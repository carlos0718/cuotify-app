-- S10 (OWASP LLM10): rate limiting por usuario para las Edge Functions de análisis
-- con IA (analyze-loans-document / analyze-credit-card). Sin esto, cualquier usuario
-- autenticado puede invocarlas en loop con archivos grandes y disparar el costo de
-- Gemini sin tope. Contador diario por usuario, sin cron: la clave `usage_date`
-- hace que cada día arranque en cero sin necesidad de resetear.

CREATE TABLE IF NOT EXISTS ai_analysis_usage (
  user_id    uuid    NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  usage_date date    NOT NULL DEFAULT CURRENT_DATE,
  count      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE ai_analysis_usage ENABLE ROW LEVEL SECURITY;

-- El usuario solo puede LEER su propio uso (para mostrarlo en la app si hiciera falta).
-- No hay políticas de INSERT/UPDATE/DELETE: la tabla se toca únicamente vía la RPC
-- increment_ai_usage (SECURITY DEFINER), nunca con un write directo del cliente.
DROP POLICY IF EXISTS "ai_usage_select_own" ON ai_analysis_usage;
CREATE POLICY "ai_usage_select_own" ON ai_analysis_usage
  FOR SELECT USING (user_id = auth.uid());

-- Incrementa atómicamente el contador del día del usuario autenticado SOLO si está
-- por debajo de p_limit. Devuelve el nuevo total si se permitió, o -1 si ya se alcanzó
-- el límite (en cuyo caso no incrementa). El borde traduce el -1 a un 429.
CREATE OR REPLACE FUNCTION increment_ai_usage(p_limit integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO ai_analysis_usage (user_id, usage_date, count)
  VALUES (v_uid, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date) DO UPDATE
    SET count = ai_analysis_usage.count + 1
    WHERE ai_analysis_usage.count < p_limit
  RETURNING count INTO v_count;

  -- Si el ON CONFLICT no actualizó (ya estaba en el límite), RETURNING no trae fila
  -- y v_count queda NULL → señal de "excedido".
  RETURN COALESCE(v_count, -1);
END;
$$;
