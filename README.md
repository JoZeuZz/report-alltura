# Alltura — Gestión de Andamios

> Plataforma web empresarial para la gestión del ciclo de vida de andamios en obras de construcción. Reemplaza el seguimiento manual por un sistema persistente con auditoría completa, reportes y control de acceso basado en roles.

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-v16+-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-v5-000000?logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-v19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-v5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v14+-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-v7-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v3-06B6D4?logo=tailwindcss&logoColor=white)

</div>

---

## Características

### Gestión de Andamios
- **Ciclo de vida completo** — creación, actualización, desarmado con foto obligatoria
- **Sistema de estados dual** — Tarjeta (verde/roja) + Armado (armado/desarmado)
- **Secciones y modificaciones** — registro de secciones adicionales por andamio
- **Certificaciones** — carga y gestión de PDFs de certificación por andamio
- **Dimensiones automáticas** — cálculo de metros cúbicos (ancho × largo × alto)
- **Progreso dinámico** — porcentaje de avance con validaciones de negocio

### Dashboard y Reportes
- Métricas de metros cúbicos (armados vs. desarmados)
- Distribución de tarjetas de seguridad en tiempo real
- Filtrado por proyecto, supervisor y cliente
- Exportación a **PDF** y **Excel** (con filtros aplicados)
- Vistas diferenciadas: dashboard global (admin) y por proyecto (supervisor)

### Auditoría y Trazabilidad
- Historial completo de todos los cambios (quién, qué y cuándo)
- Vista de diff entre estado anterior y nuevo
- Timeline expandible por andamio

### Seguridad Enterprise
- JWT (15 min) + refresh tokens (7 días) con blacklist en Redis
- Passwords según NIST SP 800-63B (mínimo 12 caracteres)
- Rate limiting, Helmet, HSTS, CSP estricto
- Validación de esquemas con Joi en todos los endpoints
- Sanitización con DOMPurify + prepared statements
- Detección de anomalías (múltiples IPs, cambios de user-agent)

### UX y Accesibilidad
- **PWA** con Service Worker y capacidades offline
- Interfaz responsive (optimizada para móvil en campo y escritorio para admin)
- Tour guiado interactivo para nuevos usuarios
- Push notifications (VAPID / web-push)
- Compresión automática de imágenes (cliente y servidor)

---

## Stack Tecnológico

### Backend
| Tecnología | Versión | Uso |
|---|---|---|
| Node.js | v16+ | Runtime |
| Express | v5 | Framework HTTP |
| PostgreSQL | v14+ | Base de datos principal |
| Redis | v7 | Blacklist de tokens, caché |
| JWT | — | Autenticación stateless |
| Joi | v18 | Validación de esquemas |
| Sharp | v0.33 | Procesamiento de imágenes |
| PDFKit / ExcelJS | — | Generación de reportes |
| Winston / Morgan | — | Logging estructurado |
| Swagger UI | — | Documentación de API (`/api-docs`) |
| Jest | v30 | Tests |

### Frontend
| Tecnología | Versión | Uso |
|---|---|---|
| React | v19 | UI |
| TypeScript | v5 | Tipado estático |
| Vite | v7 | Build tool |
| Tailwind CSS | v3 | Estilos |
| TanStack Query | v5 | Caché y sincronización de datos |
| React Router | v7 | Enrutamiento |
| React Hook Form + Zod | — | Formularios y validación |
| Vitest | v3 | Tests |

### Infraestructura
| Componente | Tecnología |
|---|---|
| Contenedores | Docker Compose |
| Deploy | Coolify + Cloudflare Tunnel |
| Imágenes | Google Cloud Storage |
| Proxy frontend | nginx |

---

## Arquitectura

```
┌─────────────────────────────────────────────┐
│                alltura_network               │
│                                             │
│  ┌──────────┐   ┌──────────┐               │
│  │ postgres │   │  redis   │               │
│  └────┬─────┘   └────┬─────┘               │
│       │              │                     │
│  ┌────▼──────────────▼─────┐               │
│  │        backend          │ :5000          │
│  │   Node.js / Express 5   │               │
│  └─────────────┬───────────┘               │
│                │                            │
│  ┌─────────────▼───────────┐               │
│  │       frontend          │ :80            │
│  │   React 19 / nginx      │               │
│  └─────────────────────────┘               │
└──────────────────┬──────────────────────────┘
                   │ Cloudflare Tunnel
                   ▼
              Internet (HTTPS)
```

**Monorepo** con tres workspaces: `backend/`, `frontend/` y raíz (scripts compartidos).

---

## Roles y Permisos

| Acción | Admin | Supervisor | Cliente |
|---|:---:|:---:|:---:|
| Ver todos los andamios | ✅ | ❌ | ❌ |
| Ver andamios de proyectos asignados | ✅ | ✅ | ✅ |
| Crear / editar andamios | ✅ | ✅ * | ❌ |
| Eliminar andamios | ✅ | ❌ | ❌ |
| Cambiar estado de tarjeta/armado | ✅ | ✅ * | ❌ |
| Subir certificaciones PDF | ✅ | ✅ * | ❌ |
| Ver historial de cambios | ✅ | ✅ | ✅ |
| Gestionar usuarios, proyectos, clientes | ✅ | ❌ | ❌ |
| Dashboard de métricas | ✅ | ✅ ** | ❌ |
| Exportar reportes PDF / Excel | ✅ | ✅ ** | ✅ ** |

\* Solo sobre andamios propios  
\*\* Solo de proyectos asignados

---

## Estructura del Proyecto

```
/
├── backend/
│   ├── src/
│   │   ├── config/        # Configuración (swagger, etc.)
│   │   ├── controllers/   # Controladores por recurso
│   │   ├── db/            # Inicialización y migraciones
│   │   ├── lib/           # Logger, Redis, utilidades
│   │   ├── middleware/    # Auth, RBAC, validación, sanitización
│   │   ├── models/        # Modelos de datos
│   │   ├── routes/        # Rutas de API
│   │   ├── services/      # Lógica de negocio
│   │   ├── tests/         # Tests de integración (Jest)
│   │   └── validation/    # Esquemas Joi
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/    # Componentes reutilizables
│   │   ├── context/       # Contextos React (auth, etc.)
│   │   ├── hooks/         # Custom hooks
│   │   ├── pages/         # Páginas por rol (admin/, supervisor/, client/)
│   │   ├── services/      # Clientes de API
│   │   └── types/         # Tipos TypeScript
│   └── Dockerfile
│
├── db/
│   └── init/001-init.sql  # Esquema SQL canónico
│
├── docs/                  # Documentación de deploy y seguridad
├── docker-compose.yml     # Deploy producción (Coolify)
├── docker-compose.dev.yml # Desarrollo local
└── package.json           # Scripts raíz del monorepo
```

---

## Instalación Local

### Prerrequisitos

- Node.js v16+
- Docker y Docker Compose

### 1. Clonar y instalar dependencias

```bash
git clone <repository-url>
cd reportes
npm run install:all
```

### 2. Configurar variables de entorno

```bash
# Backend
cp backend/.env.example backend/.env
```

Variables mínimas en `backend/.env`:

```env
# Base de datos
DB_USER=postgres
DB_PASSWORD=tu_contraseña
DB_NAME=alltura_reports
DB_HOST=localhost
DB_PORT=5432

# JWT
JWT_SECRET=secreto_minimo_32_chars
JWT_REFRESH_SECRET=otro_secreto_diferente

# Redis
REDIS_URL=redis://localhost:6379

# Google Cloud Storage
GCS_PROJECT_ID=tu-project-id
GCS_BUCKET_NAME=tu-bucket
GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/service-account.json

# Servidor
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
```

Variables en `frontend/.env`:

```env
VITE_IMAGE_MAX_MB=25
```

> Las credenciales GCS reales **no se versionan**. Solo se versiona `backend/service-account.example.json` como plantilla.

### 3. Levantar servicios locales (PostgreSQL + Redis)

```bash
npm run db:up
```

### 4. Iniciar la aplicación

```bash
npm run dev
```

- **Backend API:** `http://localhost:5000`
- **Frontend:** `http://localhost:5173`
- **Swagger UI:** `http://localhost:5000/api-docs`

---

## Scripts

### Raíz del monorepo

```bash
npm run dev            # Backend + frontend en paralelo
npm run install:all    # Instalar dependencias en todos los workspaces
npm test               # Ejecutar todos los tests
npm run db:up          # Levantar PostgreSQL y Redis (Docker)
npm run db:down        # Detener servicios locales
npm run db:logs        # Logs de PostgreSQL en tiempo real
```

### Backend

```bash
npm run dev            # Nodemon en desarrollo
npm start              # Producción
npm test               # Jest
npm run test:coverage  # Cobertura
npm run create-admin   # Crear usuario administrador
npm run generate-secrets  # Generar JWT secrets
```

### Frontend

```bash
npm run dev            # Vite dev server
npm run build          # Build de producción
npm test               # Vitest
npm run lint           # ESLint
npm run format         # Prettier
```

---

## API

**Base URL:** `/api`  
**Autenticación:** `Authorization: Bearer <token>`  
**Documentación interactiva:** `/api-docs` (Swagger UI)

### Endpoints principales

| Recurso | Métodos |
|---|---|
| `/api/auth` | `POST /login`, `POST /logout`, `POST /refresh`, `POST /change-password` |
| `/api/users` | CRUD completo |
| `/api/clients` | CRUD completo (empresas mandantes) |
| `/api/projects` | CRUD + asignación de usuarios |
| `/api/scaffolds` | CRUD + `PATCH /:id/card-status` + `PATCH /:id/assembly-status` |
| `/api/scaffold-modifications` | Secciones y modificaciones por andamio |
| `/api/notifications` | Suscripción y envío de push notifications |
| `/api/dashboard` | Métricas globales (admin) |
| `/api/supervisor-dashboard` | Métricas por proyectos asignados |
| `/api/projects/:id/report/pdf` | Exportar reporte PDF |
| `/api/projects/:id/report/excel` | Exportar reporte Excel |

---

## Deploy en Producción

El deploy usa **Coolify** con **Cloudflare Tunnel** para exponer el servicio sin abrir puertos. Ver documentación detallada:

- [`docs/DEPLOY_COOLIFY_CLOUDFLARE_TUNNEL.md`](./docs/DEPLOY_COOLIFY_CLOUDFLARE_TUNNEL.md)
- [`docs/coolify-vars.md`](./docs/coolify-vars.md)

### Variables de entorno requeridas en producción

Además de las variables de desarrollo, se requieren:

```env
VAPID_PUBLIC_KEY=...    # Push notifications
VAPID_PRIVATE_KEY=...
SESSION_SECRET=...
BACKEND_URL=http://appandamios-backend:5000
CLIENT_URL=https://tu-dominio.com
NODE_ENV=production
```

Las credenciales GCS se montan como secreto externo en runtime:

```
/data/coolify/secrets/gcs/service-account.json → /app/service-account.json (ro)
```

---

## Modelo de Datos

```
clients ──────────────────────────────┐
    │ 1:N                             │
    ▼                                 │
projects ◄──── users (supervisor/client)
    │ 1:N
    ▼
scaffolds ──────────────────────────────┐
    │                                   │
    ├── scaffold_history (auditoría)     │
    └── scaffold_modifications          │
        (secciones adicionales)         │
                              GCS (imágenes + PDFs)
```

**Entidades:** `users`, `clients`, `projects`, `scaffolds`, `scaffold_history`, `scaffold_modifications`

---

## Licencia

Copyright © 2024-2025 Alltura. Todos los derechos reservados.
