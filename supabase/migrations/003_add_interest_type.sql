-- =============================================
-- Migración: Agregar tipo de interés a loans
-- =============================================

-- Agregar columna interest_type a la tabla loans
ALTER TABLE public.loans
ADD COLUMN interest_type TEXT DEFAULT 'simple' CHECK (interest_type IN ('simple', 'french'));

-- Actualizar la función de cálculo para soportar ambos tipos
CREATE OR REPLACE FUNCTION calculate_loan_payment(
  p_principal DECIMAL,
  p_annual_rate DECIMAL,
  p_term_value INTEGER,
  p_term_type TEXT,
  p_interest_type TEXT DEFAULT 'simple'
) RETURNS TABLE (
  payment_amount DECIMAL,
  total_interest DECIMAL,
  total_amount DECIMAL
) AS $$
DECLARE
  v_periods_per_year INTEGER;
  v_periodic_rate DECIMAL;
  v_payment DECIMAL;
  v_total DECIMAL;
  v_total_interest DECIMAL;
BEGIN
  -- Determinar períodos por año
  v_periods_per_year := CASE p_term_type
    WHEN 'weeks' THEN 52
    WHEN 'months' THEN 12
  END;

  -- Calcular tasa de interés periódica
  v_periodic_rate := (p_annual_rate / 100) / v_periods_per_year;

  IF v_periodic_rate = 0 THEN
    -- Sin interés
    v_payment := p_principal / p_term_value;
    v_total_interest := 0;
    v_total := p_principal;
  ELSIF p_interest_type = 'simple' THEN
    -- SISTEMA SIMPLE: Interés = Capital × Tasa × Plazo
    v_total_interest := p_principal * v_periodic_rate * p_term_value;
    v_total := p_principal + v_total_interest;
    v_payment := v_total / p_term_value;
  ELSE
    -- SISTEMA FRANCÉS: Cuota fija, interés sobre saldo
    v_payment := p_principal *
      (v_periodic_rate * POWER(1 + v_periodic_rate, p_term_value)) /
      (POWER(1 + v_periodic_rate, p_term_value) - 1);
    v_total := v_payment * p_term_value;
    v_total_interest := v_total - p_principal;
  END IF;

  RETURN QUERY SELECT
    ROUND(v_payment, 2),
    ROUND(v_total_interest, 2),
    ROUND(v_total, 2);
END;
$$ LANGUAGE plpgsql;

-- Actualizar la función de generación de pagos para considerar el tipo de interés
CREATE OR REPLACE FUNCTION generate_payment_schedule(p_loan_id UUID)
RETURNS VOID AS $$
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

  -- Para interés simple, el interés es igual cada cuota
  IF v_loan.interest_type = 'simple' THEN
    v_simple_interest_per_payment := v_loan.total_interest / v_loan.term_value;
  END IF;

  FOR i IN 1..v_loan.term_value LOOP
    IF v_loan.interest_type = 'simple' THEN
      -- Sistema simple: interés fijo cada cuota
      v_interest_portion := ROUND(v_simple_interest_per_payment, 2);
      v_principal_portion := ROUND(v_loan.principal_amount / v_loan.term_value, 2);
    ELSE
      -- Sistema francés: interés sobre saldo
      v_interest_portion := ROUND(v_balance * v_periodic_rate, 2);
      v_principal_portion := v_loan.payment_amount - v_interest_portion;
    END IF;

    v_balance := v_balance - v_principal_portion;

    -- Ajustar último pago para redondeo
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
$$ LANGUAGE plpgsql;

-- Agregar comentario de documentación
COMMENT ON COLUMN public.loans.interest_type IS 'Tipo de cálculo de interés: simple (interés fijo sobre capital) o french (cuota fija, interés sobre saldo)';
