# Plan 002: Eliminar vulnerabilidades conocidas de dependencias (npm audit) en backend y frontend

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 52de960..HEAD -- backend/package.json backend/package-lock.json frontend/package.json frontend/package-lock.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (idealmente después de 001 para verificar con tests)
- **Category**: security
- **Planned at**: commit `52de960`, 2026-06-12

## Why this matters

`npm audit` reporta (verificado 2026-06-12):

- **backend**: 9 vulnerabilidades — 1 crítica (`shell-quote` 1.1.0–1.8.3, inyección vía newlines en valores `.op`, GHSA-w7jw-789q-3m8p), 1 alta (`tmp` <0.2.6, path traversal GHSA-ph9p-34f9-6g65), 7 moderadas (incluye `uuid` y `joi` <18.2.1 RangeError con schemas recursivos profundos). Ninguna es explotable directamente por el código propio hoy, pero son riesgo de cadena de suministro y ruido permanente en auditorías.
- **frontend**: 3 vulnerabilidades — 2 altas en `react-router` 7.0.0–7.14.2 (XSS vía redirect `javascript:`, open redirect, entre otras) y 1 crítica en `vitest` <3.2.6 (lectura/ejecución arbitraria de archivos cuando el servidor UI escucha — solo entorno dev/CI). React Router SÍ está en el bundle de producción: las altas aplican.

Todos los fixes están disponibles dentro del mismo rango semver (no requieren `--force`).

## Current state

- `backend/package.json` — deps relevantes: `joi@^18.0.1`, `exceljs@^4.4.0` (arrastra `uuid` y `tmp` transitivos), resto transitivos.
- `frontend/package.json` — `react-router-dom@^7.1.3`, `vitest@^3.2.4` (devDependency).
- Lockfiles npm v3 en cada workspace (`backend/package-lock.json`, `frontend/package-lock.json`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Audit backend | `cd backend && npm audit` | tras el fix: `found 0 vulnerabilities` (o solo moderadas sin fix disponible) |
| Audit frontend | `cd frontend && npm audit` | tras el fix: `found 0 vulnerabilities` |
| Tests backend | `cd backend && npx jest` | mismo resultado que antes del cambio |
| Tests frontend | `cd frontend && npx vitest run` | 21 passed |
| Build frontend | `cd frontend && npm run build` | exit 0 |

## Scope

**In scope**:
- `backend/package.json`, `backend/package-lock.json`
- `frontend/package.json`, `frontend/package-lock.json`
- `plans/README.md` (fila de estado)

**Out of scope**:
- Cualquier archivo de código fuente. Si un bump exige cambios de código, es STOP.
- `npm audit fix --force` — prohibido (puede hacer downgrades/majors).
- El `package.json` raíz (sus deps no reportan vulnerabilidades).

## Git workflow

- Branch: `advisor/002-npm-audit-fixes`
- Commit: `fix: patch npm audit vulnerabilities (shell-quote, tmp, react-router, vitest)`
- NO push/PR salvo instrucción del operador.

## Steps

### Step 1: Backend

```bash
cd backend
npm audit fix
npm audit
```

**Verify**: `npm audit` → 0 críticas y 0 altas. Si quedan moderadas sin fix no-breaking, lístalas en el reporte y déjalas.

### Step 2: Tests backend

**Verify**: `cd backend && npx jest 2>&1 | tail -5` → mismo número de tests passed/failed que la línea base del plan 001 (sin regresiones nuevas).

### Step 3: Frontend

```bash
cd frontend
npm audit fix
npm audit
```

Esto debe llevar `react-router`/`react-router-dom` a ≥7.14.3 y `vitest` a ≥3.2.6 dentro de los rangos `^` ya declarados.

**Verify**: `npm audit` → 0 vulnerabilidades.

### Step 4: Tests + build frontend

**Verify**:
- `cd frontend && npx vitest run` → `21 passed`.
- `cd frontend && npm run build` → exit 0.
- Smoke manual de rutas si hay entorno: login → redirect por rol funciona (router cambió de versión). Si no hay entorno corriendo, decláralo en el reporte.

## Test plan

No se escriben tests nuevos: los gates son las suites existentes + `npm audit` limpio + build.

## Done criteria

- [ ] `cd backend && npm audit` → 0 critical, 0 high
- [ ] `cd frontend && npm audit` → 0 vulnerabilities
- [ ] Ambas suites de test con el mismo resultado que antes del cambio
- [ ] `cd frontend && npm run build` exit 0
- [ ] `git status`: solo package.json/package-lock.json de ambos workspaces modificados
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- `npm audit fix` modifica algo fuera de los 4 archivos in-scope, o propone solo `--force` para alguna crítica/alta → reporta el árbol de dependencia afectado.
- Tests o build fallan tras el bump y el fallo no existía antes.
- `react-router` requiere salto de major (v8) para cerrar alguna alta → reporta; eso es un plan de migración aparte.

## Maintenance notes

- Recomendar al dueño habilitar Dependabot/Renovate o al menos `npm audit` en CI (plan 009 lo incluye) para que esto no se acumule.
- `xss-clean` y `express-mongo-sanitize` se eliminan en el plan 007 — no las toques aquí.
