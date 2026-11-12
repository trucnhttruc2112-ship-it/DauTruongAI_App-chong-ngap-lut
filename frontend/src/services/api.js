// Lớp dịch vụ giao diện. Màn hình chỉ gọi các hàm này (getFloodPoints, analyzePhoto,
// submitReport, getReport, updateReportStatus...). Chế độ mẫu và thật dùng cùng cấu trúc kết quả,
// nên khi có máy chủ chỉ cần thay phần thân hàm, không viết lại màn hình (mục 13.3).
//
// Ở bản này KHÔNG có backend: mọi hàm chạy trên trình duyệt với dữ liệu mẫu có nhãn Mô phỏng,
// có độ trễ giả lập để thể hiện trạng thái đang tải / lỗi mạng.

import { APP_CONFIG } from '../app/config.js'
import { seedReports, DEMO_OWNER_ID } from '../data/mock/reports.js'
import {
  PLACES, HISTORY_POINTS, FORECAST_AREAS, AFFECTED_ROADS, DATA_SOURCES, rainHourly, AREAS as MOCK_AREAS
} from '../data/mock/geo.js'
import { scenePhoto } from '../data/mock/photos.js'
import { idb, STORES, local } from './storage.js'
import { TIME_WINDOWS } from '../utils/time.js'
import * as live from './liveApi.js'

// dataMode = 'live': gọi máy chủ thật (NV3, NV4, NV5) qua liveApi.js
const LIVE = APP_CONFIG.dataMode === 'live'
export const AREAS = LIVE ? live.LIVE_AREAS : MOCK_AREAS

/* ------------------------------------------------------------------ */
/* Công cụ trình diễn – bật trong Tùy chọn để thử các trạng thái lỗi   */
/* ------------------------------------------------------------------ */
const DEMO_KEY = 'flood-ui-demo-tools'
export function getDemoTools() {
  return { networkFail: false, aiMode: 'auto', mapTileFail: false, ...local.get(DEMO_KEY, {}) }
}
export function setDemoTools(patch) {
  const next = { ...getDemoTools(), ...patch }
  local.set(DEMO_KEY, next)
  emit('demo-tools')
  return next
}

/* ------------------------------------------------------------------ */
/* Kho dữ liệu mô phỏng + thông báo thay đổi                           */
/* ------------------------------------------------------------------ */
const listeners = new Set()
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }
function emit(topic) { listeners.forEach((fn) => fn(topic)) }

let db = null
let loading = null

async function loadDb() {
  if (db) return db
  if (loading) return loading
  loading = (async () => {
    try {
      const saved = await idb.get(STORES.mock, 'reports')
      db = { reports: Array.isArray(saved) && saved.length ? saved : seedReports() }
    } catch (_) {
      db = { reports: seedReports() }
    }
    return db
  })()
  return loading
}

async function allReports(signal, ms) {
  if (LIVE) return live.listAllReports(signal)
  await loadDb()
  await network(ms, signal)
  return db.reports
}

async function persist() {
  try { await idb.set(STORES.mock, 'reports', db.reports) } catch (_) { /* phiên hiện tại vẫn dùng được */ }
}

/** Khôi phục dữ liệu mẫu ban đầu (Tùy chọn → Công cụ trình diễn). */
export async function resetDemoData() {
  if (LIVE) { emit('reports'); return }
  db = { reports: seedReports() }
  await persist()
  emit('reports')
}

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms)
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Đã hủy', 'AbortError')) }, { once: true })
})

export class NetworkError extends Error {
  constructor(msg = 'Không kết nối được máy chủ') { super(msg); this.name = 'NetworkError' }
}
export class ConflictError extends Error {
  constructor(latest) { super('Báo cáo đã có phiên bản mới'); this.name = 'ConflictError'; this.latest = latest }
}
export class AuthError extends Error {
  constructor(msg = 'Cần đăng nhập') { super(msg); this.name = 'AuthError' }
}

async function network(ms = 350, signal) {
  await sleep(ms + Math.random() * 200, signal)
  if (getDemoTools().networkFail || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    throw new NetworkError()
  }
}

const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)))

/* ------------------------------------------------------------------ */
/* Điểm ngập công khai                                                 */
/* ------------------------------------------------------------------ */

/** Một báo cáo trở thành điểm công khai chỉ khi publicationStatus = public (mục 2.2, 8). */
function toFloodPoint(r) {
  return {
    id: r.id,
    geometry: 'point',
    place: r.place,
    area: r.area,
    lat: r.lat,
    lng: r.lng,
    severity: r.severity,
    observedAt: r.observedAt,
    updatedAt: r.updatedAt,
    source: r.photoSource === 'camera' ? 'Người dân gửi ảnh chụp trực tiếp' : 'Người dân gửi ảnh có sẵn',
    dataMode: r.dataMode,
    verificationStatus: r.verificationStatus,
    processingStatus: r.processingStatus,
    floodCondition: r.floodCondition,
    photo: r.photo,
    photoSource: r.photoSource,
    locationSource: r.locationSource,
    ai: r.ai,
    observation: r.observation,
    history: r.history.filter((h) => h.kind !== 'internal')
  }
}

export function filterPoints(points, filters) {
  const { severities = [], time = '24h', areas = [], verification = [] } = filters || {}
  const win = TIME_WINDOWS[time]
  const now = Date.now()
  return points.filter((p) => {
    if (severities.length && !severities.includes(p.severity)) return false
    if (areas.length && !areas.includes(p.area)) return false
    if (verification.length && !verification.includes(p.verificationStatus)) return false
    if (win && now - new Date(p.observedAt).getTime() > win) return false
    return true
  })
}

/**
 * Đọc điểm ngập công khai. Lớp "Đang được báo ngập" chỉ gồm điểm có tình trạng
 * Đang ghi nhận ngập hoặc chưa có cập nhật mới; điểm "không thấy ngập" không thành marker.
 */
export async function getFloodPoints({ signal } = {}) {
  if (LIVE) return live.getFloodPoints({ signal })
  await loadDb()
  await network(450, signal)
  const pts = db.reports
    .filter((r) => r.publicationStatus === 'public')
    .filter((r) => r.ai?.outcome !== 'no-sign' || r.observation?.level)
    .filter((r) => r.floodCondition !== 'confirmed-clear')
    .map(toFloodPoint)
  return { items: clone(pts), fetchedAt: new Date().toISOString(), dataMode: APP_CONFIG.dataMode }
}

export async function getFloodPoint(id, { signal } = {}) {
  if (LIVE) return live.getFloodPoint(id, { signal })
  await loadDb()
  await network(250, signal)
  const r = db.reports.find((x) => x.id === id && x.publicationStatus === 'public')
  if (!r) return null
  const related = db.reports
    .filter((x) => x.id !== id && x.publicationStatus === 'public' && x.area === r.area)
    .slice(0, 3)
    .map((x) => ({ id: x.id, place: x.place, severity: x.severity, observedAt: x.observedAt }))
  return { ...clone(toFloodPoint(r)), related }
}

export async function getHistoryPoints() {
  if (LIVE) return live.getHistoryPoints()
  await sleep(200)
  return clone(HISTORY_POINTS)
}

export async function getForecasts() {
  if (LIVE) return live.getForecasts()
  await network(400)
  return {
    items: clone(FORECAST_AREAS),
    rain: rainHourly(1),
    rainSource: 'Nguồn thời tiết mẫu (định dạng tương tự Open-Meteo)',
    rainMode: 'sample',
    fetchedAt: new Date().toISOString()
  }
}

export async function getAffectedRoads() {
  if (LIVE) return live.getAffectedRoads()
  await network(300)
  return clone(AFFECTED_ROADS)
}

export async function getDataSources() {
  if (LIVE) return live.getDataSources()
  await network(300)
  return clone(DATA_SOURCES)
}

/* ------------------------------------------------------------------ */
/* Tìm địa điểm – chỉ trong danh mục địa điểm của dự án (mục 6.4)       */
/* ------------------------------------------------------------------ */
const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export async function searchPlaces(query, { signal } = {}) {
  await sleep(180, signal)
  const q = strip(query.trim())
  if (!q) return []
  return PLACES.filter((p) => strip(`${p.name} ${p.context}`).includes(q)).slice(0, 6)
}

export function isInsideSupportedArea(lat, lng) {
  const [[s, w], [n, e]] = APP_CONFIG.map.supportedBounds
  return lat >= s && lat <= n && lng >= w && lng <= e
}

/** Gợi ý tên địa điểm gần tọa độ (từ danh mục dự án). Không suy ra được thì trả null. */
export async function reverseLookup(lat, lng) {
  await sleep(250)
  let best = null
  let bestD = Infinity
  for (const p of PLACES) {
    if (p.outside) continue
    const d = (p.lat - lat) ** 2 + (p.lng - lng) ** 2
    if (d < bestD) { bestD = d; best = p }
  }
  // khoảng ~400 m
  if (best && bestD < 0.004 ** 2) return { name: `Gần ${best.name}`, area: LIVE ? live.nearestWard(lat, lng) : best.area }
  return null
}

/* ------------------------------------------------------------------ */
/* AI phân tích ảnh (Mô phỏng)                                         */
/* ------------------------------------------------------------------ */

/**
 * Trả về một trong các trạng thái: done | insufficient | error.
 * Kết quả: outcome flood | no-sign | insufficient, level khi có.
 * Không trả độ sâu hay phần trăm tin cậy khi "mô hình" không có (mục 7.3).
 */
export async function analyzePhoto(photoMeta, { signal } = {}) {
  if (LIVE) return live.analyzePhoto(photoMeta, { signal })
  const tools = getDemoTools()
  await sleep(2200 + Math.random() * 1200, signal)
  if (tools.networkFail || tools.aiMode === 'error') {
    throw new NetworkError('Chưa kết nối được dịch vụ phân tích ảnh')
  }
  if (tools.aiMode === 'timeout') {
    await sleep(APP_CONFIG.ai.timeoutMs + 1000, signal)
  }
  if (tools.aiMode === 'insufficient') {
    return { status: 'insufficient', outcome: 'insufficient', level: null, note: 'Ảnh chưa đủ rõ để ước lượng mức ngập.', dataMode: 'demo' }
  }
  if (tools.aiMode === 'no-sign') {
    return { status: 'done', outcome: 'no-sign', level: null, note: null, dataMode: 'demo' }
  }
  // Tự động: chọn kết quả ổn định theo kích thước ảnh để demo nhất quán
  const seed = (photoMeta?.size || 0) % 7
  if (seed === 0) return { status: 'insufficient', outcome: 'insufficient', level: null, note: 'Ảnh chưa đủ rõ để ước lượng mức ngập.', dataMode: 'demo' }
  const level = ['light', 'moderate', 'moderate', 'severe', 'light', 'moderate'][seed - 1]
  return { status: 'done', outcome: 'flood', level, note: null, dataMode: 'demo' }
}

/* ------------------------------------------------------------------ */
/* Đăng nhập thử nghiệm                                                */
/* ------------------------------------------------------------------ */
const SESSION_KEY = 'flood-ui-session'

/**
 * Bản trình diễn: tài khoản do nhóm cấp theo vai trò. Ở bản thật, kiểm tra mật khẩu
 * và phân quyền phải nằm ở máy chủ – không đặt mật khẩu quản lý trong mã frontend.
 */
const DEMO_ACCOUNTS = {
  nguoidan: { id: DEMO_OWNER_ID, role: 'citizen', name: 'Người dân (thử nghiệm)' },
  quanly: { id: 'admin-01', role: 'admin', name: 'Quản lý thử nghiệm', area: 'Biên Hòa – khu trình diễn' }
}

export function getSession() { return local.get(SESSION_KEY, null) }

export async function login(username, password) {
  await network(600)
  const acc = DEMO_ACCOUNTS[username.trim().toLowerCase()]
  if (!acc || !password || password.length < 6) {
    throw new AuthError('Tài khoản hoặc mật khẩu chưa đúng.')
  }
  const session = { ...acc, username: username.trim().toLowerCase(), expiresAt: Date.now() + 8 * 3600_000 }
  local.set(SESSION_KEY, session)
  emit('session')
  return session
}

export function logout() {
  local.remove(SESSION_KEY)
  emit('session')
}

function requireSession(role) {
  const s = getSession()
  if (!s || s.expiresAt < Date.now()) throw new AuthError('Phiên đăng nhập đã hết hạn')
  if (role && s.role !== role) throw new AuthError('Tài khoản không có quyền thực hiện thao tác này')
  return s
}

/* ------------------------------------------------------------------ */
/* Báo cáo của người dân                                               */
/* ------------------------------------------------------------------ */
const submittedKeys = new Map() // requestId → reportId, để thử lại không tạo trùng (UX09)

function nextId() {
  const n = db.reports.length + 101 + Math.floor(Math.random() * 9)
  return `BC-2611-${String(n).padStart(4, '0')}`
}

/**
 * Gửi báo cáo. Trả thành công chỉ khi "máy chủ" đã lưu (mục 7.4).
 * requestId giữ nguyên khi thử lại để không tạo bản ghi trùng.
 */
export async function submitReport(payload, { requestId }) {
  const session = requireSession()
  if (LIVE) {
    const report = await live.submitReport(payload, { requestId })
    emit('reports')
    return report
  }
  await loadDb()
  await network(900)
  if (submittedKeys.has(requestId)) {
    const existing = db.reports.find((r) => r.id === submittedKeys.get(requestId))
    if (existing) return clone(existing)
  }
  const now = new Date().toISOString()
  const report = {
    id: nextId(),
    place: payload.place,
    area: payload.area || null,
    lat: payload.lat,
    lng: payload.lng,
    severity: payload.observation?.level || payload.ai?.level || 'unknown',
    photo: payload.photo,
    photoSource: payload.photoSource,
    locationSource: payload.locationSource,
    accuracy: payload.accuracy ?? null,
    observedAt: payload.observedAt,
    capturedAt: payload.capturedAt || null,
    declaredAt: payload.declaredAt || null,
    receivedAt: now,
    updatedAt: now,
    ai: payload.ai || { status: 'pending', outcome: null, level: null },
    observation: payload.observation || { level: null, note: null },
    verificationStatus: 'unchecked',
    processingStatus: 'submitted',
    floodCondition: 'active',
    publicationStatus: 'pending',
    dataMode: 'demo',
    ownerId: session.id,
    version: 1,
    history: [{ at: now, actor: 'Bạn', text: 'Đã gửi báo cáo vào hệ thống thử nghiệm', kind: 'processing' }]
  }
  db.reports.unshift(report)
  submittedKeys.set(requestId, report.id)
  await persist()
  emit('reports')
  return clone(report)
}

export async function getMyReports({ signal } = {}) {
  const s = requireSession()
  if (LIVE) return live.getMyReports({ signal })
  await loadDb()
  await network(400, signal)
  return {
    items: clone(db.reports.filter((r) => r.ownerId === s.id)),
    fetchedAt: new Date().toISOString()
  }
}

export async function getReport(id, { signal } = {}) {
  const s = requireSession()
  if (LIVE) return live.getReport(id, { signal })
  await loadDb()
  await network(300, signal)
  const r = db.reports.find((x) => x.id === id)
  if (!r) return null
  if (s.role !== 'admin' && r.ownerId !== s.id) throw new AuthError('Bạn không có quyền xem báo cáo này')
  return clone(r)
}

/** Người gửi bổ sung thông tin khi báo cáo ở trạng thái Cần bổ sung. */
export async function addReportInfo(id, { note, photo }) {
  const s = requireSession()
  if (LIVE) {
    const r = await live.addReportInfo(id, { note, photo })
    emit('reports')
    return r
  }
  await loadDb()
  await network(700)
  const r = db.reports.find((x) => x.id === id && x.ownerId === s.id)
  if (!r) throw new Error('Không tìm thấy báo cáo')
  const now = new Date().toISOString()
  if (photo) r.extraPhoto = photo
  r.extraNote = note
  r.processingStatus = 'received'
  r.updatedAt = now
  r.version += 1
  r.history.unshift({ at: now, actor: 'Bạn', text: `Đã bổ sung thông tin${photo ? ' và ảnh mới' : ''}`, kind: 'processing' })
  delete r.request
  await persist()
  emit('reports')
  return clone(r)
}

/* ------------------------------------------------------------------ */
/* Xác nhận vẫn ngập / hết ngập                                        */
/* ------------------------------------------------------------------ */

/**
 * Người dân gửi quan sát mới tại một điểm công khai (mục 6.5):
 * "Hết ngập" KHÔNG xóa điểm, chỉ chuyển tình trạng sang "Có thông tin hết ngập" để phường kiểm tra.
 * "Vẫn ngập" làm mới thời điểm cập nhật của điểm.
 */
export async function submitConditionObservation(pointId, { still, note, level }) {
  requireSession()
  if (LIVE) {
    const p = await live.submitConditionObservation(pointId, { still, note, level })
    emit('reports')
    return p
  }
  await loadDb()
  await network(700)
  const r = db.reports.find((x) => x.id === pointId)
  if (!r) throw new Error('Không tìm thấy điểm ngập')
  const now = new Date().toISOString()
  r.observations = r.observations || []
  r.observations.unshift({ at: now, still, note: note || null, level: level || null })
  if (still) {
    if (r.floodCondition !== 'active') r.floodCondition = 'active'
    if (level) r.severity = level
    r.history.unshift({ at: now, actor: 'Người dân', text: `Gửi quan sát mới: vẫn còn ngập${level ? ` (${level === 'severe' ? 'nặng' : level === 'moderate' ? 'vừa' : 'nhẹ'})` : ''}`, kind: 'condition' })
  } else {
    r.floodCondition = 'reported-clear'
    r.history.unshift({ at: now, actor: 'Người dân', text: 'Gửi quan sát mới: nước đã rút, chờ phường xác nhận', kind: 'condition' })
  }
  r.updatedAt = now
  r.version += 1
  await persist()
  emit('reports')
  return clone(toFloodPoint(r))
}

/**
 * Phường xác nhận tình trạng ngập: 'confirmed-clear' (Đã xác nhận hết ngập) hoặc 'active' (vẫn ngập).
 * Độc lập với quy trình xử lý – không tự đóng báo cáo.
 */
export async function confirmFloodCondition(id, { condition, note, version }) {
  const s = requireSession('admin')
  if (LIVE) {
    const r = await live.confirmFloodCondition(id, { condition, note, version })
    emit('reports')
    return r
  }
  await loadDb()
  await network(600)
  const r = db.reports.find((x) => x.id === id)
  if (!r) throw new Error('Không tìm thấy báo cáo')
  if (r.version !== version) throw new ConflictError(clone(r))
  const now = new Date().toISOString()
  r.floodCondition = condition
  r.history.unshift({
    at: now,
    actor: s.name,
    text: condition === 'confirmed-clear'
      ? `Xác nhận hết ngập${note ? `: ${note}` : ''}`
      : `Xác nhận vẫn còn ngập${note ? `: ${note}` : ''}`,
    kind: 'condition'
  })
  r.updatedAt = now
  r.version += 1
  await persist()
  emit('reports')
  return clone(r)
}

/** Tổng hợp theo phường/khu vực cho trang phường. */
export async function getWardSummary({ signal } = {}) {
  requireSession('admin')
  const reports = await allReports(signal, 300)
  const map = new Map()
  for (const r of reports) {
    const key = r.area || 'Chưa rõ khu vực'
    if (!map.has(key)) map.set(key, { area: key, active: 0, reportedClear: 0, pending: 0, severe: 0, total: 0 })
    const w = map.get(key)
    w.total += 1
    if (r.publicationStatus === 'public' && r.floodCondition === 'active') w.active += 1
    if (r.floodCondition === 'reported-clear') w.reportedClear += 1
    if (r.publicationStatus === 'pending') w.pending += 1
    if (r.floodCondition === 'active' && r.severity === 'severe') w.severe += 1
  }
  return { items: [...map.values()].sort((a, b) => b.active - a.active || b.total - a.total), fetchedAt: new Date().toISOString() }
}

/** Tất cả điểm trong địa bàn quản lý (cả chờ duyệt) để vẽ bản đồ phường. */
export async function getWardPoints({ area, signal } = {}) {
  requireSession('admin')
  const reports = await allReports(signal, 350)
  return clone(reports.filter((r) => !area || r.area === area))
}

/* ------------------------------------------------------------------ */
/* Quản lý                                                             */
/* ------------------------------------------------------------------ */
export async function getAdminReports({ page = 1, pageSize = APP_CONFIG.admin.pageSize, filters = {}, sort = 'newest', query = '', signal } = {}) {
  requireSession('admin')
  const all = await allReports(signal, 400)
  const { time = 'all', severities = [], verification = [], processing = [], publication = [], areas = [], conditions = [] } = filters
  const win = TIME_WINDOWS[time]
  const q = strip(query)
  let items = all.filter((r) => {
    if (areas.length && !areas.includes(r.area)) return false
    if (conditions.length && !conditions.includes(r.floodCondition)) return false
    if (severities.length && !severities.includes(r.severity)) return false
    if (verification.length && !verification.includes(r.verificationStatus)) return false
    if (processing.length && !processing.includes(r.processingStatus)) return false
    if (publication.length && !publication.includes(r.publicationStatus)) return false
    if (win && Date.now() - new Date(r.observedAt).getTime() > win) return false
    if (q && !strip(`${r.id} ${r.place} ${r.area || ''}`).includes(q)) return false
    return true
  })
  const sev = { severe: 0, moderate: 1, light: 2, unknown: 3 }
  items.sort((a, b) => {
    if (sort === 'oldest') return new Date(a.receivedAt) - new Date(b.receivedAt)
    if (sort === 'severity') return sev[a.severity] - sev[b.severity] || new Date(b.receivedAt) - new Date(a.receivedAt)
    return new Date(b.receivedAt) - new Date(a.receivedAt)
  })
  const total = items.length
  const start = (page - 1) * pageSize
  const counts = {
    pending: all.filter((r) => r.publicationStatus === 'pending' && r.verificationStatus === 'unchecked').length,
    needsInfo: all.filter((r) => r.processingStatus === 'needs-info').length,
    checking: all.filter((r) => r.verificationStatus === 'checking').length,
    reportedClear: all.filter((r) => r.floodCondition === 'reported-clear').length
  }
  return { items: clone(items.slice(start, start + pageSize)), total, page, pageSize, counts, fetchedAt: new Date().toISOString() }
}

/**
 * Các hành động quản lý hợp lệ theo trạng thái hiện tại (mục 11.2) –
 * không cho tạo chuỗi trạng thái vô nghĩa. Máy chủ thật vẫn phải kiểm tra lại.
 */
export function allowedActions(r) {
  const a = []
  if (r.processingStatus === 'submitted') a.push('receive')
  if (['submitted', 'received', 'in-progress'].includes(r.processingStatus)) a.push('request-info')
  if (!['verified', 'invalid'].includes(r.verificationStatus) && r.processingStatus !== 'closed') a.push('verify')
  if (r.verificationStatus !== 'invalid' && r.processingStatus !== 'closed') a.push('invalid')
  if (['received', 'needs-info'].includes(r.processingStatus) && r.verificationStatus !== 'invalid') a.push('in-progress')
  if (r.processingStatus !== 'closed') a.push('close')
  if (r.publicationStatus === 'public') a.push('hide')
  return a
}

export const ACTION_META = {
  receive: { label: 'Tiếp nhận', needsReason: false, tone: 'primary' },
  'request-info': { label: 'Yêu cầu bổ sung', needsReason: true, reasonLabel: 'Nội dung cần người gửi bổ sung' },
  verify: { label: 'Xác nhận thông tin', needsReason: false, tone: 'primary', reasonLabel: 'Căn cứ đối chiếu (không bắt buộc)' },
  invalid: { label: 'Đánh dấu không hợp lệ', needsReason: true, tone: 'danger', reasonLabel: 'Lý do không hợp lệ (người gửi sẽ thấy)' },
  'in-progress': { label: 'Chuyển đang xử lý', needsReason: false },
  close: { label: 'Đóng báo cáo', needsReason: false, reasonLabel: 'Kết quả xử lý' },
  hide: { label: 'Ẩn khỏi bản đồ', needsReason: true, tone: 'danger', reasonLabel: 'Lý do ẩn báo cáo đã công khai' }
}

export async function updateReportStatus(id, { action, reason, version, closeOutcome }) {
  const s = requireSession('admin')
  if (LIVE) {
    const r = await live.updateReportStatus(id, { action, reason, version, closeOutcome })
    emit('reports')
    return r
  }
  await loadDb()
  await network(700)
  const r = db.reports.find((x) => x.id === id)
  if (!r) throw new Error('Không tìm thấy báo cáo')
  if (r.version !== version) throw new ConflictError(clone(r))
  if (!allowedActions(r).includes(action)) throw new Error('Hành động không phù hợp với trạng thái hiện tại')
  const now = new Date().toISOString()
  const actor = s.name
  const push = (text, kind) => r.history.unshift({ at: now, actor, text, kind })

  switch (action) {
    case 'receive':
      r.processingStatus = 'received'
      if (r.verificationStatus === 'unchecked') r.verificationStatus = 'checking'
      push('Đã tiếp nhận, bắt đầu kiểm tra', 'processing')
      break
    case 'request-info':
      r.processingStatus = 'needs-info'
      r.request = reason
      push(`Yêu cầu bổ sung: ${reason}`, 'processing')
      break
    case 'verify':
      r.verificationStatus = 'verified'
      if (r.publicationStatus === 'pending') r.publicationStatus = 'public'
      if (r.processingStatus === 'submitted') r.processingStatus = 'received'
      push(`Xác nhận thông tin${reason ? `: ${reason}` : ''}. Công khai trên bản đồ`, 'verification')
      break
    case 'invalid':
      r.verificationStatus = 'invalid'
      r.publicationStatus = 'private'
      r.reason = reason
      push(`Đánh dấu không hợp lệ: ${reason}`, 'verification')
      break
    case 'in-progress':
      r.processingStatus = 'in-progress'
      push('Chuyển sang Đang xử lý', 'processing')
      break
    case 'close':
      // Đóng báo cáo không tự đồng nghĩa hết ngập (UX08)
      r.processingStatus = 'closed'
      if (closeOutcome === 'confirmed-clear') r.floodCondition = 'confirmed-clear'
      push(`Đóng báo cáo${reason ? `: ${reason}` : ''}${closeOutcome === 'confirmed-clear' ? '. Đã xác nhận hết ngập' : ''}`, 'processing')
      break
    case 'hide':
      r.publicationStatus = 'hidden'
      r.hiddenReason = reason
      push(`Ẩn khỏi bản đồ công khai: ${reason}`, 'publication')
      break
    default:
      throw new Error('Hành động không xác định')
  }
  r.updatedAt = now
  r.version += 1
  await persist()
  emit('reports')
  return clone(r)
}

export async function addAdminNote(id, { text, version }) {
  const s = requireSession('admin')
  if (LIVE) {
    const r = await live.addAdminNote(id, { text, version })
    emit('reports')
    return r
  }
  await loadDb()
  await network(500)
  const r = db.reports.find((x) => x.id === id)
  if (r.version !== version) throw new ConflictError(clone(r))
  const now = new Date().toISOString()
  r.history.unshift({ at: now, actor: s.name, text: `Phản hồi cho người gửi: ${text}`, kind: 'feedback' })
  r.updatedAt = now
  r.version += 1
  await persist()
  emit('reports')
  return clone(r)
}

/* ------------------------------------------------------------------ */
/* Ảnh – kiểm tra và thu nhỏ trước khi gửi (không đổi bản gốc)         */
/* ------------------------------------------------------------------ */
export function validatePhotoFile(file) {
  const { acceptTypes, maxBytes } = APP_CONFIG.photo
  if (!acceptTypes.includes(file.type)) {
    return 'Định dạng ảnh chưa được hỗ trợ. Vui lòng dùng ảnh JPEG, PNG hoặc WebP.'
  }
  if (file.size > maxBytes) {
    return `Ảnh lớn hơn ${Math.round(maxBytes / 1024 / 1024)} MB. Vui lòng chọn ảnh nhỏ hơn hoặc chụp lại.`
  }
  return null
}

/** Thu nhỏ cạnh dài về khoảng 1600 px. Trả data URL JPEG để lưu nháp/gửi. */
export async function downscalePhoto(blob) {
  const { longEdge } = APP_CONFIG.photo
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Không đọc được ảnh'))
      el.src = url
    })
    const scale = Math.min(1, longEdge / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale)
    const h = Math.round(img.naturalHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(img, 0, 0, w, h)
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: w, height: h }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const samplePhoto = scenePhoto
