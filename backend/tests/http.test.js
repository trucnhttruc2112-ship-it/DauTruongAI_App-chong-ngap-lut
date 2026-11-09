import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/config.js';
import { createFloodAnalyzer } from '../src/gemini.js';
import { MAX_IMAGE_BYTES } from '../src/utils.js';
import { startApp, makeImage, upload, prediction } from './helpers.js';

test('health reports configuration, never claims connectivity or exposes keys', async t => {
  const base = await startApp(t, { config: readConfig({ GEMINI_API_KEY: 'test-private-key' }) });
  const response = await fetch(base + '/api/health');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.gemini.configured, true);
  assert.equal(body.gemini.connectivity, 'not_checked');
  assert.equal(body.mode, 'gemini');
  assert.equal(body.analysisReady, true);
  assert.ok(!JSON.stringify(body).includes('test-private-key'));
  assert.equal(response.headers.get('x-powered-by'), null);
});

test('health remains available without key and analysis returns 503', async t => {
  const base = await startApp(t, { config: readConfig({}) });
  const health = await (await fetch(base + '/api/health')).json();
  assert.equal(health.gemini.configured, false);
  assert.equal(health.analysisReady, false);
  const response = await fetch(base + '/api/analyze-flood', { method: 'POST', body: upload(await makeImage()) });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'GEMINI_NOT_CONFIGURED');
});

test('JPEG, PNG and WebP uploads return the full labeled mock contract', async t => {
  const base = await startApp(t);
  for (const format of ['jpeg', 'png', 'webp']) {
    const response = await fetch(base + '/api/analyze-flood', {
      method: 'POST', body: upload(await makeImage(format), { name: 'untrusted.txt', type: 'application/octet-stream' }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), [
      'isFlooded', 'status', 'severity', 'evidence', 'summary', 'needsVerification', 'analyzedAt', 'model', 'mode',
    ].sort());
    assert.equal(body.mode, 'mock');
    assert.equal(body.model, 'mock');
    assert.equal(body.status, 'uncertain');
    assert.equal(body.severity, 'unknown');
    assert.equal(body.isFlooded, null);
    assert.equal(body.needsVerification, true);
    assert.deepEqual(body.evidence, []);
    assert.equal(new Date(body.analyzedAt).toISOString(), body.analyzedAt);
  }
});

test('HTTP normalizes Gemini prediction and forwards decoded JPEG bytes', async t => {
  let received;
  const base = await startApp(t, {
    config: readConfig({ GEMINI_API_KEY: 'test-key-only', GEMINI_MODEL: 'custom-model' }),
    analyzer: async image => { received = image; return prediction(); },
  });
  const response = await fetch(base + '/api/analyze-flood', { method: 'POST', body: upload(await makeImage('webp')) });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.status, 'flooded');
  assert.equal(result.isFlooded, true);
  assert.equal(result.mode, 'gemini');
  assert.equal(result.model, 'custom-model');
  assert.equal(received.mimeType, 'image/jpeg');
  assert.equal(received.buffer[0], 0xff);
});

test('missing, empty, spoofed, unsupported and truncated files are rejected before AI', async t => {
  let calls = 0;
  const base = await startApp(t, { analyzer: async () => { calls++; return prediction(); } });
  const png = await makeImage();
  const cases = [
    [new FormData(), 400, 'IMAGE_REQUIRED'],
    [upload(Buffer.alloc(0)), 400, 'IMAGE_REQUIRED'],
    [upload(Buffer.from('not an image'), { name: 'fake.jpg', type: 'image/jpeg' }), 415, 'INVALID_IMAGE'],
    [upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>')), 415, 'UNSUPPORTED_IMAGE'],
    [upload(png.subarray(0, Math.floor(png.length / 2))), 415, 'INVALID_IMAGE'],
    [upload(png, { field: 'photo' }), 400, 'INVALID_UPLOAD'],
  ];
  for (const [body, status, code] of cases) {
    const response = await fetch(base + '/api/analyze-flood', { method: 'POST', body });
    assert.equal(response.status, status);
    assert.equal((await response.json()).error.code, code);
  }
  assert.equal(calls, 0);
});

test('exact 5 MB file is allowed; one byte above and much larger return 413', async t => {
  const base = await startApp(t);
  const jpeg = await makeImage('jpeg');
  for (const size of [MAX_IMAGE_BYTES, MAX_IMAGE_BYTES + 1, MAX_IMAGE_BYTES + 1024]) {
    const buffer = Buffer.concat([jpeg, Buffer.alloc(size - jpeg.length)]);
    const response = await fetch(base + '/api/analyze-flood', { method: 'POST', body: upload(buffer) });
    assert.equal(response.status, size === MAX_IMAGE_BYTES ? 200 : 413);
    if (size > MAX_IMAGE_BYTES) assert.equal((await response.json()).error.code, 'IMAGE_TOO_LARGE');
    else await response.json();
  }
});

test('bad content types, malformed multipart, extra fields and multiple files are rejected', async t => {
  const base = await startApp(t);
  const png = await makeImage();
  const extra = upload(png);
  extra.append('note', 'not supported');
  const multiple = upload(png);
  multiple.append('image', new Blob([png]), 'second.png');
  const cases = [
    [{ headers: { 'Content-Type': 'application/json' }, body: '{}' }, 415],
    [{ headers: { 'Content-Type': 'multipart/form-data' }, body: 'bad' }, 400],
    [{ headers: { 'Content-Type': 'multipart/form-data; boundary=test' }, body: '--test\r\nbroken' }, 400],
    [{ body: extra }, 400], [{ body: multiple }, 400],
  ];
  for (const [options, status] of cases) {
    const response = await fetch(base + '/api/analyze-flood', { method: 'POST', ...options });
    assert.equal(response.status, status);
    assert.ok((await response.json()).error.code);
  }
});

test('CORS accepts configured and own origin, supports preflight and rejects others', async t => {
  const base = await startApp(t);
  const preflight = await fetch(base + '/api/analyze-flood', {
    method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const own = await fetch(base + '/api/analyze-flood', { method: 'POST', headers: { Origin: base }, body: upload(await makeImage()) });
  assert.equal(own.status, 200);
  await own.json();
  const blocked = await fetch(base + '/api/health', { headers: { Origin: 'https://unlisted.example' } });
  assert.equal(blocked.status, 403);
  assert.equal((await blocked.json()).error.code, 'ORIGIN_NOT_ALLOWED');
});

test('provider errors and invalid JSON surface as sanitized HTTP responses', async t => {
  const config = readConfig({ GEMINI_API_KEY: 'test-key-only' });
  const cases = [
    [async () => { throw { status: 429, message: 'private provider details' }; }, 429, 'GEMINI_QUOTA_EXCEEDED'],
    [async () => { throw { status: 504 }; }, 504, 'GEMINI_TIMEOUT'],
    [async () => { throw { status: 500 }; }, 502, 'GEMINI_API_ERROR'],
    [async () => ({ text: '{bad' }), 502, 'GEMINI_INVALID_RESPONSE'],
    [async () => ({ text: '{"status":"flooded"}' }), 502, 'GEMINI_INVALID_RESPONSE'],
  ];
  for (const [generateContent, status, code] of cases) {
    const analyzer = createFloodAnalyzer(config, { client: { models: { generateContent } } });
    const base = await startApp(t, { config, analyzer });
    const response = await fetch(base + '/api/analyze-flood', { method: 'POST', body: upload(await makeImage()) });
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.error.code, code);
    assert.doesNotMatch(JSON.stringify(body), /private|test-key|stack/i);
  }
});

test('unexpected server error is hidden and test page is served', async t => {
  const logs = [];
  const base = await startApp(t, {
    analyzer: async () => { throw new Error('private-secret-stack'); },
    logger: { error: message => logs.push(message) },
  });
  const response = await fetch(base + '/api/analyze-flood', { method: 'POST', body: upload(await makeImage()) });
  assert.equal(response.status, 500);
  assert.equal((await response.json()).error.code, 'INTERNAL_ERROR');
  assert.doesNotMatch(logs.join(), /private-secret-stack/);
  const page = await fetch(base + '/test');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  const html = await page.text();
  assert.match(html, /new FormData/);
  assert.match(html, /URL.createObjectURL/);
  assert.match(html, /Đang phân tích/);
  const unknown = await fetch(base + '/api/unknown');
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).error.code, 'NOT_FOUND');
});
