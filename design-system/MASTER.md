# Design System — Cuotify

> **Fuente de verdad en código:** `src/theme/` — este documento describe y audita
> lo que ya existe ahí. Si hay discrepancia, gana el código.
> Generado en la adopción con `/charlydev-flow` (2026-08-10).

**Producto:** app financiera personal · **Tono visual:** confiable pero cercano.
Índigo/violeta como identidad, superficies claras, tarjetas pastel para dar
identidad visual a cada préstamo sin recurrir a la seriedad fría de un banco.

---

## 1. Color

Definido en `src/theme/colors.ts`.

### Marca
| Token | Hex | Uso |
|---|---|---|
| `primary.main` | `#6366F1` | Acciones principales, tab activo, color por defecto de préstamo |
| `primary.light` | `#818CF8` | Estados hover/press, acentos suaves |
| `primary.dark` | `#4F46E5` | Splash, fondo del ícono adaptativo, extremo del gradiente |
| `secondary.main` | `#8B5CF6` | Extremo violeta de los gradientes |
| `secondary.light` | `#A78BFA` | — |
| `secondary.dark` | `#7C3AED` | — |

### Semánticos
| Token | Hex | Significado |
|---|---|---|
| `success` | `#10B981` | Cuota pagada, préstamo completado |
| `warning` | `#F59E0B` | Cuota pendiente, próxima a vencer |
| `error` | `#EF4444` | Cuota vencida, mora, acción destructiva |
| `info` | `#3B82F6` | Pago parcial, información neutra |

### Estados de pago (`colors.payment`)
Espejan los semánticos y son el mapeo canónico de `payments.status`:
`pending` → warning · `paid` → success · `overdue` → error · `partial` → info.

> Estos cuatro colores son la señal más importante de la app. **Nunca deben ser la
> única señal**: siempre acompañar con ícono y texto, tanto por accesibilidad como
> por daltonismo (rojo/verde es el par más problemático y es justo el que usamos
> para pagado vs vencido).

### Neutros
| Token | Hex | Uso |
|---|---|---|
| `background` | `#F8FAFC` | Fondo de pantalla |
| `surface` | `#FFFFFF` | Tarjetas, modales, inputs |
| `text.primary` | `#1E293B` | Texto principal — 13.6:1 sobre surface ✅ |
| `text.secondary` | `#64748B` | Labels, metadatos — 4.9:1 ✅ |
| `text.disabled` | `#94A3B8` | Deshabilitado — **2.6:1 ⚠️ falla WCAG AA** |
| `text.inverse` | `#FFFFFF` | Texto sobre gradientes |
| `border` | `#E2E8F0` | Bordes de input y tarjeta |
| `divider` | `#F1F5F9` | Separadores de lista |

### Paleta de préstamos (`colors.loanColors`)
10 pasteles asignados **secuencialmente** a cada préstamo, cíclicos. Su función es
que el usuario reconozca un préstamo por color a lo largo de listado, detalle y
calendario — no son decorativos.

```
#A5B4FC índigo   #C4B5FD púrpura  #F9A8D4 rosa     #99F6E4 turquesa  #FED7AA naranja
#A7F3D0 menta    #FDE68A amarillo #FBCFE8 pink     #BAE6FD celeste   #DDD6FE lavanda
```

Helpers en `src/utils/loanColors.ts`: `getNextLoanColor(lastColor)` (secuencial, usado
al crear) y `getLoanColorByIndex(i)` (determinístico).

> ⚠️ **Regla dura:** son colores claros (luminancia alta). Texto encima **siempre**
> `text.primary`, nunca blanco — con blanco el contraste ronda 1.5:1 y es ilegible.

### Gradientes (`src/theme/gradients.ts`)
`primary` `#4F46E5→#7C3AED` · `header` `#6366F1→#8B5CF6` · `card` `#818CF8→#A78BFA` ·
`button` `#6366F1→#7C3AED` · `background` `#F8FAFC→#EEF2FF`.
Se aplican con `expo-linear-gradient`.

> `gradients.loanCards` (`personal` / `business` / `emergency`) no se usa: no existe el
> concepto de "tipo de préstamo" en el dominio. Candidato a eliminar.

---

## 2. Tipografía

`src/theme/typography.ts` — fuentes **del sistema** (San Francisco en iOS, Roboto en
Android). Decisión correcta para una app financiera: máxima legibilidad, cero peso de
bundle, y respeta las convenciones de cada plataforma.

**Escala** — `xs 12 · sm 14 · base 16 · lg 18 · xl 20 · 2xl 24 · 3xl 30 · 4xl 36 · 5xl 48`

**Estilos compuestos**
| Estilo | Tamaño | Peso | Uso |
|---|---|---|---|
| `h1` | 36 | bold | Montos grandes del dashboard |
| `h2` | 30 | bold | Títulos de pantalla |
| `h3` | 24 | semiBold | Títulos de sección |
| `h4` | 20 | semiBold | Títulos de tarjeta |
| `body` | 16 | regular | Texto general |
| `bodySmall` | 14 | regular | Texto secundario |
| `label` / `labelSmall` | 14 / 12 | medium | Etiquetas de formulario |
| `caption` | 12 | regular | Metadatos, fechas |

`lineHeight` está expresado como **multiplicador** (`tight 1.2`, `normal 1.5`,
`relaxed 1.75`), pero React Native espera píxeles absolutos. Al usar los estilos
compuestos hay que multiplicar por el `fontSize` — verificar que se esté haciendo, o
un `lineHeight: 1.5` literal colapsa el interlineado.

**Montos:** usar siempre `fontVariant: ['tabular-nums']` en cifras que se alinean en
columna (cronogramas, listados). Sin eso los dígitos bailan entre filas.

---

## 3. Espaciado, radios y sombras

`src/theme/spacing.ts` — escala de 4px:
`xs 4 · sm 8 · md 16 · lg 24 · xl 32 · 2xl 48 · 3xl 64`

`borderRadius`: `sm 4 · md 8 · lg 12 · xl 16 · 2xl 24 · full 9999`.
Convención en uso: tarjetas `xl` (16), botones `lg` (12), chips y avatares `full`.

**Sombras — adaptadas por plataforma** (la decisión mejor resuelta del sistema):
iOS usa `shadowColor/Offset/Opacity/Radius` con `elevation: 0`; Android usa solo
`elevation` (1/2/3/5), porque la sombra del sistema Android es mucho más pesada y
replicar los valores de iOS se ve sucio. `shadow` se resuelve en tiempo de import
según `Platform.OS`.

**Área táctil mínima: 44×44 pt.** Los botones de ícono del cronograma están cerca del
límite — verificar y usar `hitSlop` donde no lleguen.

---

## 4. Componentes

### Existentes (`src/components/ui/`)
| Componente | Responsabilidad |
|---|---|
| `Toast` + `ToastProvider` | Feedback no bloqueante (`showSuccess` / `showError`) |
| `Modal` | Diálogos y hojas inferiores |
| `PasswordInput` | Input con toggle de visibilidad |
| `PhoneInput` | Input de teléfono con `libphonenumber-js` |
| `Logo` | Marca |

### Faltantes — carpetas creadas y vacías
`components/{borrowers,calendar,charts,common,loans,notifications}/` y `src/hooks/`
no tienen archivos. Toda la UI vive inline en pantallas de hasta 1371 líneas.
Los candidatos a extraer, por frecuencia de duplicación:

| Componente | Hoy duplicado en |
|---|---|
| `LoanCard` | `loans/index`, `dashboard/index`, `calendar/index` |
| `PaymentRow` | `loans/[id]`, `debts/[id]` |
| `StatCard` | `dashboard/index`, `debts/index` |
| `Money` | ~20 llamadas sueltas a `formatCurrency` |
| `EmptyState` | cada listado lo resuelve a su manera |
| `ScreenHeader` | todas las pantallas |
| `Button` / `Input` | inline en cada formulario |

Ver `docs/IMPROVEMENTS.md` § A1.

### Iconografía
SVGs **inline** con `react-native-svg`, definidos dentro de los `_layout.tsx`. Sin
librería de íconos. Funciona, pero implica que cada ícono repetido se redefine.
Al extraer componentes, centralizar en `src/components/common/icons/`.

> Todo ícono que sea la única etiqueta de un botón necesita
> `accessibilityLabel` + `accessibilityRole="button"`.

---

## 5. Reglas de uso

1. **Nunca hexadecimales sueltos.** Todo color sale de `src/theme`. Hoy hay **16
   hardcodeados** en `src/app/` — bloquean el dark mode y hay que migrarlos.
2. **`Alert.alert` solo para confirmaciones destructivas** (eliminar préstamo, cerrar
   sesión). Todo el resto del feedback va por Toast. Hoy conviven 15 `Alert` con el
   sistema de Toast sin criterio — unificar.
3. **El estado nunca se comunica solo con color.** Siempre color + ícono + texto.
4. **Montos siempre con moneda explícita.** `formatCurrency(monto, currency)` — el
   default actual (`'USD'`) es un bug activo, ver `docs/IMPROVEMENTS.md` § L1.
5. **Un color de préstamo, en todos lados.** Listado, detalle, calendario y gráficos
   usan el mismo `color_code` para el mismo préstamo.
6. **Listas > 20 ítems van en `FlatList`**, no en `.map()` dentro de `ScrollView`.

---

## 6. Pendientes del sistema

- [ ] **Dark mode** — `app.json` fuerza `userInterfaceStyle: "light"`. Los tokens ya
      están centralizados; falta migrar los 16 hex sueltos y convertir `colors` en
      función del esquema o exponerlo por context.
- [ ] **Contraste de `text.disabled`** (2.6:1) — subir a ~`#64748B` o reservarlo
      exclusivamente para elementos no informativos.
- [ ] **Dynamic Type** — los `fontSize` son fijos y varios contenedores tienen altura
      fija: con fuente grande del sistema el texto se corta.
- [ ] **Tokens de animación** — no hay duraciones ni curvas definidas, con
      `react-native-reanimated` ya instalado.
- [ ] **Eliminar `gradients.loanCards`** — no corresponde a ningún concepto del dominio.
- [ ] **Estados de foco** — sin estilo de foco visible para navegación por teclado
      (relevante en tablet, y `supportsTablet: true` está activado).
