// backend/src/tests/db/migrationRunner.test.js
'use strict';

jest.mock('fs');
jest.mock('../../lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const fs = require('fs');
const { logger } = require('../../lib/logger');
const { runMigrations } = require('../../db/migrationRunner');

// Construye un pool mock + client mock reutilizable
function makePool({ appliedRows = [] } = {}) {
  const client = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  };
  const pool = {
    query: jest.fn().mockImplementation(async (sql) => {
      const q = typeof sql === 'string' ? sql : '';
      if (q.includes('SELECT version')) return { rows: appliedRows };
      return { rows: [] };
    }),
    connect: jest.fn().mockResolvedValue(client),
  };
  return { pool, client };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Por defecto: directorio existe pero está vacío
  fs.readdirSync.mockReturnValue([]);
  fs.readFileSync.mockReturnValue('SELECT 1;');
});

describe('runMigrations — tabla de tracking', () => {
  test('crea schema_migrations si no existe', async () => {
    const { pool } = makePool();
    await runMigrations(pool);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS schema_migrations')
    );
  });
});

describe('runMigrations — directorio vacío / sin archivos', () => {
  test('no aplica migraciones si no hay archivos .sql', async () => {
    const { pool } = makePool();
    fs.readdirSync.mockReturnValue([]);
    await runMigrations(pool);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test('ENOENT en readdirSync → no lanza, loguea info', async () => {
    const { pool } = makePool();
    const err = Object.assign(new Error('not found'), { code: 'ENOENT' });
    fs.readdirSync.mockImplementation(() => { throw err; });
    await expect(runMigrations(pool)).resolves.toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('no encontrado')
    );
  });

  test('error distinto de ENOENT en readdirSync → relanza', async () => {
    const { pool } = makePool();
    const err = Object.assign(new Error('permiso denegado'), { code: 'EACCES' });
    fs.readdirSync.mockImplementation(() => { throw err; });
    await expect(runMigrations(pool)).rejects.toThrow('permiso denegado');
  });
});

describe('runMigrations — archivos pendientes', () => {
  test('aplica migración pendiente: BEGIN, SQL, INSERT, COMMIT', async () => {
    const { pool, client } = makePool({ appliedRows: [] });
    fs.readdirSync.mockReturnValue(['20260612_001_test.sql']);
    fs.readFileSync.mockReturnValue('CREATE INDEX IF NOT EXISTS idx_test ON t(id);');

    await runMigrations(pool);

    const calls = client.query.mock.calls.map(c => (typeof c[0] === 'string' ? c[0].trim() : ''));
    expect(calls[0]).toBe('BEGIN');
    expect(calls[1]).toContain('CREATE INDEX');
    expect(calls[2]).toContain('INSERT INTO schema_migrations');
    expect(calls[3]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('no aplica migración ya registrada en schema_migrations', async () => {
    const sql = 'CREATE INDEX IF NOT EXISTS idx_x ON t(id);';
    const checksum = require('crypto').createHash('sha256').update(sql).digest('hex');
    const { pool, client } = makePool({
      appliedRows: [{ version: '20260612_001_test', checksum }],
    });
    fs.readdirSync.mockReturnValue(['20260612_001_test.sql']);
    fs.readFileSync.mockReturnValue(sql);

    await runMigrations(pool);

    expect(pool.connect).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
  });

  test('aplica solo la segunda migración si la primera ya está aplicada', async () => {
    const sql1 = 'CREATE INDEX IF NOT EXISTS idx_a ON t(a);';
    const checksum1 = require('crypto').createHash('sha256').update(sql1).digest('hex');
    const { pool, client } = makePool({
      appliedRows: [{ version: '20260612_001_first', checksum: checksum1 }],
    });
    fs.readdirSync.mockReturnValue(['20260612_001_first.sql', '20260612_002_second.sql']);
    fs.readFileSync
      .mockReturnValueOnce(sql1)
      .mockReturnValueOnce('ALTER TABLE t ADD COLUMN IF NOT EXISTS x INT;');

    await runMigrations(pool);

    expect(pool.connect).toHaveBeenCalledTimes(1);
    const insertCall = client.query.mock.calls.find(
      c => typeof c[0] === 'string' && c[0].includes('INSERT INTO schema_migrations')
    );
    expect(insertCall[1][0]).toBe('20260612_002_second');
  });
});

describe('runMigrations — fallo de migración', () => {
  test('hace ROLLBACK y relanza si el SQL falla', async () => {
    const { pool, client } = makePool({ appliedRows: [] });
    fs.readdirSync.mockReturnValue(['20260612_001_bad.sql']);
    fs.readFileSync.mockReturnValue('INVALID SQL;');

    const sqlError = new Error('syntax error');
    client.query.mockImplementation(async (sql) => {
      if (typeof sql === 'string' && sql.includes('INVALID')) throw sqlError;
      return { rows: [] };
    });

    await expect(runMigrations(pool)).rejects.toThrow('syntax error');

    const rollbackCall = client.query.mock.calls.find(
      c => typeof c[0] === 'string' && c[0] === 'ROLLBACK'
    );
    expect(rollbackCall).toBeDefined();
    expect(client.release).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('runMigrations — checksum drift', () => {
  test('loguea warn si migración aplicada fue modificada, sin lanzar', async () => {
    const { pool } = makePool({
      appliedRows: [{ version: '20260612_001_changed', checksum: 'aabbcc' }],
    });
    fs.readdirSync.mockReturnValue(['20260612_001_changed.sql']);
    fs.readFileSync.mockReturnValue('SELECT 2; -- contenido modificado');

    await expect(runMigrations(pool)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('fue modificada')
    );
  });
});

describe('runMigrations — CONCURRENTLY sin transacción', () => {
  test('omite BEGIN/COMMIT si el SQL contiene CONCURRENTLY', async () => {
    const { pool, client } = makePool({ appliedRows: [] });
    fs.readdirSync.mockReturnValue(['20260612_001_concurrent.sql']);
    fs.readFileSync.mockReturnValue(
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_c ON t(c);'
    );

    await runMigrations(pool);

    const calls = client.query.mock.calls.map(c => (typeof c[0] === 'string' ? c[0].trim() : ''));
    expect(calls).not.toContain('BEGIN');
    expect(calls).not.toContain('COMMIT');
    expect(calls.some(c => c.includes('CONCURRENTLY'))).toBe(true);
  });
});
