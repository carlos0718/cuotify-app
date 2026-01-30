-- Migración: Agregar configuración de penalización por mora
-- Esta migración agrega campos para que el prestamista pueda configurar
-- la penalización por pagos atrasados

-- Agregar campos de configuración de penalización a la tabla loans
ALTER TABLE loans
ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS late_penalty_rate DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS late_penalty_type TEXT DEFAULT 'none' CHECK (late_penalty_type IN ('none', 'fixed', 'daily', 'weekly'));

-- Agregar campos de penalización acumulada a la tabla payments
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS penalty_amount DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS penalty_calculated_at TIMESTAMP WITH TIME ZONE;

-- Comentarios para documentación
COMMENT ON COLUMN loans.grace_period_days IS 'Días de gracia después del vencimiento antes de aplicar penalización';
COMMENT ON COLUMN loans.late_penalty_rate IS 'Porcentaje de penalización por mora (ej: 5 = 5%)';
COMMENT ON COLUMN loans.late_penalty_type IS 'Tipo de penalización: none (sin penalización), fixed (una vez), daily (por día), weekly (por semana)';
COMMENT ON COLUMN payments.penalty_amount IS 'Monto de penalización acumulada para este pago';
COMMENT ON COLUMN payments.penalty_calculated_at IS 'Última vez que se calculó la penalización';
