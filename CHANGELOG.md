# Changelog

Todos los cambios notables de Cuotify se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/), y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/) (ver `.rocky-spec/reference/versioning.md` de la skill `rocky-spec` para el criterio completo de qué entra acá y cómo se decide cada bump de versión).

> Este proyecto no tenía `CHANGELOG.md` ni tags de git al generarse este archivo (2026-09-11) — no hay historial de releases que reconstruir. Arranca en `[Unreleased]` con el estado real acumulado hasta ahora; de acá en más, cada `feat`/`fix`/breaking change agrega su línea en el mismo commit que el código, ver `AGENTS.md`/`CLAUDE.md` sección "Commit convention".

## [Unreleased]

### Added
- `ErrorBoundary` en el layout raíz y en `(main)`, con fallback compartido y botón de reintentar — antes un error de render dejaba la app en blanco (A4)

### Changed

### Deprecated

### Removed

### Fixed
- Prestatario podía marcar sus propias cuotas como pagadas — cerrado con RLS (S1)
- Cualquier usuario podía insertar notificaciones para otro usuario — cerrado con RLS (S2)
- Préstamo abierto (`interest_type: 'open'`) violaba 3 constraints del schema — corregido de punta a punta (S4)
- `interest_rate` desbordaba con tasas mensuales altas (>83%) — columna ampliada a `DECIMAL(8,2)` (L3)
- `formatCurrency` no pasaba la moneda real en `loans/[id].tsx` y `calendar/index.tsx`, mostraba préstamos en USD como si fueran ARS (L1)
- Stats de prestamista/prestatario mezclaban montos de distintas monedas — separadas por moneda en dashboard, préstamos y deudas (L2)
- Faltaba filtro por `lender_id` en `getActiveLoans`, `getUpcomingPayments` y `getOverduePayments` (L4)
- `validateEmail` rechazaba dominios válidos no listados (`.tech`, `.ai`, etc.) por una allowlist cerrada de TLDs, y tenía una clave duplicada sin efecto en `COMMON_TLD_TYPOS` — ahora los TLDs desconocidos solo generan una advertencia no bloqueante (L12)
- `onAuthStateChange` tipaba la sesión como `unknown`, obligando a castear en `authStore.ts` sin garantía real — ahora usa el tipo `Session | null` de `@supabase/supabase-js` (L14)
- CI en rojo por 10 errores de lint: funciones usadas en un `useEffect` antes de declararse en `reset-password.tsx`, `customer-center.tsx`, `premium.tsx` y `Toast.tsx` (L18); refs leídas durante el render en `Toast.tsx` (L19); falso positivo de `react-hooks/set-state-in-effect` en `reset-password.tsx`, suprimido con comentario (L20)

### Security
- Dump y sincronización del schema real de Supabase con `supabase/migrations/`, que estaba desactualizado (S3)
- API key de RevenueCat hardcodeada en el código fuente — movida a `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY` en `.env` (S5)

## [1.0.2] - 2026-08-10 (pre-launch, sin tag de git)

### Added
- Setup completo del proyecto: Expo + TypeScript + Expo Router, Supabase (Auth + Postgres + Storage + Edge Functions), Zustand, RevenueCat, EAS Build
- Alta de préstamos en 3 pasos (borrower → términos → mora/preview), sistemas de interés simple y francés
- Deudas personales con cronograma vía RPC
- Notificaciones push, centro de notificaciones, recordatorios locales
- Dashboard con stats de prestamista y prestatario, export PDF/CSV (Pro), recordatorio por WhatsApp (Pro)
- Import de préstamos y resúmenes de tarjeta por IA
- Adopción del proyecto con skill `rocky-spec`: `SPEC.md`, `AGENTS.md`/`CLAUDE.md`, `TODO.md`, `design-system/MASTER.md`, `docs/IMPROVEMENTS.md`

> Nota: `package.json` declara `1.0.2` y `app.json` declara `1.0.1` — desincronizados, ver `TODO.md` § A9. Esta entrada usa la versión de `package.json`; corregir la discrepancia antes del próximo release real.
