# Implementation Plans

Generados por el skill improve el 2026-06-12, sobre el commit `52de960`. Ejecutar en el
orden de abajo salvo que las dependencias indiquen otra cosa. Cada ejecutor: leer el plan
completo antes de empezar, respetar sus STOP conditions y actualizar su fila al terminar.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001 | Restaurar línea base de tests (jest env + vite.config) | P1 | S | — | DONE |
| 002 | Vulnerabilidades npm audit (backend + frontend) | P1 | S | — | TODO |
| 003 | Índices DB en tabla scaffolds | P1 | S | — | TODO |
| 004 | Tests de caracterización: autorización y máquina de estados | P1 | M | 001 | TODO |
| 005 | Robustecer disassembleScaffold + deny-by-default | P2 | S | 001, 004 | TODO |
| 006 | Eliminar N+1 en listados de andamios | P2 | M | 001, 003, 004 | TODO |
| 007 | Limpieza de deps (xss-clean, mongo-sanitize, bcryptjs, setup.js) | P2 | S | 001 | TODO |
| 008 | Refresh token a cookie HttpOnly | P2 | L | 001 (rec. tras 002) | TODO |
| 009 | CI GitHub Actions + CLAUDE.md | P2 | M | 001 (rec. tras 002) | TODO |
| 010 | Reparar Service Worker (install rota, openDB inexistente) | P3* | M | — (rec. tras 001) | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (con motivo de una línea) | REJECTED (con justificación de una línea)

\* 010 sube a P2 si su Step 1 confirma que la instalación rota del SW inutiliza las push notifications en producción.

## Dependency notes

- **001 es el cuello de botella**: ni backend (`npx jest` aborta por env vars) ni frontend (`vitest` falla en startup por el guard del proxy en vite.config.ts) tienen suite ejecutable hoy. Todos los planes con tests como gate lo necesitan.
- 004 debe aterrizar ANTES de 005 y 006: caracteriza el comportamiento de `scaffolds.service.js` que esos planes modifican.
- 005 cambia un comportamiento que 004 documenta con TODO (rol client pasa `validateUserPermissions`); 005 actualiza ese test.
- 006 cambia las expectativas de mocks del caso client de 004 (de N llamadas `getByProject` a una `getByProjects`).
- 003 antes de 006: el batching asume los índices presentes.
- 009 (CI) en verde requiere 001; el step de `npm audit` del CI queda limpio solo tras 002.
- 002 y 008 tocan ambos el flujo de auth del frontend (versión de react-router / authRefresh.ts): ejecutarlos en serie, no en paralelo.

## Findings considered and rejected

- **Rotación de refresh tokens "faltante"**: falso — ya implementada en `auth.service.js:237-241` (revoca el anterior, emite par nuevo).
- **`imageCache.set` sin await**: intencional (write-behind fire-and-forget) y con `.catch` que loguea; no es bug.
- **CORS permite requests sin Origin**: by-design para clientes móviles/CLI; todas las rutas exigen Bearer token.
- **Locale `es-CL` hardcodeado en pdfGenerator**: correcto para una empresa chilena; parametrizarlo es complejidad sin beneficio.
- **"No hay comando de test unificado"**: falso — `npm test` raíz existe vía npm-run-all (el problema real era que las suites no arrancan: plan 001).
- **Secretos en `backend/.env`**: el archivo NO está versionado (gitignore correcto). Acción recomendada fuera del repo: rotar los secretos por higiene operacional. Nunca copiar valores a archivos del repo.
- **Errores de stream tras headers enviados (image-proxy / PDF)**: real pero estructural y de bajo impacto práctico (cliente recibe descarga truncada en fallos raros de GCS); coste/beneficio no justifica plan ahora. Reevaluar si aparecen reportes de PDFs corruptos.
- **Exports PDF/Excel cargan todo en RAM**: real, pero el fix (streaming/paginación) es L y arriesgado para el formato; mitigado parcialmente por `mem_limit: 1g` reciente. Reevaluar con datos de producción (proyectos >500 andamios).
- **Duplicaciones menores** (3 configs ESLint en frontend, dos directorios de validación backend, `Unauthorized.tsx`+`UnauthorizedPage.tsx`, README con rutas desactualizadas, `dompurify`+`isomorphic-dompurify`, `browser-image-compression` en package.json raíz): reales pero de bajo leverage individual; agrupar en un plan futuro de housekeeping si molestan.

## Hallazgos de dirección (opciones para el mantenedor, sin plan)

- Notificaciones de ciclo de vida de andamios (crear/desarmar no notifican; modificaciones sí — la infraestructura ya existe en `notification.service.js`).
- Sistema de migraciones versionado (hoy: `run_migration.js` ad-hoc sin tracking; ver nota en plan 003).
- Variantes de imagen pre-generadas al subir (aceleraría exports; relacionado con el hallazgo de RAM rechazado arriba).
- Reasignación masiva de andamios al cambiar supervisor (hoy requiere SQL manual).
- Migrar sw.js artesanal a `vite-plugin-pwa` (ver Maintenance del plan 010).
