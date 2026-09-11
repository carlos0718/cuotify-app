# Security Policy — Cuotify

> Generado por skill `rocky-spec` · Metodología: OWASP Top 10 adaptado (ver `.rocky-spec/reference/security.md` de la skill)
>
> Este archivo sigue la convención de GitHub para `SECURITY.md` (política de reporte de vulnerabilidades) y además documenta las decisiones de seguridad concretas de este proyecto — es un documento **vivo**, igual que `SPEC.md` y `design-system/MASTER.md`: se actualiza cada vez que cambia una decisión de seguridad, con su línea en "Historial de cambios".

## Reportar una vulnerabilidad

Si encontrás una vulnerabilidad de seguridad en este proyecto, por favor:

- **No** abras un issue público.
- Reportala a: cajs0718@gmail.com
- Incluí: descripción del problema, pasos para reproducirlo, y el impacto potencial si lo conocés.

Se confirma la recepción en un plazo razonable y se coordina la corrección antes de cualquier divulgación pública.

## Nivel de exigencia de este proyecto

- **Escala**: Producto real, pre-launch, pocos usuarios hoy — pensado para escalar a las stores (App Store / Google Play).
- **Maneja datos de usuarios**: sí — perfiles, DNI, teléfono, contactos (prestatarios).
- **Maneja datos sensibles/regulados**: parcialmente — datos financieros personales (montos de préstamos, historial de pagos, mora) entre particulares. No procesa pagos con tarjeta directamente (eso lo maneja RevenueCat/las stores), no es dato de salud ni de menores. Igual amerita el mismo cuidado que un dato financiero: nunca expuesto entre usuarios que no correspondan (ver RLS abajo).

## Decisiones de seguridad de este proyecto

| Área | Decisión |
|---|---|
| **Auth** | Supabase Auth (JWT gestionado por Supabase), sesión persistida en AsyncStorage vía `src/services/supabase/client.ts` |
| **Hasheo de passwords** | Delegado a Supabase Auth (bcrypt internamente) — nunca reimplementado en la app |
| **Autorización de datos** | Row Level Security en **todas** las tablas de Postgres — lenders solo ven lo propio; prestatarios solo ven préstamos donde `borrowers.linked_profile_id = auth.uid()` |
| **CORS — origin permitido** | No aplica directamente (cliente es app móvil, no navegador); las Edge Functions de Supabase (Deno) solo aceptan requests con la `anon key` del proyecto |
| **Rate limiting** | Gestionado por Supabase Auth (límites nativos de login/signup) — no hay rate limiting propio en Edge Functions todavía |
| **Dependency scanning** | No configurado todavía — pendiente, ver `TODO.md` § A8 |
| **Secrets en producción** | `EXPO_PUBLIC_*` inyectadas desde `.env` al bundlear; EAS Secrets para builds. Las keys de RevenueCat hoy están hardcodeadas en el código fuente — pendiente moverlas, ver `TODO.md` § S5 |

## Checklist OWASP aplicado a este proyecto

Estado real al 2026-09-11, según `TODO.md` § Bloque 1 (cerrado) y hallazgos pendientes de `docs/IMPROVEMENTS.md`:

- [x] A01 · Broken Access Control — RLS en todas las tablas; cerrado el UPDATE abierto de prestatarios sobre `payments` (S1) y el INSERT abierto de `notifications` (S2)
- [x] A02 · Cryptographic Failures — passwords hasheados por Supabase Auth, HTTPS forzado (Supabase + EAS)
- [x] A03 · Injection — todo el acceso a datos vía el cliente de Supabase (queries parametrizadas), sin SQL concatenado a mano
- [x] A04 · Insecure Design — el préstamo abierto (`interest_type: 'open'`) violaba 3 constraints del schema, corregido (S4); mora e interés validados en `loanCalculator.ts`
- [ ] A05 · Security Misconfiguration — falta revisar security headers de las Edge Functions y confirmar que no quede nada en modo debug en producción
- [ ] A06 · Vulnerable and Outdated Components — sin dependency scanning en CI todavía (§ A8)
- [ ] A07 · Identification and Authentication Failures — rate limiting depende 100% de los defaults de Supabase, sin política propia de password revisada
- [x] A08 · Software and Data Integrity Failures — `package-lock.json` commiteado
- [ ] A09 · Security Logging and Monitoring Failures — no hay error tracking configurado todavía (ver `OBSERVABILITY.md`, § A5 Sentry pendiente)
- [ ] A10 · SSRF — no aplica hoy (la app no hace requests salientes basados en input arbitrario del usuario), revisar si se agrega el import por IA a URLs externas

## Gestión de secrets

- **Desarrollo**: `.env` (gitignorado) + `.env.example` (commiteado, sin valores reales)
- **CI**: no configurado todavía (no hay CI, ver `TODO.md` § Setup)
- **Producción**: EAS Secrets / variables `EXPO_PUBLIC_*` inyectadas al build. Las keys de RevenueCat necesitan salir del código fuente hacia acá — § S5

## Fuera de alcance de este documento

Este checklist ayuda a que el proyecto arranque con buenas prácticas por default — **no reemplaza una auditoría de seguridad profesional**, especialmente antes de publicar en las stores con datos financieros reales de usuarios.

---

## Historial de cambios

| Fecha | Cambio | Commit |
|-------|--------|--------|
| 2026-08-10 | S1 — cerrado UPDATE abierto de prestatarios en `payments` (migración 009) | (ver git log) |
| 2026-08-10 | S2 — cerrado INSERT abierto de `notifications` (migración 010) | (ver git log) |
| 2026-08-10 | S3 — dump y sincronización del schema real con `supabase/migrations/` | (ver git log) |
| 2026-08-10 | S4 — préstamo abierto: corregidas 3 constraints violadas (migración 011) | (ver git log) |
| 2026-09-11 | Security policy inicial documentada (gate de Reanudación, `mode-resume.md`) | — |
