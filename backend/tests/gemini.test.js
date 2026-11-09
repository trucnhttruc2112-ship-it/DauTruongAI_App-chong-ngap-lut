import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { GoogleGenAI } from '@google/genai';
import { readConfig } from '../src/config.js';
import { createFloodAnalyzer } from '../src/gemini.js';
import { prediction } from './helpers.js';

const config = () => readConfig({ GEMINI_API_KEY: 'test-key-only', GEMINI_MODEL: 'test-model', GEMINI_TIMEOUT_MS: '1000' });
const image = { buffer: Buffer.from('test-image-bytes'), mimeType: 'image/jpeg' };
const stub = generateContent => ({ models: { generateContent } });

test('mock never calls the provider and missing key does not silently fall back', async () => {
  let calls = 0;
  const client = stub(async () => { calls++; });
  const mock = await createFloodAnalyzer(readConfig({ MOCK_GEMINI: 'true' }), { client })(image);
  assert.equal(mock.status, 'uncertain');
  assert.match(mock.summary, /mock/);
  await assert.rejects(createFloodAnalyzer(readConfig({}), { client })(image), { status: 503, code: 'GEMINI_NOT_CONFIGURED' });
  assert.equal(calls, 0);
});

test('SDK request contains image, configured model and structured JSON schema', async () => {
  let request;
  const analyzer = createFloodAnalyzer(config(), { client: stub(async args => {
    request = args;
    return { text: JSON.stringify(prediction()), candidates: [{ finishReason: 'STOP' }] };
  }) });
  assert.deepEqual(await analyzer(image), prediction());
  assert.equal(request.model, 'test-model');
  assert.deepEqual(request.contents[0].parts[1].inlineData, { mimeType: image.mimeType, data: image.buffer.toString('base64') });
  assert.equal(request.config.responseMimeType, 'application/json');
  assert.equal(request.config.responseJsonSchema.additionalProperties, false);
  assert.match(request.config.systemInstruction, /Không tự đoán độ sâu/);
  assert.ok(request.config.abortSignal instanceof AbortSignal);
});

test('SDK provider errors map to sanitized HTTP errors', async () => {
  for (const [error, status, code] of [
    [{ status: 429, message: 'secret provider details' }, 429, 'GEMINI_QUOTA_EXCEEDED'],
    [{ status: 401 }, 502, 'GEMINI_AUTH_ERROR'],
    [{ status: 403 }, 502, 'GEMINI_AUTH_ERROR'],
    [{ status: 408 }, 504, 'GEMINI_TIMEOUT'],
    [{ status: 504 }, 504, 'GEMINI_TIMEOUT'],
    [{ name: 'AbortError' }, 504, 'GEMINI_TIMEOUT'],
    [{ name: 'TimeoutError' }, 504, 'GEMINI_TIMEOUT'],
    [{ status: 500 }, 502, 'GEMINI_API_ERROR'],
    [new Error('secret network details'), 502, 'GEMINI_API_ERROR'],
  ]) {
    const analyzer = createFloodAnalyzer(config(), { client: stub(async () => { throw error; }) });
    await assert.rejects(analyzer(image), actual => {
      assert.equal(actual.status, status);
      assert.equal(actual.code, code);
      assert.doesNotMatch(actual.message, /secret/);
      return true;
    });
  }
});

test('deadline returns 504 and aborts a hanging SDK request', async () => {
  let signal;
  const analyzer = createFloodAnalyzer({ ...config(), timeoutMs: 20 }, {
    client: stub(args => { signal = args.config.abortSignal; return new Promise(() => {}); }),
  });
  await assert.rejects(analyzer(image), { status: 504, code: 'GEMINI_TIMEOUT' });
  assert.equal(signal.aborted, true);
});

test('invalid JSON, empty, blocked and truncated responses are rejected', async () => {
  for (const response of [
    { text: 'not JSON' }, { text: '```json\n{}\n```' }, { text: '' }, {},
    { text: 'x'.repeat(16_001) },
    { text: '{}', promptFeedback: { blockReason: 'SAFETY' } },
    { text: '{}', candidates: [{ finishReason: 'MAX_TOKENS' }] },
  ]) {
    const analyzer = createFloodAnalyzer(config(), { client: stub(async () => response) });
    await assert.rejects(analyzer(image), { status: 502, code: 'GEMINI_INVALID_RESPONSE' });
  }
});

test('real @google/genai SDK serializes to local HTTP upstream and parses errors', async t => {
  let captured;
  let calls = 0;
  let quota = false;
  const server = createServer(async (req, res) => {
    calls++;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    captured = { url: req.url, body: JSON.parse(Buffer.concat(chunks).toString()) };
    res.setHeader('Content-Type', 'application/json');
    if (quota) {
      res.writeHead(429);
      res.end(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'private quota detail' } }));
    } else {
      res.end(JSON.stringify({ candidates: [{
        content: { role: 'model', parts: [{ text: JSON.stringify(prediction()) }] }, finishReason: 'STOP',
      }] }));
    }
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const client = new GoogleGenAI({
    apiKey: 'test-key-only',
    httpOptions: { baseUrl: `http://127.0.0.1:${server.address().port}`, timeout: 1000, retryOptions: { attempts: 1 } },
  });
  const analyzer = createFloodAnalyzer(config(), { client });
  assert.deepEqual(await analyzer(image), prediction());
  assert.match(captured.url, /models\/test-model:generateContent/);
  assert.equal(captured.body.contents[0].parts[1].inlineData.data, image.buffer.toString('base64'));
  assert.equal(captured.body.generationConfig.responseMimeType, 'application/json');
  assert.equal(captured.body.generationConfig.responseJsonSchema.type, 'object');
  quota = true;
  await assert.rejects(analyzer(image), { status: 429, code: 'GEMINI_QUOTA_EXCEEDED' });
  assert.equal(calls, 2);
});
