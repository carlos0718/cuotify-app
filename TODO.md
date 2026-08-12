# TODO — Cuotify

> Estado real al 2026-08-10 (adopción con `/charlydev-flow`). Etapa: **pre-launch**.
> Las features salen de `SPEC.md`; la deuda técnica y las mejoras, de `docs/IMPROVEMENTS.md`.
> **Convención:** 1 tarea completada = 1 commit + push. Al cerrar una sección, actualizar `SPEC.md`.

---

## Setup

- [x] Proyecto Expo + TypeScript + Expo Router
- [x] Supabase (Auth + Postgres + Storage + Edge Functions)
- [x] Zustand (auth, preferences, subscription)
- [x] Design tokens en `src/theme/`
- [x] EAS Build configurado (`eas.json`)
- [x] RevenueCat integrado
- [ ] ESLint + `typecheck` en scripts de npm — ver `IMPROVEMENTS.md` § A8
- [ ] Jest (`jest-expo`) configurado
- [ ] CI en GitHub Actions (lint + typecheck + test)

## Dominio / DB

- [x] Schema inicial: profiles, borrowers, loans, payments, notifications, push_tokens
- [x] RLS habilitado en todas las tablas
- [x] Trigger `after_loan_insert` que genera el cronograma
- [x] Trigger de creación automática de perfil al registrarse
- [x] Migraciones 003-007: interest_type, mora, moneda, deudas personales, RPC de intereses
- [ ] 🔴 **Dump del schema real y sincronizar `supabase/migrations/`** — § S3 *(empezar por acá)*
- [ ] 🔴 Migración 008: soporte real de `interest_type: 'open'` (term_value / end_date nullable) — § S4
- [ ] 🔴 Migración 009: cerrar la policy de UPDATE de prestatarios con column grants — § S1
- [ ] 🔴 Migración 010: cerrar el INSERT abierto de notificaciones — § S2
- [ ] 🔴 Migración 011: `interest_rate` a `DECIMAL(8,2)` — § L3
- [ ] Regenerar `database.types.ts` contra el schema real — § A7
- [ ] Cron (`pg_cron`) que recalcule mora diariamente — § L7
- [ ] RPC transaccional `mark_payment_paid` / `revert_payment` — § L8

## Auth e identidad

- [x] Registro, login, persistencia de sesión
- [x] Recuperación de contraseña por código OTP
- [x] Edición de perfil
- [x] Bloqueo biométrico
- [ ] 🔴 Eliminación de cuenta + política de privacidad — **bloqueante de stores**, § S8
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
- [ ] 🟡 Préstamo abierto funcionando end-to-end (depende de la migración 008)
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

---

# 🔴 Bloque 1 — Bugs de datos y seguridad (antes que nada)

- [ ] **S3** Dump del schema real y sincronizar migraciones *(habilita S4 y L3)*
- [x] **L1** `formatCurrency` default a `'ARS'` + parámetro tipado como `CurrencyType`
- [ ] **L3** `interest_rate` overflow con tasas mensuales > 83%
- [x] **L4** Filtro por `lender_id` en `getActiveLoans`, `getUpcomingPayments` y `getOverduePayments`
- [ ] **S1** Prestatario puede marcar sus cuotas como pagadas (RLS)
- [ ] **S2** Cualquiera puede insertar notificaciones a cualquiera (RLS)
- [ ] **S4** Préstamo abierto viola 3 constraints
- [x] **L2** Stats separadas por moneda en `getLoanStats`, `getDebtStats` y
      `getLinkedLoanPaymentStats`; dashboard, préstamos y deudas apilan una tarjeta
      por moneda
- [ ] **L1 (resto)** Pasar la moneda en `loans/[id].tsx` (2 formatters) y
      `calendar/index.tsx` — hoy hardcodean ARS y muestran los préstamos en USD como pesos

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
- [ ] **S8** Eliminación de cuenta + política de privacidad
- [ ] **A4** `ErrorBoundary` en los layouts raíz
- [ ] **A5** Sentry para crash reporting
- [ ] **S5** Keys de RevenueCat fuera del código
- [ ] **A9** Unificar versión entre `package.json` y `app.json`
- [ ] `assets/icon.png` no es cuadrado (1874×1761) — `expo-doctor` lo marca.
      Apple exige 1024×1024 exacto y sin canal alfa. Bloquea el submit, no el build.
- [ ] **S7** Mapear errores de Postgres a mensajes en español

# 🟠 Bloque 3 — Red de seguridad

- [ ] **A3** Tests unitarios de `loanCalculator.ts` (simple, francés, mora, bordes)
- [ ] **A8** ESLint + typecheck + CI
- [ ] **L6** Unificar el cálculo duplicado TS / PL/pgSQL *(hacer con A3 ya listo)*
- [ ] **L12** Clave duplicada en `validators.ts` y allowlist de TLDs que rechaza dominios válidos

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
