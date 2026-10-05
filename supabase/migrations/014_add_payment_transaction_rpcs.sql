-- L8: marcar/revertir pago + transición de estado del préstamo en una sola transacción.
-- Antes esto se hacía en 3-4 round-trips sueltos desde el cliente (src/services/supabase/loans.ts):
-- si fallaba un paso intermedio, el pago y el préstamo quedaban en estados inconsistentes.
--
-- SECURITY INVOKER (default de plpgsql): la función corre con los permisos del usuario que la
-- llama, así que las RLS existentes de `payments` y `loans` siguen aplicando sin que haya que
-- duplicar la autorización acá. NO usar SECURITY DEFINER: saltearía las RLS.

-- Marca una cuota como pagada y, si todas las del préstamo quedan pagadas, completa el préstamo.
CREATE OR REPLACE FUNCTION mark_payment_paid(
  p_payment_id   uuid,
  p_paid_amount  numeric
)
RETURNS payments
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_payment payments;
  v_all_paid boolean;
BEGIN
  -- 1. Actualizar la cuota (RETURNING trae loan_id sin un SELECT previo).
  UPDATE payments
  SET status      = 'paid',
      paid_amount = p_paid_amount,
      paid_date   = CURRENT_DATE
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Pago % no encontrado o sin permisos', p_payment_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- 2. ¿Quedan cuotas sin pagar en el préstamo?
  SELECT NOT EXISTS (
    SELECT 1 FROM payments
    WHERE loan_id = v_payment.loan_id
      AND status IS DISTINCT FROM 'paid'
  ) INTO v_all_paid;

  -- 3. Si están todas pagadas, completar el préstamo.
  IF v_all_paid THEN
    UPDATE loans SET status = 'completed' WHERE id = v_payment.loan_id;
  END IF;

  RETURN v_payment;
END;
$$;

-- Revierte una cuota a pendiente y, si el préstamo estaba completado, lo reactiva.
CREATE OR REPLACE FUNCTION revert_payment(
  p_payment_id uuid
)
RETURNS payments
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_payment payments;
BEGIN
  UPDATE payments
  SET status      = 'pending',
      paid_amount = 0,
      paid_date   = NULL
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Pago % no encontrado o sin permisos', p_payment_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Solo reactivar si estaba completado (no pisar 'defaulted'/'cancelled').
  UPDATE loans
  SET status = 'active'
  WHERE id = v_payment.loan_id
    AND status = 'completed';

  RETURN v_payment;
END;
$$;
