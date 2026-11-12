import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';
import { createFloodChat, readChatBody, ruleReply } from '../src/chat.js';

const post = (base, body) => fetch(`${base}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const context = {
  points: [{ place: 'Cổng 11', area: 'Biên Hòa', severity: 'severe', simulated: true }],
  forecasts: [],
};

test('hỏi chỗ nào đang ngập thì nhắc điểm có trong dữ liệu và ghi mô phỏng', async (t) => {
  const base = await startApp(t);
  const res = await post(base, { message: 'Chỗ nào đang ngập?', context });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.mode, 'mock');
  assert.match(data.reply, /Cổng 11/);
  assert.match(data.reply, /mô phỏng/);
});

test('câu hỏi khẩn cấp có số điện thoại cứu hộ', async (t) => {
  const base = await startApp(t);
  const data = await (await post(base, { message: 'Tôi bị mắc kẹt trong nước, nguy hiểm' })).json();
  assert.match(data.reply, /112/);
});

test('câu hỏi ngoài chủ đề bị từ chối lịch sự', async (t) => {
  const base = await startApp(t);
  const data = await (await post(base, { message: 'Giá vàng hôm nay?' })).json();
  assert.match(data.reply, /chỉ hỗ trợ về ngập/);
});

test('thiếu message, quá dài, JSON hỏng đều trả 400', async (t) => {
  const base = await startApp(t);
  assert.equal((await post(base, { message: '  ' })).status, 400);
  assert.equal((await post(base, { message: 'a'.repeat(501) })).status, 400);
  assert.equal((await post(base, '{hong')).status, 400);
});

test('readChatBody giới hạn lịch sử và số điểm', () => {
  const history = Array.from({ length: 20 }, (_, i) => ({ role: 'user', text: `c${i}` }));
  const points = Array.from({ length: 50 }, (_, i) => ({ place: `p${i}` }));
  const out = readChatBody({ message: 'hi', history, context: { points } });
  assert.equal(out.history.length, 8);
  assert.equal(out.context.points.length, 30);
});

test('Gemini lỗi thì vẫn trả lời tự động', async () => {
  const client = { models: { generateContent: async () => { throw new Error('quota'); } } };
  const chat = createFloodChat({ mock: false, apiKey: 'x', model: 'm', timeoutMs: 1000 }, { client });
  const out = await chat({ message: 'Tối nay có mưa không?', history: [], context: { points: [], forecasts: [] } });
  assert.equal(out.fallback, true);
  assert.ok(out.reply.length > 0);
});

test('Gemini trả lời thì bỏ ký hiệu Markdown', async () => {
  const client = { models: { generateContent: async () => ({ text: '**Cẩn thận** nhé' }) } };
  const chat = createFloodChat({ mock: false, apiKey: 'x', model: 'm', timeoutMs: 1000 }, { client });
  const out = await chat({ message: 'hi', history: [], context: { points: [], forecasts: [] } });
  assert.equal(out.mode, 'gemini');
  assert.equal(out.reply, 'Cẩn thận nhé');
});

test('ruleReply hướng dẫn báo ngập', () => {
  assert.match(ruleReply('Cách báo ngập?', { points: [], forecasts: [] }), /Báo ngập/);
});
