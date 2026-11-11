'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const nv5 = require('../src');

const T = nv5.config.thresholds;
const point = (o = {}) => ({ id: 'p1', duong: 'Đường A', phuong: 'P. B', lat: 10.9, lng: 106.8, so_lan_ngap: 3, trang_thai: 'da_xac_minh', ...o });
// Tạo dự báo bắt đầu từ startLocal, mỗi giờ 1 giá trị
const fc = (startLocal, values) => ({ hours: values.map((p, i) => ({ time: nv5.addHoursLocal(startLocal, i), precipitation: p, probability: p === null ? null : 80 })) });

test('rollingSum: null không bị coi là 0', () => {
  assert.deepEqual(nv5.rollingSum([1, 2, 3, 4], 3), [null, null, 6, 9]);
  assert.deepEqual(nv5.rollingSum([1, null, 3, 4], 2), [null, null, null, 7]);
});

test('classify: ngưỡng biên', () => {
  assert.equal(nv5.classify(14.9, 5), 'thap');
  assert.equal(nv5.classify(15, 5), 'trung_binh');
  assert.equal(nv5.classify(30, 5), 'cao');
  assert.equal(nv5.classify(50, 3), 'rat_cao');
  assert.equal(nv5.classify(50, 2), 'cao');
  assert.equal(nv5.classify(null, 5), 'khong_du_du_lieu');
  assert.equal(nv5.classify(20, 1, { ...T, trung_binh: 25 }), 'thap'); // cấu hình được
});

test('thiếu GPS -> không đủ dữ liệu, không kết luận an toàn', () => {
  const r = nv5.assessPoint(point({ lat: null }), fc('2026-11-11T00:00', [0, 0, 0]));
  assert.equal(r.status, 'khong_du_du_lieu');
  assert.notEqual(r.maxLevel, 'thap');
});

test('dữ liệu mưa toàn null -> không đủ dữ liệu', () => {
  const r = nv5.assessPoint(point(), fc('2026-11-11T00:00', [null, null, null, null]));
  assert.equal(r.status, 'khong_du_du_lieu');
});

test('gộp khoảng chồng nhau và báo lý do', () => {
  const r = nv5.assessPoint(point(), fc('2026-11-11T10:00', [0, 10, 10, 10, 20, 25, 0, 0, 0, 0]));
  assert.equal(r.intervals.length, 1);
  const iv = r.intervals[0];
  assert.equal(iv.level, 'rat_cao');
  assert.equal(iv.maxRain3h, 55);
  assert.ok(iv.reason.includes('55'));
});

test('khoảng qua nửa đêm', () => {
  const r = nv5.assessPoint(point(), fc('2026-11-11T21:00', [0, 10, 10, 10, 10, 0, 0, 0]));
  assert.equal(r.intervals.length, 1);
  assert.ok(r.intervals[0].start.startsWith('2026-11-11'));
  assert.ok(r.intervals[0].end.startsWith('2026-11-12'));
  assert.ok(require('../src/alertScheduler').overlapsDate(r.intervals[0], '2026-11-12'));
  assert.equal(nv5.addHoursLocal('2026-12-31T23:00', 2), '2027-01-01T01:00');
});

test('cảnh báo tối hôm trước + chống trùng', () => {
  const svc = nv5.createAlertService();
  const now = nv5.simulate19('2026-11-10');
  assert.equal(nv5.vnParts(now).hour, 19);
  const a = [nv5.assessPoint(point(), fc('2026-11-11T00:00', Array(24).fill(0).map((_, i) => (i >= 14 && i <= 16 ? 12 : 0))))];
  const r1 = svc.check(a, now);
  assert.equal(r1.inWindow, true);
  assert.equal(r1.tomorrow, '2026-11-11');
  assert.equal(r1.newAlerts.length, 1);
  assert.match(r1.alerts[0].message, /Cảnh báo ngập ngày mai/);
  const r2 = svc.check(a, nv5.vnTime(20, '2026-11-10'));
  assert.equal(r2.alerts.length, 1);
  assert.equal(r2.newAlerts.length, 0);
  assert.equal(svc.check(a, nv5.vnTime(15, '2026-11-10')).inWindow, false);
  assert.equal(svc.check(a, nv5.vnTime(23, '2026-11-10')).inWindow, false);
});

test('Open-Meteo: lỗi mạng, HTTP, timeout, cache, giữ null', async () => {
  await assert.rejects(nv5.createOpenMeteoClient({ fetchImpl: async () => { throw new Error('ENOTFOUND'); } }).getHourly(1, 1), { code: 'NETWORK' });
  await assert.rejects(nv5.createOpenMeteoClient({ fetchImpl: async () => ({ ok: false, status: 500 }) }).getHourly(1, 1), { code: 'HTTP' });
  const slow = (url, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' }))));
  await assert.rejects(nv5.createOpenMeteoClient({ fetchImpl: slow, timeoutMs: 20 }).getHourly(1, 1), { code: 'TIMEOUT' });
  await assert.rejects(nv5.createOpenMeteoClient({ fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }).getHourly(1, 1), { code: 'BAD_RESPONSE' });
  await assert.rejects(nv5.createOpenMeteoClient().getHourly(NaN, 1), { code: 'INVALID_COORDS' });

  let calls = 0; let t = 0;
  const ok = async (url) => { calls++; assert.match(url, /timezone=Asia%2FHo_Chi_Minh/); return { ok: true, json: async () => ({ hourly: { time: ['2026-11-11T00:00', '2026-11-11T01:00'], precipitation: [null, 2], precipitation_probability: [10, null] } }) }; };
  const c = nv5.createOpenMeteoClient({ fetchImpl: ok, now: () => t });
  const d = await c.getHourly(10, 106);
  assert.equal(d.hours[0].precipitation, null);
  assert.equal(d.hours[1].probability, null);
  await c.getHourly(10, 106); assert.equal(calls, 1);
  t = 21 * 60 * 1000; await c.getHourly(10, 106); assert.equal(calls, 2);
});

test('assessPoints: lỗi API -> không đủ dữ liệu; adapter JSON thiếu tọa độ', async () => {
  const pts = await nv5.createJsonSource().list();
  assert.ok(pts.length > 0 && pts.every((p) => p.lat === null));
  const client = { getHourly: async () => { throw Object.assign(new Error('down'), { code: 'NETWORK' }); } };
  const res = await nv5.assessPoints([...pts, nv5.makeDemoPoint({ lat: 10.9, lng: 106.8 })], client);
  assert.ok(res.every((r) => r.status === 'khong_du_du_lieu'));
  assert.equal(res.at(-1).point.is_demo, true);
});
