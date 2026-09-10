# Revisión exhaustiva — Cuotify

> **Fecha:** 2026-08-10 · **Etapa del proyecto:** pre-launch / testing
> **Alcance:** 73 archivos TS/TSX (~18.300 líneas), 7 migraciones SQL, 3 Edge Functions.
> Cada hallazgo indica ubicación exacta, por qué importa y el fix propuesto.

**Índice de severidad**

| Nivel | Significado | Cantidad |
|---|---|---|
| 🔴 P0 | Bug de datos, seguridad, o bloqueante de launch | 8 |
| 🟠 P1 | Rompe en un caso realista o degrada la experiencia de forma visible | 9 |
| 🟡 P2 | Deuda técnica / mejora de calidad sin impacto inmediato | 12 |
| 🔵 P3 | Oportunidad de producto | 7 |

---

## 1. Seguridad y datos

### ✅ S1 · Un prestatario puede marcar sus propias cuotas como pagadas — Resuelto
`supabase/migrations/009_fix_payment_update_rls.sql`

El fix original (column-level `GRANT`) no funciona en este schema: prestamista y
prestatario comparten el rol Postgres `authenticated`, así que restringir columnas
por `GRANT` los restringe a **ambos**, rompiendo `markPaymentAsPaid` del prestamista.
Se optó por un trigger `BEFORE UPDATE` (`enforce_borrower_payment_columns`) que
permite la fila completa cuando quien edita es el `lender_id` del préstamo, y si no,
verifica que solo haya cambiado `borrower_comment` / `borrower_comment_date` —
si no, `RAISE EXCEPTION`. La policy de RLS sigue existiendo como primera barrera
(visibilidad de fila) y ahora tiene `WITH CHECK` explícito. Aplicado y verificado
contra producción (`pg_policy` / `pg_trigger`).

<details>
<summary>Análisis original (el fix propuesto ahí no se usó, ver arriba)</summary>

`supabase/migrations/001_initial_schema.sql`

```sql
CREATE POLICY "Los prestatarios pueden agregar comentarios"
  ON public.payments FOR UPDATE
  USING ( ... b.linked_profile_id = auth.uid() );
```

La policy se llama "agregar comentarios" pero concede **UPDATE sobre toda la fila**,
sin `WITH CHECK` y sin restricción de columnas. Un prestatario vinculado, con el
token anon y una llamada directa a PostgREST, puede hacer:

```
PATCH /rest/v1/payments?id=eq.<uuid>  { "status": "paid", "paid_amount": 999999 }
```

Y el préstamo del prestamista pasa a `completed` solo. Es el peor caso posible en una
app cuyo único activo es la veracidad del registro de deuda.

**Fix:** revocar el `UPDATE` amplio y reemplazarlo por column-level grants + `WITH CHECK`.

```sql
DROP POLICY "Los prestatarios pueden agregar comentarios" ON public.payments;

REVOKE UPDATE ON public.payments FROM authenticated;
GRANT  UPDATE (borrower_comment, borrower_comment_date) ON public.payments TO authenticated;

CREATE POLICY "Prestatarios comentan sus cuotas"
  ON public.payments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.loans l
    JOIN public.borrowers b ON b.id = l.borrower_id
    WHERE l.id = payments.loan_id AND b.linked_profile_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.loans l
    JOIN public.borrowers b ON b.id = l.borrower_id
    WHERE l.id = payments.loan_id AND b.linked_profile_id = auth.uid()));
```

Los column-grants son la pieza clave: las policies de RLS no saben de columnas, así
que la restricción tiene que venir del `GRANT`. Falta además reinstaurar el `GRANT
UPDATE` completo para el prestamista (que hoy pasa por la policy `FOR ALL`).

</details>

### ✅ S2 · Cualquier usuario puede insertar notificaciones a cualquier otro — Resuelto
`supabase/migrations/010_fix_notifications_insert_rls.sql`

```sql
CREATE POLICY "El sistema puede crear notificaciones"
  ON public.notifications FOR INSERT WITH CHECK (true);
```

Vector de spam/phishing dentro de la app: se pueden inyectar notificaciones con
título y cuerpo arbitrarios a la bandeja de otro usuario.

Se comprobó que ningún código cliente usa esta policy: no hay un solo
`.from('notifications')` en `src/`. El centro de notificaciones
(`src/app/(main)/notifications/index.tsx`) arma la lista en el cliente a partir de
`payments`, no lee la tabla. El único escritor real es la Edge Function
`send-payment-reminders`, que usa la `service_role` key y por lo tanto bypassea RLS
igual. Se eliminó la policy con `DROP POLICY` — no hacía falta reemplazarla por
`WITH CHECK (auth.uid() = user_id)` porque no hay ningún flujo que necesite insertar
desde el cliente. Verificado en producción (`pg_policy` ya no la lista).

### ✅ S3 · Drift entre `supabase/migrations/` y la base real — Resuelto
Se hizo `pg_dump --schema-only` contra la base real (`cuotify`, `iqiclocyjemrynksiycg`)
y se comparó contra las migraciones locales. Drift encontrado:

- `supabase migration list` mostraba **003 a 007 nunca registradas** en el historial
  remoto (se habían aplicado a mano por el dashboard) aunque su contenido sí estaba
  en la base → reparado con `supabase migration repair --status applied 003..007`.
- `transfer_proof_url` en `loans` y `personal_debts`, la tabla `notification_preferences`
  completa (con su policy y trigger), y la policy `"Profiles are viewable by
  authenticated users"` en `profiles` (necesaria para vincular por DNI y para que el
  prestatario vea el nombre de su prestamista) existían en producción sin estar en
  ninguna migración → documentado en `supabase/migrations/008_sync_schema.sql`
  (idempotente) y aplicado.

`interest_type: 'open'` sigue sin estar soportado por el `CHECK` — eso es § S4, tarea
aparte, ahora desbloqueada.

**Fix (prioridad máxima, es barato):**

```bash
supabase db dump --schema public --file supabase/schema_actual.sql
# diff contra las migraciones y escribir 008_sync_schema.sql con lo faltante
```

A partir de ahí, regla dura: **ningún cambio de schema por el dashboard** — todo
por migración versionada.

### ✅ S4 · La feature de préstamo abierto viola tres constraints — Resuelto
`supabase/migrations/011_support_open_loans.sql`

Confirmado con S3: la base real no tenía parcheado nada de esto, la feature estaba
completamente rota (el INSERT fallaba). Fix aplicado tal cual lo proponía este
hallazgo — `term_value`/`end_date` nullable, `CHECK` de `term_value` y de
`interest_type` actualizados — más un ajuste no previsto acá: `generate_payment_schedule()`
(el trigger `after_loan_insert`) hacía `FOR i IN 1..term_value LOOP`, que revienta con
`term_value NULL`; se le agregó un `RETURN` temprano para préstamos abiertos (no
generan cronograma). También se sacó el `as never` de `create.tsx`, se manda
`term_value: null` en vez de `0`, `loanCalculator.ts` ya no cae en la fórmula
francesa para `'open'` (relacionado a § L10), y `loans/[id].tsx` ya no muestra
"Invalid Date" / plazo `null` para estos préstamos. Falta todavía: no hay forma de
registrar un pago suelto contra un préstamo abierto (no es parte de este hallazgo,
queda anotado en `TODO.md`).

Probado con un INSERT real (dentro de una transacción con `ROLLBACK`) contra
producción: el trigger corre sin error y genera 0 pagos, como se espera.

<details>
<summary>Análisis original</summary>

`src/app/(main)/loans/create.tsx:262-283` inserta, para `interest_type === 'open'`:

| Valor enviado | Constraint en migrations | Resultado |
|---|---|---|
| `term_value: 0` | `CHECK (term_value > 0)` | ❌ violación |
| `end_date: null` | `end_date DATE NOT NULL` | ❌ violación |
| `interest_type: 'open'` | `CHECK (... IN ('simple','french'))` | ❌ violación |

Nótese el `as never` en `end_date` (línea 276): es exactamente el casteo que silenció
la advertencia de tipos que hubiera detectado esto. Si la base real ya fue parcheada,
esta feature funciona pero el repo miente; si no, está rota. En cualquier caso hay que
resolver S3 primero.

**Fix (además de S3):** para préstamos abiertos usar `term_value` nullable con
`CHECK (term_value IS NULL OR term_value > 0)`, `end_date` nullable, y ampliar el
`CHECK` de `interest_type`. Y quitar el `as never` de esa línea.

</details>

### 🔴 S5 · API key de RevenueCat hardcodeada en el código fuente
`src/services/subscription/index.ts:11-14` y también publicada en `SUBSCRIPTION_PLAN.md:67`.

Hoy es una *test key*, así que el riesgo actual es nulo — el problema es el **patrón**:
al publicar, la key de producción va a terminar en el mismo lugar, commiteada.

**Fix:** moverla a `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `..._ANDROID_KEY` en `.env` (que
ya está gitignoreado), y borrar la key del markdown. Las public SDK keys de RevenueCat
son de por sí visibles en el bundle, pero eso no es razón para versionarlas.

### 🟠 S6 · El estado premium es 100% client-side
El guard de límites vive solo en el cliente (`create.tsx:217-223`). No hay ninguna
verificación en la base de que un usuario free no tenga 20 préstamos. Un APK modificado
o una llamada directa a PostgREST saltea el paywall completo.

**Fix (para cuando haya usuarios pagos):** webhook de RevenueCat → tabla
`subscriptions` en Supabase → policy/trigger que valide el límite en `INSERT` sobre
`loans`. Mientras tanto es aceptable, pero conviene dejarlo escrito.

### 🟠 S7 · `handleSupabaseError` filtra mensajes crudos de Postgres a la UI
`src/services/supabase/client.ts:25-30` devuelve el `message` tal cual, y las pantallas
lo muestran con `showError('Error', errorMessage)`. El usuario final termina viendo
cosas como `duplicate key value violates unique constraint "borrowers_lender_id_dni_key"`.
Es mala UX y expone estructura interna de la base.

**Fix:** mapear los códigos frecuentes a mensajes en español y loguear el crudo.

```ts
const MENSAJES: Record<string, string> = {
  '23505': 'Ya existe un registro con esos datos.',
  '23514': 'Alguno de los valores ingresados no es válido.',
  '22003': 'El monto o la tasa ingresada es demasiado grande.',
  'PGRST116': 'No encontramos lo que buscabas.',
};
```

### 🟡 S8 · Falta eliminación de cuenta (bloqueante de Google Play)
Google Play exige, para apps con registro de cuenta, un flujo de **eliminación de cuenta
y datos** dentro de la app y una URL pública de solicitud. Apple exige lo equivalente
(guideline 5.1.1(v)). Hoy no existe ninguno de los dos, y `settings/index.tsx` no tiene
la opción.

**Fix:** Edge Function con service role que borre `auth.users` (el `ON DELETE CASCADE`
de `profiles` arrastra el resto) + pantalla de confirmación con doble paso. Sumar
política de privacidad publicada — también obligatoria.

---

## 2. Lógica de negocio y corrección de datos

### ✅ L1 · Diez implementaciones duplicadas de `formatCurrency`, la mitad con ARS fija — Resuelto (el bug de moneda; la duplicación sigue, ver Fix correcto)

> **Corregido el 2026-08-11.** La versión original de este hallazgo decía que el
> default `'USD'` de `formatCurrency` hacía que la UI mostrara pesos como `US$`.
> **Eso era incorrecto.** Ninguna pantalla importa esa función: las 8 definen la suya
> propia. El único consumidor del helper compartido es `services/pdf/loanPdf.ts`, y
> le pasa la moneda explícita. El default `'USD'` era código muerto. El problema real
> es el inverso, y se describe abajo.

Hay **10 definiciones locales** de `formatCurrency` repartidas por las pantallas —
`debts/[id].tsx` y `loans/[id].tsx` la definen **dos veces cada uno en el mismo
archivo**— más la del servicio. Cuatro de ellas hardcodean `currency: 'ARS'`:

| Archivo | Moneda | |
|---|---|---|
| `loans/[id].tsx:86` y `:276` | `'ARS'` fija | 🔴 un préstamo en USD se muestra en pesos |
| `dashboard/index.tsx:292` | `'ARS'` fija | 🔴 ídem |
| `calendar/index.tsx:166` | `'ARS'` fija | 🔴 ídem |
| `debts/index.tsx:153` | `'ARS'` fija | 🔴 ídem |
| `loans/index.tsx:141` | parámetro con default | ✅ |
| `notifications/index.tsx:156` | parámetro con default | ✅ |
| `debts/[id].tsx:49` y `:197` | usa `debt.currency` | ✅ |
| `debts/analyze.tsx:56` | parámetro obligatorio | ✅ |

Además las locales usan `minimumFractionDigits: 0` y la del servicio `2`, así que el
mismo monto se ve distinto según la pantalla.

**Estado:** el default del helper compartido se cambió a `'ARS'` y se tipó el
parámetro como `CurrencyType`; `dashboard`, `debts/index` y `loans/index` ya reciben
la moneda. Las dos de `loans/[id].tsx` (`PaymentItem` y el componente principal)
ahora toman `currency` por prop / `loan?.currency`, siguiendo el mismo patrón que
`debts/[id].tsx`. `calendar/index.tsx` combina pagos de préstamos y deudas en una
sola lista que puede mezclar monedas por fila, así que `formatCurrency` pasó a
recibir la moneda como segundo parámetro (no una sola de closure) y cada
`CalendarPaymentItem` carga su propia `currency`, tomada de `p.loan?.currency` /
`p.debt?.currency` en el mapeo. Ningún bug de constraint de por medio acá, solo
faltaba pasar el dato que la query ya traía.

**Fix correcto:** eliminar las 10 locales y dejar un único `<Money amount currency />`
en `components/common/` (parte de A1), con una sola decisión de formato.

### 🔴 L2 · Los totales del dashboard suman ARS + USD sin conversión
`src/services/supabase/loans.ts:557-575` — `totalRecovered`, `totalPending` y
`totalExpected` se calculan con `reduce` sobre todos los pagos, sin agrupar por
`currency`. Un usuario con un préstamo de USD 1.000 y otro de ARS 500.000 ve
"501.000" como total.

**Fix:** devolver las stats agrupadas por moneda y que el dashboard muestre una tarjeta
por moneda (o un selector). Nunca sumar monedas distintas, aunque haya cotización.

```ts
type StatsPorMoneda = Record<CurrencyType, { totalLent: number; totalRecovered: number; /* … */ }>;
```

### ✅ L3 · Overflow numérico con tasas mensuales altas — Resuelto
`supabase/migrations/012_widen_loan_interest_rate.sql`

`src/app/(main)/loans/create.tsx:266` guarda `parseFloat(interestRate) * 12` en una
columna `interest_rate DECIMAL(5,2)` (máximo 999,99). La validación de la línea 171
solo rechaza `> 999` **mensual**.

Toda tasa mensual mayor a **83,33%** produce un `numeric field overflow` de Postgres,
que se le muestra al usuario como error críptico después de completar 3 pasos de
formulario. En el mercado de préstamos informales argentino, tasas mensuales de 15-30%
son normales y de 100% no son inauditas.

Se amplió la columna a `DECIMAL(8,2)` (máximo 999.999,99 anual, ~83.333% mensual).
No hizo falta tocar la validación del formulario: el tope que ya exige (`> 999`
mensual, es decir hasta 11.988 anual) queda muy por debajo de lo que la columna
ampliada acepta, así que con el ALTER alcanza para que ambos queden coherentes.
`personal_debts.interest_rate` no tiene este bug — ahí la tasa se guarda directo,
sin `× 12`, y el tope de validación (999) ya coincidía con el límite real de esa
columna (`DECIMAL(5,2)`). Probado con un INSERT real (1800% anual = 150% mensual,
que antes desbordaba) dentro de una transacción con `ROLLBACK` contra producción.

### 🔴 L4 · El límite del plan free cuenta préstamos donde el usuario es deudor
`src/app/(main)/loans/create.tsx:218` llama a `getActiveLoans()`, que en
`loans.ts:289-301` filtra **solo por `status = 'active'`, sin `lender_id`**. RLS
devuelve además todos los préstamos donde el usuario es prestatario vinculado
(policy "Los prestatarios pueden ver sus préstamos vinculados").

Un usuario con rol `both` y 3 préstamos ajenos donde figura como deudor queda
bloqueado por el paywall **sin haber creado ni un solo préstamo propio**.

**Fix:** agregar `.eq('lender_id', user.id)` en `getActiveLoans()`, igual que ya hace
`getLoans()`. Mismo problema potencial en `getUpcomingPayments()` (`loans.ts:481`) y
`getOverduePayments()` (`loans.ts:504`), que tampoco filtran por lender.

### 🟠 L5 · `getLoanStats` mezcla criterios entre métricas
`loans.ts:567-575`: `totalLent` suma solo los préstamos `active`, pero `totalExpected`
suma **todos** los préstamos (incluidos completados y cancelados) y `totalRecovered`
suma todos los pagos pagados. Las tres métricas se muestran juntas en el dashboard como
si fueran comparables, y no lo son: el porcentaje de recuperación que sale de ahí no
significa nada.

**Fix:** definir explícitamente el universo de cada métrica (¿histórico o cartera
vigente?) y aplicarlo consistente a las tres.

### 🟠 L6 · La lógica de cálculo está duplicada en TypeScript y en PL/pgSQL
`src/services/calculations/loanCalculator.ts` calcula la cuota y el cronograma para el
preview; `generate_payment_schedule()` (migración 003) lo recalcula en la base al
insertar. Son dos implementaciones de la misma fórmula que ya divergen en un detalle:

- **TS** (`generateAmortizationSchedule:108-111`): en la última cuota fuerza
  `principalPortion = balance` y ajusta el interés.
- **SQL**: en la última cuota hace `v_principal_portion + v_balance` y fuerza el saldo a 0.

Para interés simple, además, el SQL usa `principal / term_value` redondeado por cuota,
lo que puede dejar una diferencia de centavos contra el `total_amount` que calculó el
cliente y ya se persistió en `loans`.

**Fix:** una sola fuente de verdad. La opción más simple es que el cliente calcule el
cronograma completo y lo inserte junto al préstamo en una transacción (RPC), y que el
trigger desaparezca. La alternativa es que el trigger sea el único que calcule y que el
cliente use la misma RPC para el preview.

### 🟠 L7 · La mora solo se recalcula si alguien abre la pantalla
`updateLoanPenalties()` se invoca desde el detalle del préstamo. Si el prestamista no
entra, `penalty_amount` queda congelado y el estado nunca pasa a `overdue`. El
dashboard, el calendario y las notificaciones muestran datos desactualizados.

Además `updateLoanPenalties` hace **un `UPDATE` por cuota en un loop secuencial**
(`loans.ts:702-726`): un préstamo de 24 cuotas dispara 24 round-trips.

**Fix:** mover el cálculo a un cron de Supabase (`pg_cron`) que corra una vez por día
sobre todos los pagos vencidos, en un solo `UPDATE ... FROM`. El cliente pasa a solo
leer. Bonus: habilita notificaciones de mora reales.

### 🟠 L8 · `markPaymentAsPaid` no es atómico
`loans.ts:382-428` hace: leer el pago → actualizar → leer todos los pagos → actualizar
el préstamo. Cuatro round-trips sin transacción. Si el proceso muere en el medio (la app
se cierra, se pierde la red), la cuota queda pagada y el préstamo nunca pasa a
`completed`. Con dos dispositivos marcando cuotas a la vez, hay carrera.

**Fix:** una RPC `mark_payment_paid(payment_id, amount)` que haga todo en una sola
transacción del lado del servidor. Aplica igual a `revertPaymentToPending`.

### 🟠 L9 · `updateAllLoanColors` es un loop de N updates sin filtro de usuario
`loans.ts:229-261`: recorre todos los préstamos y hace un `UPDATE` por cada uno, sin
`lender_id`, ignorando silenciosamente los errores (`if (!updateError) updatedCount++`).
Una migración de datos disfrazada de función de servicio.

**Fix:** si sigue siendo necesaria, convertirla en un `UPDATE` masivo con
`row_number()` del lado de Postgres. Si fue un one-off de migración, eliminarla.

### 🟡 L10 · El tipo `'open'` no está contemplado en el calculador
`InterestType` incluye `'open'` (`src/types/index.ts:16`) pero
`calculateLoanPayment()` no lo maneja: cae en el `else` y aplica **la fórmula
francesa**. Hoy no explota porque `create.tsx` corta antes con
`if (interestType !== 'open' && !payment) return`, pero es una bomba: cualquier
llamada futura al calculador con `'open'` devuelve un número sin sentido en vez de fallar.

**Fix:** `switch` exhaustivo con `never` check, o excluir `'open'` del tipo de entrada
del calculador.

### 🟡 L11 · `calculateLatePenalty` no acota la mora
Con `daily` al 1% y 400 días de atraso, la penalización es **4× la cuota** y sigue
creciendo sin techo. Muchas jurisdicciones limitan los intereses punitorios, y aunque
la app no sea un producto regulado, un número desbocado en pantalla no le sirve a nadie.

**Fix:** parámetro opcional `maxPenaltyRate` (ej. tope al 100% de la cuota) y exponerlo
en el formulario de creación.

### 🟡 L12 · `validators.ts` tiene una clave duplicada y una lista de TLDs que envejece
`src/utils/validators.ts:27,30` declara `'nte': 'net'` dos veces en el mismo objeto
literal (la segunda pisa a la primera, sin efecto, pero es un error silencioso que un
linter marcaría). Y `VALID_TLDS` es una allowlist cerrada: un usuario con
`@empresa.tech` o `@correo.ai` **no puede registrarse**.

**Fix:** invertir el criterio. Validar formato + detectar typos comunes (esa parte está
buena y es útil), pero **no rechazar** TLDs desconocidos: mostrar la sugerencia como
advertencia no bloqueante. La verificación real la da el email de confirmación.

### 🟡 L13 · Zod y react-hook-form están instalados pero no se usan en los formularios
`zod`, `react-hook-form` y `@hookform/resolvers` están en `dependencies`, pero
`loans/create.tsx` valida a mano con `useState<Record<string,string>>` y funciones
`validateStep1/2` de ~40 líneas cada una. Lo mismo en `debts/create.tsx`.

**Fix:** un schema Zod por paso, reutilizable entre préstamos y deudas (comparten casi
todos los campos), y `zodResolver`. Elimina ~150 líneas de validación duplicada y da
tipos derivados del schema.

---

## 3. Arquitectura y calidad de código

### 🔴 A1 · Cuatro pantallas superan las 1000 líneas; `src/components/` está vacío

```
1371  src/app/(main)/loans/create.tsx
1136  src/app/(main)/debts/create.tsx
1058  src/app/(main)/dashboard/index.tsx
1037  src/app/(main)/loans/[id].tsx
 845  src/app/(main)/debts/[id].tsx
```

Mientras tanto `src/components/{borrowers,calendar,charts,common,loans,notifications}/`,
`src/hooks/` y `src/services/auth/` son **carpetas sin un solo archivo**. La intención
arquitectónica está declarada en el árbol de directorios y no se ejecutó.

Cada una de esas pantallas contiene, en un mismo archivo: tipos locales, estado, fetching,
lógica de negocio, JSX y un `StyleSheet.create` de 300+ líneas.

**Plan de extracción** (ver `TODO.md` § Deuda técnica para el orden):

```
src/components/loans/
  LoanCard.tsx            ← repetido entre loans/index, dashboard y calendar
  PaymentRow.tsx          ← repetido entre loans/[id] y debts/[id]
  LoanFormStep1.tsx  Step2.tsx  Step3.tsx
  AmortizationPreview.tsx
src/components/common/
  StatCard.tsx  EmptyState.tsx  ScreenHeader.tsx  Money.tsx
src/hooks/
  useLoans.ts  useLoanDetail.ts  useDebts.ts  useAsyncData.ts
```

El objetivo no es "archivos más chicos" por estética: es que `loans/create.tsx` y
`debts/create.tsx` hoy son **el mismo formulario duplicado**, y cada fix (como L1 o L3)
hay que aplicarlo dos veces.

### 🟠 A2 · No hay capa de estado de servidor: cada pantalla reimplementa el fetch
El patrón `useState(loading) + useState(data) + useState(error) + useEffect + try/catch`
se repite en las 14 pantallas (69 `catch` en total). Sin caché compartida, sin
deduplicación, sin invalidación: volver del detalle al listado refetchea todo, y marcar
una cuota como pagada no actualiza el dashboard hasta que se recarga a mano.

**Fix:** TanStack Query — que además ya usás en 3 proyectos según tu perfil. Es la
mejora de mayor relación impacto/esfuerzo de toda esta lista: elimina el estado de
carga manual, da refetch en foco, y con `invalidateQueries` resuelve la
desincronización entre pantallas.

### 🟠 A3 · Sin tests sobre la lógica financiera
No hay ni un test en el proyecto. `loanCalculator.ts` es **código puro, sin
dependencias, con entradas y salidas numéricas** — el caso ideal para tests unitarios, y
el lugar donde un error cuesta plata real del usuario.

**Fix mínimo viable (2-3 horas, alto retorno):**

```
npx expo install -- --save-dev jest jest-expo @types/jest
```

y un `loanCalculator.test.ts` que cubra: sistema simple, sistema francés,
tasa 0, `Σ principalPortion === principalAmount`, mora en gracia / fuera de gracia /
daily / weekly / fixed, y el borde de la última cuota. Es la única forma de refactorizar
L6 (unificación TS/SQL) sin miedo.

### 🟠 A4 · Sin ErrorBoundary: un error de render deja la app en blanco
0 resultados para `ErrorBoundary` en todo `src/`. En React Native un throw durante el
render de una pantalla desmonta el árbol; en producción el usuario ve una pantalla
blanca sin explicación ni forma de volver.

**Fix:** Expo Router soporta exportar `ErrorBoundary` desde un `_layout.tsx`. Agregarlo
en `src/app/_layout.tsx` y en `(main)/_layout.tsx` con un fallback que ofrezca reintentar.

### 🟠 A5 · Sin crash reporting ni analytics
33 `console.log/error/warn` en `src/`, que en producción no van a ninguna parte. No hay
forma de saber si la app crashea en el dispositivo de un usuario, ni dónde abandonan el
flujo de creación de préstamo (que tiene 3 pasos y es el corazón del producto).

**Fix:** Sentry (`@sentry/react-native`, tiene plugin de Expo) antes del launch.

### 🟡 A6 · `theme/index.ts` usa `require()` dentro de un objeto
`src/theme/index.ts:15-22` construye `theme` con `require('./colors').colors`. Rompe el
tree-shaking, no tiene tipos derivados correctamente, y convive de forma redundante con
los `export` nombrados de arriba (que son los que el código realmente usa).

**Fix:** importar arriba y componer el objeto con las referencias ya importadas — o
eliminar el objeto `theme`, dado que ningún archivo lo consume.

### 🟡 A7 · 22 casos de `as any` / `as never`
El `as never` en los inserts está documentado en `CLAUDE.md` como patrón aceptado, y es
un workaround conocido de los tipos generados de Supabase. Pero ya causó un bug real
(**S4**: `end_date: null as never` silenció una violación de `NOT NULL`).

**Fix:** regenerar los tipos contra el schema real (`supabase gen types typescript`)
después de resolver S3. Con tipos correctos, la mayoría de los `as never` desaparecen y
los que queden marcan problemas reales.

### 🟡 A8 · Sin ESLint ni type-check en CI
No hay `lint` ni `typecheck` en los scripts de `package.json`, y no hay workflow de CI.
La clave duplicada de L12 y varios `useEffect` sin dependencias completas los detectaría
un linter en 5 segundos.

**Fix:**
```json
"scripts": {
  "lint": "eslint . --ext .ts,.tsx",
  "typecheck": "tsc --noEmit"
}
```
con `eslint-config-expo` y un workflow de GitHub Actions que corra ambos en cada push.

### 🟡 A9 · `package.json` 1.0.2 vs `app.json` 1.0.1
Las versiones ya están desincronizadas. Con `versionCode: 3` en Android, hay que
elegir una fuente de verdad antes de subir a las stores.

**Fix:** usar `expo-constants` para leer la versión de `app.json` en la UI, y considerar
`autoIncrement` en `eas.json` para el build number.

---

## 4. UX / UI

### 🔴 U1 · Accesibilidad prácticamente inexistente
**2** `accessibilityLabel` en ~18.300 líneas. Ningún `accessibilityRole`, ningún
`accessibilityState`. La app está construida con `TouchableOpacity` + `Text`, que sin
props de accesibilidad son opacos para VoiceOver y TalkBack.

Impacto concreto en esta app: los botones de acción del cronograma ("marcar pagada",
"revertir") son íconos SVG inline sin texto — para un lector de pantalla son botones sin
nombre. Un usuario con baja visión no puede gestionar sus préstamos.

**Fix incremental, por prioridad:**
1. `accessibilityRole="button"` + `accessibilityLabel` en todo `TouchableOpacity` cuyo contenido sea un ícono.
2. `accessibilityLabel` en los montos, con la moneda dicha en palabras.
3. Verificar contraste: `colors.text.disabled` (`#94A3B8`) sobre `colors.surface` da
   **2.6:1**, por debajo del mínimo WCAG AA de 4.5:1. Los colores pastel de préstamos
   con texto blanco encima también fallan.
4. Respetar `Text` scaling del sistema (hoy los `fontSize` son fijos y los contenedores
   tienen alturas fijas → con fuente grande se corta el texto).

### 🟠 U2 · Listas largas renderizadas con `.map()` dentro de `ScrollView`
45 usos de `.map()` en `src/app/` contra solo **2** `FlatList`. Un préstamo semanal a
2 años tiene 104 cuotas: `loans/[id].tsx` monta las 104 filas de golpe, cada una con su
cálculo de mora. Lo mismo en el listado de notificaciones y en el calendario.

**Fix:** `FlatList` (o `FlashList`) con `keyExtractor` en: cronograma de cuotas
(`loans/[id]`, `debts/[id]`), listado de préstamos, deudas y notificaciones. `ScrollView`
está bien solo para contenido acotado como los formularios.

### 🟠 U3 · Sin dark mode, con el sistema forzado a claro
`app.json` fija `"userInterfaceStyle": "light"`. En una app financiera que se consulta
de noche, y en 2026 donde el dark mode es expectativa por defecto, es una ausencia
notoria. Los tokens ya están centralizados en `src/theme/`, así que la migración es
mecánica: el trabajo real es reemplazar los **16 colores hexadecimales hardcodeados**
que quedaron sueltos en `src/app/`.

**Fix:** `colors` como función de esquema (`getColors(scheme)`) o un `ThemeProvider` con
context + `useColorScheme()`. Hacerlo **después** de A1 (extracción de componentes), o
hay que tocar 30 `StyleSheet.create`.

### 🟠 U4 · Fechas se ingresan tipeando `AAAA-MM-DD`
`loans/create.tsx:182-188` valida la fecha con un regex sobre texto libre. En móvil,
pedirle a alguien que tipee `2026-08-10` a mano es fricción pura y fuente garantizada de
errores — más aún en Argentina, donde el formato mental es DD/MM/AAAA.

**Fix:** `@react-native-community/datetimepicker` (o el date picker de Expo) con presets
rápidos: "Hoy", "Mañana", "En una semana". Es el campo de mayor abandono probable del
formulario.

### 🟠 U5 · El límite del plan free se descubre después de completar el formulario
`create.tsx:217-223`: el chequeo de `FREE_LIMITS.activeLoans` ocurre en `handleCreate()`,
o sea **después** de que el usuario completó los 3 pasos. Además el redirect al paywall
es silencioso: `router.push('/(main)/settings/premium')` sin ningún mensaje que explique
por qué se fue de la pantalla, y **se pierde todo lo cargado**.

**Fix:** chequear el límite al **entrar** a la pantalla y mostrar el estado de forma
honesta ("Usaste 3 de 3 préstamos del plan gratis") con el CTA claro. Si igual se llega
al final, persistir el borrador para no perder los datos al volver del paywall.

### 🟠 U6 · 15 `Alert.alert` conviviendo con un sistema de Toast propio
El proyecto tiene `ToastProvider` con `showSuccess`/`showError`, pero también usa 15
`Alert.alert` nativos. Dos lenguajes visuales distintos para lo mismo, elegidos sin
criterio aparente.

**Fix:** regla explícita — `Alert.alert` **solo** para confirmaciones destructivas que
requieren decisión (eliminar préstamo, cerrar sesión); Toast para todo el feedback no
bloqueante. Documentarlo en `design-system/MASTER.md` (ya está anotado ahí).

### 🟡 U7 · Sin manejo explícito de "sin conexión"
La app requiere red para todo y no detecta su ausencia. En el subte, con mala señal, el
usuario ve un spinner infinito o un error genérico de Supabase, sin saber que el
problema es la conexión.

**Fix:** `@react-native-community/netinfo` + un banner global de "Sin conexión". Con
TanStack Query (A2) se suma caché de lectura offline casi gratis.

### 🟡 U8 · Estados vacíos y de error probablemente inconsistentes
Con toda la UI inline en cada pantalla, cada listado resuelve "no hay datos" y "falló la
carga" a su manera. Un `EmptyState` compartido con ilustración, texto y CTA es de las
extracciones de mayor impacto visual por menor esfuerzo (parte de A1).

### 🟡 U9 · Sin confirmación al salir de un formulario a medio cargar
`handleBack()` (`create.tsx:203-210`) hace `router.back()` sin preguntar. Tres pasos de
datos se pierden con un gesto de swipe accidental.

**Fix:** detectar "form sucio" y confirmar la salida; idealmente guardar borrador.

### 🟡 U10 · El comprobante de transferencia falla en silencio
`create.tsx:250-257`: si `uploadTransferProof` tira error, se traga la excepción con un
`catch {}` vacío y el préstamo se crea sin comprobante. El usuario adjuntó un archivo y
cree que quedó guardado.

**Fix:** no bloquear la creación (esa decisión está bien), pero avisar: "El préstamo se
creó, pero no pudimos subir el comprobante. Podés adjuntarlo desde el detalle."

### 🟡 U11 · Búsqueda y filtros incompletos en los listados

> **Corregido el 2026-08-11.** La versión original decía "sin búsqueda ni filtros".
> **Era incorrecto:** `loans/index.tsx` ya tiene ambos.

Estado real:

| Pantalla | Filtros por estado | Búsqueda |
|---|---|---|
| `loans/index.tsx` | ✅ chips Todos / Activos / Completados | ✅ por nombre de prestatario |
| `debts/index.tsx` | ✅ chips Todos / Activas / Completadas | ❌ falta |

**Fix:** agregar el buscador en `debts/index.tsx` replicando el de préstamos. Falta
además en ambas el orden configurable (por vencimiento, por monto) y un filtro
"Vencidos", que hoy no se puede aislar.

### 🟡 U12 · Feedback háptico ausente
Marcar una cuota como pagada es el momento de mayor satisfacción de la app y no tiene
ninguna respuesta táctil. `expo-haptics` es una línea de código.

---

## 5. Oportunidades de producto (🔵 P3)

| # | Idea | Por qué |
|---|---|---|
| P1 | **Registrar pago parcial** | El estado `partial` ya está en el schema sin UI. En préstamos informales el pago incompleto es la norma, no la excepción — hoy la app obliga a mentir (marcar todo o nada) |
| P2 | **Recibo compartible por cuota** | Ya existe el PDF del cronograma; un recibo individual por cuota cobrada, compartible por WhatsApp, es el artefacto que hoy se manda a mano y le da valor al prestatario |
| P3 | **Historial y score del prestatario** | Con los datos que ya se guardan: % de cuotas pagadas a tiempo, atraso promedio. Ayuda a decidir si volver a prestarle. Ya está anotado como TODO en `loans.ts:338` |
| P4 | **Cotización ARS/USD** | Con dos monedas soportadas y una economía bimonetaria, mostrar el equivalente (con fecha de cotización) resuelve L2 de forma útil en vez de solo separar los totales |
| P5 | **Onboarding en el primer uso** | La app abre en un dashboard vacío. Un flujo de 3 pantallas explicando préstamos vs deudas resolvería la confusión conceptual central del producto |
| P6 | **Widget / notificación de "cobrar hoy"** | El caso de uso real es matutino: "a quién le cobro hoy". Un resumen diario o widget de home screen encaja perfecto con el modelo de datos que ya existe |
| P7 | **Compartir cartera con un socio** | Prestar en pareja o entre socios es común; hoy el modelo asume un `lender_id` único |

---

## 6. Orden sugerido de ataque

Dado que el proyecto está **pre-launch**, el orden prioriza *lo que no debe salir roto a
producción* sobre *lo que hace más lindo el código*.

**Bloque 1 — antes de cualquier otra cosa (1-2 días)**
`S3` (dump del schema real) → `S4` → `L1` → `L3` → `L4` → `S1` → `S2`

Son bugs que afectan datos visibles o la seguridad, y varios son de una línea. `S3` va
primero porque sin saber cómo es la base real, `S4` y `L3` no se pueden ni verificar.

**Bloque 2 — requisitos de launch (2-3 días)**
`S8` (eliminación de cuenta + privacidad) → `A4` (ErrorBoundary) → `A5` (Sentry) →
`S5` (keys a `.env`) → `A9` (versiones)

**Bloque 3 — red de seguridad (2-3 días)**
`A3` (tests del calculador) → `A8` (lint + typecheck en CI) → `L6` (unificar TS/SQL, ya
con tests que respalden el cambio)

**Bloque 4 — la deuda que frena todo lo demás (1-2 semanas)**
`A1` (extraer componentes y hooks) → `A2` (TanStack Query) → `L13` (Zod en formularios)

Este bloque es el que hace que todo lo siguiente cueste la mitad. Después de extraer
componentes, `U3` (dark mode), `U8` (estados vacíos) y `U1` (accesibilidad) pasan de ser
"tocar 30 archivos" a "tocar 5 componentes".

**Bloque 5 — UX**
`U4` (date picker) → `U5` (límite free adelantado) → `U2` (FlatList) → `U6` (unificar
Alert/Toast) → `U1` (accesibilidad) → `U3` (dark mode) → `U11` (búsqueda)

**Bloque 6 — producto**
`P1` (pago parcial) → `P2` (recibo por cuota) → `L7` (cron de mora) → `P5` (onboarding)
