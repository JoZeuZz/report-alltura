# Plan 006: Eliminar N+1 en listados de andamios (batch por proyecto y por andamio)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 52de960..HEAD -- backend/src/services/scaffolds.service.js backend/src/models/scaffold.js backend/src/models/scaffoldModification.js backend/src/models/scaffoldSection.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (cambia queries de listados muy usados; mitigado por tests del plan 004)
- **Depends on**: plans/001, plans/003 (índices), plans/004 (tests de caracterización)
- **Category**: perf
- **Planned at**: commit `52de960`, 2026-06-12

## Why this matters

Dos patrones N+1 en `backend/src/services/scaffolds.service.js`:

1. `getScaffoldsByRole` (rol client, líneas ~344-358): itera `projectIds` con un `for...of` y hace `await Scaffold.getByProject(projectId)` **en serie** — un cliente con 20 proyectos paga 20 round-trips secuenciales en la pantalla principal.
2. `getScaffoldsByProject` (líneas ~400-420): por CADA andamio hace `ScaffoldModification.getTotalApprovedCubicMeters(scaffold.id)` + `ScaffoldSection.getByScaffold(scaffold.id)` — un proyecto con 50 andamios = 100 queries extra por carga de vista.

Con los índices del plan 003 y estos batches, las vistas de proyecto y de cliente pasan de O(N) queries a un número constante.

## Current state

Excerpts verificados (commit 52de960):

`scaffolds.service.js` — N+1 del rol client:

```js
      const allScaffolds = [];
      for (const projectId of projectIds) {
        const projectScaffolds = await Scaffold.getByProject(projectId);
        allScaffolds.push(...projectScaffolds);
      }
      return await this._resolveScaffoldsImages(allScaffolds);
```

`scaffolds.service.js` — N+1 por andamio:

```js
    const enrichedScaffolds = await Promise.all(
      scaffolds.map(async (scaffold) => {
        const additionalCubicMeters = await ScaffoldModification.getTotalApprovedCubicMeters(scaffold.id);
        const baseCubicMeters = parseFloat(scaffold.cubic_meters);
        const totalCubicMeters = baseCubicMeters + additionalCubicMeters;
        const sections = await ScaffoldSection.getByScaffold(scaffold.id);
        return { ...scaffold, additional_cubic_meters: additionalCubicMeters, total_cubic_meters: totalCubicMeters, sections };
      })
    );
```

Modelos (queries actuales que sirven de base para las versiones batch):

`backend/src/models/scaffoldModification.js:211`:

```js
  static async getTotalApprovedCubicMeters(scaffoldId) {
    const result = await db.query(
      `SELECT COALESCE(SUM(cubic_meters), 0) as total
       FROM scaffold_modifications
       WHERE scaffold_id = $1 AND approval_status = 'approved'`,
      [scaffoldId]
    );
    return parseFloat(result.rows[0].total);
  }
```

`backend/src/models/scaffoldSection.js:4`:

```js
  async getByScaffold(scaffoldId) {
    const { rows } = await db.query(
      `SELECT id, scaffold_id, section_order, width, length, height, cubic_meters, created_at
       FROM scaffold_sections WHERE scaffold_id = $1 ORDER BY section_order ASC`, [scaffoldId]);
    return rows;
  }
```

`backend/src/models/scaffold.js:114` — `getByProject(projectId)`: SELECT grande con joins a users/projects/clients + subquery de assembly_date, `WHERE s.project_id = $1`. Nota: scaffoldModification es clase con métodos `static`; scaffold y scaffoldSection son object literals con métodos `async` — respeta el estilo de cada archivo.

Tests de caracterización que deben seguir verdes: `backend/src/tests/services/scaffolds.service.authz.test.js` (plan 004) y `backend/src/tests/services/scaffolds.service.test.js`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Suite servicios | `cd backend && npx jest src/tests/services` | todos passed |
| Suite completa | `cd backend && npx jest` | igual a baseline + nuevos |

## Scope

**In scope**:
- `backend/src/models/scaffold.js` (añadir `getByProjects(projectIds)`)
- `backend/src/models/scaffoldModification.js` (añadir `getTotalApprovedCubicMetersBulk(scaffoldIds)`)
- `backend/src/models/scaffoldSection.js` (añadir `getByScaffolds(scaffoldIds)`)
- `backend/src/services/scaffolds.service.js` (solo `getScaffoldsByRole` y `getScaffoldsByProject`)
- `backend/src/tests/services/` (tests nuevos)
- `plans/README.md`

**Out of scope**:
- La forma de la respuesta del API — `additional_cubic_meters`, `total_cubic_meters`, `sections` deben mantener exactamente nombre, tipo y orden de secciones (el frontend depende de ellos).
- `getScaffoldById` (un solo andamio, no es N+1).
- Dashboards (`dashboard.service.js`) — mismos patrones pero fuera de alcance; anótalo si lo confirmas.
- Métodos existentes de los modelos (no borrar los de a-uno; otros callers los usan).

## Git workflow

- Branch: `advisor/006-batch-n-plus-one`
- Commit: `perf: batch scaffold list queries (projects, modifications, sections)`
- NO push/PR salvo instrucción del operador.

## Steps

### Step 1: Métodos bulk en los modelos

`scaffold.js` — `getByProjects(projectIds)`: misma query que `getByProject` pero `WHERE s.project_id = ANY($1::int[])` y parámetro `[projectIds]`. Mantén joins, alias y la subquery `assembly_date` idénticos. Si `projectIds` está vacío, retorna `[]` sin query.

`scaffoldModification.js` — `getTotalApprovedCubicMetersBulk(scaffoldIds)`:

```sql
SELECT scaffold_id, COALESCE(SUM(cubic_meters), 0) as total
FROM scaffold_modifications
WHERE scaffold_id = ANY($1::int[]) AND approval_status = 'approved'
GROUP BY scaffold_id
```

Retorna `Map<scaffoldId, number>` (usa `parseFloat`). Ids sin filas → ausentes del Map (el caller usa 0 por defecto).

`scaffoldSection.js` — `getByScaffolds(scaffoldIds)`: mismas columnas, `WHERE scaffold_id = ANY($1::int[]) ORDER BY scaffold_id, section_order ASC`; retorna `Map<scaffoldId, rows[]>`.

**Verify**: `cd backend && npx jest src/tests/services` → sin regresiones (los métodos nuevos aún no tienen callers).

### Step 2: Reemplazar el loop serial del rol client

En `getScaffoldsByRole`:

```js
      const allScaffolds = projectIds.length
        ? await Scaffold.getByProjects(projectIds)
        : [];
      return await this._resolveScaffoldsImages(allScaffolds);
```

Ojo con el orden: el `for...of` actual concatenaba por proyecto. Verifica qué orden espera el frontend; la query bulk debe terminar con el mismo `ORDER BY` que `getByProject` (típicamente por fecha). Si `getByProject` ordena por `assembly_created_at DESC`, usa `ORDER BY s.assembly_created_at DESC` global — es un cambio de orden inter-proyecto aceptable; decláralo en el reporte.

**Verify**: `npx jest src/tests/services/scaffolds.service.authz.test.js` → el test del caso client (plan 004, Step 4.3) fallará porque ahora se llama `getByProjects` una vez en lugar de `getByProject` N veces — ACTUALIZA ese test para reflejar el batch (una llamada con `[1, 2]`, dedupe verificado pasando ids duplicados). Todos passed tras la actualización.

### Step 3: Batch de enriquecimiento en `getScaffoldsByProject`

```js
    const scaffolds = await Scaffold.getByProject(projectId);
    const ids = scaffolds.map((s) => s.id);
    const [modsTotals, sectionsByScaffold] = await Promise.all([
      ScaffoldModification.getTotalApprovedCubicMetersBulk(ids),
      ScaffoldSection.getByScaffolds(ids),
    ]);
    const enrichedScaffolds = scaffolds.map((scaffold) => {
      const additionalCubicMeters = modsTotals.get(scaffold.id) ?? 0;
      const baseCubicMeters = parseFloat(scaffold.cubic_meters);
      return {
        ...scaffold,
        additional_cubic_meters: additionalCubicMeters,
        total_cubic_meters: baseCubicMeters + additionalCubicMeters,
        sections: sectionsByScaffold.get(scaffold.id) ?? [],
      };
    });
    return await this._resolveScaffoldsImages(enrichedScaffolds);
```

**Verify**: `npx jest src/tests/services` → passed.

### Step 4: Tests de los métodos bulk y del service

Tests nuevos (siguiendo mocks del patrón existente):
1. `getScaffoldsByProject` con 2 andamios: mock `Scaffold.getByProject` → 2 filas; `getTotalApprovedCubicMetersBulk` → Map con un id; `getByScaffolds` → Map con el otro → verifica `additional_cubic_meters` 0 para el id ausente, `sections: []` para el otro, `total_cubic_meters` = base + adicional.
2. `getScaffoldsByProject` con 0 andamios → retorna `[]`, los bulk reciben `[]`.
3. (caso client ya actualizado en Step 2.)

**Verify**: `cd backend && npx jest` → exit 0 respecto a baseline, nuevos passed.

### Step 5 (si hay DB local con datos): smoke real

`npm run db:up`, levantar backend, `GET /api/scaffolds/project/:id` con un token válido → respuesta idéntica en forma a la previa (compara claves de un elemento). Si no hay entorno, decláralo.

## Test plan

Cubierto en Steps 2 y 4.

## Done criteria

- [ ] `getScaffoldsByRole` (client) ejecuta UNA query de scaffolds independiente del número de proyectos
- [ ] `getScaffoldsByProject` ejecuta exactamente 3 queries (scaffolds, mods bulk, sections bulk) + resolución de imágenes
- [ ] Forma de respuesta intacta: `additional_cubic_meters` (number), `total_cubic_meters` (number), `sections` (array ordenado por `section_order`)
- [ ] `cd backend && npx jest` exit 0 respecto a baseline
- [ ] `git status`: solo archivos in-scope
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- Los planes 003/004 no están ejecutados.
- `getByProject` en `scaffold.js` difiere sustancialmente del descrito (drift) — no inventes la query bulk desde cero.
- El frontend depende del orden agrupado-por-proyecto del loop original (lo descubres en tests o tipos del frontend) → reporta antes de cambiar el orden.

## Maintenance notes

- `dashboard.service.js` y `supervisorDashboard.service.js` tienen patrones por-item similares — candidatos al mismo tratamiento en un plan futuro.
- Si se añade paginación a los listados, los métodos bulk deben recibir los ids ya paginados (no cambiar).
- Revisor: verificar `ANY($1::int[])` con array vacío nunca llega a la DB (guards de `[]`).
