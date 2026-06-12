# Plan 008: Mover el refresh token de localStorage a cookie HttpOnly (access token solo en memoria)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 52de960..HEAD -- backend/src/routes/auth.routes.js backend/src/controllers/auth.controller.js backend/src/services/auth.service.js backend/src/middleware/security.js frontend/src/shell/services/authRefresh.ts frontend/src/shell/services/apiService.ts frontend/src/shell/context/AuthContext.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED–HIGH (toca login/refresh/logout end-to-end; cualquier error desconecta a todos los usuarios)
- **Depends on**: plans/001-fix-test-baselines.md (gates), recomendado después de 002
- **Category**: security
- **Planned at**: commit `52de960`, 2026-06-12

## Why this matters

Hoy el frontend guarda **access token y refresh token en `localStorage`** (`frontend/src/shell/services/authRefresh.ts:13-27`). Cualquier XSS exitoso exfiltra ambos; con el refresh token (TTL 7 días) el atacante mantiene la sesión aunque el access token expire. Moviendo el refresh token a una cookie `HttpOnly; Secure; SameSite=Strict` con `Path=/api/auth`, y el access token a memoria JS (nunca persistido), un XSS solo puede usar la sesión mientras la pestaña vive — no robarla. La rotación de refresh tokens YA está implementada en el backend (`auth.service.js:237-241` revoca el anterior y emite uno nuevo), lo que encaja perfecto con cookies.

## Current state

**Backend**:
- `backend/src/services/auth.service.js` — `refreshAccessToken(refreshToken)` (línea ~199): verifica firma, valida contra Redis (`isRefreshTokenValid`), **rota** (revoca + `generateTokenPair`), retorna `{ accessToken, refreshToken }`. Login análogo (busca `login` en el mismo archivo) retorna el par.
- `backend/src/routes/auth.routes.js:147` — `router.post('/refresh', validateBody(refreshSchema), AuthController.refresh);` con `refreshSchema = Joi.object({ refreshToken: Joi.string().required() })` (línea 75).
- `backend/src/middleware/security.js:268` — CORS ya tiene `credentials: true`.
- **No hay `cookie-parser`** en `backend/package.json` — hay que añadirlo.
- Logout: `auth.service.js` ~línea 185 — `revokeAllUserRefreshTokens(userId)`.

**Frontend**:
- `frontend/src/shell/services/authRefresh.ts` — `TOKEN_STORAGE_KEYS`, `getStoredAccessToken/getStoredRefreshToken/storeTokens/clearStoredTokens` sobre `localStorage`; `runRefresh()` postea `{ refreshToken }`.
- `frontend/src/shell/services/apiService.ts:13-19` — interceptor request añade `Authorization: Bearer <getStoredAccessToken()>`; interceptor response reintenta tras 401 vía refresh.
- `frontend/src/shell/context/AuthContext.tsx:80` — llama `storeTokens()` tras login.
- Tests existentes: `frontend/src/tests/authRefresh.test.ts`, `frontend/src/tests/apiService.test.ts` — deberán actualizarse.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests backend | `cd backend && npx jest` | baseline + nuevos passed |
| Tests frontend | `cd frontend && npx vitest run` | todos passed (tests actualizados) |
| Build frontend | `cd frontend && npm run build` | exit 0 |
| E2E manual | levantar `npm run db:up` + `npm run dev` y probar login/refresh/logout | ver Step 7 |

## Scope

**In scope**:
- Backend: `auth.routes.js`, `auth.controller.js`, `auth.service.js` (mínimo), `index.js` (registrar cookie-parser), `package.json` (+`cookie-parser`)
- Frontend: `authRefresh.ts`, `apiService.ts`, `AuthContext.tsx`, tests en `frontend/src/tests/`
- `plans/README.md`

**Out de scope**:
- El mecanismo de blacklist/rotación en Redis (`lib/redis.js`) — ya funciona, no tocarlo.
- `change-password` y demás endpoints de auth más allá de adaptar cómo ENTREGAN tokens.
- El access token: sigue viajando como `Authorization: Bearer` (no cookie) — así el resto del API y el image-proxy no cambian.
- Política CSP/headers (`security.js`), salvo confirmar `credentials: true`.

## Git workflow

- Branch: `advisor/008-refresh-cookie`
- Commits por capa: `feat: issue refresh token as HttpOnly cookie`, `feat: drop localStorage token persistence in frontend`
- NO push/PR salvo instrucción del operador.

## Steps

### Step 1: cookie-parser en backend

`cd backend && npm install cookie-parser`. En `index.js`, registrar `app.use(require('cookie-parser')());` junto al parseo de body (sección "8. Parseo de body").

**Verify**: `npx jest` → baseline.

### Step 2: Emitir cookie en login y refresh

En `auth.controller.js` (métodos `login` y `refresh`), tras obtener `{ accessToken, refreshToken }` del service, setear:

```js
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // alinear con TTL real del refresh (ver TOKEN_CONFIG)
});
```

Respuesta JSON: mantener `accessToken`; **durante la transición** seguir incluyendo `refreshToken` en el body queda PROHIBIDO solo al final (ver Step 6) — en este step ya puedes omitirlo porque frontend y backend se despliegan juntos (monorepo, mismo deploy). Omite `refreshToken` del JSON.

Busca el TTL real del refresh en la config (`TOKEN_CONFIG` / `config/index.js`) y usa ese valor, no el hardcode del ejemplo.

**Verify**: `npx jest` → baseline (ajusta tests de `auth.test.js`/`auth.service.test.js` si asertaban `refreshToken` en el body).

### Step 3: Refresh lee cookie

En `auth.routes.js`: el endpoint `/refresh` debe aceptar el token desde `req.cookies.refreshToken`, con fallback temporal a `req.body.refreshToken` (sesiones activas pre-deploy aún lo tienen en localStorage). Relaja `refreshSchema` a `Joi.object({ refreshToken: Joi.string().optional() })` y resuelve en el controller:

```js
const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
```

Logout (`/logout`): además de revocar en Redis, `res.clearCookie('refreshToken', { path: '/api/auth' })`.

**Verify**: test nuevo de controller/route (supertest está en devDependencies; modela sobre `backend/src/routes/auth.test.js`): POST `/api/auth/refresh` con cookie → 200 y `Set-Cookie` nuevo; sin cookie ni body → 400/401.

### Step 4: Frontend — access token en memoria

En `authRefresh.ts`:
- Reemplaza el almacenamiento: variable de módulo `let inMemoryAccessToken: string | null = null;` con `getStoredAccessToken()`/`storeTokens()` operando sobre ella (mantén los nombres de función para minimizar el diff en consumidores).
- `getStoredRefreshToken()` y toda escritura/lectura de `localStorage` se eliminan; `clearStoredTokens()` limpia la variable y además borra las claves viejas de localStorage una vez (`localStorage.removeItem(...)` — migración de sesiones antiguas).
- `runRefresh()`: POST `/api/auth/refresh` con `{}` y `withCredentials: true`; toma `accessToken` de la respuesta.

En `apiService.ts`: instancia axios con `withCredentials: true` (necesario para que la cookie viaje); interceptores sin cambios de lógica.

En `AuthContext.tsx`: al montar, en lugar de leer localStorage, intentar un refresh silencioso (`runRefresh()`) para restaurar sesión; si falla → estado deslogueado.

**Verify**: `cd frontend && npx vitest run` → tests de `authRefresh.test.ts`/`apiService.test.ts` actualizados y verdes.

### Step 5: Revisar el image-proxy

`backend/src/index.js:112` monta `/api/image-proxy` ANTES de la sanitización "para no romper JWT token en query" — indica que el proxy puede recibir token por query string. Verifica cómo el frontend construye URLs de imágenes (`grep -rn "image-proxy" frontend/src`): si usa el access token en query y este ahora vive en memoria, confirma que sigue disponible donde se construyen esas URLs. Si las imágenes se cargan vía `<img src>` sin header, NO cambies el mecanismo — solo confirma que la fuente del token es `getStoredAccessToken()`.

**Verify**: con entorno levantado, las imágenes de andamios cargan tras login.

### Step 6: Retirar el fallback de body (mismo PR, flag claro)

Deja el fallback `req.body.refreshToken` del Step 3 con un comentario `// TODO retirar tras un ciclo de deploy (sesiones pre-cookie)`. NO lo retires en este plan.

### Step 7: E2E manual

Con `npm run db:up` + `npm run dev`:
1. Login → DevTools: cookie `refreshToken` HttpOnly presente; `localStorage` sin tokens.
2. Forzar expiración (esperar 15 min o bajar TTL en .env local) → request protegida → refresh transparente → request OK.
3. Recargar página → sesión restaurada vía refresh silencioso.
4. Logout → cookie eliminada, rutas protegidas → 401/redirect a login.

**Verify**: los 4 pasos OK. Si no puedes levantar el entorno, STOP y repórtalo — este plan NO se considera done sin E2E.

## Test plan

- Backend (supertest, modelar sobre `backend/src/routes/auth.test.js`): login setea `Set-Cookie` con `HttpOnly` y sin `refreshToken` en JSON; refresh con cookie rota y setea cookie nueva; refresh sin nada → 4xx; logout limpia cookie.
- Frontend (vitest): `storeTokens`/`getStoredAccessToken` en memoria; `localStorage.setItem` jamás llamado con claves de token; `runRefresh` postea con `withCredentials`.

## Done criteria

- [ ] `grep -rn "localStorage" frontend/src/shell/services/authRefresh.ts` → solo el `removeItem` de migración
- [ ] Login response JSON sin `refreshToken` (test lo verifica)
- [ ] Cookie con `HttpOnly`, `SameSite=Strict`, `Path=/api/auth` (test de header)
- [ ] `cd backend && npx jest` y `cd frontend && npx vitest run` verdes
- [ ] E2E del Step 7 completado y reportado
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- El login del frontend usa el refresh token para algo más que refresh (búscalo: `grep -rn "getStoredRefreshToken" frontend/src`) — repórtalo antes de eliminar el accessor.
- El image-proxy depende de un token persistido que ya no existe tras un reload (Step 5) — reporta el diseño en vez de improvisar otro almacenamiento.
- Producción sirve frontend y API en dominios distintos sin que la cookie llegue (SameSite=Strict + cross-site): verifica en `docs/DEPLOY_COOLIFY_CLOUDFLARE_TUNNEL.md` si API y frontend comparten dominio; si NO, reporta — habría que evaluar `SameSite=Lax`/None y CSRF antes de continuar.

## Maintenance notes

- Retirar el fallback de body del Step 6 en el siguiente ciclo (anótalo como issue).
- Con cookie `SameSite=Strict` y access token en header, el riesgo CSRF queda contenido; si algún día el access token migra a cookie, hará falta CSRF token explícito.
- PWA offline (plan 010): el refresh silencioso al montar requiere red; el comportamiento offline del AuthContext debe degradarse a "sesión desconocida", no a logout destructivo.
