# Alltura — Frontend

Interfaz de usuario para el sistema de gestión de andamios. SPA construida con React 19 y TypeScript, optimizada para trabajo en campo (móvil) y administración en escritorio.

## Stack

| Tecnología | Versión | Rol |
|---|---|---|
| React | v19 | UI framework |
| TypeScript | v5 | Tipado estático |
| Vite | v7 | Build tool y dev server |
| Tailwind CSS | v3 | Estilos utilitarios |
| React Router | v7 | Enrutamiento |
| TanStack Query | v5 | Caché, sincronización y estado del servidor |
| React Hook Form + Zod | — | Formularios con validación tipada |
| Axios | v1 | Cliente HTTP |
| Vitest | v3 | Tests unitarios y de componentes |

## Estructura

```
src/
├── components/
│   ├── cards/          # EntityCard, ProjectCard, ClientCard, UserCard
│   ├── dashboard/      # Componentes de métricas y gráficos
│   ├── forms/          # FormInputs estandarizados
│   ├── icons/          # Iconos SVG propios
│   └── layout/         # Contenedores y componentes estructurales
│
├── context/            # AuthContext (sesión y rol activo)
├── hooks/              # Custom hooks (ver más abajo)
├── layouts/            # Layouts por rol
├── pages/
│   ├── admin/          # Dashboard, proyectos, usuarios, clientes, historial
│   ├── supervisor/     # Dashboard, andamios por proyecto, crear/desarmar
│   └── client/         # Vista de solo lectura con andamios y certificaciones
│
├── router/             # Definición de rutas y guards por rol
├── services/           # Clientes de API (una función por endpoint)
├── types/              # Interfaces TypeScript compartidas
└── utils/              # Helpers (formateo, compresión de imágenes, etc.)
```

## Custom Hooks

| Hook | Descripción |
|---|---|
| `useBreakpoint` | Breakpoint activo (`base` \| `xs` \| `sm` \| `md` \| `lg` \| `xl` \| `2xl`) |
| `useBreakpoints` | Flags booleanos: `isMobile`, `isTablet`, `isDesktop` |
| `useMediaQuery` | Media query arbitraria |
| `useScaffoldPermissions` | Permisos del usuario sobre un andamio concreto |
| `useScaffoldValidation` | Validaciones de negocio (estados, progreso) |
| `useScaffoldModifications` | CRUD de secciones/modificaciones de andamio |
| `useClientNotes` | Notas de cliente por proyecto |
| `useNotifications` | Suscripción y estado de push notifications |
| `useGet` / `useMutate` | Wrappers tipados sobre TanStack Query |
| `useFormErrors` | Normalización de errores de API a React Hook Form |

## Responsive

La app tiene dos modos de uso principales:

- **Móvil (supervisores en campo):** flujo de creación/actualización de andamios, cambio de estados, carga de fotos y certificaciones
- **Escritorio (administradores):** dashboard global, gestión de usuarios/proyectos/clientes, reportes

Breakpoints de Tailwind extendidos:

| Token | Ancho | Uso típico |
|---|---|---|
| `xs` | 480px | Smartphones grandes |
| `sm` | 640px | Tablets pequeñas |
| `md` | 768px | Tablets |
| `lg` | 1024px | Laptops |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Pantallas grandes |

## PWA

- Service Worker registrado en `public/sw.js`
- `public/manifest.json` con iconos en múltiples resoluciones
- Capacidades offline para lectura de datos cacheados
- Push notifications vía VAPID (requiere permiso del usuario)

## Variables de Entorno

| Variable | Descripción | Default |
|---|---|---|
| `VITE_IMAGE_MAX_MB` | Tamaño máximo de imagen en cliente (MB) | `25` |

> Copiar `frontend/.env.example` como `frontend/.env` para desarrollo local.

En producción, el build se genera en tiempo de Docker con `--build-arg VITE_IMAGE_MAX_MB=<valor>`.

## Scripts

```bash
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # Build de producción → dist/
npm run preview      # Preview del build de producción
npm test             # Vitest (una sola pasada)
npm run lint         # ESLint + TypeScript
npm run format       # Prettier sobre src/
```

## Deploy

El build de producción (`dist/`) es servido por **nginx**. La configuración del servidor (`nginx.conf.template`) reemplaza variables de entorno en runtime vía `docker-entrypoint.sh`, lo que permite configurar `BACKEND_URL` sin reconstruir la imagen.

Ver documentación completa en `docs/` (raíz del monorepo).
