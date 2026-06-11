// backend/src/tests/lib/imageCache.test.js
jest.mock('../../lib/redis');
jest.mock('../../lib/logger', () => ({ logger: { warn: jest.fn() } }));

const redisClient = require('../../lib/redis');
const imageCache = require('../../lib/imageCache');

describe('imageCache', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = { get: jest.fn(), setEx: jest.fn().mockResolvedValue('OK') };
    redisClient.getClient = jest.fn().mockResolvedValue(mockClient);
    jest.clearAllMocks();
  });

  describe('buildKey', () => {
    test('devuelve string con prefijo imgproxy: y 16 chars hex', () => {
      const key = imageCache.buildKey('bucket', 'imagenes/foto.jpg', 'thumb');
      expect(key).toMatch(/^imgproxy:[a-f0-9]{16}$/);
    });

    test('es determinístico para los mismos inputs', () => {
      const k1 = imageCache.buildKey('bucket', 'imagenes/foto.jpg', 'thumb');
      const k2 = imageCache.buildKey('bucket', 'imagenes/foto.jpg', 'thumb');
      expect(k1).toBe(k2);
    });

    test('difiere por size', () => {
      const thumb = imageCache.buildKey('b', 'o', 'thumb');
      const medium = imageCache.buildKey('b', 'o', 'medium');
      expect(thumb).not.toBe(medium);
    });

    test('difiere por objectName', () => {
      const k1 = imageCache.buildKey('b', 'foto1.jpg', 'thumb');
      const k2 = imageCache.buildKey('b', 'foto2.jpg', 'thumb');
      expect(k1).not.toBe(k2);
    });
  });

  describe('get', () => {
    test('devuelve null cuando Redis no tiene la key', async () => {
      mockClient.get.mockResolvedValue(null);
      const result = await imageCache.get('imgproxy:abc123abc123abc1');
      expect(result).toBeNull();
    });

    test('devuelve objeto con data Buffer en cache hit', async () => {
      const data = Buffer.from('fake image data');
      const stored = JSON.stringify({
        contentType: 'image/jpeg',
        etag: '"abc123"',
        data: data.toString('base64'),
      });
      mockClient.get.mockResolvedValue(stored);

      const result = await imageCache.get('imgproxy:abc123abc123abc1');
      expect(result.contentType).toBe('image/jpeg');
      expect(result.etag).toBe('"abc123"');
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect(result.data).toEqual(data);
    });

    test('devuelve null y no propaga si Redis falla', async () => {
      redisClient.getClient.mockRejectedValue(new Error('Redis down'));
      const result = await imageCache.get('imgproxy:abc123abc123abc1');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    test('llama setEx con key, TTL y payload correcto', async () => {
      const data = Buffer.from('img bytes');
      imageCache.set(
        'imgproxy:key1key1key1key1',
        { contentType: 'image/png', etag: '"xyz"', data },
        3600
      );

      await new Promise((r) => setImmediate(r));

      expect(mockClient.setEx).toHaveBeenCalledTimes(1);
      const [key, ttl, payload] = mockClient.setEx.mock.calls[0];
      expect(key).toBe('imgproxy:key1key1key1key1');
      expect(ttl).toBe(3600);
      const parsed = JSON.parse(payload);
      expect(parsed.contentType).toBe('image/png');
      expect(parsed.etag).toBe('"xyz"');
      expect(Buffer.from(parsed.data, 'base64')).toEqual(data);
    });

    test('no lanza ni propaga si Redis falla', async () => {
      redisClient.getClient.mockRejectedValue(new Error('Redis down'));
      expect(() =>
        imageCache.set('key', { contentType: 'image/jpeg', etag: null, data: Buffer.from('x') })
      ).not.toThrow();
      await new Promise((r) => setImmediate(r));
    });
  });
});
