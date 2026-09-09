---
name: rocky-spec
description: 'Crea proyectos desde cero, los retoma en sesiones siguientes o adopta proyectos ya iniciados. Soporta código (web app, API, fullstack, script, mobile), creativos (video ad, motion) e híbridos. Genera CONSTITUTION.md, SPEC.md, AGENTS.md, SECURITY.md, OBSERVABILITY.md, CHANGELOG.md, TODO.md y arquitectura documentada, nivel SDD Spec-Anchored. Tres modos — (1) nuevo: "nuevo proyecto", "armar proyecto", "iniciar proyecto"; (2) reanudación: "continuemos", "qué sigue", "retomemos"; (3) adopción de proyecto existente: "tengo un proyecto ya avanzado", "adoptar proyecto".'
---

# /rocky-spec — Skill de ciclo de vida de proyectos (integración Claude)

> Este archivo es la integración de **Claude** dentro del framework `rocky-spec`. El conocimiento real (pasos del flujo, principios, templates) vive en `.rocky-spec/` en la raíz del proyecto — versionado junto al código, no dentro de esta skill — así cualquier otro agente (Cursor, y los que se agreguen) lee exactamente lo mismo.

## Cómo usar esta skill

1. Verificar que existe `.rocky-spec/` en el cwd. Si no existe, correr `rocky init --agent claude` antes de continuar (o avisar al usuario que lo haga).
2. Detectar el modo: **Adopción** (hay código sin `.skill-state.json`) → leer `.rocky-spec/commands/mode-adopt.md`. **Reanudación** (hay `.skill-state.json` o el usuario usa frases de continuación) → leer `.rocky-spec/commands/mode-resume.md`. **Creación** → seguir el índice de abajo.
3. Cada paso del índice abre su archivo correspondiente en `.rocky-spec/commands/` recién cuando el flujo llega a ese punto — no antes (progressive disclosure).

## Índice del flujo de creación

### P0 · Detectar workspace y popular perfil
→ `.rocky-spec/commands/p0-workspace.md`

### P1 · Describe el proyecto + SPEC.md (SDD + DDD)
→ `.rocky-spec/commands/p1-spec-ddd.md`

### P3 · Confirma o edita el stack
→ `.rocky-spec/commands/p3-stack.md`

### P4 · Recomendar y decidir arquitectura
→ `.rocky-spec/commands/p4-architecture.md`

### P4.5 · UI/UX Design System
→ `.rocky-spec/commands/p4.5-design-system.md`

### P5 · Comandos a ejecutar
→ `.rocky-spec/commands/p5-commands.md`

### P5.5 · Infraestructura de deploy
→ `.rocky-spec/commands/p5.5-deploy.md`

### P5.6 · Seguridad
→ `.rocky-spec/commands/p5.6-security.md`

### P5.7 · Observabilidad
→ `.rocky-spec/commands/p5.7-observability.md`

### P5.8 · Accesibilidad
→ `.rocky-spec/commands/p5.8-accessibility.md`

### P6 y P7 · Archivos base y TODO
→ `.rocky-spec/commands/p6-p7-files-todo.md`

### P7.5 · Revisión funcional y de QA (Three Amigos)
→ `.rocky-spec/commands/p7.5-qa-review.md`

### P8 · Reporte de validación
→ `.rocky-spec/commands/p8-p8.5-validation-systemprompt.md`


## Conocimiento compartido

- `.rocky-spec/reference/` — principios de código, seguridad, observabilidad, versionado, dependencias, metodologías (SDD/TDD/BDD/DDD), arquitecturas, diseño.
- `.rocky-spec/templates/` — plantillas de todos los archivos que se generan en el proyecto (SPEC.md, CONSTITUTION.md, AGENTS.md, SECURITY.md, etc.).
- `.rocky-spec/commands/` — el detalle completo de cada paso del índice de arriba, más `mode-adopt.md` y `mode-resume.md`.
