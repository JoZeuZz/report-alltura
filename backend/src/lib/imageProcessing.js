// backend/src/lib/imageProcessing.js
let sharp = null;
try {
  // eslint-disable-next-line global-require
  sharp = require('sharp');
} catch (_) {
  // Sharp unavailable — callers must check before calling
}

/**
 * Streams inputStream through Sharp resize transform.
 * Returns { data: Buffer, resolvedContentType: string }.
 * Caller must hold the semaphore before calling and release after.
 */
const processWithSharp = (inputStream, preset, fallbackContentType) =>
  new Promise((resolve, reject) => {
    if (!sharp) {
      reject(new Error('Sharp not available'));
      return;
    }

    const transformer = sharp({ failOnError: false })
      .rotate()
      .resize({ width: preset.width, height: preset.height, fit: 'inside', withoutEnlargement: true });

    const chunks = [];
    let sharpInfo = null;

    transformer.on('info', (info) => { sharpInfo = info; });
    transformer.on('error', reject);
    transformer.on('data', (chunk) => chunks.push(chunk));
    transformer.on('end', () => {
      const fmt = sharpInfo?.format;
      const resolvedContentType = fmt === 'jpeg' ? 'image/jpeg' : fmt ? `image/${fmt}` : fallbackContentType;
      resolve({ data: Buffer.concat(chunks), resolvedContentType });
    });
    inputStream.on('error', (err) => { transformer.destroy(); inputStream.destroy(); reject(err); });
    inputStream.pipe(transformer);
  });

module.exports = { processWithSharp };
