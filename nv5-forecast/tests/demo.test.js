'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const nv5 = require('../src');
const demo = require('../src/demoScenarios');
const { createRoutes } = require('../api/routes');

const NOW = () => nv5.vnTime(15, '2026-11-10');
const call = (h, url) => new Promise((resolve) => {
  let status;
  h({ method: 'GET', url }, { writeHead: (s) => { status = s; }, end: (b) => resolve({ status, body: JSON.parse(b) }) });
});
const routes = (demoAllowed) => createRoutes({ demoAllowed, nowFn: NOW, client: { getHourly: async () => { throw new Error('không được gọi Open-Meteo'); } } });

test('chỉ bật mô phỏng trong development/demo', () => {
  assert.equal(demo.isDemoAllowed({ NODE_ENV: 'production', NV5_DEMO: '1' }, ['--demo']), false);
  assert.equal(demo.isDemoAllowed({}, []), false);
  assert.equal(demo.isDemoAllowed({ NV5_DEMO: '1' }, []), true);
  assert.equal(demo.isDemoAllowed({}, ['--demo']), true);
});

test('dữ liệu mô phỏng gắn nhãn DEMO và vượt ngưỡng đúng mức', async () => {
  const expect = { trung_binh: 20, cao: 36, rat_cao: 60 };
  for (const [name, mm] of Object.entries(expect)) {
    const fc = demo.buildScenarioForecast(name, NOW());
    assert.equal(fc.source, 'demo-simulated');
    assert.equal(fc.label, 'DEMO - dữ liệu mô phỏng');
    const p = nv5.makeDemoPoint({ lat: 10.9, lng: 106.8, so_lan_ngap: demo.SCENARIOS[name].so_lan_ngap });
    const [r] = await nv5.assessPoints([p], demo.createScenarioClient(name, NOW));
    assert.equal(r.maxLevel, name);
    assert.equal(r.intervals[0].maxRain3h, mm);
  }
});

test('route demo bị chặn khi không ở development/demo', async () => {
  const r = await call(routes(false), '/demo/alerts?scenario=cao&lat=10.9&lng=106.8&simulate=19');
  assert.equal(r.status, 403);
});

test('mưa lớn tạo cảnh báo ngày mai lúc 19:00 và không trùng lặp', async () => {
  const h = routes(true);
  for (const name of ['trung_binh', 'cao', 'rat_cao']) {
    const url = `/demo/alerts?scenario=${name}&lat=10.9&lng=106.8&simulate=19`;
    const r1 = await call(h, url);
    assert.equal(r1.status, 200);
    assert.equal(r1.body.data_source, 'DEMO - dữ liệu mô phỏng');
    assert.equal(r1.body.tomorrow, '2026-11-11');
    assert.equal(r1.body.alerts.length, 1);
    assert.equal(r1.body.newAlerts.length, 1);
    const a = r1.body.alerts[0];
    assert.equal(a.level, name);
    // Khoảng do thuật toán gộp tính ra; phải nằm trong ngày mai quanh đỉnh mưa 14:00–17:00
    assert.ok(a.start >= '2026-11-11T12:00' && a.start <= '2026-11-11T14:00', a.start);
    assert.ok(a.end >= '2026-11-11T17:00' && a.end <= '2026-11-11T20:00', a.end);
    assert.ok(a.reason);
    assert.match(a.message, /^\[DEMO - dữ liệu mô phỏng\]/);
    assert.match(a.message, /11\/11/);
    assert.match(a.message, /mm\/3h/);
    const r2 = await call(h, url);
    assert.equal(r2.body.alerts.length, 1);
    assert.equal(r2.body.newAlerts.length, 0, 'không thông báo trùng');
  }
});

const req = (host, ip) => ({ headers: { host }, socket: { remoteAddress: ip } });

test('localhost tự bật DEMO, production/host ngoài thì không', () => {
  assert.equal(demo.isDemoAllowedForRequest(req('localhost:3005', '::1'), {}, []), true);
  assert.equal(demo.isDemoAllowedForRequest(req('127.0.0.1:3005', '127.0.0.1'), {}, []), true);
  assert.equal(demo.isDemoAllowedForRequest(req('localhost:3005', '::1'), { NODE_ENV: 'production' }, []), false);
  assert.equal(demo.isDemoAllowedForRequest(req('example.com', '10.0.0.5'), {}, []), false);
  assert.equal(demo.isDemoAllowedForRequest(req('localhost', '10.0.0.5'), {}, []), false);
});

test('chuyển qua lại Open-Meteo ↔ 3 kịch bản DEMO, không lẫn dữ liệu', async () => {
  let real = 0;
  const realClient = { getHourly: async () => { real++; return { source: 'open-meteo', fetchedAt: 'x', hours: Array.from({ length: 6 }, (_, i) => ({ time: nv5.addHoursLocal('2026-11-11T00:00', i), precipitation: 1, probability: 10 })) }; } };
  const h = createRoutes({ client: realClient, nowFn: NOW });
  const get = (url) => new Promise((resolve) => {
    let status;
    h({ method: 'GET', url, headers: { host: 'localhost:3005' }, socket: { remoteAddress: '::1' } }, { writeHead: (s) => { status = s; }, end: (b) => resolve({ status, body: JSON.parse(b) }) });
  });
  const info = await get('/demo/info');
  assert.equal(info.body.demoAllowed, true);
  assert.deepEqual(info.body.so_lan_ngap, { trung_binh: 1, cao: 1, rat_cao: 3 });
  for (const name of ['', 'trung_binh', '', 'cao', '', 'rat_cao', '']) {
    const r = await get(name ? `/demo/forecast?scenario=${name}&lat=10.9&lng=106.8` : '/forecast?lat=10.9&lng=106.8');
    assert.equal(r.status, 200);
    const demoPoint = r.body.results.find((x) => x.point.is_demo);
    if (name) {
      assert.equal(r.body.data_source, 'DEMO - dữ liệu mô phỏng');
      assert.equal(r.body.results.length, 1);
      assert.equal(demoPoint.maxLevel, name);
      assert.match(demoPoint.point.duong, /DEMO - dữ liệu mô phỏng/);
    } else {
      assert.equal(r.body.data_source, 'json-sample');
      assert.equal(demoPoint.maxLevel, 'thap'); // dữ liệu thật (giả lập 1mm/h) không bị ghi đè
    }
  }
  assert.equal(real, 4);
});
