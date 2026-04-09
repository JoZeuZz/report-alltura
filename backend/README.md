# Proyecto de Reportabilidad - Backend

Este proyecto es la API para la aplicación de reportabilidad de Alltura.

## Tecnologías

- Node.js 12+
- Express
- JWT
- Sequelize
- dotenv
- PostgreSQL

## Mejoras Realizadas

Se han aplicado varias mejoras para aumentar la calidad, mantenibilidad y seguridad del código:

- **Seguridad:**
  - `helmet`: para añadir cabeceras de seguridad HTTP.
  - `cors`: para configurar una política de CORS restrictiva.
  - `express-rate-limit`: para limitar el número de peticiones por IP.
- **Validación de Entradas:** Se ha añadido validación y sanitización de todas las entradas de la API usando `joi`.
- **Gestión de JWT:**
  - Todos los tokens JWT se generan con una fecha de expiración.
  - Se ha implementado una lista de revocación de tokens en memoria para el `logout`.
- **Gestión de Errores y Logging:**
  - Se ha estandarizado el formato de las respuestas de error.
  - Se ha implementado un logger centralizado con Winston que guarda los logs en archivos y en la consola.
- **Scripts y Pruebas:**
  - Se han añadido scripts de `lint` y `test` al `package.json`.
  - Se ha configurado ESLint para asegurar la calidad del código.
  - Se ha configurado Jest para ejecutar pruebas unitarias y de integración.
  - Se han añadido pruebas unitarias para helpers como `excelGenerator` y pruebas de integración para endpoints como el de `login`.

## Scripts Disponibles

En el directorio del proyecto, puedes ejecutar:

### `npm start`

Ejecuta el servidor en modo de producción.

### `npm run dev`

Ejecuta el servidor en modo de desarrollo con `nodemon`, que reinicia el servidor automáticamente al detectar cambios.

### `npm run lint`

Ejecuta ESLint para analizar el código en busca de errores y problemas de estilo.

### `npm run test`

Ejecuta Jest para correr las pruebas unitarias.

---

**Nota sobre la base de datos:**
Si usas Docker para el entorno local, asegúrate de levantar la base de datos antes de iniciar el backend:

```bash
npm run db:up
```

Esto levantará PostgreSQL y Redis para desarrollo local usando `docker-compose.dev.yml`. PostgreSQL quedará disponible en `localhost:5432`, por lo que la configuración por defecto (`DB_HOST=localhost`) funcionará cuando el backend se ejecute fuera de contenedor. Si prefieres usar una instancia local de PostgreSQL, edita `backend/.env` con tus credenciales y crea la base de datos antes de iniciar el backend.

Fuente canónica de inicialización SQL para Docker local y deploy: `db/init/001-init.sql`.
El archivo `init.sql` en la raíz del repo se mantiene solo como wrapper de compatibilidad y no debe contener DDL propio.

---

**Política de credenciales GCP (Alltura):**
- Se versiona solo `backend/service-account.example.json` como plantilla.
- El archivo real de credenciales no se versiona y debe mantenerse fuera del árbol del repo.
- En local, `GOOGLE_APPLICATION_CREDENTIALS` debe apuntar a una ruta externa configurable libre.
- En deploy Docker/Coolify, la ruta canónica es `/app/service-account.json` con montaje externo read-only (por ejemplo: `/data/coolify/secrets/gcs/service-account.json:/app/service-account.json:ro`).
