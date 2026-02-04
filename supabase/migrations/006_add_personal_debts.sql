-- =============================================
-- MIGRACIÓN: Sistema de Deudas/Gastos Personales
-- Descripción: Permite a los usuarios registrar sus propias deudas
--              para llevar control personal de lo que deben
-- =============================================

-- TABLA: personal_debts (Deudas personales del usuario)
-- =============================================
CREATE TABLE public.personal_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  -- Información del acreedor (a quién le debe)
  creditor_name TEXT NOT NULL,
  creditor_phone TEXT,
  description TEXT,

  -- Detalles del préstamo
  principal_amount DECIMAL(10, 2) NOT NULL CHECK (principal_amount > 0),
  interest_rate DECIMAL(5, 2) NOT NULL DEFAULT 0 CHECK (interest_rate >= 0),
  interest_type TEXT NOT NULL DEFAULT 'simple' CHECK (interest_type IN ('simple', 'french')),

  -- Plazo
  term_value INT NOT NULL CHECK (term_value > 0),
  term_type TEXT NOT NULL CHECK (term_type IN ('weeks', 'months')),

  -- Moneda
  currency TEXT NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),

  -- Fechas
  first_payment_date DATE NOT NULL,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Penalizaciones por mora
  late_penalty_type TEXT NOT NULL DEFAULT 'none' CHECK (late_penalty_type IN ('none', 'fixed', 'daily', 'weekly')),
  late_penalty_rate DECIMAL(5, 2) DEFAULT 0 CHECK (late_penalty_rate >= 0),
  grace_period_days INT DEFAULT 0 CHECK (grace_period_days >= 0),

  -- Totales calculados
  total_amount DECIMAL(10, 2) NOT NULL,
  installment_amount DECIMAL(10, 2) NOT NULL,

  -- Estado
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),

  -- Personalización
  color_code TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para personal_debts
CREATE INDEX idx_personal_debts_user ON public.personal_debts(user_id);
CREATE INDEX idx_personal_debts_status ON public.personal_debts(status);
CREATE INDEX idx_personal_debts_first_payment ON public.personal_debts(first_payment_date);

-- =============================================
-- TABLA: debt_payments (Pagos de deudas personales)
-- =============================================
CREATE TABLE public.debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID REFERENCES public.personal_debts(id) ON DELETE CASCADE NOT NULL,

  -- Información del pago
  payment_number INT NOT NULL,
  due_date DATE NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  principal_amount DECIMAL(10, 2) NOT NULL,
  interest_amount DECIMAL(10, 2) NOT NULL,

  -- Penalizaciones
  penalty_amount DECIMAL(10, 2) DEFAULT 0,

  -- Estado del pago
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  paid_date DATE,
  paid_amount DECIMAL(10, 2),

  -- Notas
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para debt_payments
CREATE INDEX idx_debt_payments_debt ON public.debt_payments(debt_id);
CREATE INDEX idx_debt_payments_status ON public.debt_payments(status);
CREATE INDEX idx_debt_payments_due_date ON public.debt_payments(due_date);

-- =============================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- =============================================

-- Habilitar RLS
ALTER TABLE public.personal_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

-- Políticas para personal_debts: Solo el usuario puede gestionar sus propias deudas
CREATE POLICY "Los usuarios pueden gestionar sus deudas personales"
  ON public.personal_debts FOR ALL
  USING (auth.uid() = user_id);

-- Políticas para debt_payments: Solo el usuario puede gestionar pagos de sus deudas
CREATE POLICY "Los usuarios pueden gestionar pagos de sus deudas"
  ON public.debt_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.personal_debts d
      WHERE d.id = debt_payments.debt_id
      AND d.user_id = auth.uid()
    )
  );

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger para actualizar updated_at en personal_debts
CREATE TRIGGER update_personal_debts_updated_at
  BEFORE UPDATE ON public.personal_debts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para actualizar updated_at en debt_payments
CREATE TRIGGER update_debt_payments_updated_at
  BEFORE UPDATE ON public.debt_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FUNCIÓN: Generar cronograma de pagos para deuda personal
-- =============================================
CREATE OR REPLACE FUNCTION generate_debt_payment_schedule(
  p_debt_id UUID,
  p_principal DECIMAL,
  p_interest_rate DECIMAL,
  p_interest_type TEXT,
  p_term_value INT,
  p_term_type TEXT,
  p_first_payment_date DATE
) RETURNS VOID AS $$
DECLARE
  v_installment_amount DECIMAL;
  v_total_amount DECIMAL;
  v_remaining_balance DECIMAL;
  v_payment_date DATE;
  v_period_days INT;
  i INT;
BEGIN
  -- Calcular días entre pagos
  IF p_term_type = 'weeks' THEN
    v_period_days := 7;
  ELSE
    v_period_days := 30;
  END IF;

  -- Calcular monto de cuota según tipo de interés
  IF p_interest_type = 'simple' THEN
    -- Interés Simple: Total con interés dividido por número de cuotas
    v_total_amount := p_principal * (1 + (p_interest_rate / 100));
    v_installment_amount := v_total_amount / p_term_value;

    -- Crear pagos con interés distribuido uniformemente
    FOR i IN 1..p_term_value LOOP
      v_payment_date := p_first_payment_date + ((i - 1) * v_period_days);

      INSERT INTO public.debt_payments (
        debt_id,
        payment_number,
        due_date,
        total_amount,
        principal_amount,
        interest_amount,
        status
      ) VALUES (
        p_debt_id,
        i,
        v_payment_date,
        v_installment_amount,
        p_principal / p_term_value,
        (v_total_amount - p_principal) / p_term_value,
        'pending'
      );
    END LOOP;

  ELSE
    -- Sistema Francés: Cuota fija con amortización
    v_installment_amount := (p_principal * (p_interest_rate / 100)) /
                           (1 - POWER(1 + (p_interest_rate / 100), -p_term_value));
    v_remaining_balance := p_principal;

    FOR i IN 1..p_term_value LOOP
      DECLARE
        v_interest DECIMAL;
        v_principal DECIMAL;
      BEGIN
        v_payment_date := p_first_payment_date + ((i - 1) * v_period_days);
        v_interest := v_remaining_balance * (p_interest_rate / 100);
        v_principal := v_installment_amount - v_interest;

        INSERT INTO public.debt_payments (
          debt_id,
          payment_number,
          due_date,
          total_amount,
          principal_amount,
          interest_amount,
          status
        ) VALUES (
          p_debt_id,
          i,
          v_payment_date,
          v_installment_amount,
          v_principal,
          v_interest,
          'pending'
        );

        v_remaining_balance := v_remaining_balance - v_principal;
      END;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- FUNCIÓN: Actualizar estado de deuda al completar pagos
-- =============================================
CREATE OR REPLACE FUNCTION check_debt_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Si todos los pagos están pagados, marcar deuda como completada
  IF NOT EXISTS (
    SELECT 1 FROM public.debt_payments
    WHERE debt_id = NEW.debt_id
    AND status != 'paid'
  ) THEN
    UPDATE public.personal_debts
    SET status = 'completed'
    WHERE id = NEW.debt_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar estado de deuda
CREATE TRIGGER debt_completion_check
  AFTER UPDATE OF status ON public.debt_payments
  FOR EACH ROW
  WHEN (NEW.status = 'paid')
  EXECUTE FUNCTION check_debt_completion();
