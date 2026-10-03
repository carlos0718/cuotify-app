# TODO — Cuotify

> Estado real al 2026-08-10 (adopción con `/charlydev-flow`). Etapa: **pre-launch**.
> Las features salen de `SPEC.md`; la deuda técnica y las mejoras, de `docs/IMPROVEMENTS.md`.
> **Convención:** 1 tarea completada = 1 commit + push. Al cerrar una sección, actualizar `SPEC.md`.

> **Nota (drift de contenido, 2026-10-02):** `rocky check drift` marca como "faltantes" las secciones
> "Features iniciales", "Calidad" y "Estado por grupo" del template de `rocky-spec` — no son gaps reales.
> "Features iniciales" está repartida por dominio (`Dominio / DB`, `Auth e identidad`, `Préstamos`,
> `Deudas personales`, `Notificaciones`, `Dashboard y reportes`, `Monetización`, `Infraestructura / Deploy`,
> `Seguridad`, `Observabilidad`) en vez de un bloque único, por decisión de `AGENTS.md`. "Calidad" está
> dentro de `## Setup` (ESLint, typecheck, Jest, CI). "Estado por grupo" es una tabla del modo orquestador
> (`todos/<grupo>.md`); este proyecto usa `TODO.md` único, así que no aplica.

---

## Setup

- [x] Proyecto Expo + TypeScript + Expo Router
- [x] Supabase (Auth + Postgres + Storage + Edge Functions)
- [x] Zustand (auth, preferences, subscription)
- [x] Design tokens en `src/theme/`
- [x] EAS Build configurado (`eas.json`)
- [x] RevenueCat integrado
- [x] ESLint + `typecheck` en scripts de npm — ver `IMPROVEMENTS.md` § A8
      (`npx expo lint` configuró `eslint-config-expo`; `tsc --noEmit` excluye
      `supabase/functions/` en `tsconfig.json` porque son Edge Functions Deno,
      no código Node/Expo. Encontraron 62 problemas de lint y 6 errores de tipos
      reales — quedan como tareas nuevas L14-L17 en el Bloque 3, L12 ya estaba)
- [x] Jest (`jest-expo`) configurado — preset en `package.json`, primer smoke test en
      `src/services/calculations/__tests__/loanCalculator.test.ts`. `@react-native/jest-preset`
      quedó pineado a `0.86.3` (exacto, no caret) para que coincida con la versión real de
      `react-native` — `expo install` resolvió `^0.87.1` y rompía el preset
- [x] CI en GitHub Actions (lint + typecheck + test) — `.github/workflows/ci.yml`, corre en
      push/PR a `master`/`development`. El primer run va a salir en 🔴 por la deuda ya
      conocida (L12, L14-L18) — es esperado, no un problema de la config del workflow
- [x] Crear rama `development` desde `master` — GitFlow simplificado adoptado (ver `AGENTS.md` § "Branching — GitFlow simplificado")

## Dominio / DB

- [x] Schema inicial: profiles, borrowers, loans, payments, notifications, push_tokens
- [x] RLS habilitado en todas las tablas
- [x] Trigger `after_loan_insert` que genera el cronograma
- [x] Trigger de creación automática de perfil al registrarse
- [x] Migraciones 003-007: interest_type, mora, moneda, deudas personales, RPC de intereses
- [x] 🔴 **Dump del schema real y sincronizar `supabase/migrations/`** — § S3
- [x] 🔴 Migración 011: soporte real de `interest_type: 'open'` (term_value / end_date nullable) — § S4
- [x] 🔴 Migración 009: cerrar el UPDATE de prestatarios en `payments` — § S1
      (no con column grants — prestamista y prestatario comparten el rol `authenticated`;
      se resolvió con un trigger `BEFORE UPDATE` que solo permite editar
      `borrower_comment`/`borrower_comment_date` cuando quien edita no es el lender)
- [x] 🔴 Migración 010: cerrar el INSERT abierto de notificaciones — § S2
- [x] 🔴 Migración 012: `interest_rate` a `DECIMAL(8,2)` — § L3
- [x] Regenerar `database.types.ts` contra el schema real — § A7
- [x] Cron (`pg_cron`) que recalcule mora diariamente — § L7
      (migración `013_add_penalty_cron.sql`: función SQL `recalculate_overdue_penalties`
      como única fuente de verdad del cálculo + cron diario 06:00 UTC + backfill inmediato.
      `updateLoanPenalties` pasó a wrapper del RPC; `updatePaymentPenalty` eliminada (muerta);
      el detalle muestra el `penalty_amount` persistido. La migración también amplió el trigger
      de S1 con un bypass de contexto de sistema (`auth.uid() IS NULL`) para que el cron/backfill
      no fueran bloqueados. Aplicada a la DB el 2026-10-03 vía `supabase db push`)
- [ ] RPC transaccional `mark_payment_paid` / `revert_payment` — § L8

## Auth e identidad

- [x] Registro, login, persistencia de sesión
- [x] Recuperación de contraseña por código OTP
- [x] Edición de perfil
- [x] Bloqueo biométrico
- [x] 🔴 Eliminación de cuenta — § S8 (falta todavía publicar la política de
      privacidad en una URL pública, ver Bloque 2)
- [ ] Login con Google / Apple

## Préstamos

- [x] Alta en 3 pasos con preview del cronograma
- [x] Deduplicación de prestatarios (DNI → teléfono)
- [x] Vinculación automática con cuentas de la app por DNI
- [x] Sistemas simple y francés
- [x] Moneda ARS / USD por préstamo
- [x] Mora configurable (tipo, tasa, gracia)
- [x] Comprobante de transferencia
- [x] Colores pastel secuenciales
- [x] Detalle con cronograma, marcar y revertir cuotas
- [x] Baja de préstamos completados
- [x] Import por IA desde documento
- [ ] 🟡 Préstamo abierto: falta poder registrar pagos ad-hoc (creación y detalle ya
      funcionan de punta a punta desde la migración 011; no hay UI/servicio para
      agregar un pago suelto a un préstamo sin cronograma fijo)
- [ ] Registrar **pago parcial** (el estado `partial` ya existe en el schema) — § P1
- [ ] Transiciones a `defaulted` y `cancelled`
- [ ] Recibo individual por cuota, compartible — § P2

## Deudas personales

- [x] Alta de deuda con cronograma vía RPC
- [x] Marcar / revertir cuotas
- [x] Import de resumen de tarjeta con IA
- [x] Baja de deudas completadas o canceladas
- [x] Vista de préstamos vinculados en solo lectura

## Notificaciones

- [x] Push tokens por dispositivo
- [x] Recordatorios locales por cuota
- [x] Centro de notificaciones con badge
- [x] Preferencias por usuario
- [x] Edge Function `send-payment-reminders`
- [ ] Schedule automático que dispare la Edge Function
- [ ] Avisar al prestamista cuando el prestatario comenta una cuota

## Dashboard y reportes

- [x] Stats de prestamista y de prestatario
- [x] Export PDF del cronograma (Pro)
- [x] Export CSV (Pro)
- [x] Recordatorio por WhatsApp (Pro)
- [ ] Gráfico de intereses por mes (la RPC `get_monthly_interest_earned` ya existe)
- [ ] Reporte de morosidad por prestatario — § P3

## Monetización

- [x] RevenueCat: paywall y Customer Center nativos
- [x] Guards de límite en préstamos y deudas
- [ ] Guard del límite de prestatarios (`FREE_LIMITS.borrowers` no se aplica)
- [ ] Keys de RevenueCat a variables de entorno — § S5
- [ ] Productos en App Store Connect y Google Play Console
- [ ] Paywall diseñado en el dashboard de RevenueCat
- [ ] Validación server-side del entitlement — § S6

## Infraestructura / Deploy

- [x] EAS Build configurado (perfiles `development`, `preview`, `preview-apk`)
- [ ] `assets/icon.png` cuadrado 1024×1024 sin canal alfa — bloquea el submit a Apple
- [ ] Primer build de producción (perfil `production` en `eas.json`, si no existe todavía)
- [ ] Productos creados en App Store Connect y Google Play Console (ver Monetización)
- [ ] Primer submit exitoso a TestFlight / internal testing de Play Console
- [ ] Política de privacidad publicada (bloqueante de Google Play, ver § S8)

## Seguridad

<!-- Checklist OWASP de SECURITY.md que quedó sin marcar y todavía no tenía tarea propia acá -->

- [ ] OWASP A05 · Revisar security headers de las Edge Functions y confirmar que no quede nada en modo debug en producción
- [ ] OWASP A06 · Dependency scanning en CI — mismo trabajo que § A8 (Bloque 3)
- [ ] OWASP A07 · Revisar política de password más allá de los defaults de Supabase (rate limiting, complejidad)
- [ ] OWASP A09 · Error tracking configurado — mismo trabajo que § A5 (Bloque 2, Sentry)
- [ ] OWASP A10 · Revisar SSRF si el import por IA llega a aceptar URLs externas (hoy no aplica)
- [ ] 🔴 OWASP LLM01 · Guarda contra prompt injection en `analyze-loans-document`/`analyze-credit-card` — § S9
- [ ] 🔴 OWASP LLM10 · Rate limiting / límite de tamaño de archivo en las Edge Functions de análisis con IA — § S10

## Observabilidad

- [ ] Reemplazar `console.log`/`console.error` sueltos por un logger mínimo con niveles, a medida que se toca cada archivo (no requiere una migración masiva)
- [ ] Revisar logs de `send-payment-reminders` una vez que exista el schedule automático (ver sección Notificaciones arriba)

---

# 🔴 Bloque 1 — Bugs de datos y seguridad (antes que nada)

- [x] **S3** Dump del schema real y sincronizar migraciones *(habilita S4 y L3)*
- [x] **L1** `formatCurrency` default a `'ARS'` + parámetro tipado como `CurrencyType`
- [x] **L3** `interest_rate` overflow con tasas mensuales > 83%
- [x] **L4** Filtro por `lender_id` en `getActiveLoans`, `getUpcomingPayments` y `getOverduePayments`
- [x] **S1** Prestatario puede marcar sus cuotas como pagadas (RLS)
- [x] **S2** Cualquiera puede insertar notificaciones a cualquiera (RLS)
- [x] **S4** Préstamo abierto viola 3 constraints
- [x] **L2** Stats separadas por moneda en `getLoanStats`, `getDebtStats` y
      `getLinkedLoanPaymentStats`; dashboard, préstamos y deudas apilan una tarjeta
      por moneda
- [x] **L1 (resto)** Pasar la moneda en `loans/[id].tsx` (2 formatters) y
      `calendar/index.tsx` — hoy hardcodean ARS y muestran los préstamos en USD como pesos
- [x] **A10** `react-native-worklets-core` sin usar rompía todo build de Android — sacado de `package.json`

# 🟠 Bloque 2 — Requisitos de launch

- [ ] **Development build de Android** *(prerequisito de todo este bloque)*
      Expo Go ya no alcanza: RevenueCat (`react-native-purchases`) es un módulo nativo
      que no existe en Expo Go, y el push remoto en Android se removió en el SDK 53.
      Hasta que exista el dev build, **la app siempre se testea como usuario free** y
      el paywall, la compra y las features Pro son inverificables.
      Pasos: `npx expo install expo-dev-client` →
      `eas build --profile development --platform android` → instalar el APK →
      `npx expo start --dev-client`. Se compila una sola vez; después el JS
      recarga igual que siempre.
      Nota: el perfil `development` de `eas.json` no tiene bloque `env` (no hace
      falta: las `EXPO_PUBLIC_*` se inyectan al bundlear local desde `.env`).
- [x] **S8** Eliminación de cuenta (falta publicar la política de privacidad en una
      URL pública — sigue como pendiente separado, ver § Documentación)
- [x] **A4** `ErrorBoundary` en los layouts raíz
- [ ] **A5** Sentry para crash reporting
- [x] **S5** Keys de RevenueCat fuera del código
- [x] **A9** Unificar versión entre `package.json` y `app.json` (ambos en 1.0.3)
- [ ] `assets/icon.png` no es cuadrado (1874×1761) — `expo-doctor` lo marca.
      Apple exige 1024×1024 exacto y sin canal alfa. Bloquea el submit, no el build.
- [ ] **S7** Mapear errores de Postgres a mensajes en español

# 🟠 Bloque 3 — Red de seguridad

- [x] **A3** Tests unitarios de `loanCalculator.ts` (simple, francés, mora, bordes) — 35 tests en
      `src/services/calculations/__tests__/loanCalculator.test.ts`, cubre los dos sistemas de
      interés, cronograma de amortización, mora (fija/diaria/semanal/gracia) y bordes de redondeo
- [x] **A8** ESLint + typecheck (`npx expo lint` + `tsc --noEmit`) — falta todavía el CI en GitHub Actions, ver `## Setup`
- [ ] **L6** Unificar el cálculo duplicado TS / PL/pgSQL *(A3 ya está listo, queda pendiente)*
- [x] **A11** Backfill de tests por capas (decisión 2026-09-29, ver `AGENTS.md` § Decisiones del setup)
      — orden: lógica pura (A3, listo) → ~~`utils/validators.ts`/`loanColors.ts`~~ (listo, 30 tests) →
      `services/supabase/*.ts` (mockeando con msw, infra lista) → `store/*.ts` (Zustand) →
      `components/ui/`. TDD estricto (test-first) para todo lo nuevo que se toque a partir de acá;
      las pantallas de `src/app/` quedan para el final por el costo de mockear navegación/Supabase
      — infra de test agregada: `jest.config.js` con proyectos `app`/`logic` (Node, para que
      `msw/node` pueda interceptar los fetch de supabase-js), `babel.config.js` (faltaba, lo
      necesita el preset `jest-expo/node`), `src/test/msw/` (server + wiring), `src/test/setupEnv.js`.
      `services/supabase/loans.ts` (903 líneas): cubierto — prestatarios (dedup por DNI/teléfono),
      `markPaymentAsPaid`/`revertPaymentToPending` (auto-transición de estado), `deleteLoan` (guard
      "solo completados"), `getActiveLoans` (regresión L4), `getNextPendingPaymentDatesByLoan`,
      `getLoanStats`/`getLinkedLoanPaymentStats` (separación por moneda), `updatePaymentPenalty`/
      `updateLoanPenalties` (33 tests en `loans.test.ts` + `loans.payments.test.ts`). Quedan sin
      cubrir los passthroughs simples (`createLoan`, `getLoans`, `getLinkedLoans`, `getLoanById`,
      `updateLoanStatus`, `addBorrowerComment`, `getUpcomingPayments`, `getOverduePayments`,
      `getLastLoanColor`, `updateAllLoanColors`, `getAllPaymentsForExport`,
      `getMonthlyInterestEarned`) — bajo ROI relativo, quedan para cuando se toquen.
      `services/supabase/personalDebts.ts` (518 líneas): cubierto — `createPersonalDebt` (cálculo
      simple/francés, nota: acá `interest_rate` se trata como tasa del período y no anual, a
      diferencia de `loanCalculator.ts` — confirma por qué existe L6; y el rollback si falla la
      RPC del cronograma), `deletePersonalDebt` (guard "no activa"), `getDebtStats` (regresión:
      solo cuenta pagos de deudas activas, separado por moneda), `getOverdueDebtPayments`
      (side-effect de marcar `overdue` + skip si no hay vencidos), `getDebtPaidAmounts`,
      `getNextPendingPaymentDates` (15 tests en `personalDebts.test.ts`). Quedan sin cubrir los
      passthroughs simples (`getPersonalDebts`, `getActivePersonalDebts`, `getPersonalDebtById`,
      `updateDebtStatus`, `updateDebtColor`, `getDebtPayments`, `markDebtPaymentAsPaid`,
      `revertDebtPaymentToPending`, `getUpcomingDebtPayments`, `getAllDebtPaymentsForExport`).
      `services/supabase/auth.ts` (168 líneas): cubierto completo — 24 tests (`auth.test.ts`).
      Notas: `supabase.functions` es un getter que crea un `FunctionsClient` nuevo en cada
      acceso, no se puede mockear `.invoke` sobre una instancia ya obtenida — hay que mockear
      el getter (`jest.spyOn(supabase, 'functions', 'get')`); `deleteAccount` tiene dos caminos
      de error distintos (falla la invocación vs. la Edge Function responde 200 con `data.error`).
      `services/supabase/export.ts`: cubierto completo — 7 tests (`export.test.ts`), mockeando
      `../loans`/`../personalDebts` con `jest.mock()` (no hace falta msw acá, no habla con
      Supabase directo) y `expo-file-system`/`expo-sharing`. Cubre armado de columnas, mapeo de
      prestatario/preéstamo por id, defaults de `null`, y el escaping de CSV (comas/comillas).
      **`services/supabase/` queda 100% cubierto** (144 tests en total del proyecto).
      `store/*.ts` (Zustand): cubierto completo — `authStore.ts` (init con/sin sesión, listener
      de `onAuthStateChange` para SIGNED_IN/SIGNED_OUT/TOKEN_REFRESHED, signIn/signUp/signOut/
      deleteAccount con sus paths de error, getters computados isLender/isBorrower/isAuthenticated/
      getRole), `preferencesStore.ts` (setters + reset), `subscriptionStore.ts` (startListening,
      refresh, setters). 34 tests (`authStore.test.ts` + `preferencesStore.test.ts` +
      `subscriptionStore.test.ts`) — **178 tests en total del proyecto**. Nota: mockear
      `services/subscription` necesita una factory explícita en `jest.mock()` — el automock
      default igual `require()`ea `react-native-purchases` (módulo nativo) para inspeccionar su
      forma, y eso rompe fuera de un runtime RN.
      `components/ui/`: cubierto completo — `Modal.tsx` (visibilidad, botones default/custom,
      estilos cancel/primary/destructive, cierre automático vs. callback propio, children),
      `Toast.tsx` (render por tipo, ícono/mensaje, auto-hide por `duration`, hide manual al
      tocar la pill), `ToastProvider.tsx`/`useToast` (los 4 show* + showToast genérico,
      reemplazo del toast anterior en vez de apilar, hideToast, error si se usa `useToast` fuera
      del provider), `PasswordInput.tsx` (toggle mostrar/ocultar, autoCapitalize/autoCorrect
      forzados, passthrough de props), `PhoneInput.tsx` (país/label por defecto, cálculo de
      E.164, validación del check ✓, picker de país con búsqueda por nombre/dial code,
      selección y cierre), `ErrorFallback.tsx` (mensaje genérico, detalle técnico solo en
      `__DEV__`, callback `retry`). 44 tests nuevos (`Modal.test.tsx` + `Toast.test.tsx` +
      `ToastProvider.test.tsx` + `PasswordInput.test.tsx` + `PhoneInput.test.tsx` +
      `ErrorFallback.test.tsx`) — **222 tests en total del proyecto**. Infra agregada:
      `@testing-library/react-native` 14.0.1
      + `test-renderer` 1.3.0 (dev deps; en v14 `render`/`rerender`/`fireEvent.*` son
      `async`, hay que `await`-earlos), mock de `react-native-safe-area-context` vía
      `jest.mock()` en `src/test/setupReactNativeMocks.ts` (con `moduleNameMapper` el propio
      `jest.requireActual` del mock oficial de la librería quedaba atrapado en el mismo mock).
      Se agregó `accessibilityRole`/`accessibilityLabel` al botón de mostrar/ocultar contraseña
      en `PasswordInput.tsx` (antes un ícono SVG sin ningún texto ni label accesible) — hacía
      falta para poder testearlo con las queries accesibles de RTL v14 (que sacó las queries
      `UNSAFE_*`), y de paso cierra un gap real de accesibilidad para VoiceOver/TalkBack.
      Pantallas críticas de `src/app/` (`(auth)/login.tsx`, `(auth)/register.tsx`,
      `(main)/loans/[id].tsx`, `(main)/dashboard/index.tsx`, `(main)/loans/create.tsx`):
      cubierto — la lógica de cada una (estado, validaciones, llamadas a Supabase, cálculos)
      se extrajo a un hook propio en `src/hooks/` (`useLoginForm`, `useRegisterForm`,
      `useLoanDetail`, `useDashboardData`, `useCreateLoanForm`), dejando la pantalla como JSX
      puro — primer uso real de `src/hooks/` (estaba vacío desde el setup, A1). 79 tests
      nuevos entre los 5 hooks (mockeando expo-router, los stores, services/supabase,
      services/notifications, services/pdf y expo-image-picker), incluyendo el camino feliz y
      de error de `handleCreate`/`confirmDeleteLoan`, el gate de premium por límite del plan
      free, y los dos fallos "best effort" que no bloquean la creación del préstamo
      (comprobante, notificaciones). **301 tests en total del proyecto.**
      Resto de pantallas de `src/app/` (ampliación posterior, mismo día): se extendió el
      backfill al resto de pantallas con lógica real — `settings/customer-center.tsx`,
      `(auth)/forgot-password.tsx`, `(auth)/reset-password.tsx`,
      `settings/delete-account.tsx`, `settings/profile.tsx`, `settings/notifications.tsx`,
      `settings/premium.tsx` (2 hooks: paywall nativo vs. custom para Expo Go),
      `settings/index.tsx`, `loans/index.tsx`, `loans/link.tsx`, `loans/analyze.tsx`,
      `calendar/index.tsx`, `notifications/index.tsx`, `debts/index.tsx`,
      `debts/analyze.tsx`, `debts/[id].tsx`, `debts/create.tsx`, y `src/app/_layout.tsx`
      (init de auth/RevenueCat/push, `useAppBootstrap`) — 17 hooks nuevos, 165 tests nuevos.
      Se saltearon a propósito por no tener lógica real que extraer (solo redirect de auth o
      placeholder estático): `src/app/index.tsx`, `(main)/_layout.tsx`,
      `(main)/settings/security.tsx`, `(main)/borrowers/index.tsx`.
      De paso, un fix real: `useCustomerCenter` llamaba `openCustomerCenter()` sin `await` ni
      `.catch()` en el `useEffect` — el `finally` ya garantizaba el `router.back()`, pero el
      reject de `presentCustomerCenter` quedaba como unhandled promise rejection.
      **466 tests en total del proyecto.** Con esto A11 queda completo para todas las
      pantallas de `src/app/` que tenían lógica propia — no queda nada pendiente de este
      backfill.
- [x] **L12** Clave duplicada en `validators.ts` y allowlist de TLDs que rechaza dominios válidos
- [x] **L14** `onAuthStateChange` tipa la sesión como `unknown` — se filtra a `authStore.ts`
- [x] **L15** `Modal` con `style: 'secondary'` inexistente en `loans/create.tsx:634`
- [x] **L16** `getNextLoanColor`/`getLoanColorByIndex` — mismatch de tipos contra la paleta literal
- [x] **A7** Regenerar `database.types.ts` contra el schema real, sacar los `as never`/`as any` que ya no hacían falta (27 en 5 archivos)
- [x] **L17** `.update()` sin tipar en `settings/profile.tsx` — resuelto junto con A7
- [x] **L18** Función usada en `useEffect` antes de declararse — 4 archivos (error de lint, bloqueaba CI)
- [x] **L19** `Toast.tsx` leía refs (`useRef(...).current`) durante el render (error de lint, bloqueaba CI)
- [x] **L20** Falso positivo de `react-hooks/set-state-in-effect` en `reset-password.tsx` — suprimido con comentario

# 🟡 Deuda técnica (detectada al adoptar el proyecto)

## Archivos que superan el límite duro de 1000 líneas
- [ ] 🔴 `src/app/(main)/loans/create.tsx` — **1371** líneas
- [ ] 🔴 `src/app/(main)/debts/create.tsx` — **1136** (≈ el mismo formulario duplicado)
- [ ] 🔴 `src/app/(main)/dashboard/index.tsx` — **1058**
- [ ] 🔴 `src/app/(main)/loans/[id].tsx` — **1037**

## En zona de revisión
- [ ] 🟡 `src/app/(main)/debts/[id].tsx` — 845
- [ ] 🟡 `src/services/supabase/loans.ts` — 783 (dividir en loans / payments / stats)
- [ ] 🟡 `src/app/(main)/debts/analyze.tsx` — 722
- [ ] 🟡 `src/app/(main)/debts/index.tsx` — 625
- [ ] 🟡 `src/app/(main)/notifications/index.tsx` — 624
- [ ] 🟡 `src/app/(main)/settings/index.tsx` — 601

## Extracción — llenar las carpetas que ya existen vacías (§ A1)
- [ ] `components/common/`: `StatCard`, `EmptyState`, `ScreenHeader`, `Money`, `Button`, `Input`
- [ ] `components/loans/`: `LoanCard`, `PaymentRow`, `AmortizationPreview`, pasos del formulario
- [ ] `hooks/`: `useLoans`, `useLoanDetail`, `useDebts`, `useAsyncData`
- [ ] Unificar los formularios de préstamo y deuda en componentes compartidos
- [ ] **A2** TanStack Query como capa de estado de servidor
- [ ] **L13** Schemas Zod + react-hook-form (las deps ya están instaladas)
- [ ] **A6** `theme/index.ts` usa `require()` dentro de un objeto
- [ ] **L9** `updateAllLoanColors`: loop de N updates sin filtro de usuario
- [ ] **L10** El calculador cae en fórmula francesa si recibe `'open'`
- [ ] **L11** La mora `daily` no tiene techo

# 🟠 Bloque 5 — UX

- [ ] **U4** Date picker nativo en vez de tipear `AAAA-MM-DD`
- [ ] **U5** Mostrar el límite del plan free **al entrar**, no al final del formulario
- [ ] **U2** `FlatList` en cronogramas y listados (45 `.map()` vs 2 `FlatList`)
- [ ] **U6** Unificar `Alert.alert` vs Toast con un criterio explícito
- [ ] **U9** Confirmar antes de salir de un formulario a medio cargar
- [ ] **U10** Avisar cuando falla la subida del comprobante (hoy es un `catch {}` vacío)
- [ ] **U1** Accesibilidad: labels en botones de ícono, contraste, Dynamic Type
- [ ] **U3** Dark mode *(hacer después de la extracción de componentes)*
- [ ] **U11** Búsqueda y filtros en listados
- [ ] **U7** Detección de sin conexión
- [ ] **U8** `EmptyState` compartido
- [ ] **U12** Feedback háptico al cobrar una cuota

# 🔵 Bloque 6 — Producto

- [ ] **P1** Pago parcial
- [ ] **P2** Recibo por cuota compartible
- [ ] **P3** Historial y score del prestatario
- [ ] **P4** Cotización ARS/USD
- [ ] **P5** Onboarding en el primer uso
- [ ] **P6** Resumen diario "a quién cobro hoy"
- [ ] **P7** Cartera compartida entre socios

## Documentación

- [ ] 🔴 Publicar la política de privacidad en una URL pública — **bloqueante de
      stores** (Google Play la exige en la ficha, y Apple la pide en App Store
      Connect). Hoy solo existe como texto in-app en Ajustes. Falta decidir dónde
      hostearla (GitHub Pages de este repo, Notion, u otra) — parte de § S8
- [ ] Completar `README.md` con setup, features reales y estado del proyecto (README sync, ver `AGENTS.md`)
- [ ] Revisar que las secciones nuevas de `AGENTS.md`/`CLAUDE.md` (agregadas al resolver el drift de contenido del 2026-09-11) no contradigan ninguna convención real del equipo
- [ ] Agregar diagrama del modelo de dominio (`SPEC.md` § 4.2) como imagen, si se necesita para onboarding de alguien nuevo al proyecto
