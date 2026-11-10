'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const nv5 = require('../src');
const { createRoutes } = require('../api/routes');

const SAMPLE_NV4 = {
  ok: true,
  data: [
    {
      key: 'street:xa lo ha noi',
      street: 'Xa lộ Hà Nội',
      wardId: 'long-binh',
      centerLat: 10.9447,
      centerLng: 106.8243,
      eventCount: 6,
      avgSeverity: 'medium',
      lastFloodAt: '2026-11-08T05:30:00.000Z',
    },
    {
      key: 'street:quoc lo 1a',
      street: 'Quốc lộ 1A',
      wardId: 'an-binh',
      centerLat: 10.9525,
      centerLng: 106.8421,
      eventCount: 2,
      avgSeverity: 'high',
      lastFloodAt: '2026-11-08T05:40:00.000Z',
    },
    {
      key: 'street:nguyen ai quoc',
      street: 'Nguyễn Ái Quốc',
      wardId: 'tan-phong',
      centerLat: 10.9689,
      centerLng: 106.8155,
      eventCount: 1,
      avgSeverity: 'low',
      lastFloodAt: null,
    },
  ],
};

test('NV4 adapter: response hợp lệ, ánh xạ đúng trường và giữ null trường thiếu', async () => {
  let calledUrl = '';
  const src = nv5.createApiSource({
    apiUrl: 'http://localhost:3000/',
    fetchImpl: async (url) => {
      calledUrl = url;
      return { ok: true, status: 200, json: async () => SAMPLE_NV4 };
    },
  });
  const pts = await src.list();
  assert.equal(calledUrl, 'http://localhost:3000/api/flood-prone?minEvents=1');
  assert.equal(pts.length, 3);
  assert.deepEqual(pts[0], {
    id: 'street:xa lo ha noi',
    duong: 'Xa lộ Hà Nội',
    phuong: 'long-binh',
    lat: 10.9447,
    lng: 106.8243,
    muc_ngap: 'vua',
    nguyen_nhan: null,
    gio_bao: '2026-11-08T05:30:00.000Z',
    anh: null,
    so_lan_ngap: 6,
    trang_thai: null,
    source: 'nv4-api',
    verification_status: 'chua_ro',
  });
  assert.equal(pts[1].muc_ngap, 'nang');
  assert.equal(pts[2].muc_ngap, 'nhe');
  assert.equal(pts[2].gio_bao, null);
});

test('NV4 adapter: danh sách rỗng trả về mảng rỗng hợp lệ', async () => {
  const src = nv5.createApiSource({
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, data: [] }) }),
  });
  const pts = await src.list();
  assert.deepEqual(pts, []);
});

test('NV4 adapter: điểm thiếu tọa độ từ NV4 -> assessPoints báo không đủ dữ liệu', async () => {
  const src = nv5.createApiSource({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: [{ key: 'no-gps', street: 'Đường X', wardId: 'long-binh', centerLat: null, centerLng: undefined, eventCount: 4, avgSeverity: 'high' }],
      }),
    }),
  });
  const pts = await src.list();
  assert.equal(pts[0].lat, null);
  assert.equal(pts[0].lng, null);
  const res = await nv5.assessPoints(pts, { getHourly: async () => { throw new Error('không được gọi Open-Meteo'); } });
  assert.equal(res[0].status, 'khong_du_du_lieu');
  assert.equal(res[0].point.verified, false);
  assert.equal(res[0].point.source, 'nv4-api');
  assert.equal(res[0].point.verification_status, 'chua_ro');
});

test('NV4 adapter: HTTP lỗi, lỗi mạng, timeout và dữ liệu sai đều báo lỗi rõ, không âm thầm fallback', async () => {
  const httpErr = nv5.createApiSource({ fetchImpl: async () => ({ ok: false, status: 503 }) });
  await assert.rejects(httpErr.list(), { code: 'NV4_HTTP' });

  const netErr = nv5.createApiSource({ fetchImpl: async () => { throw new Error('ECONNREFUSED'); } });
  await assert.rejects(netErr.list(), { code: 'NV4_NETWORK' });

  const slow = (_url, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  const timeoutSrc = nv5.createApiSource({ fetchImpl: slow, timeoutMs: 20 });
  await assert.rejects(timeoutSrc.list(), { code: 'NV4_TIMEOUT' });

  const badJson = nv5.createApiSource({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: false }) }) });
  await assert.rejects(badJson.list(), { code: 'NV4_BAD_RESPONSE' });

  const nonJson = nv5.createApiSource({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new Error('syntax'); } }) });
  await assert.rejects(nonJson.list(), { code: 'NV4_BAD_RESPONSE' });
});

test('NV4 adapter: cache 10 phút hoạt động đúng', async () => {
  let calls = 0;
  let now = 1000;
  const src = nv5.createApiSource({
    now: () => now,
    fetchImpl: async () => {
      calls++;
      return { ok: true, status: 200, json: async () => SAMPLE_NV4 };
    },
  });
  await src.list();
  now += 5 * 60 * 1000; // 5 phút < 10 phút
  await src.list();
  assert.equal(calls, 1);

  now += 6 * 60 * 1000; // tổng 11 phút > 10 phút
  await src.list();
  assert.equal(calls, 2);
});

test('createConfiguredSource & routes: chọn NV4 theo biến môi trường, kết hợp Open-Meteo và trả lỗi 502 khi NV4 sập', async () => {
  const sJson = nv5.createConfiguredSource({ env: {} });
  assert.equal(sJson.kind, 'json-sample');

  const sNv4 = nv5.createConfiguredSource({
    env: { NV5_POINTS_SOURCE: 'nv4', NV4_API_URL: 'http://localhost:3000' },
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => SAMPLE_NV4 }),
  });
  assert.equal(sNv4.kind, 'nv4-api');

  const meteoClient = {
    getHourly: async () => ({
      source: 'open-meteo',
      fetchedAt: '2026-11-10T10:00:00Z',
      cached: false,
      hours: Array.from({ length: 6 }, (_, i) => ({ time: nv5.addHoursLocal('2026-11-11T12:00', i), precipitation: 18, probability: 85 })),
    }),
  };
  const hOk = createRoutes({ source: sNv4, client: meteoClient });
  const rOk = await new Promise((resolve) => {
    let status;
    hOk({ method: 'GET', url: '/forecast' }, { writeHead: (s) => { status = s; }, end: (b) => resolve({ status, body: JSON.parse(b) }) });
  });
  assert.equal(rOk.status, 200);
  assert.equal(rOk.body.data_source, 'nv4-api');
  assert.equal(rOk.body.results[0].maxLevel, 'rat_cao'); // 54mm/3h và eventCount=6 >= 3
  assert.equal(rOk.body.results[0].point.verified, false);
  assert.equal(rOk.body.results[0].point.verification_status, 'chua_ro');

  // Khi NV4 mất kết nối và không bật fallback -> trả HTTP 502 với mã NV4_NETWORK
  const sDown = nv5.createConfiguredSource({
    env: { NV5_POINTS_SOURCE: 'nv4' },
    fetchImpl: async () => { throw new Error('ECONNREFUSED'); },
  });
  const hDown = createRoutes({ source: sDown, client: meteoClient });
  const rDown = await new Promise((resolve) => {
    let status;
    hDown({ method: 'GET', url: '/forecast' }, { writeHead: (s) => { status = s; }, end: (b) => resolve({ status, body: JSON.parse(b) }) });
  });
  assert.equal(rDown.status, 502);
  assert.equal(rDown.body.code, 'NV4_NETWORK');
});
