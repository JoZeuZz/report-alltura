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

- Auth: JWT 15min + refresh 7d con rotación. Refresh token en cookie HttpOnly (`Path=/api/auth`); access token en memoria JS. Blacklist en Redis (`src/lib/redis.js`).
- Errores: `error.statusCode = <code>` + mensaje; los lanza el service, los formatea `middleware/errorHandler.js`.
- Validación: Joi vía `middleware/validate.js`; schemas compartidos en `src/validation/`.
- Imágenes: GCS vía `lib/googleCloud.js`; proxy con caché Redis en `routes/imageProxy.routes.js`.
- Schema canónico: `db/init/001-init.sql`. Migraciones automáticas al arrancar vía `initializeDatabase()` (`src/db/initialize.js`).

## Roles

admin (todo), supervisor (solo sus andamios / proyectos asignados), client (lectura de
sus proyectos). Enforcement en `middleware/roles.js` + `services/scaffolds.service.js`.

## Convenciones

- Commits: conventional commits (`fix:`, `feat:`, `chore:`), español o inglés.
- Frontend: páginas por rol en `src/pages/{admin,supervisor,client}/`; código compartido en `src/shell/`; tipos en `src/types/`.
- No editar `init.sql` de la raíz (legacy); el canónico es `db/init/001-init.sql`.
- Backend lint tiene 28 errores pre-existentes (`no-unused-vars`); no son regresiones.

## Planes de mejora

Ver `plans/README.md` (estado y orden de ejecución).
