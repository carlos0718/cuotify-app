-- =============================================
-- Cuotify - Soporte real para préstamo abierto (§ S4)
-- =============================================
-- loans/create.tsx ya ofrece interest_type = 'open' en el paso 2 del formulario,
-- pero el insert viola tres constraints de la tabla real:
--   - term_value: 0            viola CHECK (term_value > 0)
--   - end_date: null           viola NOT NULL
--   - interest_type: 'open'    viola CHECK (... IN ('simple', 'french'))
-- Hoy la creación de un préstamo abierto falla en el INSERT.

-- 1. term_value y end_date pasan a ser nullable (un préstamo abierto no tiene
--    plazo fijo ni fecha de fin conocida de antemano).
ALTER TABLE public.loans ALTER COLUMN term_value DROP NOT NULL;
ALTER TABLE public.loans ALTER COLUMN end_date DROP NOT NULL;

ALTER TABLE public.loans DROP CONSTRAINT IF EXISTS loans_term_value_check;
ALTER TABLE public.loans ADD CONSTRAINT loans_term_value_check
  CHECK (term_value IS NULL OR term_value > 0);

ALTER TABLE public.loans DROP CONSTRAINT IF EXISTS loans_interest_type_check;
ALTER TABLE public.loans ADD CONSTRAINT loans_interest_type_check
  CHECK (interest_type = ANY (ARRAY['simple', 'french', 'open']));

-- 2. El trigger after_loan_insert corre generate_payment_schedule() para
--    cualquier préstamo nuevo. Con term_value NULL el `FOR i IN 1..NULL LOOP`
--    de la función revienta ("NULL is not allowed"), así que hay que salir
--    antes para préstamos abiertos: no tienen cronograma fijo, sus pagos se
--    registran manualmente cuando corresponda (fuera del alcance de este fix).
CREATE OR REPLACE FUNCTION public.generate_payment_schedule("p_loan_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_loan RECORD;
  v_balance DECIMAL;
  v_periodic_rate DECIMAL;
  v_periods_per_year INTEGER;
  v_interest_portion DECIMAL;
  v_principal_portion DECIMAL;
  v_current_date DATE;
  v_interval INTERVAL;
  v_simple_interest_per_payment DECIMAL;
BEGIN
  SELECT * INTO v_loan FROM public.loans WHERE id = p_loan_id;

  -- Préstamo abierto: sin plazo fijo, sin cronograma que generar.
  IF v_loan.term_value IS NULL THEN
    RETURN;
  END IF;

  v_periods_per_year := CASE v_loan.term_type
    WHEN 'weeks' THEN 52
    WHEN 'months' THEN 12
  END;

  v_periodic_rate := (v_loan.interest_rate / 100) / v_periods_per_year;
  v_balance := v_loan.principal_amount;
  v_current_date := v_loan.first_payment_date;
  v_interval := CASE v_loan.term_type
    WHEN 'weeks' THEN INTERVAL '1 week'
    WHEN 'months' THEN INTERVAL '1 month'
  END;

  IF COALESCE(v_loan.interest_type, 'simple') = 'simple' THEN
    v_simple_interest_per_payment := v_loan.total_interest / v_loan.term_value;
  END IF;

  FOR i IN 1..v_loan.term_value LOOP
    IF COALESCE(v_loan.interest_type, 'simple') = 'simple' THEN
      v_interest_portion := ROUND(v_simple_interest_per_payment, 2);
      v_principal_portion := ROUND(v_loan.principal_amount / v_loan.term_value, 2);
    ELSE
      v_interest_portion := ROUND(v_balance * v_periodic_rate, 2);
      v_principal_portion := v_loan.payment_amount - v_interest_portion;
    END IF;

    v_balance := v_balance - v_principal_portion;

    IF i = v_loan.term_value THEN
      v_principal_portion := v_principal_portion + v_balance;
      v_balance := 0;
    END IF;

    INSERT INTO public.payments (
      loan_id, payment_number, due_date,
      principal_portion, interest_portion, total_amount, remaining_balance
    ) VALUES (
      p_loan_id, i, v_current_date,
      v_principal_portion, v_interest_portion, v_loan.payment_amount,
      GREATEST(v_balance, 0)
    );

    v_current_date := v_current_date + v_interval;
  END LOOP;
END;
$$;
