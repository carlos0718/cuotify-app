-- Migración 013: Recálculo automático de mora por cron (pg_cron)
-- Resuelve el finding L7.
--
-- Estado previo: la mora solo se persistía al llamar updateLoanPenalties() /
-- updatePaymentPenalty() — hoy código muerto (solo referenciado en tests). En la
-- práctica payments.penalty_amount queda en cero y el dashboard, el calendario y
-- las notificaciones (que leen el valor persistido) muestran datos desactualizados.
-- La pantalla de detalle calculaba la mora en vivo con TS sin persistirla.
--
-- Camino A (única fuente de verdad en SQL): el cálculo vive en una función de
-- Postgres que un cron diario corre sobre todos los pagos vencidos en un solo
-- UPDATE set-based (sin el loop de N updates que tenía updateLoanPenalties).

-- 1. Extensión pg_cron (ya habilitada en el proyecto; IF NOT EXISTS = idempotente)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Función de recálculo de mora.
--    Replica exactamente calculateLatePenalty() de loanCalculator.ts:
--      daysOverdue    = CURRENT_DATE - due_date
--      daysAfterGrace = daysOverdue - grace_period_days
--      fixed:  monto * tasa%
--      daily:  monto * tasa% * daysAfterGrace
--      weekly: monto * tasa% * ceil(daysAfterGrace / 7)
--    status: pending -> overdue en cuanto CURRENT_DATE > due_date (incluso en gracia),
--            igual que el newStatus de updateLoanPenalties.
--    p_loan_id NULL     = todos los préstamos (uso del cron diario)
--    p_loan_id puntual  = un solo préstamo (refresco on-demand desde el detalle)
CREATE OR REPLACE FUNCTION public.recalculate_overdue_penalties(p_loan_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.payments p
  SET
    penalty_amount = CASE
      WHEN l.late_penalty_type = 'none'
        THEN 0
      WHEN (CURRENT_DATE - p.due_date) - l.grace_period_days <= 0
        THEN 0
      WHEN l.late_penalty_type = 'fixed'
        THEN ROUND(p.total_amount * (l.late_penalty_rate / 100.0), 2)
      WHEN l.late_penalty_type = 'daily'
        THEN ROUND(
          p.total_amount * (l.late_penalty_rate / 100.0)
          * ((CURRENT_DATE - p.due_date) - l.grace_period_days), 2)
      WHEN l.late_penalty_type = 'weekly'
        THEN ROUND(
          p.total_amount * (l.late_penalty_rate / 100.0)
          * CEIL(((CURRENT_DATE - p.due_date) - l.grace_period_days)::numeric / 7.0), 2)
      ELSE 0
    END,
    penalty_calculated_at = now(),
    status = CASE
      WHEN p.status = 'pending' AND CURRENT_DATE > p.due_date THEN 'overdue'
      ELSE p.status
    END
  FROM public.loans l
  WHERE p.loan_id = l.id
    AND p.status IN ('pending', 'overdue')
    AND CURRENT_DATE > p.due_date
    AND l.status NOT IN ('completed', 'cancelled')
    AND (p_loan_id IS NULL OR p.loan_id = p_loan_id)
    -- Guarda de autorización: la función es SECURITY DEFINER (bypasa RLS), necesario
    -- para que el cron recorra todos los préstamos (p_loan_id NULL, auth.uid() NULL).
    -- En el llamado on-demand del cliente (p_loan_id puntual), solo deja recalcular
    -- préstamos del propio prestamista — así nadie recalcula mora de préstamos ajenos.
    AND (p_loan_id IS NULL OR l.lender_id = auth.uid());
$$;

COMMENT ON FUNCTION public.recalculate_overdue_penalties(uuid) IS
  'Recalcula penalty_amount y status (pending->overdue) de los pagos vencidos. '
  'Única fuente de verdad del cálculo de mora (camino A, finding L7). '
  'p_loan_id NULL = todos (cron diario); puntual = un préstamo (refresco on-demand).';

-- 3. Ajustar el trigger de S1 (migración 009) para permitir el contexto de sistema.
--    El trigger enforce_borrower_payment_columns bloquea cambios a columnas que no sean
--    el comentario cuando quien edita no es el prestamista. El cron y el backfill de esta
--    migración corren SIN contexto de auth (auth.uid() = NULL), así que v_is_lender queda
--    NULL -> COALESCE(NULL, false) = false -> bloquea el UPDATE de penalty_amount/status.
--    Se agrega un bypass para auth.uid() IS NULL (cron / backfill / migración / funciones
--    SECURITY DEFINER de sistema). NO reabre S1: un prestatario siempre tiene auth.uid()
--    no-nulo, así que sigue sujeto a la restricción de columnas. Un cliente anónimo nunca
--    llega al trigger porque la RLS de payments exige auth.uid() antes.
CREATE OR REPLACE FUNCTION public.enforce_borrower_payment_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_lender BOOLEAN;
BEGIN
  -- Contexto de sistema (cron, backfill, migración, funciones SECURITY DEFINER sin JWT):
  -- no hay usuario que restringir. La RLS ya filtró cualquier cliente no autenticado.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT (l.lender_id = auth.uid()) INTO v_is_lender
  FROM public.loans l
  WHERE l.id = NEW.loan_id;

  -- El prestamista puede modificar la fila entera; solo se restringe
  -- a quien la edita como prestatario (o cualquier otro actor no identificado
  -- como prestamista, que en ese caso no debería llegar hasta acá por RLS).
  IF COALESCE(v_is_lender, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.status               IS DISTINCT FROM OLD.status
     OR NEW.paid_amount        IS DISTINCT FROM OLD.paid_amount
     OR NEW.paid_date          IS DISTINCT FROM OLD.paid_date
     OR NEW.principal_portion  IS DISTINCT FROM OLD.principal_portion
     OR NEW.interest_portion   IS DISTINCT FROM OLD.interest_portion
     OR NEW.total_amount       IS DISTINCT FROM OLD.total_amount
     OR NEW.remaining_balance  IS DISTINCT FROM OLD.remaining_balance
     OR NEW.lender_note        IS DISTINCT FROM OLD.lender_note
     OR NEW.penalty_amount     IS DISTINCT FROM OLD.penalty_amount
     OR NEW.penalty_calculated_at IS DISTINCT FROM OLD.penalty_calculated_at
  THEN
    RAISE EXCEPTION 'Un prestatario solo puede modificar el comentario de su cuota';
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Agendar el cron diario a las 06:00 UTC (≈ 03:00 ART).
--    cron.schedule con el mismo jobname es idempotente en pg_cron 1.6+ (reescribe
--    el job existente en vez de duplicarlo), así que re-aplicar la migración es seguro.
SELECT cron.schedule(
  'recalculate-overdue-penalties',
  '0 6 * * *',
  $$ SELECT public.recalculate_overdue_penalties(); $$
);

-- 5. Backfill inmediato: corregir de una los pagos ya vencidos al aplicar la migración,
--    sin esperar a la primera corrida del cron.
SELECT public.recalculate_overdue_penalties();
