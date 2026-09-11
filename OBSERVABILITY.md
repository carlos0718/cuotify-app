# Observability — Cuotify

> Generado por skill `rocky-spec` · Ver `.rocky-spec/reference/observability.md` de la skill para el detalle completo de cada decisión. Documento vivo — se actualiza cada vez que cambia una decisión de observabilidad, con su línea en "Historial de cambios".
>
> Seguridad (`SECURITY.md`) responde "¿alguien está atacando esto?". Este archivo responde **"¿esto está funcionando bien ahora mismo, y si no, por qué?"**.

## Nivel de exigencia de este proyecto

- **Escala**: Producto real, pre-launch, pocos usuarios hoy — pero con lógica financiera (mora, cronogramas de pago) donde un bug silencioso es costoso de detectar tarde.

## Decisiones de este proyecto

Cuotify es una app móvil (Expo/React Native) sin servidor propio — el único backend es Supabase (Postgres + Edge Functions Deno). El modelo de "health check HTTP" del template no aplica tal cual; se adapta así:

| Área | Decisión |
|---|---|
| **Error tracking (cliente)** | No configurado todavía — pendiente, ver `TODO.md` § A5 (Sentry para crash reporting) |
| **Error tracking (Edge Functions)** | No configurado — logs solo vía `supabase functions logs` |
| **Logging (cliente)** | `console.log`/`console.error` sueltos (11 apariciones detectadas por `rocky check code .` — bajo volumen, no es un hallazgo urgente todavía, pero crece con cada feature nueva) |
| **Dónde van los logs** | Metro/Expo dev tools en desarrollo; sin captura estructurada en producción todavía (justamente lo que resuelve Sentry) |
| **"Health check"** | No aplica un endpoint HTTP propio — el equivalente es confirmar que las Edge Functions (`send-payment-reminders`) responden y que el trigger `after_loan_insert` sigue generando cronogramas correctamente. Sin monitoreo automático de esto hoy |
| **Uptime monitoring** | No aplica directamente (no hay servidor propio) — la disponibilidad depende del status de Supabase; considerar suscribirse a status.supabase.com si se vuelve crítico |
| **Métricas de negocio** | Dashboard nativo de la app (stats de prestamista/prestatario) — no hay métricas de producto (analytics de uso) configuradas |

## Setup pendiente

- [ ] Sentry (o equivalente) inicializado en el cliente — captura de crashes y errores no manejados (`TODO.md` § A5)
- [ ] `ErrorBoundary` en los layouts raíz para que un crash de un screen no tire toda la app (`TODO.md` § A4)
- [ ] Reemplazar `console.log` sueltos por un logger mínimo con niveles (debug/info/warn/error) a medida que se toca cada archivo — no hace falta una migración masiva de una sola vez
- [ ] Revisar logs de `send-payment-reminders` cuando se agregue el schedule automático (`TODO.md`, sección Notificaciones)

## Qué nunca loguear

Passwords, tokens de sesión completos, montos exactos de préstamos de terceros en logs compartidos, DNI/teléfono de prestatarios — ver `.rocky-spec/reference/security.md` de la skill. Si hace falta debuggear la presencia de un valor sensible, loguear `Boolean(valor)`, nunca el valor.

---

## Historial de cambios

| Fecha | Cambio | Commit |
|-------|--------|--------|
| 2026-09-11 | Observability inicial documentada (gate de Reanudación, `mode-resume.md`) — sin error tracking ni logging estructurado todavía | — |
