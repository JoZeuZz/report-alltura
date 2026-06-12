# Plan 010: Reparar el Service Worker (instalación rota, rutas CRA, openDB inexistente)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 52de960..HEAD -- frontend/public/sw.js frontend/src/shell/services/notificationService.ts frontend/public`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3 (sube a P2 si se confirma que rompe push notifications en producción — ver Step 1)
- **Effort**: M
- **Risk**: MED (los service workers mal versionados pueden dejar clientes con caché podrida; mitigado con bump de versión de caché)
- **Depends on**: none (verificación manual; idealmente tras 001 para correr la suite frontend)
- **Category**: bug
- **Planned at**: commit `52de960`, 2026-06-12

## Why this matters

`frontend/public/sw.js` está roto en tres puntos encadenados, verificados en el código:

1. **La instalación falla siempre**: el handler `install` hace `cache.addAll(STATIC_ASSETS)` con rutas de Create-React-App (`/static/js/bundle.js`, `/static/css/main.css`) que Vite no genera, y `cache.add('/offline.html')` cuando **`frontend/public/offline.html` no existe**. `addAll` rechaza si UNA URL falla → el SW nunca pasa de `installing` → ninguna funcionalidad del SW opera.
2. Como el SW se registra en `notificationService.ts:15` (`navigator.serviceWorker.register('/sw.js')`) para **push notifications**, una instalación fallida puede dejar `pushManager.subscribe` sin service worker activo → push roto en producción.
3. La cola offline llama `openDB()` (líneas 142 y 155) que **no está definida en ningún lugar del archivo** → `ReferenceError` en cuanto se intenta guardar/reintentar un request fallido. Además la cola no tiene TTL ni límite.

El README vende "PWA con Service Worker y capacidades offline"; hoy es letra muerta.

## Current state

- `frontend/public/sw.js` (~200 líneas):
  - Líneas 5-12: `STATIC_ASSETS = ['/', '/static/js/bundle.js', '/static/css/main.css', '/manifest.json', '/logo192.png', '/offline.html']`.
  - `install` (líneas ~21-31): `Promise.all([cache.addAll(STATIC_ASSETS), cache.add('/offline.html')])`.
  - `fetch` handler: API → network-first; assets (`request.destination` script/style/image) → cache-first; navegación → network-first con fallback a `/offline.html`.
  - `saveFailedRequest` (línea ~131) y `retryFailedRequests` (línea ~153): usan `const db = await openDB();` — `grep -n 'function openDB' frontend/public/sw.js` → **vacío**.
  - Background sync: `self.addEventListener('sync', ...)` con tag `retry-failed-requests`.
- `frontend/public/` contiene: favicon.ico, favicon.png, logo192.png, logo512.png, manifest.json, robots.txt, sw.js — **no hay offline.html**.
- `frontend/src/shell/services/notificationService.ts:15` — único punto de registro del SW.
- Vite copia `public/` tal cual a `dist/`; los bundles van a `/assets/<hash>.js` (nombres con hash — NO se pueden precachear con lista estática escrita a mano).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Build | `cd frontend && npm run build` | exit 0; `dist/sw.js` y `dist/offline.html` presentes |
| Servir build | `cd frontend && npx vite preview` | sirve en localhost; DevTools → Application → Service Workers |
| Tests frontend | `cd frontend && npx vitest run` | 21 passed (sin regresión) |

## Scope

**In scope**:
- `frontend/public/sw.js`
- `frontend/public/offline.html` (crear)
- `plans/README.md`

**Out of scope**:
- `notificationService.ts` y el flujo de push/VAPID (solo se verifica, no se cambia).
- Migrar a `vite-plugin-pwa`/Workbox — sería la solución "bien hecha" pero es un proyecto aparte; este plan repara lo mínimo para que el SW instale y no lance ReferenceError. Anotado en Maintenance.
- Backend.

## Git workflow

- Branch: `advisor/010-sw-repair`
- Commit: `fix: repair service worker install (Vite paths, offline.html, remove dead IndexedDB queue)`
- NO push/PR salvo instrucción del operador.

## Steps

### Step 1: Confirmar el impacto en push (diagnóstico, 10 min)

Con un build servido (`npm run build && npx vite preview`), en DevTools → Application → Service Workers: ¿el SW queda en estado `redundant`/error tras registrar? Console: errores de `addAll`. Documenta el resultado — si el SW efectivamente nunca activa, anota en el reporte que push notifications estaban rotas y que este fix las restaura (sube prioridad del plan en README a P2).

**Verify**: captura del estado anotada en el reporte.

### Step 2: Crear `offline.html`

`frontend/public/offline.html` — página estática autónoma (sin JS, estilos inline) con el mensaje "Sin conexión — la aplicación Alltura requiere internet para esta acción" y branding mínimo. Sin dependencias externas.

**Verify**: `ls frontend/public/offline.html` → existe; `npm run build && ls dist/offline.html` → copiado.

### Step 3: Corregir el precache

En `sw.js`:

```js
const CACHE_NAME = 'alltura-reports-v2'; // bump: invalida cachés v1 podridas
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo192.png',
  '/offline.html',
];
```

- Eliminar `/static/js/bundle.js` y `/static/css/main.css` (no existen en Vite). Los bundles hasheados de `/assets/` se cachearán en runtime por el handler `fetch` cache-first existente (cubre `request.destination === 'script'|'style'`), que debe escribir en `RUNTIME_CACHE` — verifica que `cacheFirstStrategy` guarde la respuesta en caché tras el fetch; si no lo hace, añade el `cache.put`.
- En `install`, cambiar `cache.addAll(...)` por adds tolerantes a fallo individual:

```js
await Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url)));
```

(El SW debe instalar aunque un asset falle.)
- El `activate` ya borra cachés que no estén en la lista blanca — confirma que `alltura-reports-v1` quedará fuera y se borrará.

**Verify**: `npm run build && npx vite preview` → DevTools: SW `activated and running`; Application → Cache Storage muestra `alltura-reports-v2` con los 4 assets.

### Step 4: Eliminar la cola IndexedDB muerta

`saveFailedRequest`, `retryFailedRequests` y el listener `sync` llaman a `openDB()` inexistente. Implementarla bien (schema, TTL, límites, idempotencia con el backend) es un proyecto (ver Maintenance). En este plan: **eliminar** las tres piezas (`saveFailedRequest`, `retryFailedRequests`, el listener `sync`) y cualquier llamada a `saveFailedRequest` dentro del handler de fetch (búscala: `grep -n 'saveFailedRequest' frontend/public/sw.js`), dejando el fallback offline simple (respuesta de error o `offline.html`).

**Verify**: `grep -n 'openDB\|saveFailedRequest\|retryFailedRequests' frontend/public/sw.js` → vacío. `node --check frontend/public/sw.js` → exit 0.

### Step 5: Prueba offline manual

Con `vite preview` + SW activo: DevTools → Network → Offline → recargar la app → aparece `offline.html` (navegación) y los assets cacheados sirven. Volver online → app normal. Login y carga de imágenes siguen funcionando online.

**Verify**: los 3 comportamientos confirmados; `npx vitest run` → 21 passed.

## Test plan

No hay harness de test para SW en el repo (vitest no lo carga); la verificación es manual vía `vite preview` + DevTools, pasos 3–5. Dejarlo registrado en el reporte con detalle.

## Done criteria

- [ ] SW instala y activa en un build de producción servido localmente (DevTools)
- [ ] `offline.html` existe y se sirve en navegación offline
- [ ] Cero referencias a `openDB`/`saveFailedRequest`/`retryFailedRequests` en sw.js
- [ ] `CACHE_NAME` bumpeado a v2
- [ ] `cd frontend && npx vitest run` sin regresiones y `npm run build` exit 0
- [ ] Fila actualizada en `plans/README.md` (con la prioridad ajustada según Step 1)

## STOP conditions

- El handler `fetch` de sw.js difiere sustancialmente de lo descrito (drift).
- Al eliminar la cola IndexedDB descubres un caller fuera de sw.js que depende de ella (`grep -rn 'retry-failed-requests' frontend/src`).
- Tras los fixes, el SW sigue sin activar por una causa distinta (p. ej. el registro en notificationService está condicionado a permisos de push) — reporta el diagnóstico.

## Maintenance notes

- **Mejora futura recomendada**: migrar a `vite-plugin-pwa` (Workbox) para precache automático de los bundles hasheados y estrategia de actualización gestionada; eliminaría sw.js artesanal. Candidato a plan de dirección.
- La cola offline de mutaciones (lo que openDB pretendía) requiere diseño con idempotencia en el backend — está registrada como hallazgo de dirección, no resuelta aquí.
- Cualquier cambio futuro a sw.js debe bumpear `CACHE_NAME`, o los clientes quedan con versiones mezcladas.
