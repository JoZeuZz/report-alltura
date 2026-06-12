'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { logger } = require('../lib/logger');

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

async function runMigrations(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     VARCHAR(255) PRIMARY KEY,
      description TEXT,
      applied_at  TIMESTAMPTZ DEFAULT NOW(),
      checksum    VARCHAR(64)
    )
  `);

  let files;
  try {
    files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.info('[migrations] Directorio de migraciones no encontrado, omitiendo.');
      return;
    }
    throw err;
  }

  if (files.length === 0) {
    logger.info('[migrations] No hay archivos SQL de migración.');
    return;
  }

  const { rows } = await pool.query(
    'SELECT version, checksum FROM schema_migrations ORDER BY version'
  );
  const applied = new Map(rows.map(r => [r.version, r.checksum]));

  let appliedCount = 0;

  for (const file of files) {
    const version = path.basename(file, '.sql');
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');

    if (applied.has(version)) {
      if (applied.get(version) !== checksum) {
        logger.warn(
          `[migrations] ⚠️  La migración ${version} fue modificada después de ser aplicada.`
        );
      }
      continue;
    }

    logger.info(`[migrations] Aplicando: ${version} ...`);

    const useTransaction = !sql.toUpperCase().includes('CONCURRENTLY');
    const client = await pool.connect();

    try {
      if (useTransaction) await client.query('BEGIN');
      await client.query(sql);
      const description = version.replace(/^\d{8}_\d+_/, '').replace(/-/g, ' ');
      await client.query(
        'INSERT INTO schema_migrations (version, description, checksum) VALUES ($1, $2, $3)',
        [version, description, checksum]
      );
      if (useTransaction) await client.query('COMMIT');
      appliedCount++;
      logger.info(`[migrations] ✅ Aplicada: ${version}`);
    } catch (err) {
      if (useTransaction) {
        try { await client.query('ROLLBACK'); } catch (_) { /* ignorar error de rollback */ }
      }
      logger.error(`[migrations] ❌ Falló: ${version}`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  if (appliedCount === 0) {
    logger.info('[migrations] Esquema actualizado — no hay migraciones pendientes.');
  } else {
    logger.info(`[migrations] ✅ ${appliedCount} migración(es) aplicada(s) exitosamente.`);
  }
}

module.exports = { runMigrations };
