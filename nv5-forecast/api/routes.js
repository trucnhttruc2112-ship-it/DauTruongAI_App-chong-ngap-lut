'use strict';
// Router độc lập (node:http). Có thể mount vào app nhóm sau: if (handler(req,res)) return;
const nv5 = require('../src');
const demo = require('../src/demoScenarios');

function createRoutes({ source = nv5.createConfiguredSource(), client = nv5.createOpenMeteoClient(), alertService = nv5.createAlertService(), nowFn = () => new Date(), demoAllowed } = {}) {
  async function loadPoints(q) {
    const points = await source.list();
    const lat = parseFloat(q.get('lat'));
    const lng = parseFloat(q.get('lng'));
    if (q.has('lat') || q.has('lng')) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        const e = new Error('Tọa độ demo không hợp lệ'); e.status = 400; throw e;
      }
      points.push(nv5.makeDemoPoint({ lat, lng, so_lan_ngap: q.get('so_lan') || 1 }));
    }
    return points;
  }

  const meta = (kind) => ({
    data_source: kind,
    disclaimer: kind === 'nv4-api'
      ? 'Mô hình demo, không phải dự báo thủy văn chính thức. Điểm ngập lấy từ API NV4 (trạng thái xác minh chưa rõ, không coi là dữ liệu chính thức).'
      : 'Mô hình demo, không phải dự báo thủy văn chính thức. Điểm DEMO dùng tọa độ thử nghiệm chưa xác minh.',
    thresholds: nv5.config.thresholds,
  });

  async function forecast(q) {
    const points = await loadPoints(q);
    const results = await nv5.assessPoints(points, client);
    return { ...meta(source.kind), generatedAt: new Date().toISOString(), results };
  }

  async function alerts(q) {
    const points = await loadPoints(q);
    const results = await nv5.assessPoints(points, client);
    const simulate = q.get('simulate') === '19';
    const now = simulate ? nv5.simulate19() : nowFn();
    const out = alertService.check(results, now);
    return { ...meta(source.kind), simulated: simulate, now: nv5.vnParts(now).iso, ...out };
  }

  // ---- DEMO mô phỏng mưa lớn: tách riêng nguồn, client và bộ chống trùng, không trộn Open-Meteo ----
  const demoAlertService = nv5.createAlertService();
  // demoAllowed: true/false cố định; undefined = tự động (bật khi truy cập localhost và không phải production)
  const allowed = (req) => (demoAllowed !== undefined ? demoAllowed : demo.isDemoAllowedForRequest(req));
  function demoContext(q, req) {
    if (!allowed(req)) { const e = new Error('Chế độ mô phỏng chỉ bật trong development/demo'); e.status = 403; e.code = 'DEMO_DISABLED'; throw e; }
    const name = q.get('scenario');
    const sc = demo.SCENARIOS[name];
    if (!sc) { const e = new Error(`Kịch bản không hợp lệ: ${name}`); e.status = 400; throw e; }
    const lat = parseFloat(q.get('lat')); const lng = parseFloat(q.get('lng'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { const e = new Error('Cần lat/lng thử nghiệm cho mô phỏng'); e.status = 400; throw e; }
    const p = nv5.makeDemoPoint({ lat, lng, so_lan_ngap: sc.so_lan_ngap, ten: `${demo.DEMO_LABEL} – kịch bản ${name}` });
    return { name, points: [p], client: demo.createScenarioClient(name, nowFn) };
  }
  const demoMeta = (name) => ({ data_source: demo.DEMO_LABEL, scenario: name, disclaimer: `${demo.DEMO_LABEL}: lượng mưa giả định, KHÔNG phải Open-Meteo. Mô hình demo.`, thresholds: nv5.config.thresholds });

  async function demoForecast(q, req) {
    const c = demoContext(q, req);
    return { ...demoMeta(c.name), generatedAt: new Date().toISOString(), results: await nv5.assessPoints(c.points, c.client) };
  }
  async function demoAlerts(q, req) {
    const c = demoContext(q, req);
    const results = await nv5.assessPoints(c.points, c.client);
    const now = q.get('simulate') === '19' ? nv5.simulate19(nv5.vnParts(nowFn()).date) : nowFn();
    const out = demoAlertService.check(results, now);
    out.alerts.forEach((a) => { a.message = `[${demo.DEMO_LABEL}] ${a.message}`; });
    return { ...demoMeta(c.name), simulated: q.get('simulate') === '19', now: nv5.vnParts(now).iso, ...out };
  }
  const demoInfo = async (q, req) => ({ demoAllowed: allowed(req), scenarios: Object.keys(demo.SCENARIOS), so_lan_ngap: Object.fromEntries(Object.entries(demo.SCENARIOS).map(([k, v]) => [k, v.so_lan_ngap])) });

  return async function handler(req, res) {
    const u = new URL(req.url, 'http://localhost');
    const route = { '/forecast': forecast, '/alerts': alerts, '/demo/forecast': demoForecast, '/demo/alerts': demoAlerts, '/demo/info': demoInfo }[u.pathname];
    if (req.method !== 'GET' || !route) return false;
    try {
      send(res, 200, await route(u.searchParams, req));
    } catch (e) {
      send(res, e.status || 502, { error: e.message, code: e.code || 'ERROR' });
    }
    return true;
  };
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}

module.exports = { createRoutes };
