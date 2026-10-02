# Cuotify

![CI](https://github.com/carlos0718/cuotify-app/actions/workflows/ci.yml/badge.svg)

App móvil (React Native / Expo) para gestionar préstamos personales: alta de préstamos con
interés simple o francés, cronogramas de pago, mora configurable, deudas personales, y
notificaciones de vencimiento. Ver `SPEC.md` para el detalle funcional completo.

## Setup

Requisitos: Node.js 24+, cuenta de Expo (para EAS Build).

```bash
npm install
cp .env.example .env   # completar EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PROJECT_ID
npm start
```

### Scripts disponibles

```bash
npm start          # expo start
npm run android    # expo start --android
npm run ios         # expo start --ios
npm run web         # expo start --web
npm run lint        # expo lint (eslint-config-expo)
npm run typecheck   # tsc --noEmit
npm test            # jest (preset jest-expo)
```

> RevenueCat (`react-native-purchases`) es un módulo nativo — no funciona en Expo Go. Para
> probar suscripciones/paywall hace falta un development build (`eas build --profile development`).

## Stack

React Native + Expo (SDK 57) · Expo Router · Supabase (Postgres + Auth + Edge Functions) ·
Zustand · React Hook Form + Zod · RevenueCat · Gemini (análisis de documentos por IA) · Jest
(`jest-expo`). Ver `AGENTS.md` para el detalle completo y el *por qué* de cada elección.

## Estructura

```
src/
  app/          Expo Router file-based routes — las pantallas
  components/   UI compartida (ui/ poblado; las carpetas por feature siguen vacías — ver A1)
  hooks/        Custom hooks extraídos de las pantallas (lógica testeable, sin JSX)
  services/     supabase/ · calculations/ · notifications/ · pdf/ · gemini/ · subscription/
  store/        Zustand (useAuthStore, usePreferencesStore)
  theme/        Design tokens (colors, typography, spacing, shadow)
  types/        Tipos compartidos + database.types.ts (generado)
  utils/        Helpers puros
supabase/
  migrations/   SQL versionado
  functions/    Edge Functions (Deno)
```

> La arquitectura es por capa técnica, no por feature — el razonamiento completo está en
> `AGENTS.md` sección "Architecture — Layer-based, with an unfinished extraction".

## Contribuir

Proyecto de un solo desarrollador por ahora — sin flujo de fork/PR externo todavía. El
workflow interno (ver `AGENTS.md` sección "Workflow de Git"):

1. Rama propia desde `development`: `git checkout -b feature/<nombre>` o `fix/<nombre>`
2. Commits en [Conventional Commits](https://www.conventionalcommits.org/), subject en
   español, referenciando el Finding ID cuando aplica: `fix(rls): restringir UPDATE (S1)`
3. 1 tarea completada del `TODO.md` = 1 commit + push
4. Merge a `development` siempre con confirmación explícita, nunca automático

## Development Methodologies

Este proyecto sigue un flujo Spec-Anchored (ver `AGENTS.md` sección "Agregar o modificar
código") combinado con las metodologías de abajo. Detalle completo en
[`.rocky-spec/reference/methodologies.md`](.rocky-spec/reference/methodologies.md).

### Specification-Driven Development (SDD)
`SPEC.md` define el alcance antes de cualquier línea de código y se actualiza en cada
cambio de alcance — no es una foto del día 1. Ver `AGENTS.md` sección "Iteración — Spec-First".

### Domain-Driven Design (DDD)
El dominio (`profiles` → `borrowers` → `loans` → `payments`, y en paralelo `personal_debts` →
`debt_payments`) está documentado en `SPEC.md` § 4. A diferencia del DDD "de libro"
(`domain/`/`application/`/`infrastructure/`), este proyecto organiza por capa técnica
(`services/`, `store/`, `app/`) — ver el trade-off documentado en `AGENTS.md`.

### Test-Driven Development (TDD)
Adoptado el 2026-09-29. Ciclo Red → Green → Refactor para código nuevo; el código existente
se cubre con un backfill por capas (lógica pura → `utils/` → `services/supabase/` →
`store/` → `components/ui/` → pantallas críticas de `src/app/`, vía extracción a `hooks/`).

```bash
npm test            # correr tests (jest-expo)
npm test -- --watch # modo watch para TDD activo
```

### Behavior-Driven Development (BDD) — no implementado todavía
El proyecto no usa Gherkin ni tests E2E hoy (no hay Playwright ni Detox configurado). Si se
adopta más adelante, la convención sería:

```gherkin
Feature: [Nombre de la feature]
  Scenario: [Caso de uso]
    Given [estado inicial]
    When  [acción del usuario]
    Then  [resultado esperado]
```

---

## Licencia

Propietaria — ver [`LICENSE`](LICENSE). Software privado, no se redistribuye.
