-- Migración: índices de performance para tabla scaffolds y scaffold_history.
-- Idempotente (IF NOT EXISTS) — seguro aplicar múltiples veces.
-- Reemplaza: db/init/migrations/2026-06-12-scaffolds-indexes.sql
--
-- En tablas con cientos de miles de filas considerar CREATE INDEX CONCURRENTLY
-- (requiere un archivo de migración separado sin transacción).

CREATE INDEX IF NOT EXISTS idx_scaffolds_project ON scaffolds(project_id, assembly_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scaffolds_created_by ON scaffolds(created_by, assembly_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scaffolds_user ON scaffolds(user_id);
CREATE INDEX IF NOT EXISTS idx_scaffold_history_scaffold ON scaffold_history(scaffold_id, change_type, created_at);
