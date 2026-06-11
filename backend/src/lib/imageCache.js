// backend/src/lib/imageCache.js
const crypto = require('crypto');
const { logger } = require('./logger');
const redisClient = require('./redis');

const TTL = parseInt(process.env.IMAGE_PROXY_CACHE_TTL_SECONDS || '14400', 10);
const ENABLED = (process.env.IMAGE_PROXY_CACHE_ENABLED || 'true').toLowerCase() !== 'false';

const buildKey = (bucketName, objectName, size) => {
  const raw = `${bucketName}:${objectName}:${size}`;
  return `imgproxy:${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16)}`;
};

const get = async (key) => {
  if (!ENABLED) return null;
  try {
    const client = await redisClient.getClient();
    const raw = await client.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      contentType: parsed.contentType,
      etag: parsed.etag || null,
      data: Buffer.from(parsed.data, 'base64'),
    };
  } catch (err) {
    logger.warn('imageCache.get failed', { key, error: err.message });
    return null;
  }
};

const set = (key, { contentType, etag, data }, ttlSeconds = TTL) => {
  if (!ENABLED) return;
  redisClient.getClient().then((client) => {
    const payload = JSON.stringify({
      contentType,
      etag: etag || null,
      data: data.toString('base64'),
    });
    return client.setEx(key, ttlSeconds, payload);
  }).catch((err) => {
    logger.warn('imageCache.set failed', { key, error: err.message });
  });
};

module.exports = { buildKey, get, set };
