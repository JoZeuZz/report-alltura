# Alltura Reports

Aplicación web para la digitalización y gestión de informes de avance en trabajos de montaje de andamios para la empresa "Alltura".

## Descripción

"Alltura Reports" es una Aplicación Web Progresiva (PWA) diseñada para reemplazar el reporte de avances vía WhatsApp por un sistema centralizado. Permite a los técnicos en terreno reportar su progreso desde dispositivos móviles y a los administradores supervisar proyectos, visualizar avances y generar informes desde un panel de control de escritorio.

## Funcionalidades Principales

### Rol: Administrador (Admin)
- **Dashboard:** Visualización de métricas clave (Total de m³ armados, proyectos activos, etc.).
- **Gestión de Clientes:** CRUD completo para los clientes de la empresa.
- **Gestión de Proyectos:** CRUD completo para los proyectos, asignándolos a clientes.
- **Gestión de Usuarios:** CRUD completo para los usuarios y sus roles (admin/technician).
- **Visualizador de Reportes:** Vista detallada de los reportes por proyecto, con opción de ver imágenes en tamaño completo.
- **Exportación:** Generación de informes de proyecto en formato PDF y Excel.

### Rol: Técnico (Technician)
- **Interfaz Móvil Simple:** Acceso rápido a los proyectos activos asignados.
- **Creación de Reportes:** Formulario optimizado para móviles que permite:
  - Adjuntar fotos desde la cámara o galería.
  - Ingresar dimensiones (alto, ancho, profundidad).
  - Cálculo automático de metros cúbicos (m³).
  - Ingresar porcentaje de avance y notas adicionales.

## Arquitectura y Tecnologías

La aplicación sigue una arquitectura MVC tanto en el backend como en el frontend.

- **Backend:**
  - **Framework:** Node.js con Express.js
  - **Lenguaje:** JavaScript
  - **Base de Datos:** PostgreSQL
  - **Autenticación:** JSON Web Tokens (JWT)
  - **Almacenamiento de Archivos:** Google Cloud Storage
  - **Generación de Documentos:** `pdfkit`, `exceljs`

- **Frontend:**
  - **Framework:** React.js
  - **Lenguaje:** TypeScript (TSX)
  - **Estilo:** Tailwind CSS
  - **PWA:** `manifest.json` y Service Worker para capacidades offline.
  - **Cliente HTTP:** Axios