# Plan 005: Robustecer `disassembleScaffold` (limpieza de imagen huérfana, guard de rows, deny-by-default)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 52de960..HEAD -- backend/src/services/scaffolds.service.js backend/src/tests/services`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-fix-test-baselines.md, plans/004-authz-characterization-tests.md
- **Category**: bug
- **Planned at**: commit `52de960`, 2026-06-12

## Why this matters

Tres defectos puntuales en `backend/src/services/scaffolds.service.js`:

1. `disassembleScaffold` sube la imagen a GCS (`uploadFile`) y DESPUÉS hace el UPDATE; si el UPDATE o el insert de historial fallan, la imagen queda huérfana en el bucket (costo de storage que se acumula). El método hermano `createScaffold` (líneas ~492–551) sí limpia con `deleteFileByUrl` en su catch — este quedó sin esa protección.
2. Tras el UPDATE, `rows[0]` se usa sin guard: si el andamio fue borrado concurrentemente entre el `getById` y el UPDATE, `updated` es `undefined` y `_resolveScaffoldImages(undefined)` revienta con un error opaco.
3. `validateUserPermissions` no es deny-by-default: un rol distinto de admin/supervisor (p. ej. `client`) pasa el validador sin error. Hoy lo cubren los middlewares de ruta, pero es defensa en profundidad faltante en la capa de negocio.

## Current state

`backend/src/services/scaffolds.service.js`, método `disassembleScaffold` (línea ~799). Flujo actual (excerpt verificado):

```js
    // Subir imagen
    const disassemblyImageUrl = await uploadFile(imageFile);

    // Actualizar andamio a desarmado
    const query = `
      UPDATE scaffolds 
      SET assembly_status = 'disassembled', 
          card_status = NULL,
          disassembly_image_url = $1, ...
      WHERE id = $3
      RETURNING *
    `;
    const { rows } = await db.query(query, [disassemblyImageUrl, disassemblyNotes || null, scaffoldId]);
    const updated = rows[0];

    // Registrar en historial
    await ScaffoldHistory.create({ ... });
    ...
    return await this._resolveScaffoldImages(updated);
```

`validateUserPermissions` (línea ~191): maneja `admin` (return) y `supervisor` (check creador/asignado); cualquier otro rol cae al final sin lanzar.

Convenciones: errores con `error.statusCode = <code>` y mensaje en español; `deleteFileByUrl` se importa de `../lib/googleCloud` (ver imports al inicio del archivo y su uso en `createScaffold`).

Tests relevantes: `backend/src/tests/services/scaffolds.service.authz.test.js` (creado por el plan 004) contiene un test que documenta que `client` PASA el validador, marcado con TODO para este plan.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Suite servicios | `cd backend && npx jest src/tests/services` | todos passed |
| Suite completa | `cd backend && npx jest` | igual a baseline + tests nuevos |

## Scope

**In scope**:
- `backend/src/services/scaffolds.service.js` (solo `disassembleScaffold` y `validateUserPermissions`)
- `backend/src/tests/services/scaffolds.service.authz.test.js` (actualizar caso client)
- `backend/src/tests/services/scaffolds.service.test.js` (añadir tests de disassemble)
- `plans/README.md`

**Out of scope**:
- Rutas, controllers, middlewares — el deny-by-default a nivel de service NO debe requerir cambios de ruta (los middlewares ya bloquean clients antes).
- `createScaffold`, `updateScaffold` y el resto del service (el batching es plan 006).
- `lib/googleCloud.js`.

## Git workflow

- Branch: `advisor/005-disassemble-robustness`
- Commits: `fix: clean up orphaned GCS upload on disassemble failure`, `fix: deny-by-default in validateUserPermissions`
- NO push/PR salvo instrucción del operador.

## Steps

### Step 1: Deny-by-default en `validateUserPermissions`

Al final del método (después del bloque `if (user.role === 'supervisor') {...}`), añadir:

```js
    if (user.role !== 'supervisor') {
      const error = new Error('No tienes permisos para modificar este andamio.');
      error.statusCode = 403;
      throw error;
    }
```

(Es decir: admin retorna, supervisor pasa sus checks, todo lo demás → 403.)

Actualizar el test del plan 004 que documentaba que `client` pasaba: ahora espera `statusCode === 403`. Quitar el comentario TODO.

**Verify**: `npx jest src/tests/services/scaffolds.service.authz.test.js` → todos passed.

### Step 2: Guard de `rows[0]` en `disassembleScaffold`

Tras `const updated = rows[0];` añadir:

```js
    if (!updated) {
      const error = new Error('El andamio no pudo ser actualizado (no encontrado).');
      error.statusCode = 404;
      throw error;
    }
```

**Verify**: `npx jest src/tests/services` → sin regresiones.

### Step 3: Limpieza de imagen huérfana

Envolver desde el UPDATE hasta el `ScaffoldHistory.create` en try/catch que borre la imagen subida antes de relanzar, imitando el patrón de `createScaffold`:

```js
    const disassemblyImageUrl = await uploadFile(imageFile);

    try {
      const { rows } = await db.query(query, [...]);
      const updated = rows[0];
      if (!updated) { /* guard del Step 2 */ }

      await ScaffoldHistory.create({ ... });

      logger.info(`Andamio ${scaffoldId} desarmado por usuario ${user.id}`);
      return await this._resolveScaffoldImages(updated);
    } catch (error) {
      try {
        await deleteFileByUrl(disassemblyImageUrl);
      } catch (cleanupError) {
        logger.error('No se pudo limpiar imagen de desarmado huérfana:', cleanupError);
      }
      throw error;
    }
```

Asegúrate de que `deleteFileByUrl` esté en el import de `../lib/googleCloud` al inicio del archivo (ya lo está si `createScaffold` lo usa — verifica).

**Verify**: `npx jest src/tests/services` → passed.

### Step 4: Tests nuevos de disassemble

En `backend/src/tests/services/scaffolds.service.test.js`, añadir `describe('disassembleScaffold')` siguiendo los mocks existentes:

1. Happy path: `Scaffold.getById` → scaffold armado; `Project.getById`/`validateActiveProject` satisfecho (mockea `Project` como hace el archivo); `uploadFile` → 'gs://img'; `db.query` → `{ rows: [ {...} ] }`; `ScaffoldHistory.create` resuelve → retorna scaffold resuelto, `deleteFileByUrl` NO llamado.
2. UPDATE devuelve `{ rows: [] }` → rechaza con 404 y `deleteFileByUrl` fue llamado con 'gs://img'.
3. `db.query` rechaza → el error se propaga y `deleteFileByUrl` fue llamado.
4. `ScaffoldHistory.create` rechaza → error se propaga y `deleteFileByUrl` fue llamado.
5. Sin `imageFile` → 400 y `uploadFile` NO llamado (comportamiento existente).

Nota: revisa cómo `validateActiveProject` obtiene el proyecto (probablemente `Project.getById`) y mockea acorde; el test existente del archivo ya resuelve este setup para otros métodos — imítalo.

**Verify**: `cd backend && npx jest` → exit 0 (o baseline + nuevos), 5 tests nuevos passed.

## Test plan

Cubierto en Steps 1 y 4: actualización del caso client (1) + 5 casos de disassemble.

## Done criteria

- [ ] `validateUserPermissions` lanza 403 para roles ≠ admin/supervisor; test actualizado
- [ ] `disassembleScaffold` borra la imagen subida si el UPDATE o el historial fallan (tests 2–4 lo prueban)
- [ ] `rows[0]` con guard 404
- [ ] `cd backend && npx jest` exit 0 respecto a baseline
- [ ] `git status`: solo archivos in-scope
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- El plan 004 no está ejecutado (no existe `scaffolds.service.authz.test.js`).
- Algún flujo legítimo llama `validateUserPermissions` con rol `client` esperando que pase (busca llamadas: `grep -rn 'validateUserPermissions' backend/src`) — si un caller depende de que client pase, reporta antes de cambiar.
- `deleteFileByUrl` no existe en `lib/googleCloud.js` con esa firma.

## Maintenance notes

- Si más adelante `updateScaffold` u otros métodos suben archivos, deben seguir este mismo patrón upload→try→cleanup.
- Revisor: verificar que el 403 nuevo no cambie respuestas de endpoints usados por el frontend de clientes (no debería: las rutas ya bloqueaban antes con `isAdminOrSupervisor`).
- Deferido: transaccionar UPDATE + historial en una transacción DB (hoy son dos statements sin transacción); anotado como mejora futura, no bloquea.
