-- Migración: Agregar campo de moneda a préstamos
-- Permite seleccionar entre Pesos Argentinos (ARS) y Dólares (USD)

-- Agregar campo de moneda con valor por defecto ARS
ALTER TABLE loans
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD'));

-- Comentario para documentación
COMMENT ON COLUMN loans.currency IS 'Tipo de moneda: ARS (Pesos Argentinos) o USD (Dólares)';
