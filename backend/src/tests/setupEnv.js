// Variables de entorno deterministas para tests.
// Los tests unitarios mockean db/redis/gcs; estos valores solo
// satisfacen la validación de src/config/index.js (fail-fast).
// Si añades una variable required() a config/index.js, agrégala aquí también.
process.env.NODE_ENV = 'test';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_USER = process.env.DB_USER || 'test_user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test_password_not_real';
process.env.DB_NAME = process.env.DB_NAME || 'test_db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-minimo-32-caracteres!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-minimo-32-chars!!!';
