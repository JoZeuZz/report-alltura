# Plan 004: Tests de caracterización para autorización y máquina de estados de andamios

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 52de960..HEAD -- backend/src/services/scaffolds.service.js backend/src/tests`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (solo añade tests; no cambia comportamiento)
- **Depends on**: plans/001-fix-test-baselines.md
- **Category**: tests
- **Planned at**: commit `52de960`, 2026-06-12

## Why this matters

La lógica de autorización y la máquina de estados de andamios (tarjeta verde/roja + armado/desarmado) viven en `backend/src/services/scaffolds.service.js`, el archivo de mayor churn del backend, y **no tienen ni un test**: `validateUserPermissions`, `validateDisassembledImmutability`, `validateProgressNoBacktrack` y el dispatch por rol de `getScaffoldsByRole` están descubiertos. Los planes 005 y 006 refactorizan este archivo; sin caracterización primero, una regresión de permisos (un supervisor editando andamios ajenos) pasaría silenciosa. Estos tests fijan el comportamiento ACTUAL — incluyendo una laguna conocida que se corrige en el plan 005.

## Current state

- `backend/src/services/scaffolds.service.js` — clase `ScaffoldService` con métodos estáticos. Validadores relevantes:

`validateUserPermissions` (línea ~191) — comportamiento actual exacto:

```js
  static validateUserPermissions(user, scaffold, project) {
    if (user.role === 'admin') {
      return; // Admin tiene permisos totales
    }
    if (user.role === 'supervisor') {
      const isCreator = scaffold.created_by === user.id;
      const isAssignedToProject = project && project.assigned_supervisor_id === user.id;
      if (!isCreator && !isAssignedToProject) {
        const error = new Error('No tienes permisos para modificar este andamio. ...');
        error.statusCode = 403;
        throw error;
      }
    }
  }
```

**Importante**: un `user.role === 'client'` (o cualquier rol desconocido) NO lanza error — cae al final y "pasa". Hoy lo mitigan los middlewares de ruta (`isAdminOrSupervisor` en `backend/src/routes/scaffolds.routes.js:236` etc.), pero el service no es deny-by-default. **Caracteriza este comportamiento tal cual es hoy** (test que documenta que client pasa el validador) con un comentario `// TODO plan 005: deny-by-default`; el plan 005 lo cambia y actualizará este test.

`validateDisassembledImmutability` (línea ~216): si `scaffold.assembly_status === 'disassembled'`: rechaza con statusCode 400 (1) `newData.assembly_status` distinto de 'disassembled', (2) `newData.progress_percentage > 0`, (3) `newData.card_status` distinto de null/undefined.

`getScaffoldsByRole` (línea ~330): admin → `Scaffold.getAll()`; supervisor → `Scaffold.getByCreator(userId)`; client → proyectos asignados + legacy, luego scaffolds por proyecto; otro rol → Error 403 'Rol no autorizado.'.

- Patrón de test existente a imitar: `backend/src/tests/services/scaffolds.service.test.js` — mockea `../../models/scaffold`, `../../models/project`, `../../db`, `../../lib/googleCloud`, `../../lib/logger` con `jest.mock(...)`; estructura `describe`/`it` con nombres en español ("debe ..."). Copia ese encabezado de mocks tal cual.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Suite completa | `cd backend && npx jest` | exit 0 (con baseline del plan 001) |
| Solo este archivo | `cd backend && npx jest src/tests/services/scaffolds.service.authz.test.js` | todos los tests nuevos pasan |

## Scope

**In scope**:
- `backend/src/tests/services/scaffolds.service.authz.test.js` (crear)
- `plans/README.md` (fila de estado)

**Out of scope**:
- `backend/src/services/scaffolds.service.js` — NO cambiar comportamiento; si un test revela un bug, el test documenta el comportamiento actual y lo reportas.
- Middlewares de ruta y controllers (la caracterización aquí es a nivel service).

## Git workflow

- Branch: `advisor/004-authz-tests`
- Commit: `test: characterize scaffold authorization and state-machine validators`
- NO push/PR salvo instrucción del operador.

## Steps

### Step 1: Crear el archivo de test con los mocks estándar

Crear `backend/src/tests/services/scaffolds.service.authz.test.js` copiando el bloque de `jest.mock(...)` de `backend/src/tests/services/scaffolds.service.test.js` (líneas 1–31).

**Verify**: `npx jest src/tests/services/scaffolds.service.authz.test.js` → corre (0 tests aún, o un test dummy pasa).

### Step 2: Tests de `validateUserPermissions`

Casos (todos síncronos, sin mocks de DB):
1. admin → no lanza, con cualquier scaffold/project.
2. supervisor creador (`scaffold.created_by === user.id`) → no lanza.
3. supervisor asignado al proyecto (`project.assigned_supervisor_id === user.id`) → no lanza.
4. supervisor ni creador ni asignado → lanza con `statusCode === 403`.
5. supervisor con `project` null/undefined y no creador → lanza 403.
6. **Comportamiento actual**: `role: 'client'` → NO lanza (documentar con comentario `// Laguna conocida: el service no es deny-by-default; se corrige en plan 005`).

**Verify**: `npx jest src/tests/services/scaffolds.service.authz.test.js` → 6 nuevos passed.

### Step 3: Tests de `validateDisassembledImmutability`

Casos:
1. scaffold armado (`assembly_status: 'assembled'`) → cualquier newData pasa.
2. desarmado + `newData.assembly_status: 'assembled'` → 400.
3. desarmado + `newData.progress_percentage: 50` → 400.
4. desarmado + `newData.card_status: 'green'` → 400.
5. desarmado + `newData.card_status: null` → no lanza.
6. desarmado + newData vacío `{}` → no lanza.

**Verify**: suite del archivo → +6 passed.

### Step 4: Tests de `getScaffoldsByRole`

Con los mocks de modelos:
1. admin → llama `Scaffold.getAll` una vez, no llama `getByCreator`.
2. supervisor → llama `Scaffold.getByCreator(userId)`.
3. client con 2 proyectos (mock `Project.getByAssignedClient` → `[{id:1}]`, `Project.getForUser` → `[{id:2}]`) → llama `Scaffold.getByProject` con 1 y con 2; con proyectos duplicados entre ambas fuentes (`[{id:1}]` y `[{id:1}]`) llama solo una vez.
4. rol desconocido `'otro'` → rechaza con `statusCode === 403`.

Nota: `getScaffoldsByRole` llama `this._resolveScaffoldsImages(...)`; el mock de `resolveImageUrl` (identidad, ya en el patrón copiado) lo cubre.

**Verify**: suite del archivo → +4 passed.

### Step 5: Suite completa

**Verify**: `cd backend && npx jest` → exit igual a baseline + ~16 tests nuevos passed.

## Test plan

Este plan ES el test plan: ~16 casos listados arriba, en un archivo, siguiendo el patrón de `scaffolds.service.test.js`.

## Done criteria

- [ ] `backend/src/tests/services/scaffolds.service.authz.test.js` existe con ≥14 tests, todos passed
- [ ] `cd backend && npx jest` exit 0 (o mismo set de fallos pre-existentes que la baseline del plan 001, documentado)
- [ ] Ningún archivo de `src/services/` modificado (`git status`)
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- El plan 001 no está hecho (la suite aborta al arrancar) → ejecuta 001 primero o reporta.
- El comportamiento real de algún validador difiere de los excerpts (drift) — reporta el diff en vez de adivinar el caso esperado.
- Para hacer pasar un test necesitas tocar `scaffolds.service.js`.

## Maintenance notes

- El plan 005 cambia `validateUserPermissions` a deny-by-default: deberá ACTUALIZAR el caso 6 del Step 2 (de "no lanza" a "lanza 403"). El comentario TODO en el test lo señala.
- Los planes 005/006 deben dejar esta suite verde como gate de no-regresión.
- Cobertura pendiente deliberadamente fuera de alcance: `validateActiveProject`, `synchronizeAssemblyState` (parcialmente cubierto en el test existente) y tests de integración con DB real.
