// Variables de entorno dummy para tests. El cliente real de Supabase
// (src/services/supabase/client.ts) requiere una URL/anon key válidas para
// construirse, aunque las requests nunca salgan a la red (las intercepta msw).
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
