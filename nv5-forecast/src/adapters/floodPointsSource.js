'use strict';
// Nguồn điểm ngập: JSON mẫu hoặc API NV4 (GET /api/flood-prone?minEvents=1).
const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../config');

const FIELDS = ['id', 'duong', 'phuong', 'lat', 'lng', 'muc_ngap', 'nguyen_nhan', 'gio_bao', 'anh', 'so_lan_ngap', 'trang_thai'];
const SEVERITY_MAP = { low: 'nhe', medium: 'vua', high: 'nang' };

class PointsSourceError extends Error {
  constructor(message, code, status = 502) { super(message); this.code = code; this.status = status; }
}

function normalize(p) {
  const out = {};
  for (const f of FIELDS) out[f] = p[f] === undefined ? null : p[f];
  out.lat = typeof out.lat === 'number' && Number.isFinite(out.lat) ? out.lat : null;
  out.lng = typeof out.lng === 'number' && Number.isFinite(out.lng) ? out.lng : null;
  if (p.is_demo) out.is_demo = true;
  if (p.source) out.source = p.source;
  if (p.verification_status !== undefined) out.verification_status = p.verification_status;
  return out;
}

/** Ánh xạ 1 bản ghi từ GET /api/flood-prone của NV4 sang schema NV5. Không tự bịa các trường thiếu. */
function mapNv4ProneItem(item) {
  if (!item || typeof item !== 'object') {
    throw new PointsSourceError('Bản ghi từ NV4 không hợp lệ', 'NV4_BAD_RESPONSE');
  }
  const sev = typeof item.avgSeverity === 'string' ? SEVERITY_MAP[item.avgSeverity.toLowerCase()] || null : null;
  const evCount = typeof item.eventCount === 'number' && Number.isFinite(item.eventCount) ? item.eventCount : null;
  return normalize({
    id: item.key ?? null,
    duong: item.street ?? null,
    phuong: item.wardId ?? null,
    lat: item.centerLat,
    lng: item.centerLng,
    muc_ngap: sev,
    nguyen_nhan: null,
    gio_bao: item.lastFloodAt ?? null,
    anh: null,
    so_lan_ngap: evCount,
    trang_thai: null,
    source: 'nv4-api',
    verification_status: 'chua_ro',
  });
}

function createJsonSource(file = path.join(__dirname, '..', '..', 'data', 'flood-points.sample.json')) {
  return {
    kind: 'json-sample',
    async list() {
      const raw = JSON.parse(await fs.readFile(file, 'utf8'));
      const arr = Array.isArray(raw) ? raw : raw.points || [];
      return arr.map(normalize);
    },
  };
}

/**
 * Adapter API NV4: GET <apiUrl>/api/flood-prone?minEvents=1, có cache 10 phút và timeout 5 giây.
 * Khi mất kết nối/dữ liệu sai: ném PointsSourceError rõ ràng (trừ khi bật fallbackToJson riêng).
 */
function createApiSource(urlOrOpts = config.nv4.apiUrl, fetchArg) {
  const opts = typeof urlOrOpts === 'string' ? { apiUrl: urlOrOpts, fetchImpl: fetchArg } : (urlOrOpts || {});
  const apiUrl = (opts.apiUrl || config.nv4.apiUrl).replace(/\/+$/, '');
  const minEvents = opts.minEvents ?? config.nv4.minEvents;
  const cacheMs = opts.cacheMs ?? config.nv4.cacheMs;
  const timeoutMs = opts.timeoutMs ?? config.nv4.timeoutMs;
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const now = opts.now || (() => Date.now());
  const fallbackSource = opts.fallbackToJson ? (opts.fallbackSource || createJsonSource()) : null;
  let cache = null;

  async function fetchFromNv4() {
    const endpoint = `${apiUrl}/api/flood-prone?minEvents=${encodeURIComponent(minEvents)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(endpoint, { method: 'GET', headers: { Accept: 'application/json' }, signal: ctrl.signal });
    } catch (e) {
      const isTimeout = e && e.name === 'AbortError';
      throw new PointsSourceError(
        isTimeout ? 'API NV4 quá thời gian chờ (timeout)' : `Không kết nối được API NV4: ${e.message}`,
        isTimeout ? 'NV4_TIMEOUT' : 'NV4_NETWORK'
      );
    } finally {
      clearTimeout(timer);
    }
    if (!res || !res.ok) {
      throw new PointsSourceError(`API NV4 trả về HTTP ${res ? res.status : 'unknown'}`, 'NV4_HTTP');
    }
    let body;
    try {
      body = await res.json();
    } catch {
      throw new PointsSourceError('Phản hồi từ API NV4 không phải JSON hợp lệ', 'NV4_BAD_RESPONSE');
    }
    if (!body || body.ok !== true || !Array.isArray(body.data)) {
      throw new PointsSourceError('Dữ liệu từ API NV4 sai cấu trúc hợp đồng (thiếu ok:true hoặc mảng data)', 'NV4_BAD_RESPONSE');
    }
    return body.data.map(mapNv4ProneItem);
  }

  return {
    kind: 'nv4-api',
    endpoint: `${apiUrl}/api/flood-prone?minEvents=${minEvents}`,
    clearCache() { cache = null; },
    async list() {
      if (cache && now() - cache.at < cacheMs) return cache.points;
      try {
        const points = await fetchFromNv4();
        cache = { at: now(), points };
        return points;
      } catch (err) {
        if (fallbackSource) return fallbackSource.list();
        throw err;
      }
    },
  };
}

/** Chọn nguồn điểm ngập theo cấu hình hoặc biến môi trường NV5_POINTS_SOURCE=json|nv4. */
function createConfiguredSource(opts = {}) {
  const env = opts.env || process.env;
  const mode = (opts.sourceType || env.NV5_POINTS_SOURCE || config.pointsSource || 'json').toLowerCase();
  if (mode === 'nv4') {
    return createApiSource({
      apiUrl: opts.apiUrl || env.NV4_API_URL || config.nv4.apiUrl,
      fallbackToJson: opts.fallbackToJson ?? (env.NV4_FALLBACK_JSON === '1' || config.nv4.fallbackToJson),
      fetchImpl: opts.fetchImpl,
      cacheMs: opts.cacheMs,
      timeoutMs: opts.timeoutMs,
      now: opts.now,
    });
  }
  return createJsonSource(opts.file);
}

/** Điểm thử nghiệm cho chế độ demo - KHÔNG phải địa điểm đã xác minh. */
function makeDemoPoint({ lat, lng, so_lan_ngap = 1, ten = 'Điểm thử nghiệm' }) {
  return normalize({
    id: `demo-${Number(lat).toFixed(4)}-${Number(lng).toFixed(4)}`,
    duong: `${ten} (tọa độ nhập tay)`,
    phuong: 'DEMO - chưa xác minh',
    lat: Number(lat), lng: Number(lng),
    so_lan_ngap: Number(so_lan_ngap),
    trang_thai: 'demo_chua_xac_minh',
    nguyen_nhan: null, muc_ngap: null, gio_bao: null, anh: null,
    is_demo: true,
  });
}

module.exports = {
  createJsonSource,
  createApiSource,
  createConfiguredSource,
  mapNv4ProneItem,
  PointsSourceError,
  makeDemoPoint,
  normalize,
  FIELDS,
};
