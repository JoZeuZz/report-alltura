# Plan 003: Añadir índices a la tabla `scaffolds` (project_id, created_by, user_id)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 52de960..HEAD -- db/init/001-init.sql backend/src/db`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `52de960`, 2026-06-12

## Why this matters

La tabla `scaffolds` es la más consultada del sistema (listados por proyecto, por supervisor, dashboards, exports) y **no tiene ningún índice secundario** — solo el PK. En cambio, casi todas las demás tablas del schema sí los tienen (`idx_scaffold_sections_scaffold`, `idx_notifications_user`, `idx_scaffold_mods_scaffold`, etc.), lo que indica que `scaffolds` quedó fuera por descuido. Cada `WHERE project_id = $1` o `WHERE created_by = $1` es hoy un seq scan; con miles de andamios en producción, cada vista de proyecto y dashboard lo paga.

## Current state

- `db/init/001-init.sql:50-77` — `CREATE TABLE IF NOT EXISTS scaffolds (...)` con FKs `project_id`, `user_id`, `created_by` SIN índices. El archivo ya usa el patrón `CREATE INDEX IF NOT EXISTS idx_<tabla>_<col> ON ...` para otras tablas (ej. línea 91: `idx_scaffold_sections_scaffold`).
- Queries que se benefician (evidencia):
  - `backend/src/models/scaffold.js:114` — `getByProject`: `FROM scaffolds s ... WHERE s.project_id = $1` (visto en el cuerpo de la query).
  - `backend/src/models/scaffold.js:154-166` — `getByCreator`: `WHERE s.created_by = $1 ORDER BY s.assembly_created_at DESC`.
  - `backend/src/services/dashboard.service.js` — agregaciones `FROM scaffolds WHERE project_id = $1`.
  - Subquery correlacionada en `getByProject` sobre `scaffold_history(scaffold_id, change_type, ...)` — ya existe `idx_scaffold_history_user` pero verifica si existe índice por `scaffold_id`; si no, inclúyelo (ver Step 1).
- El schema se aplica en instalaciones nuevas vía `db/init/001-init.sql` (montado por Docker en el init de Postgres). Para bases EXISTENTES hay un runner ad-hoc: `backend/src/scripts/run_migration.js` (ejecuta un .sql por ruta). No hay sistema de migraciones versionado.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Levantar DB local | `npm run db:up` (raíz) | contenedores postgres_db y redis arriba |
| Aplicar SQL a DB local | `docker compose -f docker-compose.dev.yml exec -T postgres_db psql -U <DB_USER> -d <DB_NAME> -f -` (stdin) o `node backend/src/scripts/run_migration.js <archivo.sql>` | sin errores |
| Listar índices | `docker compose -f docker-compose.dev.yml exec postgres_db psql -U <DB_USER> -d <DB_NAME> -c "\di+ idx_scaffolds*"` | muestra los índices nuevos |

(Usuario/DB salen de `backend/.env` o `.env.db.example`; no copies valores a ningún archivo del repo.)

## Scope

**In scope**:
- `db/init/001-init.sql` (añadir índices para instalaciones nuevas)
- `db/init/` o `backend/src/db/` — un nuevo archivo SQL de migración para bases existentes (ver Step 2)
- `plans/README.md` (fila de estado)

**Out of scope**:
- Cualquier cambio a queries o modelos JS (eso es plan 006).
- Reescribir el sistema de migraciones (hallazgo de dirección, fuera de alcance).
- `init.sql` de la raíz del repo (legacy; el canónico es `db/init/001-init.sql`).

## Git workflow

- Branch: `advisor/003-scaffolds-indexes`
- Commit: `perf: add indexes on scaffolds(project_id, created_by, user_id)`
- NO push/PR salvo instrucción del operador.

## Steps

### Step 1: Añadir índices al schema canónico

En `db/init/001-init.sql`, inmediatamente después del `CREATE TABLE IF NOT EXISTS scaffolds (...)` (tras la línea ~77), añadir siguiendo el estilo existente del archivo:

```sql
CREATE INDEX IF NOT EXISTS idx_scaffolds_project ON scaffolds(project_id, assembly_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scaffolds_created_by ON scaffolds(created_by, assembly_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scaffolds_user ON scaffolds(user_id);
```

Además, busca en el archivo si existe un índice sobre `scaffold_history(scaffold_id)`:
`grep -n 'idx_scaffold_history' db/init/001-init.sql`. Si solo existe `idx_scaffold_history_user`, añade:

```sql
CREATE INDEX IF NOT EXISTS idx_scaffold_history_scaffold ON scaffold_history(scaffold_id, change_type, created_at);
```

**Verify**: `grep -c 'idx_scaffolds' db/init/001-init.sql` → `3`.

### Step 2: Crear migración para bases existentes

Crear `db/init/migrations/2026-06-12-scaffolds-indexes.sql` (crear el directorio si no existe) con exactamente los mismos `CREATE INDEX IF NOT EXISTS` del Step 1, encabezado con un comentario:

```sql
-- Migración: índices para scaffolds. Idempotente (IF NOT EXISTS).
-- Aplicar en producción con: node backend/src/scripts/run_migration.js db/init/migrations/2026-06-12-scaffolds-indexes.sql
-- En tablas grandes considerar CREATE INDEX CONCURRENTLY (fuera de transacción).
```

**Verify**: `diff <(grep 'CREATE INDEX' db/init/migrations/2026-06-12-scaffolds-indexes.sql) <(grep 'idx_scaffolds\|idx_scaffold_history_scaffold' db/init/001-init.sql | grep 'CREATE INDEX')` → sin diferencias.

### Step 3: Probar contra DB local

```bash
npm run db:up
# espera ~5s a que postgres esté listo
docker compose -f docker-compose.dev.yml exec -T postgres_db psql -U $DB_USER -d $DB_NAME < db/init/migrations/2026-06-12-scaffolds-indexes.sql
```

(Si la DB local está vacía sin schema, primero aplica `db/init/001-init.sql` completo.)

**Verify**: `... psql -c "\di idx_scaffolds*"` → lista los 3 índices. Repetir la migración → exit 0 sin error (idempotencia).

### Step 4 (opcional, si hay datos): confirmar uso del índice

`EXPLAIN SELECT * FROM scaffolds WHERE project_id = 1;` → el plan menciona `Index Scan`/`Bitmap Index Scan` sobre `idx_scaffolds_project` (con pocas filas Postgres puede preferir seq scan — no es fallo).

## Test plan

No aplica test de JS. Verificación = SQL idempotente aplicado dos veces sin error + `\di` muestra los índices.

## Done criteria

- [ ] `db/init/001-init.sql` contiene los 3 índices de scaffolds (y el de scaffold_history si faltaba)
- [ ] Migración idempotente en `db/init/migrations/` aplicada 2 veces contra DB local sin error
- [ ] `git status`: solo archivos in-scope
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- `db/init/001-init.sql` ya contiene índices sobre scaffolds (drift — el hallazgo ya fue corregido).
- La migración falla contra la DB local por schema divergente del init.sql (reporta el diff de schema).
- Descubres que producción aplica schema por un mecanismo distinto a init.sql/run_migration.js.

## Maintenance notes

- En producción (Coolify), la migración debe correrse manualmente una vez (`run_migration.js`); documentarlo en el mensaje de PR. Para tablas con cientos de miles de filas, usar `CREATE INDEX CONCURRENTLY` manual.
- El plan 006 (batching N+1) asume estos índices presentes — ejecutar este plan antes.
- Si después se agregan filtros frecuentes por `assembly_status`, evaluar índice parcial (`WHERE assembly_status = 'assembled'`) — deferido a propósito.
