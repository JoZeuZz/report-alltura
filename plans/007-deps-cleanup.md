# Plan 007: Limpiar dependencias muertas y duplicadas del backend (xss-clean, express-mongo-sanitize, bcryptjs, setup.js)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 52de960..HEAD -- backend/package.json backend/src/middleware/sanitization.js backend/src/db/setup.js backend/src/scripts/create-admin.js backend/src/models/user.js backend/src/index.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW–MED (toca hashing de contraseñas en scripts; el camino caliente de auth NO cambia)
- **Depends on**: plans/001-fix-test-baselines.md
- **Category**: tech-debt
- **Planned at**: commit `52de960`, 2026-06-12

## Why this matters

Cuatro restos verificados en el backend:

1. **`xss-clean`** (`backend/package.json`): deprecada, sin mantenimiento desde 2020, y **cero imports** en el código (`grep -rn "xss-clean" backend/src` → vacío). Superficie de supply-chain gratis.
2. **`express-mongo-sanitize`**: importada en `backend/src/middleware/sanitization.js` y exportada como `sanitizeMongoOnly`, pero su registro está comentado en `backend/src/index.js:109` con `// ⚠️ Deshabilitado: incompatible con Express 5.x`. La sanitización real la hace el middleware custom (`sanitizeStrict`, registrado en `index.js`). Dependencia y export muertos.
3. **bcrypt duplicado**: `bcrypt` (nativo) se usa en el camino caliente (`backend/src/models/user.js:2` — hash y compare de login), mientras `bcryptjs` (JS puro) solo en dos scripts: `backend/src/db/setup.js:5` y `backend/src/scripts/create-admin.js:20`. Dos implementaciones del mismo algoritmo, dos deps.
4. **`backend/src/db/setup.js` es código muerto con credenciales por defecto**: crea usuarios seed con contraseña `password123` (líneas 143, 150) y **nada lo referencia** (`grep -rn "db/setup" backend/src` → solo la exclusión de cobertura en `jest.config.js`). Si alguien lo ejecutara contra producción, sembraría cuentas con contraseña conocida.

## Current state

- `backend/package.json` — dependencies incluyen: `bcrypt@^6.0.0`, `bcryptjs@^3.0.2`, `express-mongo-sanitize@^2.2.0`, `xss-clean@^0.1.4`.
- `backend/src/middleware/sanitization.js` — línea ~22 importa `express-mongo-sanitize`; línea ~210 lo expone como `sanitizeMongoOnly` en los exports. El resto del archivo (DOMPurify + `sanitizeObject` custom) es la protección activa — NO tocarlo.
- `backend/src/index.js:107-109`:

```js
// 9. Sanitización de inputs (DESPUÉS de parsear body)
// NoSQL injection protection está integrada en sanitizeStrict
// app.use(sanitizeMongoOnly); // ⚠️ Deshabilitado: incompatible con Express 5.x
```

- `backend/src/scripts/create-admin.js:20` — `const bcrypt = require('bcryptjs');` (script CLI para crear admin; SÍ es usado: `npm run create-admin`).
- Hashes `$2a$` (bcryptjs) y `$2b$` (bcrypt) son interoperables: `bcrypt.compare` verifica ambos prefijos. Cambiar el hasher de scripts no invalida contraseñas existentes.
- `backend/jest.config.js` — `collectCoverageFrom` excluye `'!src/db/setup.js'`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Buscar referencias | `grep -rn "<paquete>" backend/src` | vacío tras limpieza |
| Tests | `cd backend && npx jest` | igual a baseline |
| Arranque sintáctico | `cd backend && node -e "require('./src/middleware/sanitization')"` | exit 0 |
| Audit | `cd backend && npm audit` | sin nuevas vulnerabilidades |

## Scope

**In scope**:
- `backend/package.json`, `backend/package-lock.json`
- `backend/src/middleware/sanitization.js` (solo quitar import/export de express-mongo-sanitize)
- `backend/src/index.js` (solo borrar la línea comentada 109)
- `backend/src/scripts/create-admin.js` (bcryptjs → bcrypt)
- `backend/src/db/setup.js` (eliminar)
- `backend/jest.config.js` (quitar la exclusión de setup.js)
- `plans/README.md`

**Out of scope**:
- `backend/src/models/user.js` — ya usa `bcrypt`; no tocar el camino de login.
- La lógica custom de `sanitizeObject`/`sanitizeStrict` en sanitization.js — es la protección activa.
- `dompurify` vs `isomorphic-dompurify` (duplicación menor; verificar cuál se usa requiere más análisis — deferido, ver Maintenance notes).

## Git workflow

- Branch: `advisor/007-deps-cleanup`
- Commits: `chore: remove unused xss-clean and express-mongo-sanitize`, `chore: unify password hashing on bcrypt, drop dead setup.js`
- NO push/PR salvo instrucción del operador.

## Steps

### Step 1: Quitar xss-clean

```bash
cd backend && npm uninstall xss-clean
```

**Verify**: `grep -n "xss-clean" backend/package.json` → vacío; `npx jest` → baseline.

### Step 2: Quitar express-mongo-sanitize

1. En `sanitization.js`: eliminar el `require('express-mongo-sanitize')` y el export `sanitizeMongoOnly` (y cualquier referencia interna). Antes confirma que nadie más lo importa: `grep -rn "sanitizeMongoOnly" backend/src` → solo sanitization.js e index.js (comentado).
2. En `index.js`: borrar la línea comentada `// app.use(sanitizeMongoOnly); ...` (y ajustar el comentario de la sección si queda huérfano).
3. `cd backend && npm uninstall express-mongo-sanitize`.

**Verify**: `node -e "require('./src/middleware/sanitization')"` → exit 0; `node -e "require('./src/index.js')"` NO usar (levanta el server) — en su lugar `npx jest` → baseline.

### Step 3: Unificar hashing en bcrypt

En `backend/src/scripts/create-admin.js`: cambiar `require('bcryptjs')` por `require('bcrypt')`. La API (`hash`, `compare`) es idéntica para este uso.

**Verify**: `node -e "const b=require('bcrypt'); b.hash('x',10).then(h=>b.compare('x',h)).then(ok=>{if(!ok)process.exit(1);console.log('bcrypt OK')})"` (en backend/) → `bcrypt OK`.

### Step 4: Eliminar setup.js muerto y bcryptjs

1. Reconfirma cero referencias: `grep -rn "db/setup" backend/src backend/package.json` → solo `jest.config.js`.
2. `git rm backend/src/db/setup.js`.
3. En `backend/jest.config.js`, quitar la línea `'!src/db/setup.js',`.
4. `cd backend && npm uninstall bcryptjs`.

**Verify**: `grep -rn "bcryptjs" backend/src backend/package.json` → vacío; `npx jest` → baseline.

### Step 5: Audit y cierre

**Verify**: `cd backend && npm audit` → sin críticas/altas nuevas; `git status` → solo archivos in-scope.

## Test plan

Sin tests nuevos: los gates son la suite existente (que no referencia nada de lo eliminado — verificado: jest.config solo lo excluía de cobertura) + arranques sintácticos por paso.

## Done criteria

- [ ] `xss-clean`, `express-mongo-sanitize`, `bcryptjs` fuera de `backend/package.json` y de todo `backend/src`
- [ ] `backend/src/db/setup.js` eliminado; jest.config sin la exclusión
- [ ] `create-admin.js` usa `bcrypt`
- [ ] `cd backend && npx jest` → baseline sin regresiones
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- Cualquier grep de los Steps revela un consumidor real no listado aquí (p. ej. algo importa `setup.js` o `sanitizeMongoOnly` desde fuera de los archivos in-scope).
- `npm uninstall bcrypt`... — cuidado: el paquete a desinstalar es `bcryptjs`. Si por error quitas `bcrypt`, el login muere; revierte de inmediato.
- Tests fallan tras quitar la exclusión de setup.js de jest.config (no debería: el archivo ya no existe).

## Maintenance notes

- Deferido conscientemente: la duplicación `dompurify` + `isomorphic-dompurify` (ambas en package.json). Resolverla requiere mapear qué importa `sanitization.js` exactamente; vale un mini-plan aparte.
- Deferido: dependencia `browser-image-compression` en el package.json RAÍZ (es lib de navegador; el frontend ya la declara). Quitarla de raíz es seguro pero verifica `grep -rn "browser-image-compression" --include='*.{js,ts,tsx}' .` fuera de node_modules primero.
- Revisor: confirmar en el diff que `models/user.js` no cambió.
