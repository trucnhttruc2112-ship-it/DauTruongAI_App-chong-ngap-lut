// Kết nối máy chủ thật: NV4 (báo cáo, điểm ngập, trang phường), NV3 (AI), NV5 (dự báo mưa).
// Chỉ dùng khi APP_CONFIG.dataMode = 'live'. Kết quả trả về cùng dạng với chế độ mẫu
// nên các màn hình không phải sửa.
import { APP_CONFIG } from '../app/config.js'
import WARDS from '../data/wards.json'
import { local } from './storage.js'
import { NetworkError, ConflictError, AuthError, getSession, getDemoTools } from './api.js'

const { server, ai, forecast } = APP_CONFIG.api

const SEV = { high: 'severe', medium: 'moderate', low: 'light' }
const SEV_RANK = { severe: 0, moderate: 1, light: 2, unknown: 3 }
const NV5_LEVEL = { rat_cao: 'severe', cao: 'moderate', trung_binh: 'light' }
const NV5_RANK = { rat_cao: 3, cao: 2, trung_binh: 1 }
const ALL_STATUS = 'active,pending,resolved,rejected,expired'

export const WARD_NAMES = Object.fromEntries(
  WARDS.wards.map((w) => [w.id, w.name.replace(/^(Phường|Xã) /, '')])
)
export const LIVE_AREAS = Object.values(WARD_NAMES)

const MY_KEY = 'flood-live-my-reports'
const DEVICE_KEY = 'flood-live-device-id'

function deviceId() {
  let id = local.get(DEVICE_KEY, null)
  if (!id) {
    id = `web_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    local.set(DEVICE_KEY, id)
  }
  return id
}

const myReports = () => local.get(MY_KEY, [])

async function http(url, options = {}) {
  let res
  try {
    res = await fetch(url, options)
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new NetworkError()
  }
  let body = null
  try { body = await res.json() } catch (_) { /* không phải JSON */ }
  if (!res.ok) {
    const err = new Error(body?.error?.message || body?.message || `Máy chủ báo lỗi (${res.status})`)
    err.status = res.status
    err.code = body?.error?.code || body?.code
    err.body = body
    throw err
  }
  return body
}

const postJson = (url, data) =>
  http(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })

const toBlob = async (dataUrl) => (await fetch(dataUrl)).blob()

export function nearestWard(lat, lng) {
  let best = null
  let bestD = Infinity
  for (const w of WARDS.wards) {
    if (typeof w.lat !== 'number') continue
    const d = (w.lat - lat) ** 2 + (w.lng - lng) ** 2
    if (d < bestD) { bestD = d; best = w }
  }
  return best ? WARD_NAMES[best.id] : null
}

/* ---------- Đổi điểm ngập của NV4 sang dạng báo cáo của giao diện ---------- */
function toReport(p) {
  const verification = { active: 'verified', resolved: 'verified', expired: 'verified', pending: 'checking', rejected: 'invalid' }[p.status] || 'unchecked'
  let condition = 'active'
  if (p.status === 'resolved' || p.status === 'expired') condition = 'confirmed-clear'
  else if (p.confirmEnded > p.confirmStill) condition = 'reported-clear'
  const publication = p.publication || ({ active: 'public', resolved: 'public', expired: 'public', pending: 'pending', rejected: 'private' }[p.status] || 'pending')
  const hasPhoto = Array.isArray(p.images) && p.images.length > 0
  // Điểm không có ảnh là dữ liệu nhóm tổng hợp từ báo chí (NV6), không phải người dân gửi
  const last = p.latestReport || null
  const photoSource = !hasPhoto ? 'none' : last?.photoSource === 'library' || last?.source === 'gallery' ? 'library' : 'camera'
  const locationSource = !hasPhoto ? 'team' : last?.source === 'manual-pin' ? 'manual' : 'gps'
  // Kết quả AI lấy từ báo cáo gần nhất (chỉ có ở API chi tiết), không suy ra từ trạng thái điểm
  let ai = null
  if (p.latestAi) {
    const outcome = p.latestAi.isFlood === true ? 'flood' : p.latestAi.isFlood === false ? 'no-sign' : 'insufficient'
    ai = {
      status: outcome === 'insufficient' ? 'insufficient' : 'done',
      outcome,
      level: outcome === 'flood' ? SEV[p.latestAi.severity] || null : null,
      note: p.latestAi.description || null
    }
  }
  const session = getSession()
  const mine = myReports().some((m) => m.id === p.id)
  const request = (p.history || []).find((h) => h.text?.startsWith('Yêu cầu bổ sung'))

  return {
    id: p.id,
    place: p.address || p.street || 'Điểm ngập',
    street: p.street || null,
    area: WARD_NAMES[p.wardId] || null,
    lat: p.lat,
    lng: p.lng,
    severity: SEV[p.severity] || 'unknown',
    photo: hasPhoto ? p.images[0] : null,
    photoSource,
    locationSource,
    accuracy: locationSource === 'gps' && last?.accuracyM ? Math.round(last.accuracyM) : null,
    observedAt: p.lastConfirmedAt || p.lastUpdatedAt || p.firstReportedAt,
    capturedAt: last?.capturedAt || null,
    receivedAt: p.firstReportedAt,
    updatedAt: p.lastUpdatedAt,
    // Điểm nạp từ dữ liệu NV6 không có ảnh nên chưa có kết quả AI
    ai,
    observation: { level: null, note: null },
    verificationStatus: verification,
    processingStatus: p.processingStatus || 'submitted',
    floodCondition: condition,
    publicationStatus: publication,
    request: p.processingStatus === 'needs-info' && request ? request.text.replace(/^Yêu cầu bổ sung:?\s*/, '') : undefined,
    dataMode: p.dataMode === 'demo' ? 'demo' : 'live',
    ownerId: mine && session ? session.id : 'other',
    version: p.version || 1,
    trustScore: p.trustScore,
    reportCount: p.reportCount,
    history: [
      ...(p.history || []),
      { at: p.firstReportedAt, actor: 'Hệ thống', text: `Ghi nhận điểm ngập (${p.reportCount || 1} báo cáo)`, kind: 'processing' }
    ]
  }
}

function toPoint(r) {
  return {
    id: r.id,
    geometry: 'point',
    place: r.place,
    street: r.street,
    area: r.area,
    lat: r.lat,
    lng: r.lng,
    severity: r.severity,
    observedAt: r.observedAt,
    updatedAt: r.updatedAt,
    source: r.photo
      ? 'Ảnh hiện trường người dân gửi qua website'
      : r.dataMode === 'demo'
        ? 'Điểm hay ngập theo báo chí, tình trạng hiện tại là mô phỏng'
        : 'Điểm ngập nhóm tổng hợp từ báo chí',
    channel: r.photo ? 'Báo cáo người dân qua website' : 'Dữ liệu nhóm tổng hợp',
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

const isPublic = (r) => r.publicationStatus === 'public' && r.floodCondition !== 'confirmed-clear'

export async function listAllReports(signal) {
  const body = await http(`${server}/api/flood-points?status=${ALL_STATUS}&limit=1000`, { signal })
  return body.data.map(toReport)
}

async function getDetail(id, signal) {
  try {
    const body = await http(`${server}/api/flood-points/${encodeURIComponent(id)}`, { signal })
    return toReport(body.data)
  } catch (err) {
    if (err.status === 404) return null
    throw err
  }
}

/* ---------- Bản đồ, điểm ngập, đường bị ảnh hưởng ---------- */
export async function getFloodPoints({ signal } = {}) {
  const all = await listAllReports(signal)
  return { items: all.filter(isPublic).map(toPoint), fetchedAt: new Date().toISOString(), dataMode: 'live' }
}

export async function getFloodPoint(id, { signal } = {}) {
  const r = await getDetail(id, signal)
  if (!r || r.publicationStatus !== 'public') return null
  const all = await listAllReports(signal)
  const related = all
    .filter((x) => x.id !== id && isPublic(x) && x.area === r.area)
    .slice(0, 3)
    .map((x) => ({ id: x.id, place: x.place, severity: x.severity, observedAt: x.observedAt }))
  return { ...toPoint(r), related }
}

export async function getHistoryPoints() {
  const body = await http(`${server}/api/flood-prone?minEvents=1`)
  return body.data.map((c) => ({
    id: c.key,
    place: c.street || 'Khu vực hay ngập',
    area: WARD_NAMES[c.wardId] || null,
    lat: c.centerLat,
    lng: c.centerLng,
    count: c.eventCount,
    period: 'Theo dữ liệu nhóm đã ghi nhận',
    lastSeen: c.lastFloodAt,
    source: 'Báo cáo người dân và dữ liệu điểm ngập của nhóm'
  }))
}

export async function getAffectedRoads() {
  const { items } = await getFloodPoints()
  const roads = new Map()
  for (const p of items) {
    // Điểm không có tên đường (người dân tự mô tả vị trí) để ở mục "chưa gắn với đoạn đường"
    if (p.floodCondition !== 'active' || !p.street) continue
    const name = p.street
    const cur = roads.get(name)
    const reportIds = [...(cur?.reportIds || []), p.id]
    if (cur && SEV_RANK[cur.severity] <= SEV_RANK[p.severity]) { cur.reportIds = reportIds; continue }
    roads.set(name, {
      id: `rd-${p.id}`,
      name,
      from: null,
      to: null,
      severity: p.severity,
      source: p.photo ? 'Báo cáo người dân' : 'Dữ liệu nhóm tổng hợp',
      observedAt: p.observedAt,
      hasGeometry: false,
      dataMode: p.dataMode,
      reportId: p.id,
      reportIds,
      lat: p.lat,
      lng: p.lng
    })
  }
  return [...roads.values()]
}

/* ---------- Dự báo (NV5) ---------- */
const nv5Time = (t) => (t && t.length === 16 ? `${t}:00+07:00` : t)

// Vùng nhỏ quanh tâm khu vực hay ngập để tô trên bản đồ (khoảng 400 m)
const square = (lat, lng, d = 0.0036) => [[lat + d, lng - d], [lat + d, lng + d], [lat - d, lng + d], [lat - d, lng - d]]

export async function getForecasts() {
  const scenario = getDemoTools().rainScenario || ''
  let results = []

  if (scenario) {
    // Kịch bản mưa mô phỏng của NV5 cho 3 khu vực hay ngập nhất
    const prone = (await getHistoryPoints()).sort((a, b) => b.count - a.count).slice(0, 3)
    for (const c of prone) {
      const body = await http(`${forecast}/demo/forecast?scenario=${scenario}&lat=${c.lat}&lng=${c.lng}`)
      const res = body.results[0]
      if (res) results.push({ ...res, point: { ...res.point, id: c.id, duong: c.place, area: c.area, lat: c.lat, lng: c.lng } })
    }
  } else {
    const body = await http(`${forecast}/forecast`)
    results = body.results.map((r) => ({ ...r, point: { ...r.point, area: WARD_NAMES[r.point.phuong] || null } }))
    // Máy chủ NV5 chạy nhưng không tải được Open-Meteo (thường do mất Internet)
    if (results.length && results.every((r) => r.error || !r.hourly?.length)) {
      const err = new Error('Open-Meteo không trả dữ liệu')
      err.hint = 'Máy chủ dự báo chưa lấy được lượng mưa từ Open-Meteo (cần Internet). Bấm Thử lại sau, hoặc vào Tùy chọn chọn kịch bản mưa mô phỏng để trình diễn.'
      throw err
    }
  }

  const mode = scenario ? 'demo' : 'live'
  const items = []
  for (const r of results) {
    if (!Number.isFinite(r.point.lat)) continue
    for (const iv of r.intervals || []) {
      const from = new Date(nv5Time(iv.start)).getTime()
      const to = new Date(nv5Time(iv.end)).getTime()
      // Mưa từng giờ quanh khoảng nguy cơ để vẽ cột
      const rainSeries = (r.hourly || [])
        .filter((h) => { const t = new Date(nv5Time(h.time)).getTime(); return t >= from - 2 * 3600_000 && t <= to + 3600_000 })
        .slice(0, 12)
        .map((h) => ({ at: nv5Time(h.time), mm: h.precipitation ?? 0, probability: h.probability ?? 0 }))
      items.push({
        id: `fc-${r.point.id}-${iv.start}`,
        title: `Dự báo nguy cơ ngập – ${r.point.duong || r.point.area || 'khu vực hay ngập'}`,
        place: r.point.duong || null,
        area: r.point.area || null,
        level: NV5_LEVEL[iv.level] || 'light',
        issuedAt: r.fetchedAt || new Date().toISOString(),
        validFrom: nv5Time(iv.start),
        validTo: nv5Time(iv.end),
        rain: { amount: `${iv.maxRain3h} mm`, window: '3 giờ', probability: iv.maxProbability ?? '—' },
        rainSeries,
        basis: [
          scenario ? 'Lượng mưa theo kịch bản mô phỏng của NV5' : 'Lượng mưa dự báo theo giờ từ Open-Meteo',
          iv.reason,
          'Ngưỡng nhóm dùng: 15 / 30 / 50 mm trong 3 giờ'
        ],
        ruleVersion: 'Quy tắc NV5',
        dataMode: mode,
        polygon: square(r.point.lat, r.point.lng)
      })
    }
  }
  items.sort((a, b) => new Date(a.validFrom) - new Date(b.validFrom) || SEV_RANK[a.level] - SEV_RANK[b.level])

  // Mưa 12 giờ tới tại khu vực hay ngập đầu tiên (chỉ khi dùng dự báo thật)
  const now = Date.now() - 3600_000
  const first = results.find((r) => r.hourly?.length)
  const rain = scenario || !first ? null : first.hourly
    .filter((h) => new Date(nv5Time(h.time)).getTime() >= now)
    .slice(0, 12)
    .map((h) => ({ at: nv5Time(h.time), mm: h.precipitation ?? 0, probability: h.probability ?? 0 }))

  return {
    items,
    rain,
    rainPlace: first?.point?.duong || first?.point?.area || null,
    rainSource: scenario ? 'kịch bản mưa mô phỏng của NV5 (không phải dự báo thật)' : 'Open-Meteo, qua máy chủ dự báo NV5',
    rainMode: scenario ? 'sample' : 'live',
    fetchedAt: new Date().toISOString()
  }
}

/* ---------- Nguồn dữ liệu ---------- */
async function ping(url) {
  try { return await http(url) } catch (_) { return null }
}

export async function getDataSources() {
  const [nv4, nv3, nv5, fc] = await Promise.all([
    ping(`${server}/api/health`),
    ping(`${ai}/api/health`),
    ping(`${forecast}/demo/info`),
    ping(`${forecast}/forecast`)
  ])
  const rainOk = Boolean(fc?.results?.some((r) => r.hourly?.length))
  const now = new Date().toISOString()
  const aiMock = nv3 && (nv3.mode === 'mock' || nv3.mock === true)
  return [
    { id: 'src-01', name: 'Báo cáo người dân qua website (NV4)', area: 'TP. Đồng Nai', status: nv4 ? 'connected' : 'offline', mode: nv4 ? 'live' : 'offline', lastReceived: nv4 ? now : null, note: 'Lưu trong cơ sở dữ liệu SQLite của máy chủ NV4' },
    { id: 'src-02', name: 'AI phân tích ảnh (Gemini, NV3)', area: 'Toàn bộ', status: nv3 ? 'connected' : 'offline', mode: nv3 ? (aiMock ? 'demo' : 'live') : 'offline', lastReceived: nv3 ? now : null, note: aiMock ? 'Đang chạy chế độ mock, chưa gọi Gemini' : 'Gọi Google Gemini qua máy chủ NV3' },
    {
      id: 'src-03', name: 'Lượng mưa Open-Meteo (NV5)', area: 'Các khu vực hay ngập',
      status: !nv5 ? 'offline' : rainOk ? 'connected' : 'error',
      mode: rainOk ? 'live' : 'offline',
      lastReceived: rainOk ? fc.generatedAt || now : null,
      note: !nv5 ? 'Máy chủ dự báo NV5 chưa chạy' : rainOk ? 'Mưa theo giờ 3 ngày tới, máy chủ NV5 giữ 20 phút' : 'Máy chủ NV5 chạy nhưng chưa tải được Open-Meteo (cần Internet)'
    },
    { id: 'src-04', name: 'Điểm ngập tổng hợp từ báo chí (NV6)', area: 'Khu vực Biên Hòa cũ', status: 'connected', mode: 'live', lastReceived: null, note: 'Toạ độ ước lượng, đang kiểm tra lại trên bản đồ' },
    { id: 'src-05', name: 'Trạm đo mực nước', area: '—', status: 'offline', mode: 'offline', lastReceived: null, note: 'Chưa có nguồn được phép sử dụng' },
    { id: 'src-06', name: 'Dữ liệu triều cường', area: '—', status: 'offline', mode: 'offline', lastReceived: null, note: 'Chưa kết nối' }
  ]
}

/* ---------- AI phân tích ảnh (NV3) ---------- */
export async function analyzePhoto(photoMeta, { signal } = {}) {
  if (!photoMeta?.dataUrl) throw new NetworkError('Chưa có ảnh để phân tích')
  const form = new FormData()
  form.append('image', await toBlob(photoMeta.dataUrl), 'anh.jpg')
  let res
  try {
    res = await http(`${ai}/api/analyze-flood`, { method: 'POST', body: form, signal })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new NetworkError('Chưa kết nối được dịch vụ phân tích ảnh')
  }
  const dataMode = res.mode === 'mock' ? 'demo' : 'live'
  if (res.status === 'flooded') {
    return { status: 'done', outcome: 'flood', level: SEV[res.severity] || null, note: res.summary || null, dataMode }
  }
  if (res.status === 'not_flooded') {
    return { status: 'done', outcome: 'no-sign', level: null, note: res.summary || null, dataMode }
  }
  return { status: 'insufficient', outcome: 'insufficient', level: null, note: res.summary || 'Ảnh chưa đủ rõ để ước lượng mức ngập.', dataMode }
}

/* ---------- Báo cáo của người dân (NV4) ---------- */
const submitted = new Map() // requestId -> báo cáo đã gửi, để bấm gửi lại không tạo trùng

export async function submitReport(payload, { requestId }) {
  if (submitted.has(requestId)) return submitted.get(requestId)
  if (getDemoTools().networkFail) throw new NetworkError()
  const session = getSession()
  const form = new FormData()
  form.append('image', await toBlob(payload.photo), 'bao-ngap.jpg')
  form.append('lat', payload.lat)
  form.append('lng', payload.lng)
  // Ghim tay trên bản đồ thì không có sai số GPS, gửi mức tối đa NV4 cho phép (100 m)
  form.append('accuracyM', payload.accuracy ?? 100)
  form.append('capturedAt', payload.capturedAt || payload.observedAt)
  form.append('deviceId', deviceId())
  // NV4 tính điểm tin cậy: ghim tay thấp nhất, ảnh có sẵn thấp hơn ảnh chụp
  const source = payload.locationSource !== 'gps' ? 'manual-pin' : payload.photoSource === 'library' ? 'gallery' : 'camera'
  form.append('source', source)
  form.append('photoSource', payload.photoSource === 'library' ? 'library' : 'camera')
  if (payload.place) form.append('address', payload.place.slice(0, 200))
  if (payload.observation?.note) form.append('note', payload.observation.note.slice(0, 200))

  const body = await http(`${server}/api/reports`, { method: 'POST', body: form })
  const p = body.data.floodPoint
  if (!p) {
    // AI không thấy ngập: NV4 vẫn lưu báo cáo để kiểm tra lại nhưng không tạo điểm trên bản đồ
    const report = {
      id: body.data.report?.id || 'Đã ghi nhận',
      place: payload.place,
      receivedAt: new Date().toISOString(),
      ownerId: session?.id,
      verificationStatus: 'invalid',
      processingStatus: 'closed',
      publicationStatus: 'private',
      notOnMap: true,
      serverMessage: body.data.message
    }
    submitted.set(requestId, report)
    return report
  }
  local.set(MY_KEY, [{ id: p.id, at: new Date().toISOString() }, ...myReports().filter((m) => m.id !== p.id)].slice(0, 50))

  const detail = await getDetail(p.id)
  const report = {
    ...detail,
    receivedAt: new Date().toISOString(),
    ownerId: session?.id,
    observation: payload.observation || detail.observation,
    serverMessage: body.data.message
  }
  submitted.set(requestId, report)
  return report
}

export async function getMyReports({ signal } = {}) {
  const items = []
  for (const m of myReports()) {
    const r = await getDetail(m.id, signal)
    if (r) items.push({ ...r, receivedAt: m.at })
  }
  return { items, fetchedAt: new Date().toISOString() }
}

export async function getReport(id, { signal } = {}) {
  const s = getSession()
  const r = await getDetail(id, signal)
  if (!r) return null
  if (s.role !== 'admin' && r.ownerId !== s.id) throw new AuthError('Bạn không có quyền xem báo cáo này')
  return r
}

/* ---------- Xác nhận vẫn ngập / hết ngập (NV4) ---------- */
function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Thiết bị không hỗ trợ định vị'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => reject(new Error('Cần bật định vị để xác nhận (bạn phải ở gần điểm ngập khoảng 300 m).')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  })
}

export async function submitConditionObservation(pointId, { still }) {
  const pos = await currentPosition()
  await postJson(`${server}/api/flood-points/${encodeURIComponent(pointId)}/confirm`, {
    type: still ? 'still' : 'ended',
    deviceId: deviceId(),
    lat: pos.latitude,
    lng: pos.longitude
  })
  return toPoint(await getDetail(pointId))
}

/* ---------- Trang phường (NV4 ward-action) ---------- */
async function wardAction(id, data) {
  const s = getSession()
  try {
    const body = await postJson(`${server}/api/flood-points/${encodeURIComponent(id)}/ward-action`, {
      actor: s?.role === 'admin' ? s.name : 'Người gửi',
      ...data
    })
    return toReport(body.data)
  } catch (err) {
    if (err.status === 409 && err.body?.data) throw new ConflictError(toReport(err.body.data))
    throw err
  }
}

export const updateReportStatus = (id, { action, reason, version, closeOutcome }) =>
  wardAction(id, { action, reason: reason || undefined, version, closeOutcome: closeOutcome || undefined })

export const addAdminNote = (id, { text, version }) =>
  wardAction(id, { action: 'note', reason: text, version })

export const confirmFloodCondition = (id, { condition, note, version }) =>
  wardAction(id, { action: condition === 'confirmed-clear' ? 'confirm-clear' : 'confirm-active', reason: note || undefined, version })

export const addReportInfo = (id, { note }) =>
  wardAction(id, { action: 'add-info', reason: note || undefined })
