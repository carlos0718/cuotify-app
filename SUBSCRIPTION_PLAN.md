# Plan de Suscripciones — Cuotify Pro

> **Versión:** 2.0
> **Fecha:** Marzo 2026
> **Estado:** En implementación

---

## Modelo Freemium

El objetivo es no frustrar a usuarios casuales con límites razonables, mientras se ofrece valor genuino en el plan Pro.

---

## Límites del Plan Gratuito

| Funcionalidad             | Free | Pro        |
| ------------------------- | ---- | ---------- |
| Préstamos activos         | 3    | Ilimitados |
| Deudas personales         | 2    | Ilimitadas |
| Prestatarios              | 5    | Ilimitados |
| Exportar a PDF            | ❌   | ✅         |
| Recordatorio por WhatsApp | ❌   | ✅         |
| Dashboard avanzado        | ❌   | ✅         |
| Backup / Exportar CSV     | ❌   | ✅         |

---

## Lo que NO se limita (nunca)

- Tipos de interés (simple / francés) — es el core de la app
- Notificaciones — limitar alertas financieras se siente punitivo
- Múltiples monedas (ARS / USD)
- El calendario

---

## Features exclusivas Pro

1. **Exportar a PDF** — cronograma de pagos como recibo formal, compartible por cualquier app
2. **Recordatorio por WhatsApp** — abre WhatsApp con mensaje pre-armado al prestatario
3. **Dashboard avanzado** — gráfico de intereses ganados por mes, historial _(pendiente)_
4. **Backup / Exportar CSV** — descarga todos los datos _(pendiente)_

---

## Precios (RevenueCat)

| Plan                  | Precio      | Notas                  |
| --------------------- | ----------- | ---------------------- |
| Mensual (`monthly`)   | ~USD 5/mes  |                        |
| Anual (`yearly`)      | ~USD 48/año | Ahorro ~20% vs mensual |
| Lifetime (`lifetime`) | Pago único  | Sin renovaciones       |

---

## Infraestructura técnica

**SDK:** RevenueCat (`react-native-purchases` + `react-native-purchases-ui`)

- Maneja App Store + Play Store en un solo lugar
- Free hasta USD 2.500/mes de revenue
- Paywall y Customer Center nativos configurables desde el dashboard

**Configuración RevenueCat:**

- API Key: `test_JchOkvEzlhSdWAJnCRZjXxRBAkU` _(reemplazar con prod key al publicar)_
- Entitlement: `Cuotify Pro`
- Offering: `default` (3 packages: monthly, yearly, lifetime)

---

## Estado de implementación

### ✅ Completado

| Archivo                                       | Descripción                                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/services/subscription/index.ts`          | Wrapper RevenueCat: `isPremium()`, `purchasePackage()`, `restorePurchases()`, listener en tiempo real |
| `src/store/subscriptionStore.ts`              | Zustand store con `premium: boolean` y `FREE_LIMITS`                                                  |
| `src/app/_layout.tsx`                         | Inicializa RevenueCat con `user.id` al autenticar, arranca listener                                   |
| `src/app/(main)/settings/premium.tsx`         | Paywall nativo via `RevenueCatUI.presentPaywallIfNeeded()`                                            |
| `src/app/(main)/settings/customer-center.tsx` | Customer Center nativo via `RevenueCatUI.presentCustomerCenter()`                                     |
| `src/app/(main)/settings/index.tsx`           | Sección "Mi Plan": muestra estado actual, redirige a paywall o customer center                        |
| `src/app/(main)/loans/create.tsx`             | Guard: bloquea al 4to préstamo activo y redirige al paywall                                           |
| `src/app/(main)/debts/create.tsx`             | Guard: bloquea a la 3ra deuda activa y redirige al paywall                                            |
| `src/app/(main)/loans/[id].tsx`               | Botones "Exportar PDF" y "WhatsApp" (con candado si es free)                                          |
| `src/services/pdf/loanPdf.ts`                 | Genera HTML del cronograma y comparte como PDF                                                        |

### ⏳ Pendiente

| Feature            | Descripción                                                            |
| ------------------ | ---------------------------------------------------------------------- |
| Dashboard avanzado | Gráfico de intereses ganados por mes, tendencias                       |
| Backup / CSV       | Exportar todos los datos del usuario                                   |
| Prod API keys      | Reemplazar test key con claves de producción de App Store / Play Store |
| Paywall diseñado   | Configurar el paywall visual desde el dashboard de RevenueCat          |

---

## Flujo del usuario

```
Usuario free
  └─ Intenta crear el 4to préstamo
       └─ Guard detecta límite
            └─ Redirige a Settings/premium.tsx
                 └─ RevenueCatUI muestra el paywall nativo
                      ├─ Compra exitosa → setPremium(true) → vuelve a crear
                      └─ Cancela → vuelve al listado

Usuario premium
  └─ Settings → Mi Plan → "Gestionar suscripción"
       └─ RevenueCatUI muestra Customer Center
            └─ Puede cancelar, pedir reembolso, restaurar, contactar soporte
```

---

## Próximos pasos para publicar

1. Crear productos en **App Store Connect** y **Google Play Console** con los IDs: `monthly`, `yearly`, `lifetime`
2. Reemplazar la test API key en `src/services/subscription/index.ts` con las claves de producción de RevenueCat
3. Diseñar el paywall en el dashboard de RevenueCat (usar el prompt generado)
4. Configurar el **Customer Center** en RevenueCat dashboard
5. Hacer una compra de prueba en sandbox para verificar el flujo completo
