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

## Stack y documentación

Ver `AGENTS.md` para stack completo, arquitectura, convenciones y el flujo de trabajo del
proyecto (Spec-Anchored, workflow de Git, branching). Ver `TODO.md` para el estado real y
lo que sigue.
