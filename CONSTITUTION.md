# Constitution — Cuotify

> Concepto tomado de GitHub Spec Kit: la constitution es el conjunto de principios **inmutables** que gobiernan cómo las specs se convierten en código — la diferencia con `SPEC.md` es la frecuencia de cambio. `SPEC.md` cambia con cada feature (Spec-Anchored, vivo). Esta Constitution casi no cambia — enmendarla es un acto deliberado y explícito, nunca un efecto colateral de resolver una tarea.
>
> Relación con los demás documentos: `SPEC.md` dice **qué** se construye. `AGENTS.md` dice **cómo operar** el día a día (comandos, stack, workflow). Esta Constitution dice **qué reglas nunca se negocian** mientras se construye cualquiera de las dos cosas anteriores.

## Gobernanza

- **Versión de esta Constitution**: 1.0.1
- **Fecha de ratificación**: 2026-09-11
- **Última enmienda**: 2026-09-12

**Regla de enmienda** (versionado propio, independiente del SemVer del software — ver `.rocky-spec/reference/versioning.md` de la skill):

- **MAJOR**: se elimina o redefine un artículo existente (ej. dejar de aplicar SOLID).
- **MINOR**: se agrega un artículo nuevo (ej. sumar un requisito de accesibilidad que antes no estaba).
- **PATCH**: aclaración de redacción sin cambio de fondo.

**Cómo enmendar**: nunca en silencio dentro de un commit de feature. Si una tarea hace evidente que un artículo ya no tiene sentido para este proyecto, es señal de pausar y conversarlo explícitamente con el humano — no de bandear la regla y seguir. Una vez acordado el cambio, actualizar este archivo, subir la versión según la regla de arriba, y agregar la línea correspondiente al Historial de enmiendas al final.

## Artículo 1 — Principios de código

| Principio      | Qué significa en la práctica                                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SOLID**      | Cada módulo tiene una sola razón para cambiar (SRP). Extender sin modificar lo existente (OCP). Interfaces pequeñas y específicas (ISP). Depender de abstracciones, no de implementaciones concretas (DIP). |
| **DRY**        | Si una lógica aparece dos veces, extraerla a una función, hook o constante — ej. el formulario de préstamo y el de deuda personal, hoy duplicados (ver `docs/IMPROVEMENTS.md` § A1).                        |
| **KISS**       | La solución más simple que resuelve el problema es la correcta.                                                                                                                                             |
| **YAGNI**      | No implementar lo que no se necesita hoy.                                                                                                                                                                   |
| **Clean Code** | Nombres que se explican solos. Funciones < 30 líneas. Early returns. Logs estructurados, nunca `console.log("texto")` suelto — ver `OBSERVABILITY.md` para el criterio de este proyecto.                    |

Detalle completo, ejemplos y contraejemplos en `.rocky-spec/reference/coding-principles.md` de la skill.

## Artículo 2 — Tamaño y estructura de archivos

- **Límite de tamaño de archivo**: pantalla/componente UI se mantiene bajo ~400 líneas (ver regla de `AGENTS.md`/`CLAUDE.md`). **1000 líneas es techo duro sin excepción.** `rocky check code .` marcó 4 archivos por encima de ese techo (`loans/create.tsx` 1371, `debts/create.tsx` 1136, `dashboard/index.tsx` 1089, `loans/[id].tsx` 1046) — ver deuda técnica en `TODO.md`.
- **Code smells a evitar**: God File, Long Method, Duplicate Code, Primitive Obsession, Long Parameter List — catálogo completo en `coding-principles.md`.
- **Separación de tipos/interfaces**: si un tipo se usa en 2+ archivos o el archivo ya tiene 3+ declaraciones, va en `<entidad>.types.ts` / `types/` propio.
- **Sin estilos inline**: tokens de `src/theme/` (colors, gradients, typography, spacing, borderRadius, shadow) vía `StyleSheet`, nunca valores hardcodeados salvo casos calculados en runtime.
- **Sin librería de estilos externa**: no hay styled-components ni CSS-in-JS — todo pasa por `StyleSheet.create` + los tokens del theme.

## Artículo 3 — Seguridad

- Nunca secrets en el repo — `.env` en `.gitignore` desde el primer commit.
- Autenticación delegada a Supabase Auth; nunca reimplementar hasheo de contraseñas a mano.
- Validación de input en el borde antes de que llegue a la lógica de negocio (formularios de alta de préstamo/deuda, edición de perfil).
- Row Level Security habilitado en **todas** las tablas de Supabase — ningún acceso a datos ajenos sin política RLS explícita.
- HTTPS obligatorio en producción (garantizado por Supabase + Expo/EAS).
- Dependency scanning configurado en CI — pendiente, ver `TODO.md` § A8.

Checklist completo (OWASP adaptado) y decisiones específicas de este proyecto en `SECURITY.md`.

## Artículo 4 — Especificación viva (SDD Spec-Anchored)

`SPEC.md` es la fuente de verdad de qué se construye, y se actualiza **antes** de escribir código para cualquier cambio de alcance — nunca después, nunca "cuando haya tiempo". Este principio no se negocia por apuro: un cambio de alcance sin su línea correspondiente en `SPEC.md` es una violación de esta Constitution, no un atajo válido. Mecanismo completo en `AGENTS.md`/`CLAUDE.md` sección "Iteración flow — Spec-First".

## Artículo 5 — Patrones de arquitectura de este proyecto

- **Arquitectura elegida**: Layer-based (organización por capa técnica: `app/` rutas Expo Router, `components/`, `services/`, `store/`, `theme/`, `types/`, `utils/`) — ver `CLAUDE.md`/`AGENTS.md` sección "Architecture — Layer-based, with an unfinished extraction" para la justificación y el trade-off actual (extracción a `components/<feature>/` y `hooks/` incompleta).
- **Patrones activos**:
    - **Service layer** — todo el acceso a datos pasa por `src/services/supabase/` (`auth.ts`, `loans.ts`, `personalDebts.ts`, `client.ts`), nunca queries sueltas en las pantallas.
    - **Store pattern (Zustand)** — estado global de sesión (`useAuthStore`) y preferencias persistidas (`usePreferencesStore`).
    - **Strategy** — `loanCalculator.ts` aplica dos estrategias de interés intercambiables (simple / francés) sobre la misma interfaz de cálculo.
    - **Trigger-driven side effects** — generación de cronogramas de pago vía trigger de Postgres (`after_loan_insert`) o RPC (`generate_debt_payment_schedule`), no en la capa de aplicación.

Estos patrones son la forma concreta en que este proyecto aplica el Artículo 1 (SOLID en particular) — no son una capa aparte, son su implementación.

## Artículo 6 — Boundaries

**Preguntar primero** (no asumir, confirmar con el humano antes de aplicar):

- Cualquier feature nueva o corrección: mostrar el plan (con o sin cambio de `SPEC.md`, según corresponda) y esperar confirmación explícita antes de tocar código.
- Cambios de arquitectura que tocan 3+ módulos.
- Agregar una dependencia nueva no trivial (más de un wrapper chico).
- Desactivar alguno de los artículos de esta Constitution para este proyecto puntual.
- Cambiar el mecanismo de auth (Supabase Auth) o el alcance de las políticas RLS.

**Nunca:**

- Commitear secrets, API keys o `.env` con valores reales (incluye las keys de RevenueCat, ver `TODO.md` § S5).
- Cambiar el schema de Supabase desde el dashboard — siempre migración numerada en `supabase/migrations/` (ver `CLAUDE.md`/`AGENTS.md` § S3).
- Saltarse el Artículo 4 (Spec-Anchored) para cambios de dominio o alcance.
- Marcar una tarea del `TODO.md` como hecha sin el commit correspondiente.
- Enmendar esta Constitution como efecto colateral de una tarea (ver "Cómo enmendar" arriba).

## Artículo 7 — Versionado y releases

- Los commits siguen **Conventional Commits** — el tipo (`feat`/`fix`/`feat!`) no es una etiqueta libre, determina el bump de SemVer y si entra al `CHANGELOG.md`.
- La versión del proyecto sigue **SemVer** (`MAJOR.MINOR.PATCH`) — romper compatibilidad es siempre MAJOR, sin excepción, incluso si el cambio fue chico de programar.
- Un release (tag de versión) es una decisión explícita, nunca automática por acumulación de commits.
- **La versión hoy vive en dos lugares** (`package.json` y `app.json`) — cualquier bump debe tocar los dos archivos a mano (ver `AGENTS.md`/`CLAUDE.md` § A9); `android.versionCode`/`ios.buildNumber` de `app.json` son contadores de build independientes del SemVer y no se tocan en un bump de versión.
- El trabajo del día a día se hace en `feature/*`/`fix/*`, nunca directo sobre `main`/`dev` — ver `AGENTS.md` sección "Branching". Al mergear a `dev` o `main`, recordar (no ejecutar solo) si corresponde bumpear versión.
- **El merge nunca es automático** — después de commitear y pushear una rama, parar y mostrar un resumen del cambio antes de ejecutar `git merge`, esperando confirmación explícita. Nunca encadenar commit → push → merge sin que el usuario vea qué se integra a `dev`/`main`.

Detalle completo, ejemplos y la relación con los snapshots de `specs/` en `.rocky-spec/reference/versioning.md` de la skill.

## Artículo 8 — Gestión de dependencias

- El lockfile (`package-lock.json`) se commitea **siempre** — nunca en `.gitignore`.
- Dependency scanning corre en CI (Dependabot u equivalente) — pendiente, ver `TODO.md` § A8. Mantener dependencias actualizadas en el tiempo, no solo parchear vulnerabilidades — ver `.rocky-spec/reference/dependencies.md`.
- Cuotify es software propietario (ver `LICENSE`) — no se redistribuye, por lo que compliance de licencias de terceros no es obligatorio, aunque sigue siendo buena práctica evitar dependencias con licencias copyleft fuerte (GPL/AGPL) por las restricciones que imponen igual.

## Overrides ratificados

Excepciones explícitas a algún artículo de arriba, acordadas para este proyecto en particular:

- Ninguna por ahora.

---

## Historial de enmiendas

| Fecha      | Versión | Cambio               | Motivo                                                                          |
| ---------- | ------- | -------------------- | ------------------------------------------------------------------------------- |
| 2026-09-11 | 1.0.0   | Ratificación inicial | Generado al cerrar el drift de adopción (gate de Reanudación, `mode-resume.md`) |
| 2026-09-12 | 1.0.1   | Aclaración de redacción (reformateo de tablas, Artículo 7 corregido) | Un auto-update de la skill había introducido en el Artículo 7 una afirmación incorrecta para este proyecto ("la versión vive en un solo lugar") y una regla irrelevante sobre distribución vía npm/PyPI — corregido para reflejar que la versión sigue en `package.json`/`app.json` (§ A9) |
