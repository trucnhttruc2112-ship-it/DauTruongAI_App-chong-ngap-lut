'use strict';
const config = require('./config');

class ForecastError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

/**
 * Client Open-Meteo có cache + timeout. Giá trị null được GIỮ NGUYÊN (không đổi thành 0).
 */
function createOpenMeteoClient(opts = {}) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const cacheMs = opts.cacheMs ?? config.openMeteo.cacheMs;
  const timeoutMs = opts.timeoutMs ?? config.openMeteo.timeoutMs;
  const now = opts.now || (() => Date.now());
  const cache = new Map();

  async function getHourly(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new ForecastError('Thiếu hoặc sai tọa độ', 'INVALID_COORDS');
    }
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const hit = cache.get(key);
    if (hit && now() - hit.at < cacheMs) return { ...hit.data, cached: true };

    const u = new URL(config.openMeteo.url);
    u.searchParams.set('latitude', lat);
    u.searchParams.set('longitude', lng);
    u.searchParams.set('hourly', 'precipitation,precipitation_probability');
    u.searchParams.set('timezone', config.timezone);
    u.searchParams.set('forecast_days', config.openMeteo.forecastDays);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(u.toString(), { signal: ctrl.signal });
    } catch (e) {
      const code = e && e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK';
      throw new ForecastError(code === 'TIMEOUT' ? 'Open-Meteo quá thời gian chờ' : `Lỗi mạng: ${e.message}`, code);
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new ForecastError(`Open-Meteo trả về HTTP ${res.status}`, 'HTTP');
    let body;
    try { body = await res.json(); } catch { throw new ForecastError('Phản hồi không phải JSON', 'BAD_RESPONSE'); }
    const h = body && body.hourly;
    if (!h || !Array.isArray(h.time) || !Array.isArray(h.precipitation)) {
      throw new ForecastError('Thiếu dữ liệu hourly', 'BAD_RESPONSE');
    }
    const norm = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const data = {
      source: 'open-meteo',
      lat, lng,
      fetchedAt: new Date(now()).toISOString(),
      hours: h.time.map((t, i) => ({
        time: t,
        precipitation: norm(h.precipitation[i]),
        probability: norm(h.precipitation_probability ? h.precipitation_probability[i] : null),
      })),
    };
    cache.set(key, { at: now(), data });
    return { ...data, cached: false };
  }

  return { getHourly, clearCache: () => cache.clear() };
}

module.exports = { createOpenMeteoClient, ForecastError };
