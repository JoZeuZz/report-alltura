-- DEPRECADO: wrapper de compatibilidad.
-- Fuente canónica única de inicialización SQL: db/init/001-init.sql
--
-- Este archivo se mantiene para evitar referencias rotas en flujos manuales,
-- pero NO debe contener DDL duplicado.
--
-- Entornos oficiales:
-- - Local/dev: docker-compose.dev.yml monta db/init/001-init.sql
-- - Deploy/prod: docker-compose.yml (db/postgres/Dockerfile) copia db/init/

\echo 'NOTICE: init.sql (raiz) esta deprecado; ejecutando db/init/001-init.sql'
\ir db/init/001-init.sql