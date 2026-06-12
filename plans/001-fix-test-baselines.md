# Plan 001: Restaurar la línea base de verificación — que `npm test` funcione en backend y frontend

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 52de960..HEAD -- backend/jest.config.js backend/src/config/index.js frontend/vite.config.ts backend/src/tests frontend/package.json backend/package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `52de960`, 2026-06-12

## Why this matters

Hoy ninguna de las dos suites de test corre desde un checkout limpio:

1. **Backend**: `npx jest` aborta el proceso entero. `src/config/index.js` valida variables de entorno con Joi y llama `process.exit(1)` si faltan. Bajo Jest, `dotenv` no inyecta las variables (`injecting env (0) from .env`), así que cualquier test que (transitivamente) requiera `src/lib/logger.js` → `src/config/index.js` mata el worker. Variables que fallan: `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_USER`, `JWT_SECRET`, `JWT_REFRESH_SECRET`.
2. **Frontend**: `npx vitest run` falla en startup porque `vite.config.ts` lanza un error si no existe `VITE_DEV_API_PROXY_TARGET` ni `BACKEND_URL` — pero los tests no usan el proxy. Con `BACKEND_URL` definido, los 21 tests existentes pasan (verificado el 2026-06-12).

Sin esta línea base, ningún otro plan (tests de autorización, refactors, CI) puede verificarse. Este plan es prerequisito de los planes 004, 005, 006, 008 y 009.

## Current state

- `backend/jest.config.js` — config de Jest; NO tiene `setupFiles`. Excluye de cobertura `src/index.js`, `src/db/setup.js`, `src/scripts/**`, `src/tests/**`.
- `backend/src/config/index.js:17` — `require('dotenv').config();` y luego validación Joi; en fallo imprime errores y `process.exit(1)` (línea ~171).
- `frontend/vite.config.ts:21-25` — excerpt actual:

```ts
  if (isDev && !devApiProxyTarget) {
    throw new Error(
      '[vite] Debes definir VITE_DEV_API_PROXY_TARGET o BACKEND_URL para habilitar el proxy /api en desarrollo.'
    );
  }
```

donde `const isDev = mode !== 'production';` (línea 10). Vitest corre con `mode === 'test'`, por lo que `isDev` es `true` y el throw se dispara.

- Convención del repo: backend CommonJS (`require`), mensajes en español, commits estilo conventional commits (`fix:`, `feat:`, `chore:` — ver `git log --oneline`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests backend | `cd backend && npx jest` | exit 0, todas las suites corren (algunas pueden fallar por asserts — ver STOP) |
| Tests frontend | `cd frontend && npx vitest run` | exit 0, `Tests  21 passed (21)` |
| Test raíz | `npm test` (en raíz) | corre ambas suites vía npm-run-all |

## Scope

**In scope** (los únicos archivos que puedes modificar):
- `backend/jest.config.js`
- `backend/src/tests/setupEnv.js` (crear)
- `frontend/vite.config.ts`
- `plans/README.md` (fila de estado)

**Out of scope** (NO tocar aunque parezcan relacionados):
- `backend/src/config/index.js` — el fail-fast con `process.exit(1)` es comportamiento de producción deseado; no lo condiciones a `NODE_ENV`.
- `backend/.env` y `frontend/.env` — los tests NO deben depender de archivos .env con secretos reales.
- Cualquier archivo de test existente.

## Git workflow

- Branch: `advisor/001-fix-test-baselines`
- Commits estilo conventional commits, p. ej. `fix: load deterministic test env via jest setupFiles`
- NO hacer push ni abrir PR salvo instrucción del operador.

## Steps

### Step 1: Crear setup de entorno de test para Jest

Crear `backend/src/tests/setupEnv.js`:

```js
// Variables de entorno deterministas para tests.
// Los tests unitarios mockean db/redis/gcs; estos valores solo
// satisfacen la validación de src/config/index.js (fail-fast).
process.env.NODE_ENV = 'test';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_USER = process.env.DB_USER || 'test_user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test_password_not_real';
process.env.DB_NAME = process.env.DB_NAME || 'test_db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-minimo-32-caracteres!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-minimo-32-chars!!!';
```

Nota: revisa `backend/src/config/index.js` por si el schema Joi exige longitud mínima u otras variables `required()` adicionales (hay `.required()` en ~6 campos); si la validación sigue fallando, añade aquí la variable que falte con un valor fake — nunca un valor real.

**Verify**: `cd backend && node -e "require('./src/tests/setupEnv'); require('./src/config'); console.log('config OK')"` → imprime `config OK`, exit 0.

### Step 2: Registrar setupFiles en Jest

En `backend/jest.config.js` añadir al objeto exportado:

```js
  setupFiles: ['<rootDir>/src/tests/setupEnv.js'],
```

**Verify**: `cd backend && npx jest 2>&1 | tail -5` → aparece resumen `Tests: ... passed` (ya no aborta con `process.exit called with "1"`).

### Step 3: Limitar el throw del proxy en vite.config.ts al dev server

En `frontend/vite.config.ts`, cambiar la condición del throw para que solo aplique al dev server (no a tests ni builds):

```ts
  const isTest = mode === 'test' || process.env.VITEST === 'true';

  if (isDev && !isTest && !devApiProxyTarget) {
    throw new Error(
      '[vite] Debes definir VITE_DEV_API_PROXY_TARGET o BACKEND_URL para habilitar el proxy /api en desarrollo.'
    );
  }
```

Si el bloque `server.proxy` más abajo usa `devApiProxyTarget`, protégelo con el mismo guard (en test puede quedar `undefined`; usa spread condicional para no definir proxy sin target).

**Verify**: `cd frontend && npx vitest run 2>&1 | tail -4` → `Tests  21 passed (21)`, exit 0. Y `BACKEND_URL= npx vite build 2>&1 | tail -3` debe seguir funcionando (build usa mode production, no afectado).

### Step 4: Verificación integrada desde la raíz

**Verify**: en la raíz, `npm test` → corre backend y frontend; frontend 21 passed. Anota en tu reporte cuántos tests backend pasan/fallan.

## Test plan

Este plan ES la infraestructura de tests; no añade tests nuevos. La verificación es que ambas suites ejecuten hasta el final.

## Done criteria

- [ ] `cd backend && npx jest` ejecuta todas las suites sin `process.exit` prematuro (exit code refleja asserts reales)
- [ ] `cd frontend && npx vitest run` → 21 passed, exit 0, sin definir BACKEND_URL
- [ ] `git status` solo muestra los archivos in-scope
- [ ] Fila de estado actualizada en `plans/README.md`

## STOP conditions

Stop and report back (do not improvise) if:

- Tras los pasos 1–2, suites backend siguen abortando por `process.exit` (causa distinta a env vars).
- Más de 5 tests backend fallan por asserts una vez que la suite corre — repórtalos como hallazgo, NO los "arregles" en este plan.
- El guard de vite.config.ts rompe `npm run dev` del frontend (el dev server debe seguir exigiendo el target del proxy).

## Maintenance notes

- El plan 009 (CI) usará exactamente estos comandos como gates; cualquier cambio aquí debe reflejarse allí.
- Si alguien añade una variable `required()` a `src/config/index.js`, debe añadir su fake a `setupEnv.js` — vale la pena un comentario en config apuntando a este archivo.
- Tests que fallen por asserts tras restaurar la suite son deuda pre-existente: registrarlos, no ocultarlos.
