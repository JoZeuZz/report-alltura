# Alltura — Backend

API REST para el sistema de gestión de andamios. Arquitectura de 3 capas (routes → controllers → services) sobre Node.js con Express 5 y PostgreSQL.

## Stack

| Tecnología | Versión | Rol |
|---|---|---|
| Node.js | v16+ | Runtime |
| Express | v5 | Framework HTTP |
| PostgreSQL | v14+ | Base de datos |
| Redis | v7 | Blacklist de tokens JWT |
| `pg` | v8 | Driver PostgreSQL (prepared statements) |
| Joi | v18 | Validación de esquemas (todos los endpoints) |
| Sharp | v0.33 | Procesamiento y compresión de imágenes |
| PDFKit | v0.17 | Generación de reportes PDF |
| ExcelJS | v4 | Generación de reportes Excel |
| Winston / Morgan | — | Logging estructurado |
| Swagger UI Express | v5 | Documentación interactiva de API |
| Jest | v30 | Tests unitarios e integración |

## Seguridad

| Capa | Implementación |
|---|---|
| Headers HTTP | Helmet (HSTS, CSP, X-Frame-Options, Permissions-Policy) |
| Autenticación | JWT 15 min + refresh token 7 días + blacklist Redis |
| Contraseñas | bcrypt, NIST SP 800-63B (mín. 12 chars) |
| Rate limiting | 5 intentos / 15 min por IP |
| Validación | Joi en todos los endpoints, prepared statements en todas las queries |
| Sanitización | DOMPurify + express-mongo-sanitize + hpp |
| CORS | Origen dinámico desde `CLIENT_URL` |
| Anomalías | Detección de múltiples IPs y cambios de user-agent |

## Estructura

```
src/
├── config/
│   └── swagger.js          # Configuración OpenAPI
├── controllers/            # Handlers HTTP, sin lógica de negocio
├── db/
│   └── initialize.js       # Inicialización del pool PostgreSQL
├── lib/
│   ├── logger.js           # Winston + Morgan
│   └── redis.js            # Cliente Redis singleton
├── middleware/
│   ├── auth.js             # Verificación JWT
│   ├── roles.js            # RBAC (admin / supervisor / client)
│   ├── security.js         # Helmet, CORS, rate limit, compresión
│   ├── sanitization.js     # DOMPurify, sanitización de inputs
│   ├── validate.js         # Middleware Joi
│   ├── upload.js           # Multer + Sharp
│   ├── errorHandler.js     # Handler de errores centralizado
│   └── requestId.js        # UUID por request (trazabilidad)
├── models/                 # Queries SQL por entidad
├── routes/                 # Definición de rutas + Swagger JSDoc
├── services/               # Lógica de negocio
├── tests/                  # Tests Jest (lib/ y services/)
├── validation/             # Esquemas Joi por recurso
└── index.js                # Entry point
```

## Variables de Entorno

| Variable | Descripción | Requerida |
|---|---|:---:|
| `DB_USER` | Usuario PostgreSQL | ✅ |
| `DB_PASSWORD` | Contraseña PostgreSQL | ✅ |
| `DB_NAME` | Nombre de la base de datos | ✅ |
| `DB_HOST` | Host PostgreSQL | ✅ |
| `DB_PORT` | Puerto PostgreSQL (default: 5432) | — |
| `JWT_SECRET` | Secreto para access tokens (≥32 chars) | ✅ |
| `JWT_REFRESH_SECRET` | Secreto para refresh tokens | ✅ |
| `SESSION_SECRET` | Secreto de sesión | ✅ |
| `REDIS_URL` | URL Redis (ej. `redis://localhost:6379`) | ✅ |
| `GCS_PROJECT_ID` | Google Cloud project ID | ✅ |
| `GCS_BUCKET_NAME` | Nombre del bucket GCS | ✅ |
| `GOOGLE_APPLICATION_CREDENTIALS` | Ruta al service account JSON | ✅ |
| `VAPID_PUBLIC_KEY` | Clave pública para push notifications | ✅ |
| `VAPID_PRIVATE_KEY` | Clave privada para push notifications | ✅ |
| `CLIENT_URL` | URL del frontend (CORS) | ✅ |
| `PORT` | Puerto del servidor (default: 5000) | — |
| `NODE_ENV` | `development` \| `production` | — |
| `IMAGE_MAX_BYTES` | Límite de tamaño de imagen (bytes) | — |
| `IMAGE_JPEG_QUALITY` | Calidad JPEG de salida (0-100) | — |

> Copiar `backend/.env.example` como `backend/.env` para desarrollo local.

**Credenciales GCS:** solo se versiona `service-account.example.json` como plantilla. El archivo real debe mantenerse fuera del repositorio. En producción (Docker/Coolify) se monta como secreto externo:
```
/data/coolify/secrets/gcs/service-account.json → /app/service-account.json (ro)
```

## Scripts

```bash
npm run dev          # Servidor con nodemon (desarrollo)
npm start            # Servidor en producción
npm test             # Jest
npm run test:watch   # Jest en modo watch
npm run test:coverage # Jest con cobertura
npm run lint         # ESLint
npm run create-admin # Crear usuario admin inicial
npm run generate-secrets # Generar JWT secrets seguros
npm run migrate:security # Migración de campos de seguridad
```

## Base de Datos

**Fuente canónica:** `db/init/001-init.sql` (raíz del monorepo).

Para desarrollo local con Docker (desde la raíz del monorepo):

```bash
npm run db:up     # Levantar PostgreSQL + Redis
npm run db:down   # Detener servicios
npm run db:logs   # Logs en tiempo real
```

## API Docs

Swagger UI disponible en `/api-docs` cuando el servidor está corriendo.

Spec JSON en `/api-docs/swagger.json`.
