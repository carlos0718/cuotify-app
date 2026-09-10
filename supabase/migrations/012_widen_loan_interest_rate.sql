-- =============================================
-- Cuotify - Ampliar loans.interest_rate para evitar overflow (§ L3)
-- =============================================
-- loans/create.tsx guarda parseFloat(interestRate) * 12 (el usuario ingresa una
-- tasa MENSUAL, se guarda la anualizada) en una columna DECIMAL(5,2) (máximo
-- 999,99). La validación del formulario solo rechaza tasas mensuales > 999, sin
-- contemplar el *12: cualquier tasa mensual > 83,33% produce un
-- `numeric field overflow` de Postgres recién al insertar, después de completar
-- los 3 pasos del formulario. En el mercado de préstamos informales argentino,
-- tasas mensuales de 100%+ no son infrecuentes.
--
-- DECIMAL(8,2) soporta hasta 999.999,99 anual (~83.333% mensual), muy por encima
-- del tope de 999% mensual que ya exige la validación del formulario
-- (999 * 12 = 11.988 << 999.999,99): con la columna ampliada, el tope actual del
-- formulario ya es coherente con lo que la base acepta.

ALTER TABLE public.loans ALTER COLUMN interest_rate TYPE DECIMAL(8,2);
