-- =============================================
-- Cuotify - Cerrar el INSERT abierto de notifications (§ S2)
-- =============================================
-- "El sistema puede crear notificaciones" ON notifications FOR INSERT WITH CHECK (true)
-- permite que cualquier usuario autenticado (o anon) inserte notificaciones con
-- título/cuerpo arbitrarios en la bandeja de cualquier otro usuario.
--
-- Verificado que ningún código cliente inserta en esta tabla: el único escritor
-- real es la Edge Function send-payment-reminders, que usa la service_role key
-- (bypassea RLS por completo). El centro de notificaciones de la app
-- (src/app/(main)/notifications/index.tsx) tampoco lee de esta tabla: arma la
-- lista en el cliente a partir de payments. La policy no cumple ninguna función
-- legítima hoy, así que se elimina en lugar de acotarla con WITH CHECK.

DROP POLICY IF EXISTS "El sistema puede crear notificaciones" ON public.notifications;
