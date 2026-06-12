# Plan 009: CI con GitHub Actions + CLAUDE.md raíz

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 52de960..HEAD -- .github package.json backend/package.json frontend/package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (solo archivos nuevos)
- **Depends on**: plans/001-fix-test-baselines.md (las suites deben correr); recomendado tras 002 (audit limpio)
- **Category**: dx
- **Planned at**: commit `52de960`, 2026-06-12

## Why this matters

El repo no tiene CI (`.github/` solo contiene `copilot-instructions.md`): nada verifica tests, lint ni build antes de mergear, y el historial muestra cadenas de commits "fixes deploy" que un pipeline habría atajado. Además no existe `CLAUDE.md`, y este repo se trabaja con agentes (planes en `plans/`, `.claude/` presente): un CLAUDE.md con la arquitectura y los comandos exactos reduce errores de cada sesión futura.

## Current state

- `.github/copilot-instructions.md` — existe; déjalo.
- Comandos verificados (2026-06-12, asumiendo plan 001 aplicado):
  - Backend tests: `cd backend && npx jest` (Node, sin servicios externos: los tests mockean db/redis/gcs).
  - Frontend tests: `cd frontend && npx vitest run` → 21 passed.
  - Frontend build: `cd frontend && npm run build` (Vite; en mode production no exige BACKEND_URL).
  - Backend lint: `cd backend && npm run lint` (`eslint .`, config flat `backend/eslint.config.js`).
  - Frontend lint: `cd frontend && npm run lint` (`eslint src --ext .ts,.tsx`) — **OJO**: el flag `--ext` puede fallar con ESLint 9 + flat config; pruébalo antes de meterlo en CI; si falla, usa `npx eslint src` directamente en el workflow (sin tocar package.json).
- Stack: Node (backend CommonJS Express 5; frontend Vite/React 19/TS). Lockfiles npm separados por workspace. Node v16+ según README, pero deps actuales (Express 5, Vite 7, Jest 30) requieren Node ≥18; usa Node 20 en CI.
- Roles/arquitectura para el CLAUDE.md: monorepo `backend/` + `frontend/`; capas backend routes → controllers → services → models; auth JWT + Redis; imágenes en GCS vía image-proxy; deploy Coolify + Cloudflare Tunnel; schema canónico `db/init/001-init.sql`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Validar workflow localmente | `npx --yes @action-validator/cli .github/workflows/ci.yml` (o revisión manual de YAML) | sin errores de sintaxis |
| Tests/lint/build | los listados arriba | exit 0 |

## Scope

**In scope**:
- `.github/workflows/ci.yml` (crear)
- `CLAUDE.md` (crear, raíz)
- `plans/README.md`

**Out of scope**:
- Workflows de deploy (Coolify se gestiona fuera de GitHub).
- Cambios a scripts de package.json o configs de lint (si un comando falla, se adapta el workflow, no el repo — y se reporta).
- Pre-commit hooks (deferido).

## Git workflow

- Branch: `advisor/009-ci-claude-md`
- Commits: `ci: add GitHub Actions workflow (test, lint, build)`, `docs: add CLAUDE.md`
- NO push/PR salvo instrucción del operador.

## Steps

### Step 1: Verificar cada comando localmente

Corre los 5 comandos de "Current state" y anota exit codes. Cualquier fallo ≠ baseline conocido → STOP.

**Verify**: todos exit 0 (o fallos pre-existentes documentados en plans/README.md por el plan 001).

### Step 2: Crear `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npx jest
      - run: npm audit --audit-level=high

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npx eslint src
      - run: npx vitest run
      - run: npm run build
      - run: npm audit --audit-level=high
```

Ajustes permitidos: si `npm audit` falla por vulnerabilidades aún no corregidas (plan 002 pendiente), añade `continue-on-error: true` a ese step y déjalo anotado; si el lint frontend revela errores pre-existentes, usa `continue-on-error: true` con comentario `# TODO: limpiar lint y quitar esto`.

**Verify**: YAML parsea (`node -e "require('js-yaml')"` no está garantizado; usa un validador online o `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"`) → sin error.

### Step 3: Crear `CLAUDE.md`

Contenido mínimo (escribir en español, conciso, SOLO hechos verificados — nada aspiracional):

```markdown
# CLAUDE.md

Plataforma de gestión de andamios (Alltura). Monorepo: `backend/` (Express 5, CommonJS,
PostgreSQL, Redis, GCS) + `frontend/` (React 19, TypeScript, Vite, TanStack Query).

## Comandos
- Tests backend: `cd backend && npx jest` (mockean DB/Redis/GCS; no requieren servicios)
- Tests frontend: `cd frontend && npx vitest run`
- Lint: `cd backend && npm run lint` / `cd frontend && npx eslint src`
- Build frontend: `cd frontend && npm run build`
- DB+Redis local: `npm run db:up` (raíz); app: `npm run dev`

## Arquitectura backend
routes → controllers → services (lógica de negocio) → models (SQL crudo con pg).
- Auth: JWT 15min + refresh 7d con rotación, blacklist en Redis (`src/lib/redis.js`).
- Errores: `error.statusCode = <code>` + mensaje en español; los lanza el service.
- Validación: Joi vía `middleware/validate.js`; schemas en `src/lib/validation/`.
- Imágenes: GCS vía `lib/googleCloud.js`; proxy con caché Redis en `routes/imageProxy.routes.js`.
- Schema canónico: `db/init/001-init.sql`. Migraciones ad-hoc: `src/scripts/run_migration.js`.

## Roles
admin (todo), supervisor (solo sus andamios / proyectos asignados), client (lectura de
sus proyectos). Enforcement en `middleware/roles.js` + `services/scaffolds.service.js`.

## Convenciones
- Commits: conventional commits (`fix:`, `feat:`, `chore:`), español o inglés.
- Frontend: páginas por rol en `src/pages/{admin,supervisor,client}/`; código compartido
  en `src/shell/`; tipos en `src/types/`.
- No editar `init.sql` de la raíz (legacy); el canónico es `db/init/001-init.sql`.

## Planes de mejora
Ver `plans/README.md` (estado y orden de ejecución).
```

Verifica cada afirmación contra el repo antes de escribirla (p. ej. que `middleware/validate.js` exista: `ls backend/src/middleware/`).

**Verify**: `cat CLAUDE.md` → cada comando listado fue ejecutado en Step 1.

### Step 4 (solo si el operador lo pide): probar el workflow en GitHub

Si se permite push: push de la rama y revisar el run en Actions. Si no, terminar aquí y dejar la prueba real para el PR.

## Test plan

No aplica; los gates son los comandos del Step 1 y el YAML válido.

## Done criteria

- [ ] `.github/workflows/ci.yml` existe, YAML válido, jobs backend+frontend
- [ ] Todo comando del workflow fue ejecutado localmente con éxito (o `continue-on-error` justificado por escrito)
- [ ] `CLAUDE.md` en raíz, solo con hechos verificados
- [ ] `git status`: solo archivos in-scope
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- Plan 001 sin ejecutar (las suites no corren) — el CI nacería en rojo.
- Un comando pasa localmente pero requiere secretos/servicios que CI no tendrá (p. ej. tests que de pronto exigen GCS real).
- El repo no tiene remote de GitHub (`git remote -v` vacío o no-GitHub) — el workflow no correrá nunca; crea los archivos igual y repórtalo.

## Maintenance notes

- Cuando el plan 002 cierre el audit, quitar cualquier `continue-on-error` del step de audit.
- Si se agrega typecheck estricto al frontend (`tsc --noEmit`), añadirlo como step.
- El CLAUDE.md debe actualizarse cuando los planes 005–008 cambien convenciones (p. ej. cookies de refresh).
