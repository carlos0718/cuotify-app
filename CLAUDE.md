# CLAUDE.md

@AGENTS.md

> **Nota para Claude Code**: la línea `@AGENTS.md` de arriba importa el contenido de `AGENTS.md` (stack, comandos, convenciones, y el flujo Spec-Anchored) a esta sesión. Si tu versión de Claude Code no soporta imports con `@`, pedile directamente a Claude que lea `AGENTS.md` al arrancar la sesión — tiene toda la info operativa del proyecto.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Roles del asistente (áreas de expertise)

Cuando trabajes en este proyecto, asumí estos perfiles según el contexto del pedido. Si una decisión cruza varios roles, considerá los trade-offs entre ellos. Cuotify es una app móvil (Expo/React Native) sin superficie web propia — los roles de Diseño web/SEO técnico/Servicios Cloud/Docker rara vez se activan hoy, pero quedan documentados por si el proyecto suma un landing o un backend propio más adelante.

### Frontend
- Performance del render en listas largas (préstamos, pagos) — virtualization, memoization
- Patrones de estado local (`useState` por pantalla) vs. global (Zustand) — ver `AGENTS.md` § Code style
- Componentes accesibles desde la base, aunque React Native no tenga HTML semántico — usar los `accessibilityRole`/`accessibilityLabel` nativos

### Backend
- Supabase como backend: RLS como capa de autorización (no lógica de negocio duplicada en el cliente)
- Validación en el borde: constraints de DB + Zod en formularios, no solo uno de los dos
- Manejo centralizado de errores vía `handleSupabaseError()` (ver `AGENTS.md`)

### Arquitectura de software (frontend + backend)
- Separación de capas: `app/` (rutas) → `services/` (acceso a datos) → `store/` (estado) — ver `CONSTITUTION.md` Artículo 5
- Decisiones documentadas (por qué SI X y NO Y) van en `AGENTS.md` § "Decisiones del setup"

### UI
- Sistemas de diseño: tokens en `src/theme/` — valores concretos en `design-system/MASTER.md`
- Estados de componente: default, pressed, disabled, loading, error (equivalentes móviles de hover/focus)
- Consistencia visual entre pantallas (bordes, sombras, `loanColors`)

### UX
- Flujos completos (crear préstamo en 3 pasos, no pantallas sueltas)
- Estados de feedback: loading, success, error, empty — con `Toast`/`Modal` de `src/components/ui/`
- Microcopy en español, claro y de marca — evitar genéricos ("Error" sin contexto)
- Affordances claras en touch targets (tamaño mínimo, feedback visual al tocar)

### Diseño web
- Solo aplica si el proyecto suma una superficie web (landing, panel admin) — hoy no la tiene.

### SEO técnico
- No aplica — app móvil sin páginas indexables. Revisar si se agrega un landing.

### Accesibilidad — WCAG 2.1 nivel AA
> Adaptado a móvil: los criterios de WCAG se aplican vía los equivalentes nativos de accesibilidad (VoiceOver/TalkBack), no HTML.
- Labels asociados a inputs, `accessibilityLabel` en íconos sin texto
- Contraste mínimo 4.5:1 para texto normal, 3:1 para texto grande
- Touch targets de al menos 44x44pt
- Orden de foco lógico para lectores de pantalla (VoiceOver/TalkBack)

### Auditoría de performance
- Tiempo de arranque (cold start) y transición entre pantallas
- Bundle size de la app (Expo/Metro), lazy loading de pantallas pesadas
- Optimización de imágenes (formato, tamaño) en assets de la app
- Evitar re-renders innecesarios en listas de préstamos/pagos

### UX writing / digital writing
- Voz de marca consistente, en español
- Mensajes de error que ayudan (qué pasó y qué hacer, no el error técnico crudo)
- Empty states con tono e incentivo (ej. "Todavía no tenés préstamos activos")
- CTAs verbo + objeto ("Registrar pago" > "Confirmar")

### Servicios Cloud (AWS, Azure, GCP)
- No aplica directamente — el backend es Supabase (managed). Relevante solo si se agrega infraestructura propia (ej. un worker para notificaciones).

### Docker
- No aplica — app móvil, no se containeriza.

### Testing
- Sin testing configurado hoy (ver `AGENTS.md` § Decisiones del setup — decisión explícita: no TDD, tests después de implementar).
- Cuando se agreguen: unit para `loanCalculator.ts` (money math no se verifica a mano), integration para servicios de Supabase.

### Regla cruzada
Cuando una feature toca varios roles (ej. agregar recordatorios de pago):
- **Frontend**: estado de la lista de notificaciones, pull-to-refresh
- **Backend**: RPC o Edge Function que genera los recordatorios, RLS sobre quién los ve
- **UX**: estado vacío, tono del mensaje del recordatorio
- **Accesibilidad**: anuncio de nuevas notificaciones a lectores de pantalla
- **Performance**: no bloquear el hilo principal al generar/enviar push notifications

Mencionar los trade-offs entre roles al usuario cuando son significativos.

## Project Overview

**Cuotify** is a React Native / Expo mobile app for managing personal loans. It allows lenders to create and track loans, manage borrowers, and monitor payment schedules. Borrowers can view their own loans and add comments to payments.

## Commands

```bash
# Start development server
npx expo start

# Run on Android
npx expo start --android

# Run on iOS
npx expo start --ios
```

There are no lint or test scripts configured. TypeScript checking is done implicitly through the Expo build toolchain.

## Environment Setup

Copy `.env.example` to `.env` and fill in:
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `EXPO_PROJECT_ID` — Expo project ID (for push notifications)

## Architecture

### Routing (Expo Router file-based)

```
src/app/
  index.tsx               # Auth redirect gate (→ dashboard or login)
  _layout.tsx             # Root layout: initializes auth, push notifications, ToastProvider
  (auth)/                 # Unauthenticated screens (login, register, forgot/reset password)
  (main)/                 # Authenticated tab navigator
    _layout.tsx           # Tab bar with: dashboard, loans, debts, calendar, settings
    dashboard/            # Lender/borrower stats overview
    loans/                # Loan list, create, detail ([id].tsx), link
    debts/                # Personal debt tracking (separate from managed loans)
    calendar/             # Payment calendar view
    notifications/        # Notification center (hidden from tab bar, accessed via header)
    borrowers/            # Borrower management (hidden from tab bar)
    settings/             # Profile, security, notification preferences
```

### State Management (Zustand)

- `useAuthStore` — session, user, profile, auth actions. Initialized in root `_layout.tsx` on mount. Listens to Supabase `onAuthStateChange`.
- `usePreferencesStore` — persisted user preferences (e.g. `defaultCurrency`). Stored in AsyncStorage via zustand `persist` middleware.

### Backend (Supabase)

All data access goes through `src/services/supabase/`:
- `client.ts` — Supabase client singleton; uses AsyncStorage for session persistence
- `auth.ts` — sign in/up/out, session, profile CRUD
- `loans.ts` — borrowers, loans, payments, stats, penalty calculation
- `personalDebts.ts` — personal debt tracking (separate from lender loans)

**Key database relationships:**
- `profiles` (auth users) → `borrowers` (lender's contacts) → `loans` → `payments`
- `profiles` → `personal_debts` → `debt_payments` (separate tables for personal debt tracking)
- Loan payments are auto-generated by a Supabase DB trigger (`after_loan_insert`) when a loan is created
- Personal debt payments are generated via RPC call (`generate_debt_payment_schedule`) in `createPersonalDebt`
- Payments cascade-delete when a loan is deleted
- Only `completed` loans can be deleted; personal debts require `completed` or `cancelled` status

**Auto-status transitions:**
- `markPaymentAsPaid` checks if all payments are paid and auto-transitions the loan to `completed`
- `revertPaymentToPending` reverts a completed loan back to `active`

**Borrower deduplication:** `getOrCreateBorrower` searches by DNI first, then phone, before creating a new borrower.

**Row Level Security** is enabled on all tables. Lenders can only see their own data; borrowers can view loans where `borrowers.linked_profile_id = auth.uid()`.

### Loan Calculation Engine

`src/services/calculations/loanCalculator.ts` implements two interest systems:
- **Simple**: fixed interest per payment = `principal × rate × term`
- **French (amortization)**: PMT formula with interest calculated on remaining balance

Both use an annual interest rate converted to a periodic rate (52 periods/year for weekly, 12 for monthly).

Late penalties support: `none`, `fixed` (one-time %), `daily` (% × days overdue), `weekly` (% × weeks overdue), with a configurable grace period.

### Theme System

`src/theme/` exports: `colors`, `gradients`, `typography` (fontFamily, fontSize, fontWeight, lineHeight), `spacing`, `borderRadius`, `shadow`. Import directly from `../theme` — all tokens are named constants, no styled-components.

### UI Components

`src/components/ui/` contains shared primitives: `Toast`/`ToastProvider`, `Modal`, `PasswordInput`. SVG icons are defined inline in layout files (no icon library). Import from `../../components` barrel.

### Loan Color System

Each loan gets a pastel `color_code` from the `colors.loanColors` palette (`src/theme/colors.ts`). Helpers in `src/utils/loanColors.ts`: `getNextLoanColor(lastColor)` cycles through the palette sequentially; `getLoanColorByIndex(i)` assigns deterministically. The create flow calls `getLastLoanColor()` before saving to ensure sequential assignment.

## Key Conventions

- **Language**: UI strings are in Spanish (the app targets Spanish-speaking markets)
- **Currency**: Defaults to ARS (Argentine Peso); USD also supported. Format with `formatCurrency()` from calculations service
- **User roles**: `lender`, `borrower`, `both` — checked via `useAuthStore().isLender()` / `isBorrower()`
- **Create screens**: Use a multi-step `step` state (e.g. `useState(1)`) to split long forms. The loan create screen has 3 steps: borrower info → loan terms → penalties/preview
- **Navigation**: Use `expo-router`'s `router.push/replace` and `<Redirect>`. Tab resets use `router.replace('/(main)/loans')` in tab `listeners`
- **Supabase queries**: Always call `handleSupabaseError(error)` when re-throwing errors
- **Type casting**: Many Supabase responses require `as never` on inserts/updates due to generated type strictness — this is an existing pattern, not a bug

## Subagents (.claude/agents/)

Three specialized subagents are configured for this project. Invoke them with `@"name (agent)"` or Claude will select automatically.

| Subagent | Covers |
|----------|--------|
| `supabase-expert` | Queries, tables, RLS, generated types, DB errors |
| `ui-specialist` | Screens, components, theme tokens, navigation, forms |
| `business-logic` | Loan calculations, penalties, Zustand stores, types, utils |

### Subagent tools reference

| Tool | What it does |
|------|-------------|
| `Read` | Read files |
| `Edit` | Modify existing files |
| `Write` | Create new files |
| `Bash` | Run terminal commands |
| `Grep` | Search text inside files |
| `Glob` | Find files by pattern |
| `WebSearch` | Search the internet |
| `WebFetch` | Fetch content from a URL |
| `Agent` | Spawn sub-subagents |

### Model options

| Value | Model | When to use |
|-------|-------|-------------|
| `haiku` | Claude Haiku | Simple tasks, search, fast exploration — cheapest |
| `sonnet` | Claude Sonnet | Most tasks — good balance of speed and capability |
| `opus` | Claude Opus | Complex reasoning, deep analysis — slowest and most expensive |
| `inherit` | Same as parent | Subagent uses whatever model Claude Code is running with |

---

# Project Workflow (charlydev-flow, adopted 2026-08-10)

## Source-of-truth documents

| File | Answers | Update when |
|---|---|---|
| `SPEC.md` | **What** the product is: domain model, features, acceptance criteria, risks | Before writing code for any new feature |
| `CLAUDE.md` (this file) | **How** to work in this codebase | When a convention changes |
| `TODO.md` | **What's next**, in priority order | Every completed task |
| `docs/IMPROVEMENTS.md` | **What's wrong** — full audit with IDs (S1, L3, A2, U4…) | When a finding is fixed or a new one is found |
| `design-system/MASTER.md` | Design tokens, component inventory, usage rules | When tokens or shared components change |

Finding IDs (`S*` security, `L*` logic, `A*` architecture, `U*` UX, `P*` product) are
stable — reference them in commit messages: `fix(loans): formatCurrency default a ARS (L1)`.

## Architecture — Layer-based, with an unfinished extraction

The project is organized **by technical layer**, not by feature:

```
src/
  app/          Expo Router file-based routes — the screens
  components/   Shared UI  (ui/ is populated; the feature folders are EMPTY)
  hooks/        Custom hooks  (EMPTY)
  services/     supabase/ · calculations/ · notifications/ · pdf/ · gemini/ · subscription/
  store/        Zustand stores
  theme/        Design tokens
  types/        Shared types + generated database.types.ts
  utils/        Pure helpers
supabase/
  migrations/   Versioned SQL   ⚠ currently out of sync with the real DB — see S3
  functions/    Edge Functions (Deno)
```

**Why layer-based fits here:** the app has ~14 screens over two parallel domains
(loans / debts) that share almost all their infrastructure — one Supabase client, one
calculation engine, one theme. Feature-based would duplicate that plumbing for little gain.

**The trade-off it's currently paying:** because `components/{loans,common,…}/` and
`hooks/` were created but never filled, all UI lives inline in the screens — four files
exceed 1000 lines and `loans/create.tsx` / `debts/create.tsx` are the same form written
twice. The architecture isn't wrong; it's incomplete.

**Rule for new code:** a screen file stays under ~400 lines. Anything beyond that —
sub-components, data fetching, business logic — is extracted to
`components/<feature>/` or `hooks/`. Don't refactor everything at once; extract what
you touch. See `docs/IMPROVEMENTS.md` § A1 for the target layout.

## Iteration flow — Spec-First

For any new feature or non-trivial change:

1. **Spec** — update `SPEC.md` first: what it does, which invariants it touches, its
   acceptance criteria. If it changes the domain model, update § 4 too.
2. **Schema** — if the DB changes, write a **numbered migration** in
   `supabase/migrations/`. Never change the schema from the Supabase dashboard: that's
   how the current drift (S3) happened.
3. **Types** — regenerate `database.types.ts` after any schema change.
4. **Implementation** — services first, then hooks, then screen.
5. **Verification** — `npx tsc --noEmit`, plus a unit test if it touches
   `loanCalculator.ts` (money math is not verified by hand).
6. **TODO** — check off the task and note anything new that came up.

## Commit convention

One completed task = one commit + push. Conventional commits, subject in Spanish,
referencing the finding ID when applicable:

```
fix(rls): restringir UPDATE de prestatarios a columnas de comentario (S1)
feat(loans): registrar pago parcial de cuota (P1)
refactor(loans): extraer LoanCard y PaymentRow a components/loans (A1)
docs(spec): actualizar criterios de aceptación de préstamo abierto
```

Never commit `.env`, API keys, or generated builds.

## Caveat on the `as never` pattern

The "Type casting" convention above is accurate as a description of the existing code,
but it is **not safe**: `end_date: null as never` in `loans/create.tsx` silenced a real
`NOT NULL` violation (finding S4). Prefer regenerating the Supabase types over adding
new casts, and when a cast is unavoidable, verify the value against the actual column
constraint first.

## Todo lo demás

Stack, comandos, arquitectura, convenciones, principios de código, el flujo Spec-Anchored, README sync, y el workflow de Git — todo eso vive en **`AGENTS.md`** (importado arriba). Es el mismo archivo que va a leer cualquier otro agente (Codex, Cursor, OpenCode, Copilot) si en algún momento se usa uno distinto en este proyecto.
