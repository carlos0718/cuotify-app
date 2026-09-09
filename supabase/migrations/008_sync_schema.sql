-- =============================================
-- Cuotify - Sincronización de schema real (§ S3)
-- =============================================
-- Este archivo documenta objetos que ya existen en la base de producción
-- (aplicados manualmente en algún momento vía dashboard) pero que nunca
-- quedaron registrados en una migración versionada. Es idempotente: correrlo
-- contra una base que ya tiene estos objetos no debe fallar.

-- ---------------------------------------------
-- 1. Columna transfer_proof_url en loans
-- ---------------------------------------------
ALTER TABLE public.loans
ADD COLUMN IF NOT EXISTS transfer_proof_url TEXT;

-- ---------------------------------------------
-- 2. Columna transfer_proof_url en personal_debts
-- ---------------------------------------------
ALTER TABLE public.personal_debts
ADD COLUMN IF NOT EXISTS transfer_proof_url TEXT;

-- ---------------------------------------------
-- 3. Tabla notification_preferences (preferencias de notificación por usuario)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_days_before INTEGER NOT NULL DEFAULT 3,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_preferences'
      AND policyname = 'Users can manage own preferences'
  ) THEN
    CREATE POLICY "Users can manage own preferences"
      ON public.notification_preferences
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------
-- 4. Policy de lectura de profiles entre usuarios
-- ---------------------------------------------
-- Necesaria para: vincular prestatarios por DNI (loans.ts getOrCreateBorrower)
-- y mostrarle al prestatario el nombre de su prestamista (loans.ts:310).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Profiles are viewable by authenticated users'
  ) THEN
    CREATE POLICY "Profiles are viewable by authenticated users"
      ON public.profiles FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
