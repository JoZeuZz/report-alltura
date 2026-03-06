const express = require('express');
const router = express.Router();
const healthCheckService = require('../lib/healthCheck');
const redisClient = require('../lib/redis');

const checkCriticalDependencies = async () => {
  const dependencies = {};

  const dbStart = Date.now();
  try {
    await healthCheckService.checkDatabase();
    dependencies.database = {
      status: 'healthy',
      duration: Date.now() - dbStart,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    dependencies.database = {
      status: 'unhealthy',
      duration: Date.now() - dbStart,
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }

  const redisStart = Date.now();
  try {
    const redisHealth = await redisClient.healthCheck();
    if (!redisHealth.healthy) {
      dependencies.redis = {
        status: 'unhealthy',
        duration: Date.now() - redisStart,
        timestamp: new Date().toISOString(),
        error: redisHealth.message || 'Redis unhealthy',
      };
    } else {
      dependencies.redis = {
        status: 'healthy',
        duration: Date.now() - redisStart,
        timestamp: new Date().toISOString(),
      };
    }
  } catch (error) {
    dependencies.redis = {
      status: 'unhealthy',
      duration: Date.now() - redisStart,
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }

  const isReady =
    dependencies.database.status === 'healthy' &&
    dependencies.redis.status === 'healthy';

  return { dependencies, isReady };
};

// Endpoint de health check básico
router.get('/', async (req, res) => {
  try {
    const health = await healthCheckService.runAllChecks();
    const { dependencies, isReady } = await checkCriticalDependencies();

    const status = health.status === 'healthy' && isReady ? 'healthy' : 'unhealthy';
    const statusCode = status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      ...health,
      status,
      dependencies,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint simple de liveness (para Kubernetes)
router.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

// Endpoint de readiness
router.get('/ready', async (req, res) => {
  try {
    const { dependencies, isReady } = await checkCriticalDependencies();
    if (!isReady) {
      return res.status(503).json({
        status: 'not ready',
        dependencies,
      });
    }
    res.status(200).json({ status: 'ready', dependencies });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

module.exports = router;
