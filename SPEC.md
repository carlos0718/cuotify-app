# SPEC — Cuotify

> **Versión:** 1.0.2 · **Etapa:** Pre-launch / testing
> **Generado:** 2026-08-10 (adopción con `/charlydev-flow`)
> Metodología: **SDD** (Spec-Driven Development) + análisis de dominio **DDD**.
> Este documento es la fuente de verdad del *qué*. El *cómo* vive en `CLAUDE.md`.

---

## 1. Problema

En Latinoamérica una porción enorme del crédito personal ocurre **fuera del sistema
bancario**: se presta plata entre conocidos, con interés, en cuotas semanales o
mensuales. Ese circuito se administra hoy con cuadernos, planillas de Excel y
mensajes de WhatsApp. Los problemas concretos:

- El prestamista no sabe con precisión **cuánto tiene prestado, cuánto recuperó y qué está vencido**.
- Calcular cuotas con interés (simple o francés) a mano es propenso a error.
- No hay recordatorios: el cobro depende de que el prestamista se acuerde.
- El prestatario no tiene visibilidad de su propia deuda ni comprobante de lo que pagó.
- No hay registro histórico: si se pierde el cuaderno, se pierde el préstamo.

## 2. Propuesta de valor

Una app móvil que convierte ese cuaderno en un sistema: **calcula el cronograma,
lo persiste, avisa antes de cada vencimiento y le da visibilidad a las dos partes**.

Cuotify cubre las **dos caras de la misma persona**: casi todos los usuarios prestan
plata *y* deben plata. Por eso la app tiene dos módulos paralelos e independientes:

| Módulo | Rol del usuario | Entidad raíz |
|---|---|---|
| **Préstamos** | Prestamista (presto plata) | `loans` → `payments` |
| **Deudas** | Deudor (debo plata) | `personal_debts` → `debt_payments` |

Cuando el prestatario también es usuario de Cuotify, ambas vistas se sincronizan
(vinculación por DNI) y el préstamo aparece en modo lectura del lado del deudor.

## 3. Usuarios y roles

| Rol | Valor en `profiles.role` | Qué puede hacer |
|---|---|---|
| **Prestamista** | `lender` | Crear/gestionar prestatarios, préstamos, cobrar cuotas, aplicar mora |
| **Prestatario** | `borrower` | Ver los préstamos donde está vinculado, comentar cuotas |
| **Ambos** | `both` | Todo lo anterior (rol dominante en la práctica) |

> Nota: el módulo **Deudas personales** es independiente del rol — cualquier usuario
> puede registrar deudas propias sin que exista un prestamista en la app.

---

## 4. Modelo de dominio (DDD)

### 4.1 Lenguaje ubicuo

| Término | Definición | Implementación |
|---|---|---|
| **Préstamo** (*Loan*) | Dinero que el usuario entrega a un tercero, con condiciones pactadas | `loans` |
| **Deuda personal** (*Personal Debt*) | Dinero que el usuario debe a un tercero | `personal_debts` |
| **Prestatario** (*Borrower*) | Contacto del prestamista que recibe el préstamo. Puede o no ser usuario de la app | `borrowers` |
| **Vinculación** (*Link*) | Unión entre un `borrower` y un `profile` real vía DNI | `borrowers.linked_profile_id` |
| **Cuota** (*Payment*) | Una obligación de pago en una fecha, con desglose capital/interés | `payments`, `debt_payments` |
| **Cronograma** (*Schedule*) | Conjunto ordenado de cuotas generado al crear el préstamo | trigger `after_loan_insert` |
| **Sistema de interés** | Fórmula de cálculo: simple, francés u abierto | `loans.interest_type` |
| **Mora** (*Late penalty*) | Recargo por pagar después del vencimiento + gracia | `payments.penalty_amount` |
| **Período de gracia** | Días posteriores al vencimiento sin recargo | `loans.grace_period_days` |
| **Capital** (*Principal*) | Monto original prestado, sin interés | `principal_amount` |

### 4.2 Agregados y límites de consistencia

```
AGREGADO: Préstamo                          AGREGADO: Deuda personal
┌──────────────────────────────┐            ┌──────────────────────────────┐
│ Loan  ◄── raíz               │            │ PersonalDebt  ◄── raíz       │
│  ├── Payment[]  (cascade)    │            │  ├── DebtPayment[] (cascade) │
│  └── ref → Borrower          │            │  └── creditor_name (VO)      │
└──────────────────────────────┘            └──────────────────────────────┘
        │                                            (sin relación entre agregados)
        ▼
AGREGADO: Prestatario
┌──────────────────────────────┐            AGREGADO: Perfil
│ Borrower  ◄── raíz           │            ┌──────────────────────────────┐
│  ├── ref → lender (Profile)  │  ────────► │ Profile  ◄── raíz            │
│  └── ref → linked (Profile)  │            │  ├── NotificationPreferences │
└──────────────────────────────┘            │  └── PushToken[]             │
                                            └──────────────────────────────┘
```

**Invariantes del agregado Préstamo**
1. Un préstamo siempre tiene ≥1 cuota (garantizado por el trigger `after_loan_insert`).
2. `total_amount = principal_amount + total_interest`.
3. `Σ payments.principal_portion = principal_amount` (el redondeo se absorbe en la última cuota).
4. Un préstamo pasa a `completed` ⟺ **todas** sus cuotas están en `paid`.
5. Solo un préstamo `completed` puede eliminarse.
6. Al revertir una cuota pagada, un préstamo `completed` vuelve a `active`.

**Invariantes del agregado Prestatario**
1. `UNIQUE(lender_id, dni)` y `UNIQUE(lender_id, email)` — sin duplicados por prestamista.
2. La deduplicación en escritura busca por DNI, luego por teléfono, antes de crear.
3. `linked_profile_id` se resuelve por coincidencia exacta de DNI contra `profiles`.

### 4.3 Value Objects (conceptualmente — hoy son campos primitivos)

- `Money` = `{ amount: decimal(12,2), currency: 'ARS' | 'USD' }`
- `Term` = `{ value: integer, type: 'weeks' | 'months' }`
- `InterestPolicy` = `{ type: 'simple' | 'french' | 'open', annualRate: decimal }`
- `PenaltyPolicy` = `{ type: 'none'|'fixed'|'daily'|'weekly', rate: decimal, graceDays: int }`

> **Deuda de diseño:** hoy estos VOs están aplanados como columnas sueltas y se
> re-arman a mano en cada pantalla. Ver `docs/IMPROVEMENTS.md` § Lógica.

### 4.4 Máquinas de estado

```
Loan:     active ──(todas las cuotas paid)──► completed ──► [delete permitido]
            ▲                                     │
            └───────(revertir una cuota)──────────┘
          active ──► defaulted    (definido en el CHECK, sin transición implementada)
          active ──► cancelled    (definido en el CHECK, sin transición implementada)

Payment:  pending ──(vence + gracia)──► overdue ──(cobro)──► paid
            └──────────(cobro)───────────────────────────────►│
          paid ──(revertir)──► pending
          partial: definido en el CHECK, sin flujo de UI implementado

PersonalDebt: active ──► completed | cancelled ──► [delete permitido]
```

### 4.5 Reglas de negocio del cálculo

| Sistema | Fórmula | Comportamiento |
|---|---|---|
| **Simple** | `interésTotal = capital × tasaPeriódica × plazo` | Interés fijo por cuota, no baja con el saldo |
| **Francés** | `PMT = P × [r(1+r)ⁿ] / [(1+r)ⁿ−1]` | Cuota fija; el interés se calcula sobre saldo y decrece |
| **Abierto** | sin cronograma | Solo capital + tasa; sin plazo ni cuotas fijas |

- Tasa periódica = `tasaAnual / 100 / periodosPorAño`, con **52** períodos/año para
  `weeks` y **12** para `months`.
- En la UI el usuario ingresa la tasa **mensual**; se persiste multiplicada ×12 como anual.
- Mora: `none` (0) · `fixed` (% una vez) · `daily` (% × días post-gracia) ·
  `weekly` (% × semanas post-gracia, redondeadas hacia arriba).

---

## 5. Features

Leyenda: ✅ implementado · 🟡 implementado con deuda/limitación · ⏳ pendiente

### 5.1 Autenticación e identidad
- ✅ Registro con email + contraseña (Supabase Auth) y creación automática de `profile` (trigger)
- ✅ Login con persistencia de sesión en AsyncStorage
- ✅ Recuperación de contraseña por **código OTP** (no por magic link)
- ✅ Edición de perfil (nombre, DNI, teléfono, rol)
- ✅ Bloqueo biométrico de la app (`expo-local-authentication`)
- ⏳ Login social (Google / Apple) — requisito de App Store si se agrega otro social
- ⏳ Eliminación de cuenta y export de datos (requisito de Google Play y GDPR)

### 5.2 Préstamos (rol prestamista)
- ✅ Alta en 3 pasos: datos del prestatario → condiciones → mora y preview
- ✅ Deduplicación automática de prestatarios por DNI, luego por teléfono
- ✅ Vinculación automática del prestatario a su cuenta de la app por DNI
- ✅ Sistema simple y francés con preview del cronograma antes de guardar
- 🟡 Préstamo **abierto** (`interest_type: 'open'`, sin cronograma) — el código lo
  soporta pero los constraints de `supabase/migrations/` no lo permiten (ver § 8)
- ✅ Selección de moneda ARS / USD por préstamo
- ✅ Configuración de mora: tipo, tasa y días de gracia
- ✅ Comprobante de transferencia adjunto (imagen a Supabase Storage)
- ✅ Color pastel secuencial por préstamo (10 colores, cíclico)
- ✅ Detalle con cronograma completo, marcar/revertir cuota pagada
- ✅ Baja de préstamo (solo si está `completed`)
- ✅ Análisis de documento con IA para importar préstamos en lote (Gemini vía Edge Function)
- ⏳ Pago **parcial** de cuota — el estado `partial` existe en el schema, sin UI
- ⏳ Refinanciación / reestructuración de un préstamo vigente
- ⏳ Transiciones a `defaulted` y `cancelled`

### 5.3 Deudas personales (rol deudor)
- ✅ Alta de deuda propia con acreedor, condiciones e interés
- ✅ Cronograma generado por RPC `generate_debt_payment_schedule`
- ✅ Marcar / revertir cuotas pagadas
- ✅ Import de resumen de tarjeta de crédito con IA (Edge Function `analyze-credit-card`)
- ✅ Baja de deuda (solo `completed` o `cancelled`)
- ✅ Vista de préstamos vinculados (donde el usuario es el prestatario), en solo lectura

### 5.4 Cobros, mora y calendario
- ✅ Marcar cuota como pagada con auto-transición del préstamo a `completed`
- ✅ Revertir cuota pagada con vuelta del préstamo a `active`
- ✅ Cálculo de mora por cuota con período de gracia
- ✅ Calendario mensual con cuotas marcadas por color de préstamo
- 🟡 La mora se recalcula **solo al abrir la pantalla del préstamo** — no hay job periódico
- ⏳ Registro de pagos parciales y de pagos adelantados

### 5.5 Notificaciones
- ✅ Push token por dispositivo (`push_tokens`) con soporte iOS/Android
- ✅ Recordatorios locales programados por cuota, N días antes del vencimiento
- ✅ Centro de notificaciones in-app con badge de no leídas
- ✅ Preferencias por usuario (push / email / días de anticipación)
- ✅ Edge Function `send-payment-reminders` para envíos server-side
- ⏳ Notificación al prestamista cuando el prestatario comenta una cuota
- ⏳ Cron/schedule que dispare `send-payment-reminders` automáticamente

### 5.6 Dashboard y reportes
- ✅ Dashboard prestamista: total prestado, recuperado, pendiente, activos, vencidos
- ✅ Dashboard prestatario: deuda total, pagado, próxima cuota
- ✅ Export a PDF del cronograma (Pro)
- ✅ Export CSV de préstamos, pagos, deudas y todo junto (Pro)
- ✅ Recordatorio por WhatsApp con mensaje pre-armado (Pro)
- 🟡 Dashboard avanzado: la RPC `get_monthly_interest_earned` existe, falta el gráfico
- ⏳ Reporte de rentabilidad y de morosidad por prestatario

### 5.7 Monetización (Cuotify Pro)
- ✅ Integración RevenueCat con paywall y Customer Center nativos
- ✅ Límites free: 3 préstamos activos, 2 deudas, 5 prestatarios
- ✅ Guards en creación de préstamo y de deuda con redirección al paywall
- 🟡 API key de RevenueCat es **test key** hardcodeada en el código fuente
- ⏳ Guard del límite de prestatarios (definido en `FREE_LIMITS`, no aplicado)
- ⏳ Productos creados en App Store Connect y Google Play Console

---

## 5.8 Schema de DB (resumen — ver `supabase/migrations/` para el detalle exacto)

> Nota: R1 ya documenta que hay columnas en producción sin migración correspondiente — este resumen es de las tablas creadas por migración, no una garantía de que coincide 1:1 con la DB real.

| Tabla | Migración | Rol |
|---|---|---|
| `profiles` | `001_initial_schema.sql` (+ trigger de `002_auto_create_profile.sql`) | Perfil de usuario (lender/borrower/both), 1:1 con `auth.users` |
| `borrowers` | `001` | Contacto del prestamista — raíz del agregado Prestatario |
| `loans` | `001`, ampliada en `003` (interest_type), `004` (mora), `005` (currency), `011` (open), `012` (rate) | Raíz del agregado Préstamo |
| `payments` | `001` | Cuotas de un préstamo — generadas por trigger `after_loan_insert` |
| `notifications` | `001` | Centro de notificaciones in-app |
| `push_tokens` | `001` | Tokens de push por dispositivo |
| `personal_debts` | `006` | Raíz del agregado Deuda personal |
| `debt_payments` | `006` | Cuotas de una deuda personal — generadas por RPC `generate_debt_payment_schedule` |
| `notification_preferences` | `008` | Preferencias de notificación por usuario |

## 5.9 API Contracts (RPCs y Edge Functions — no hay API REST propia, todo es Supabase directo)

| Contrato | Tipo | Definido en | Consumido por |
|---|---|---|---|
| `generate_debt_payment_schedule` | RPC (Postgres function) | `007_add_monthly_interest_rpc.sql` y siguientes | `personalDebts.ts` al crear una deuda |
| `get_monthly_interest_earned` | RPC | `007_add_monthly_interest_rpc.sql` | Dashboard prestamista (§ 5.6, gráfico pendiente) |
| `after_loan_insert` (trigger, no RPC invocable) | Trigger de DB | `001_initial_schema.sql` | Se dispara solo al insertar en `loans` |
| `analyze-loans-document` | Edge Function (Deno) | `supabase/functions/analyze-loans-document/` | Importación de préstamos en lote con Gemini (§ 5.2) |
| `analyze-credit-card` | Edge Function (Deno) | `supabase/functions/analyze-credit-card/` | Import de resumen de tarjeta con IA (§ 5.3) |
| `send-payment-reminders` | Edge Function (Deno) | `supabase/functions/send-payment-reminders/` | Envío server-side de recordatorios (§ 5.5) — sin cron automático todavía |

---

## 6. Requisitos no funcionales

| Área | Estado | Notas |
|---|---|---|
| **Seguridad de datos** | 🟡 | RLS habilitado en todas las tablas; hay policies demasiado permisivas (§ 8) |
| **Offline** | ⏳ | La app requiere conexión para todo; no hay caché ni cola de escritura |
| **Performance** | 🟡 | Listas renderizadas con `.map()` dentro de `ScrollView` (45 casos vs 2 `FlatList`) |
| **Accesibilidad** | 🔴 | 2 `accessibilityLabel` en ~18.300 líneas; sin roles ni soporte de screen reader |
| **Dark mode** | ⏳ | `userInterfaceStyle: "light"` forzado en `app.json` |
| **i18n** | ⏳ | Strings en español hardcodeados en las pantallas |
| **Testing** | 🔴 | Sin tests, sin lint, sin CI |
| **Observabilidad** | 🔴 | Sin crash reporting (Sentry) ni analytics |
| **Moneda** | 🟡 | ARS y USD conviven pero **se suman sin conversión** en los totales del dashboard |

---

## 7. Criterios de aceptación

### Cerrados
- [x] Un prestamista puede crear un préstamo y ver el cronograma completo generado
- [x] El mismo prestatario cargado dos veces con el mismo DNI no se duplica
- [x] Marcar la última cuota pagada mueve el préstamo a `completed` automáticamente
- [x] Revertir una cuota de un préstamo completado lo devuelve a `active`
- [x] Un préstamo `active` no puede eliminarse
- [x] Un prestatario vinculado ve sus préstamos en modo lectura
- [x] El usuario free ve el paywall al intentar crear el 4° préstamo activo
- [x] El cronograma se puede exportar a PDF y compartir (Pro)
- [x] La app se puede bloquear con biometría

### Abiertos
- [ ] Un prestatario vinculado **no puede** modificar el estado de sus propias cuotas
- [ ] Una tasa mensual alta (>83%) se guarda sin error de overflow numérico
- [ ] El límite del plan free cuenta solo los préstamos donde el usuario es prestamista
- [ ] El préstamo abierto (`open`) se crea y se lee correctamente contra el schema real
- [ ] Los totales del dashboard no mezclan ARS con USD
- [ ] La mora se actualiza sin necesidad de abrir la pantalla del préstamo
- [ ] Las pantallas principales son navegables con lector de pantalla
- [ ] Un crash en cualquier pantalla no deja la app en blanco (ErrorBoundary)
- [ ] `supabase/migrations/` reproduce exactamente el schema de producción

---

## 8. Riesgos abiertos

| # | Riesgo | Impacto | Estado |
|---|---|---|---|
| R1 | **Drift de schema**: `transfer_proof_url` y otras columnas están en el código pero en ninguna migración. No se puede reconstruir la DB desde cero | Alto | Sin verificar |
| R2 | **Policy de RLS permisiva**: `"Los prestatarios pueden agregar comentarios"` es `FOR UPDATE` sin `WITH CHECK` → un prestatario puede marcar sus cuotas como pagadas | Alto | Abierto |
| R3 | **Notificaciones sin control**: policy `WITH CHECK (true)` permite insertar notificaciones a cualquier `user_id` | Medio | Abierto |
| R4 | **Overflow de `interest_rate`**: `DECIMAL(5,2)` vs tasa mensual ×12 validada hasta 999 | Medio | Abierto |
| R5 | **Suma de monedas**: ARS y USD se agregan en el mismo total sin conversión | Medio | Abierto |
| R6 | **Sin tests**: toda la lógica financiera (interés, amortización, mora) sin cobertura | Alto | Abierto |
| R7 | **Duplicación de lógica**: el cálculo de cuotas existe en TS y en PL/pgSQL; pueden divergir | Medio | Abierto |
| R8 | **Cumplimiento de stores**: falta eliminación de cuenta (Google Play) y política de privacidad publicada | Bloqueante para launch | Abierto |

> El análisis completo con ubicación exacta de cada hallazgo y su fix propuesto
> está en **`docs/IMPROVEMENTS.md`**.

---

## 9. Fuera de alcance (por ahora)

- Procesamiento real de pagos (pasarelas, transferencias dentro de la app)
- Scoring crediticio o buró de morosos compartido entre prestamistas
- Cualquier forma de intermediación financiera regulada
- Multi-usuario / equipos sobre la misma cartera de préstamos
- Versión web (el bundler web está configurado pero no es un target soportado)

---

## 10. Historial de cambios

> Este proyecto usa Finding IDs (`S*`/`L*`/`A*`/`U*`/`P*`, ver `AGENTS.md` § Trazabilidad de requisitos) en vez del esquema `RF-N`/`US-N` — las entradas de features nuevas referencian su ID de finding cuando corresponde.

| Fecha | Cambio | Referencia |
|---|---|---|
| 2026-08-10 | Adopción del proyecto con `rocky-spec` (entonces `charlydev-flow`) — SPEC reconstruido desde el código existente | — |
| 2026-09-11 | `.rocky-spec` actualizado a v0.20.0 — SPEC.md, AGENTS.md, CLAUDE.md, OBSERVABILITY.md, CHANGELOG.md y TODO.md alineados al template vigente (drift de contenido resuelto) | — |
