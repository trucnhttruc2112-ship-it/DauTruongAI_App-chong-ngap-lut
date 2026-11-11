'use strict';
// DEMO - dữ liệu mô phỏng mưa lớn. KHÔNG phải dữ liệu Open-Meteo, chỉ dùng trong development/demo.
const { vnParts, addDays, addHoursLocal } = require('./time');

const DEMO_LABEL = 'DEMO - dữ liệu mô phỏng';

// Mưa (mm/giờ) ngày mai 14:00–16:00; tổng 3h tương ứng. so_lan_ngap giả định cho điểm demo.
const SCENARIOS = {
  trung_binh: { rain: [7, 7, 6], so_lan_ngap: 1, moTa: '20mm/3h' },
  cao: { rain: [12, 12, 12], so_lan_ngap: 1, moTa: '36mm/3h' },
  rat_cao: { rain: [20, 20, 20], so_lan_ngap: 3, moTa: '60mm/3h, điểm đã ngập 3 lần' },
};
const PEAK_START_HOUR = 14;

function isDemoAllowed(env = process.env, argv = process.argv) {
  if (env.NODE_ENV === 'production') return false;
  return env.NV5_DEMO === '1' || env.NODE_ENV === 'development' || argv.includes('--demo');
}

/** Bật khi được cấu hình rõ, hoặc khi request đến từ localhost (không bao giờ trong production). */
function isDemoAllowedForRequest(req, env = process.env, argv = process.argv) {
  if (env.NODE_ENV === 'production') return false;
  if (isDemoAllowed(env, argv)) return true;
  const host = String((req && req.headers && req.headers.host) || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  const ip = String((req && req.socket && req.socket.remoteAddress) || '');
  const localHost = ['localhost', '127.0.0.1', '::1'].includes(host);
  const localIp = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
  return localHost && localIp;
}

/** Dữ liệu theo giờ 3 ngày (từ 00:00 hôm nay, giờ VN), cùng định dạng openMeteoClient. */
function buildScenarioForecast(name, now = new Date()) {
  const sc = SCENARIOS[name];
  if (!sc) throw Object.assign(new Error(`Kịch bản không hợp lệ: ${name}`), { status: 400, code: 'BAD_SCENARIO' });
  const start = `${vnParts(now).date}T00:00`;
  const peak = `${addDays(vnParts(now).date, 1)}T${String(PEAK_START_HOUR).padStart(2, '0')}:00`;
  const hours = Array.from({ length: 72 }, (_, i) => {
    const time = addHoursLocal(start, i);
    const k = sc.rain.findIndex((_, j) => addHoursLocal(peak, j) === time);
    return { time, precipitation: k >= 0 ? sc.rain[k] : 0, probability: k >= 0 ? 90 : 10 };
  });
  return { source: 'demo-simulated', label: DEMO_LABEL, scenario: name, fetchedAt: new Date(now).toISOString(), hours, cached: false };
}

/** Client giả có cùng giao diện getHourly() để tái sử dụng assessPoints(). */
function createScenarioClient(name, nowFn = () => new Date()) {
  return { getHourly: async () => buildScenarioForecast(name, nowFn()) };
}

module.exports = { DEMO_LABEL, SCENARIOS, isDemoAllowed, isDemoAllowedForRequest, buildScenarioForecast, createScenarioClient };
