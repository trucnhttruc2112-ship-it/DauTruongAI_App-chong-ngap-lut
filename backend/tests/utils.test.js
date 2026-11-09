import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { readConfig } from '../src/config.js';
import { normalizeAnalysis, prepareImage } from '../src/utils.js';
import { makeImage, prediction } from './helpers.js';

const metadata = { model: 'test-model', mode: 'gemini', now: new Date('2026-11-09T02:00:00.000Z') };

test('configuration defaults, strict booleans, ports and exact origins', () => {
  assert.equal(readConfig({}).mock, false);
  assert.equal(readConfig({}).port, 3001);
  assert.equal(readConfig({}).apiKey, '');
  const config = readConfig({
    MOCK_GEMINI: ' TRUE ', GEMINI_MODEL: 'custom-model', GEMINI_API_KEY: ' test-key ',
    PORT: '4000', GEMINI_TIMEOUT_MS: '5000',
    ALLOWED_ORIGINS: 'http://localhost:5173/,http://localhost:5173,https://example.com',
  });
  assert.equal(config.mock, true);
  assert.equal(config.model, 'custom-model');
  assert.equal(config.apiKey, 'test-key');
  assert.deepEqual(config.allowedOrigins, ['http://localhost:5173', 'https://example.com']);
  for (const env of [
    { PORT: '0' }, { PORT: '65536' }, { PORT: '1.5' }, { MOCK_GEMINI: 'yes' },
    { GEMINI_TIMEOUT_MS: '-1' }, { GEMINI_TIMEOUT_MS: '120001' },
    { ALLOWED_ORIGINS: '*' }, { ALLOWED_ORIGINS: 'https://example.com/path' },
    { ALLOWED_ORIGINS: 'https://user:password@example.com' },
  ]) assert.throws(() => readConfig(env));
});

test('normalization derives server fields and ignores model-supplied metadata', () => {
  const result = normalizeAnalysis({
    ...prediction(), isFlooded: false, needsVerification: false,
    analyzedAt: 'yesterday', mode: 'mock', model: 'untrusted',
    evidence: [' Nước phủ mặt đường ', 'Nước phủ mặt đường'],
  }, metadata);
  assert.deepEqual(result, {
    isFlooded: true, status: 'flooded', severity: 'medium', evidence: ['Nước phủ mặt đường'],
    summary: prediction().summary, needsVerification: true,
    analyzedAt: '2026-11-09T02:00:00.000Z', model: 'test-model', mode: 'gemini',
  });
});

test('not_flooded and uncertain have consistent boolean/severity mappings', () => {
  const dry = normalizeAnalysis({ ...prediction(), status: 'not_flooded', severity: 'none' }, metadata);
  assert.equal(dry.isFlooded, false);
  assert.equal(dry.severity, 'none');
  const unknown = normalizeAnalysis({ ...prediction(), status: 'uncertain', severity: 'high' }, metadata);
  assert.equal(unknown.isFlooded, null);
  assert.equal(unknown.severity, 'unknown');
});

test('missing evidence and contradictory results degrade to uncertain', () => {
  for (const value of [
    { ...prediction(), evidence: [] },
    { ...prediction(), severity: 'none' },
    { ...prediction(), status: 'not_flooded', severity: 'high' },
    { ...prediction(), status: 'not_flooded', severity: 'none', evidence: [] },
  ]) {
    const result = normalizeAnalysis(value, metadata);
    assert.equal(result.status, 'uncertain');
    assert.equal(result.isFlooded, null);
    assert.equal(result.severity, 'unknown');
    assert.deepEqual(result.evidence, []);
  }
});

test('common unsupported depth, capture and route claims are discarded', () => {
  for (const summary of [
    'Nước sâu 30 cm.', 'Ảnh được chụp tại Quận 1.', 'Ảnh chụp lúc 08:00.',
    'Tuyến đường này an toàn.', 'An toàn để di chuyển.',
  ]) {
    const result = normalizeAnalysis({ ...prediction(), summary }, metadata);
    assert.equal(result.status, 'uncertain');
    assert.notEqual(result.summary, summary);
  }
});

test('invalid AI response types, enums and oversized strings are rejected', () => {
  for (const value of [
    null, [], {}, { ...prediction(), status: 'yes' },
    { ...prediction(), severity: 3 }, { ...prediction(), evidence: 'water' },
    { ...prediction(), evidence: [5] }, { ...prediction(), evidence: ['  '] },
    { ...prediction(), evidence: ['a'.repeat(301)] },
    { ...prediction(), evidence: Array(9).fill('water') },
    { ...prediction(), summary: '' }, { ...prediction(), summary: 'a'.repeat(601) },
  ]) assert.throws(() => normalizeAnalysis(value, metadata), { status: 502, code: 'GEMINI_INVALID_RESPONSE' });
});

test('decode strips EXIF, fixes orientation and resizes before forwarding', async () => {
  const buffer = await sharp({
    create: { width: 2500, height: 1200, channels: 3, background: '#456789' },
  }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const image = await prepareImage({ buffer, mimetype: 'text/plain', originalname: 'anything.txt' });
  const actual = await sharp(image.buffer).metadata();
  assert.equal(image.mimeType, 'image/jpeg');
  assert.equal(actual.height, 2048);
  assert.ok(actual.width < actual.height);
  assert.equal(actual.exif, undefined);
  assert.equal(actual.orientation, undefined);
});

test('rejects high-pixel images and animated WebP', async () => {
  const large = await makeImage('png', 6000, 5000);
  await assert.rejects(prepareImage({ buffer: large }), { status: 415, code: 'INVALID_IMAGE' });
  // Distinct frames prevent the encoder from collapsing the fixture to a still image.
  const pixels = Buffer.from([
    255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0,
    0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255,
  ]);
  const animated = await sharp(pixels, {
    raw: { width: 2, height: 4, pageHeight: 2, channels: 3 },
  }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
  assert.equal((await sharp(animated).metadata()).pages, 2);
  await assert.rejects(prepareImage({ buffer: animated }), { status: 415, code: 'ANIMATED_IMAGE_UNSUPPORTED' });
});
