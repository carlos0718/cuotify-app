# Accessibility — Cuotify

> Generado por skill `rocky-spec` · Ver `.rocky-spec/reference/ui-design-guidelines.md` de la skill para el detalle completo de cada regla. Documento vivo — se actualiza cada vez que cambia una decisión de accesibilidad, con su línea en "Historial de cambios".
>
> Seguridad (`SECURITY.md`) responde "¿nos atacan?". Observabilidad (`OBSERVABILITY.md`) responde "¿funciona?". Este archivo responde **"¿lo puede usar cualquiera?"**.

## Nivel de exigencia de este proyecto

- **Escala**: Producto real, público general (personas prestando/pidiendo dinero entre conocidos) — sin requisito legal de accesibilidad conocido hoy, pero el checklist mínimo aplica igual porque hay usuarios reales con distintas capacidades.

Cuotify es React Native/Expo, no HTML — el checklist de la skill (pensado para web) se adapta a los equivalentes nativos: `accessibilityLabel` en vez de `aria-label`, `accessibilityRole` en vez de `role`, no aplica `lang` de `<html>` ni contraste de CSS hardcodeado (los heurísticos automáticos de `rocky check accessibility .` no cubren RN, dieron "sin hallazgos" porque no hay HTML/JSX web en el proyecto — no porque ya esté auditado).

## Decisiones de este proyecto

| Área | Decisión |
|---|---|
| **Idioma declarado** | es (todas las strings de UI en español, ver `AGENTS.md`/`CLAUDE.md` § Key Conventions) |
| **Sistema de foco visible** | El de cada plataforma nativa (iOS/Android) — no hay override custom de foco |
| **Paleta verificada contra WCAG AA** | No verificada todavía — pendiente correr los tokens de `src/theme/colors.ts` contra un checker de contraste |

## Checklist — mínimo indispensable (adaptado a React Native)

- [ ] Contraste de texto normal ≥ 4.5:1, texto grande/UI ≥ 3:1 — sin verificar contra los tokens de `src/theme/colors.ts`
- [ ] `accessibilityLabel` en todo ícono/botón sin texto visible (los íconos SVG inline de los layouts no tienen labels hoy — ver `TODO.md` § U1)
- [ ] `accessibilityRole` correcto en elementos interactivos custom (`TouchableOpacity` haciendo de botón, etc.)
- [ ] Touch targets ≥ 44×44px en botones e íconos clickeables
- [ ] Dynamic Type / escalado de fuente del sistema respetado (no fuentes con tamaño fijo que rompan el layout al agrandar)
- [ ] Color nunca es el único indicador de estado (ej. estado de una cuota: pagada/vencida/pendiente) — agregar ícono o texto además del color
- [ ] `AccessibilityInfo` / soporte de lector de pantalla (VoiceOver/TalkBack) no probado todavía en los flujos críticos (alta de préstamo, marcar cuota como pagada)

## Chequeo automático

`rocky check accessibility .` corre heurísticos pensados para HTML/JSX web (`alt`, `lang`, `div` clickeable sin rol, botón solo-ícono, contraste hardcodeado en CSS/inline) — en este proyecto no detecta nada porque no hay ese tipo de markup, **no** porque el proyecto ya cumpla el checklist de RN de arriba. La verificación real acá es manual: revisar accesibilidad nativa con VoiceOver (iOS) y TalkBack (Android) en los flujos principales.

## Fuera de alcance de este documento

Este checklist ayuda a que el proyecto arranque con las prácticas mínimas de accesibilidad — **no reemplaza una auditoría profesional** (usuarios reales, lectores de pantalla nativos) si en algún momento se vuelve un requisito de compliance.

---

## Historial de cambios

| Fecha | Cambio | Commit |
|-------|--------|--------|
| 2026-09-11 | Accessibility inicial documentada (gate de Reanudación, `mode-resume.md`) — checklist sin verificar todavía, ver `TODO.md` § U1 | — |
