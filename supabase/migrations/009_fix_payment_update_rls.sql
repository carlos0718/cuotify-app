-- =============================================
-- Cuotify - Restringir UPDATE de prestatarios sobre payments (§ S1)
-- =============================================
-- La policy "Los prestatarios pueden agregar comentarios" concede UPDATE sobre
-- TODA la fila (sin WITH CHECK), permitiendo que un prestatario marque su propia
-- cuota como pagada. Como prestamista y prestatario comparten el mismo rol
-- Postgres ("authenticated"), la restricción no puede resolverse solo con
-- GRANT por columna (eso limitaría también al prestamista). Se resuelve con:
--   1. Una policy con WITH CHECK que exige que la fila siga perteneciendo
--      al préstamo vinculado (defensa en RLS, igual que antes).
--   2. Un trigger BEFORE UPDATE que, cuando quien actualiza NO es el
--      prestamista del préstamo, verifica que solo haya tocado
--      borrower_comment / borrower_comment_date.

DROP POLICY IF EXISTS "Los prestatarios pueden agregar comentarios" ON public.payments;

CREATE POLICY "Los prestatarios pueden comentar sus cuotas"
  ON public.payments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.loans l
    JOIN public.borrowers b ON b.id = l.borrower_id
    WHERE l.id = payments.loan_id AND b.linked_profile_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.loans l
    JOIN public.borrowers b ON b.id = l.borrower_id
    WHERE l.id = payments.loan_id AND b.linked_profile_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.enforce_borrower_payment_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_lender BOOLEAN;
BEGIN
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

DROP TRIGGER IF EXISTS enforce_borrower_payment_columns_trigger ON public.payments;
CREATE TRIGGER enforce_borrower_payment_columns_trigger
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_borrower_payment_columns();
