-- =============================================
-- Cuotify - Esquema Inicial de Base de Datos
-- =============================================

-- =============================================
-- TABLA: profiles (Perfiles de usuario)
-- =============================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  dni TEXT UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'borrower' CHECK (role IN ('lender', 'borrower', 'both')),
  notification_preferences JSONB DEFAULT '{"email": true, "push": true, "reminder_days": 5}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para profiles
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_dni ON public.profiles(dni);
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- =============================================
-- TABLA: borrowers (Prestatarios registrados)
-- =============================================
CREATE TABLE public.borrowers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  linked_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  dni TEXT,
  email TEXT,
  full_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lender_id, dni),
  UNIQUE(lender_id, email)
);

-- Índices para borrowers
CREATE INDEX idx_borrowers_lender ON public.borrowers(lender_id);
CREATE INDEX idx_borrowers_linked_profile ON public.borrowers(linked_profile_id);
CREATE INDEX idx_borrowers_dni ON public.borrowers(dni);
CREATE INDEX idx_borrowers_email ON public.borrowers(email);

-- =============================================
-- TABLA: loans (Préstamos)
-- =============================================
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  borrower_id UUID REFERENCES public.borrowers(id) ON DELETE CASCADE NOT NULL,

  -- Detalles del préstamo
  principal_amount DECIMAL(12,2) NOT NULL CHECK (principal_amount > 0),
  interest_rate DECIMAL(5,2) NOT NULL CHECK (interest_rate >= 0),
  term_value INTEGER NOT NULL CHECK (term_value > 0),
  term_type TEXT NOT NULL CHECK (term_type IN ('weeks', 'months')),

  -- Campos calculados
  payment_amount DECIMAL(12,2) NOT NULL,
  total_interest DECIMAL(12,2) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,

  -- Fechas
  delivery_date DATE NOT NULL,
  first_payment_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Estado y configuración
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled')),
  reminder_days_before INTEGER DEFAULT 5 CHECK (reminder_days_before >= 0 AND reminder_days_before <= 30),
  color_code TEXT DEFAULT '#6366F1',
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para loans
CREATE INDEX idx_loans_lender ON public.loans(lender_id);
CREATE INDEX idx_loans_borrower ON public.loans(borrower_id);
CREATE INDEX idx_loans_status ON public.loans(status);
CREATE INDEX idx_loans_delivery_date ON public.loans(delivery_date);
CREATE INDEX idx_loans_end_date ON public.loans(end_date);

-- =============================================
-- TABLA: payments (Pagos/Cuotas)
-- =============================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE NOT NULL,

  payment_number INTEGER NOT NULL CHECK (payment_number > 0),
  due_date DATE NOT NULL,

  -- Desglose de amortización
  principal_portion DECIMAL(12,2) NOT NULL,
  interest_portion DECIMAL(12,2) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  remaining_balance DECIMAL(12,2) NOT NULL,

  -- Estado del pago
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue')),
  paid_amount DECIMAL(12,2) DEFAULT 0,
  paid_date DATE,

  -- Comentarios
  borrower_comment TEXT,
  borrower_comment_date TIMESTAMPTZ,
  lender_note TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(loan_id, payment_number)
);

-- Índices para payments
CREATE INDEX idx_payments_loan ON public.payments(loan_id);
CREATE INDEX idx_payments_due_date ON public.payments(due_date);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_pending_due ON public.payments(due_date) WHERE status = 'pending';

-- =============================================
-- TABLA: notifications (Notificaciones)
-- =============================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN (
    'payment_reminder',
    'payment_overdue',
    'payment_received',
    'borrower_comment',
    'loan_linked',
    'loan_completed'
  )),

  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,

  is_read BOOLEAN DEFAULT FALSE,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para notifications
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);

-- =============================================
-- TABLA: push_tokens (Tokens de notificación push)
-- =============================================
CREATE TABLE public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL,
  device_type TEXT CHECK (device_type IN ('ios', 'android')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Índices para push_tokens
CREATE INDEX idx_push_tokens_user ON public.push_tokens(user_id);
CREATE INDEX idx_push_tokens_active ON public.push_tokens(user_id) WHERE is_active = TRUE;

-- =============================================
-- FUNCIONES
-- =============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_borrowers_updated_at
  BEFORE UPDATE ON public.borrowers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loans_updated_at
  BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Los usuarios pueden ver su propio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Los usuarios pueden actualizar su propio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Los usuarios pueden insertar su propio perfil"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Políticas para borrowers
CREATE POLICY "Los prestamistas pueden gestionar sus prestatarios"
  ON public.borrowers FOR ALL
  USING (auth.uid() = lender_id);

CREATE POLICY "Los prestatarios vinculados pueden ver su registro"
  ON public.borrowers FOR SELECT
  USING (auth.uid() = linked_profile_id);

-- Políticas para loans
CREATE POLICY "Los prestamistas pueden gestionar sus préstamos"
  ON public.loans FOR ALL
  USING (auth.uid() = lender_id);

CREATE POLICY "Los prestatarios pueden ver sus préstamos vinculados"
  ON public.loans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.borrowers b
      WHERE b.id = loans.borrower_id
      AND b.linked_profile_id = auth.uid()
    )
  );

-- Políticas para payments
CREATE POLICY "Los prestamistas pueden gestionar pagos de sus préstamos"
  ON public.payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = payments.loan_id
      AND l.lender_id = auth.uid()
    )
  );

CREATE POLICY "Los prestatarios pueden ver pagos de sus préstamos"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      JOIN public.borrowers b ON b.id = l.borrower_id
      WHERE l.id = payments.loan_id
      AND b.linked_profile_id = auth.uid()
    )
  );

CREATE POLICY "Los prestatarios pueden agregar comentarios"
  ON public.payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      JOIN public.borrowers b ON b.id = l.borrower_id
      WHERE l.id = payments.loan_id
      AND b.linked_profile_id = auth.uid()
    )
  );

-- Políticas para notifications
CREATE POLICY "Los usuarios pueden ver sus notificaciones"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus notificaciones"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "El sistema puede crear notificaciones"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Políticas para push_tokens
CREATE POLICY "Los usuarios pueden gestionar sus tokens"
  ON public.push_tokens FOR ALL
  USING (auth.uid() = user_id);

-- =============================================
-- FUNCIÓN: Calcular pago de préstamo
-- =============================================
CREATE OR REPLACE FUNCTION calculate_loan_payment(
  p_principal DECIMAL,
  p_annual_rate DECIMAL,
  p_term_value INTEGER,
  p_term_type TEXT
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
BEGIN
  -- Determinar períodos por año
  v_periods_per_year := CASE p_term_type
    WHEN 'weeks' THEN 52
    WHEN 'months' THEN 12
  END;

  -- Calcular tasa de interés periódica
  v_periodic_rate := (p_annual_rate / 100) / v_periods_per_year;

  -- Calcular pago usando fórmula de amortización
  IF v_periodic_rate = 0 THEN
    v_payment := p_principal / p_term_value;
  ELSE
    v_payment := p_principal *
      (v_periodic_rate * POWER(1 + v_periodic_rate, p_term_value)) /
      (POWER(1 + v_periodic_rate, p_term_value) - 1);
  END IF;

  v_total := v_payment * p_term_value;

  RETURN QUERY SELECT
    ROUND(v_payment, 2),
    ROUND(v_total - p_principal, 2),
    ROUND(v_total, 2);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- FUNCIÓN: Generar cronograma de pagos
-- =============================================
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

  FOR i IN 1..v_loan.term_value LOOP
    v_interest_portion := ROUND(v_balance * v_periodic_rate, 2);
    v_principal_portion := v_loan.payment_amount - v_interest_portion;
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

-- =============================================
-- TRIGGER: Auto-generar pagos al crear préstamo
-- =============================================
CREATE OR REPLACE FUNCTION trigger_generate_payments()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM generate_payment_schedule(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_loan_insert
  AFTER INSERT ON public.loans
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_payments();

-- =============================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =============================================
COMMENT ON TABLE public.profiles IS 'Perfiles de usuarios de la aplicación';
COMMENT ON TABLE public.borrowers IS 'Prestatarios registrados por los prestamistas';
COMMENT ON TABLE public.loans IS 'Registro de préstamos';
COMMENT ON TABLE public.payments IS 'Cronograma y estado de pagos de cada préstamo';
COMMENT ON TABLE public.notifications IS 'Notificaciones del sistema para usuarios';
COMMENT ON TABLE public.push_tokens IS 'Tokens para notificaciones push';

COMMENT ON FUNCTION calculate_loan_payment IS 'Calcula el monto de pago periódico usando fórmula de amortización';
COMMENT ON FUNCTION generate_payment_schedule IS 'Genera el cronograma completo de pagos para un préstamo';
