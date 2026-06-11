// backend/src/routes/imageProxy.routes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs');
const { logger } = require('../lib/logger');
const { createRedisRateLimiter, getRateLimitConfig } = require('../middleware/rateLimit');
const { sharpSemaphore, TIMEOUT_MS } = require('../lib/imageSemaphore');
const imageCache = require('../lib/imageCache');

const router = express.Router();

let sharp = null;
try {
  // eslint-disable-next-line global-require
  sharp = require('sharp');
  sharp.concurrency(1);
  sharp.cache(false);
} catch (error) {
  logger.warn('Sharp not available for image proxy resizing', { error: error.message });
}

const proxySecret = process.env.IMAGE_PROXY_SECRET || process.env.JWT_SECRET;
const proxyTokenTtlSeconds = parseInt(process.env.IMAGE_PROXY_TTL_SECONDS || '2592000', 10);
const proxyMaxCacheSeconds = Math.min(proxyTokenTtlSeconds, 3600);
const sizePresets = {
  thumb: { width: 320, height: 240 },
  medium: { width: 1024, height: 768 },
};

const storageOptions = {};
if (process.env.GCS_PROJECT_ID) storageOptions.projectId = process.env.GCS_PROJECT_ID;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) storageOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;

const storage = new Storage(storageOptions);
const localUploadsDir = path.join(__dirname, '../../uploads');

const { windowMs: imageProxyWindowMs, max: imageProxyMax } = getRateLimitConfig('IMAGE_PROXY', {
  windowMs: 60 * 1000,
  max: 1200,
});

const imageProxyLimiter = createRedisRateLimiter({
  keyPrefix: 'image-proxy',
  windowMs: imageProxyWindowMs,
  max: imageProxyMax,
  message: 'Demasiadas solicitudes de imágenes. Intenta nuevamente más tarde.',
});

const normalizeEtag = (etag) => {
  if (!etag) return null;
  if (etag.startsWith('W/"') || etag.startsWith('"')) return etag;
  return `"${etag}"`;
};

const stripEtag = (etag) => {
  if (!etag) return null;
  let clean = etag;
  if (clean.startsWith('W/"')) clean = clean.slice(2);
  clean = clean.replace(/^"+|"+$/g, '');
  return clean;
};

// Streams inputStream through Sharp resize, returns output Buffer.
// Caller must hold the semaphore before calling this and release after.
const processWithSharp = (inputStream, preset) =>
  new Promise((resolve, reject) => {
    const transformer = sharp({ failOnError: false })
      .rotate()
      .resize({ width: preset.width, height: preset.height, fit: 'inside', withoutEnlargement: true });

    const chunks = [];
    transformer.on('error', reject);
    transformer.on('data', (chunk) => chunks.push(chunk));
    transformer.on('end', () => resolve(Buffer.concat(chunks)));
    inputStream.on('error', (err) => { transformer.destroy(); reject(err); });
    inputStream.pipe(transformer);
  });

// Returns false and sends 503 when semaphore queue times out, true when acquired.
const acquireSemaphoreOrReject = async (res) => {
  try {
    await sharpSemaphore.acquireWithTimeout(TIMEOUT_MS);
    return true;
  } catch (err) {
    if (err.code === 'SEMAPHORE_TIMEOUT') {
      res.status(503)
        .set('Retry-After', '2')
        .json({ message: 'Servidor ocupado procesando imágenes, reintenta en unos segundos.' });
      return false;
    }
    throw err;
  }
};

router.use(imageProxyLimiter);

router.get('/', async (req, res) => {
  if (!proxySecret) {
    return res.status(500).json({ message: 'Image proxy secret not configured' });
  }

  const token = req.query.token;
  if (!token) {
    return res.status(400).json({ message: 'Missing image token' });
  }

  let payload;
  try {
    payload = jwt.verify(token, proxySecret);
  } catch (error) {
    logger.warn('Invalid image proxy token', { error: error.message });
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  const isLocal = payload.t === 'local' || payload.f;
  const bucketName = payload.b;
  const objectName = payload.o;
  const size = typeof req.query.size === 'string' ? req.query.size : '';

  // ==================== LOCAL FILE PATH ====================
  if (isLocal) {
    const relativePath = typeof payload.f === 'string' ? payload.f : '';
    if (!relativePath) {
      return res.status(400).json({ message: 'Invalid image token payload' });
    }

    try {
      const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
      const resolvedPath = path.resolve(localUploadsDir, normalized);
      const basePath = path.resolve(localUploadsDir);

      if (!resolvedPath.startsWith(basePath)) {
        return res.status(400).json({ message: 'Invalid image path' });
      }

      const stats = await fs.promises.stat(resolvedPath);
      const cacheMaxAge = proxyMaxCacheSeconds;
      const baseEtag = `${stats.size}-${stats.mtimeMs}`;
      const resolvedEtag = normalizeEtag(size ? `${baseEtag}-${size}` : baseEtag);

      if (resolvedEtag) res.setHeader('ETag', resolvedEtag);
      res.setHeader('Last-Modified', new Date(stats.mtimeMs).toUTCString());

      if (resolvedEtag && req.headers['if-none-match'] === resolvedEtag) {
        res.setHeader('Cache-Control', `private, max-age=${cacheMaxAge}`);
        return res.status(304).end();
      }

      if (req.headers['if-modified-since']) {
        const ifModifiedSince = new Date(req.headers['if-modified-since']);
        if (!Number.isNaN(ifModifiedSince.getTime()) && ifModifiedSince >= new Date(stats.mtimeMs)) {
          res.setHeader('Cache-Control', `private, max-age=${cacheMaxAge}`);
          return res.status(304).end();
        }
      }

      const extension = path.extname(resolvedPath).toLowerCase();
      const contentType = (() => {
        if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
        if (extension === '.png') return 'image/png';
        if (extension === '.webp') return 'image/webp';
        if (extension === '.avif') return 'image/avif';
        if (extension === '.pdf') return 'application/pdf';
        return 'application/octet-stream';
      })();

      if (size && sizePresets[size] && sharp) {
        const preset = sizePresets[size];
        const cacheKey = imageCache.buildKey('local', relativePath, size);

        const cached = await imageCache.get(cacheKey);
        if (cached) {
          res.setHeader('Content-Type', cached.contentType);
          res.setHeader('Cache-Control', `private, max-age=${cacheMaxAge}`);
          return res.end(cached.data);
        }

        const acquired = await acquireSemaphoreOrReject(res);
        if (!acquired) return;

        try {
          const inputStream = fs.createReadStream(resolvedPath);
          const outputBuffer = await processWithSharp(inputStream, preset);
          imageCache.set(cacheKey, { contentType, etag: resolvedEtag, data: outputBuffer });
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', `private, max-age=${cacheMaxAge}`);
          return res.end(outputBuffer);
        } finally {
          sharpSemaphore.release();
        }
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', `private, max-age=${cacheMaxAge}`);
      const stream = fs.createReadStream(resolvedPath);
      stream.on('error', (error) => {
        logger.warn('Image proxy local stream error', { error: error.message, path: resolvedPath });
        if (!res.headersSent) res.status(500).end();
      });
      return stream.pipe(res);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ message: 'Image not found' });
      }
      logger.error('Image proxy local error', { error: error.message });
      return res.status(500).json({ message: 'Failed to fetch image' });
    }
  }

  // ==================== GCS PATH ====================
  if (!bucketName || !objectName) {
    return res.status(400).json({ message: 'Invalid image token payload' });
  }

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectName);

    if (size && sizePresets[size] && sharp) {
      const preset = sizePresets[size];
      const cacheKey = imageCache.buildKey(bucketName, objectName, size);

      // Cache hit: serve without touching GCS or Sharp
      const cached = await imageCache.get(cacheKey);
      if (cached) {
        if (cached.etag && req.headers['if-none-match'] === cached.etag) {
          res.setHeader('ETag', cached.etag);
          res.setHeader('Cache-Control', `private, max-age=${proxyMaxCacheSeconds}`);
          return res.status(304).end();
        }
        if (cached.etag) res.setHeader('ETag', cached.etag);
        res.setHeader('Content-Type', cached.contentType);
        res.setHeader('Cache-Control', `private, max-age=${proxyMaxCacheSeconds}`);
        return res.end(cached.data);
      }

      // Cache miss: fetch metadata, check 304, process with Sharp
      const [metadata] = await file.getMetadata();
      const contentType = metadata.contentType || 'application/octet-stream';
      const cacheMaxAge = proxyMaxCacheSeconds;
      const lastModified = metadata.updated || metadata.timeCreated;
      const baseEtagRaw = metadata.etag || metadata.md5Hash || metadata.generation;
      const baseEtag = stripEtag(baseEtagRaw);
      const resolvedEtag = normalizeEtag(baseEtag ? `${baseEtag}-${size}` : null);

      if (resolvedEtag) res.setHeader('ETag', resolvedEtag);
      if (lastModified) res.setHeader('Last-Modified', new Date(lastModified).toUTCString());

      if (resolvedEtag && req.headers['if-none-match'] === resolvedEtag) {
        res.setHeader('Cache-Control', metadata.cacheControl || `private, max-age=${cacheMaxAge}`);
        return res.status(304).end();
      }

      const acquired = await acquireSemaphoreOrReject(res);
      if (!acquired) return;

      try {
        const gcsStream = file.createReadStream();
        const outputBuffer = await processWithSharp(gcsStream, preset);
        imageCache.set(cacheKey, { contentType, etag: resolvedEtag, data: outputBuffer });
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', metadata.cacheControl || `private, max-age=${cacheMaxAge}`);
        return res.end(outputBuffer);
      } finally {
        sharpSemaphore.release();
      }
    }

    // Passthrough: no size preset or Sharp unavailable — stream directly
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'application/octet-stream';
    const cacheMaxAge = proxyMaxCacheSeconds;
    const lastModified = metadata.updated || metadata.timeCreated;
    const baseEtagRaw = metadata.etag || metadata.md5Hash || metadata.generation;
    const baseEtag = stripEtag(baseEtagRaw);
    const resolvedEtag = normalizeEtag(baseEtag || null);

    if (resolvedEtag) res.setHeader('ETag', resolvedEtag);
    if (lastModified) res.setHeader('Last-Modified', new Date(lastModified).toUTCString());

    if (resolvedEtag && req.headers['if-none-match'] === resolvedEtag) {
      res.setHeader('Cache-Control', metadata.cacheControl || `private, max-age=${cacheMaxAge}`);
      return res.status(304).end();
    }

    if (!resolvedEtag && lastModified && req.headers['if-modified-since']) {
      const ifModifiedSince = new Date(req.headers['if-modified-since']);
      if (!Number.isNaN(ifModifiedSince.getTime()) && ifModifiedSince >= new Date(lastModified)) {
        res.setHeader('Cache-Control', metadata.cacheControl || `private, max-age=${cacheMaxAge}`);
        return res.status(304).end();
      }
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', metadata.cacheControl || `private, max-age=${cacheMaxAge}`);
    const stream = file.createReadStream();
    stream.on('error', (error) => {
      logger.warn('Image proxy stream error', { error: error.message, objectName });
      if (!res.headersSent) res.status(error.code === 404 ? 404 : 500).end();
    });
    stream.pipe(res);
  } catch (error) {
    logger.error('Image proxy error', { error: error.message, objectName });
    res.status(500).json({ message: 'Failed to fetch image' });
  }
});

module.exports = router;
