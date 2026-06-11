// backend/src/tests/lib/imageProcessing.test.js
const { PassThrough, Readable } = require('stream');
const path = require('path');
const fs = require('fs');
const { processWithSharp } = require('../../lib/imageProcessing');

const FIXTURE_JPEG = path.join(__dirname, '../../../src/assets/logo-alltura.png');

describe('processWithSharp', () => {
  const preset = { width: 100, height: 100 };

  test('procesa imagen real y devuelve Buffer con resolvedContentType', async () => {
    const inputStream = fs.createReadStream(FIXTURE_JPEG);
    const { data, resolvedContentType } = await processWithSharp(inputStream, preset, 'image/png');
    expect(Buffer.isBuffer(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(resolvedContentType).toMatch(/^image\//);
  }, 10000);

  test('usa fallbackContentType cuando Sharp no reporta formato', async () => {
    // We test the fallback by providing a tiny valid PNG (1x1 white pixel)
    const onePxPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const inputStream = Readable.from(onePxPng);
    const { data, resolvedContentType } = await processWithSharp(inputStream, preset, 'image/png');
    expect(Buffer.isBuffer(data)).toBe(true);
    expect(resolvedContentType).toBe('image/png');
  }, 10000);

  test('rechaza cuando el inputStream emite error', async () => {
    const errorStream = new PassThrough();
    const p = processWithSharp(errorStream, preset, 'image/jpeg');
    errorStream.destroy(new Error('network failure'));
    await expect(p).rejects.toThrow('network failure');
  }, 5000);
});
