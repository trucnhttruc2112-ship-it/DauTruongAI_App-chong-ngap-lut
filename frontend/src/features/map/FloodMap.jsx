import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import L from 'leaflet'
import { APP_CONFIG } from '../../app/config.js'
import { iconSvgString, SEVERITY_ICON } from '../../components/ui/Icon.jsx'
import { SEVERITY } from '../../locales/vi/labels.js'

/** Màu nét/tô cho lớp bản đồ – màu mức ngập, không đảo bằng CSS ở chế độ tối. */
export const SEVERITY_COLOR = { light: '#CA8A04', moderate: '#EA580C', severe: '#DC2626', unknown: '#64748B' }

function pointIcon(p, selected) {
  const icon = iconSvgString(SEVERITY_ICON[p.severity], 16, '#fff')
  return L.divIcon({
    className: '',
    html: `<span class="fm-marker fm-marker--${p.severity} ${selected ? 'is-selected' : ''}">${icon}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  })
}

function clusterIcon(count, worst) {
  return L.divIcon({
    className: '',
    html: `<span class="fm-cluster fm-cluster--${worst}"><span>${count}</span></span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21]
  })
}

function historyIcon() {
  return L.divIcon({
    className: '',
    html: `<span class="fm-history">${iconSvgString('history', 15, 'currentColor')}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  })
}

const SEV_RANK = { severe: 3, moderate: 2, light: 1, unknown: 0 }

/** Gộp cụm đơn giản theo lưới điểm ảnh – đủ cho dữ liệu demo, không cần thư viện thêm. */
function clusterPoints(map, points, cellPx = 56) {
  const zoom = map.getZoom()
  if (zoom >= 16) return points.map((p) => ({ type: 'point', point: p }))
  const cells = new Map()
  for (const p of points) {
    const pt = map.project([p.lat, p.lng], zoom)
    const key = `${Math.floor(pt.x / cellPx)}:${Math.floor(pt.y / cellPx)}`
    if (!cells.has(key)) cells.set(key, [])
    cells.get(key).push(p)
  }
  const out = []
  cells.forEach((items) => {
    if (items.length === 1) { out.push({ type: 'point', point: items[0] }); return }
    const lat = items.reduce((s, p) => s + p.lat, 0) / items.length
    const lng = items.reduce((s, p) => s + p.lng, 0) / items.length
    const worst = items.reduce((w, p) => (SEV_RANK[p.severity] > SEV_RANK[w] ? p.severity : w), 'unknown')
    out.push({ type: 'cluster', lat, lng, items, worst })
  })
  return out
}

/**
 * Bản đồ Leaflet: khởi tạo MỘT lần, dọn khi tháo; chỉ cập nhật lớp/marker cần đổi.
 * DOM do Leaflet quản lý nằm trong vùng riêng (mục 13.2).
 */
export const FloodMap = forwardRef(function FloodMap(
  {
    points = [],
    selectedId,
    onSelect,
    layers = { active: true },
    history = [],
    forecasts = [],
    selectedForecastId,
    roads = [],
    userLocation,
    initialView,
    onViewChange,
    onMoveEnd,
    onTileError,
    tileFail = false,
    className = '',
    label = 'Bản đồ điểm ngập'
  },
  ref
) {
  const el = useRef(null)
  const map = useRef(null)
  const groups = useRef({})
  const tileErrors = useRef(0)
  const tileLayer = useRef(null)
  const [zoomTick, setZoomTick] = useState(0)
  const cb = useRef({})
  cb.current = { onSelect, onViewChange, onMoveEnd, onTileError }

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, zoom) => map.current?.flyTo([lat, lng], zoom ?? Math.max(map.current.getZoom(), 16), { duration: 0.5 }),
    fitBounds: (b) => map.current?.fitBounds(b, { padding: [40, 40] }),
    getBounds: () => map.current?.getBounds(),
    invalidate: () => map.current?.invalidateSize(),
    zoomIn: () => map.current?.zoomIn(),
    zoomOut: () => map.current?.zoomOut(),
    getMap: () => map.current,
    retryTiles: () => { tileErrors.current = 0; tileLayer.current?.redraw() }
  }), [])

  // Khởi tạo một lần
  useEffect(() => {
    const start = initialView || { center: APP_CONFIG.map.center, zoom: APP_CONFIG.map.zoom }
    const m = L.map(el.current, {
      center: start.center,
      zoom: start.zoom,
      minZoom: APP_CONFIG.map.minZoom,
      maxZoom: APP_CONFIG.map.maxZoom,
      zoomControl: false,
      attributionControl: true
    })
    m.attributionControl.setPrefix(false)
    const tiles = L.tileLayer(tileFail ? 'https://invalid.tile.local/{z}/{x}/{y}.png' : APP_CONFIG.map.tileUrl, {
      attribution: APP_CONFIG.map.attribution,
      maxZoom: APP_CONFIG.map.maxZoom
    })
    tiles.on('tileerror', () => {
      tileErrors.current += 1
      if (tileErrors.current === 4) cb.current.onTileError?.()
    })
    tiles.on('load', () => { tileErrors.current = 0 })
    tiles.addTo(m)
    tileLayer.current = tiles

    groups.current = {
      forecast: L.layerGroup().addTo(m),
      roads: L.layerGroup().addTo(m),
      history: L.layerGroup().addTo(m),
      active: L.layerGroup().addTo(m),
      user: L.layerGroup().addTo(m)
    }

    const moved = () => {
      const c = m.getCenter()
      cb.current.onViewChange?.({ center: [c.lat, c.lng], zoom: m.getZoom() })
    }
    m.on('moveend', moved)
    m.on('dragend', () => cb.current.onMoveEnd?.(m.getBounds()))
    m.on('zoomend', () => setZoomTick((t) => t + 1))

    map.current = m

    // Kích thước vùng bản đồ đổi → tính lại
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)

    return () => {
      ro.disconnect()
      m.off()
      m.remove()
      map.current = null
      tileLayer.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    tileErrors.current = 0
    tileLayer.current?.setUrl(tileFail ? 'https://invalid.tile.local/{z}/{x}/{y}.png' : APP_CONFIG.map.tileUrl)
  }, [tileFail])

  // Lớp Đang được báo ngập
  useEffect(() => {
    const m = map.current
    const g = groups.current.active
    if (!m || !g) return
    g.clearLayers()
    if (!layers.active) return
    const items = clusterPoints(m, points)
    for (const it of items) {
      if (it.type === 'cluster') {
        const mk = L.marker([it.lat, it.lng], {
          icon: clusterIcon(it.items.length, it.worst),
          keyboard: true,
          title: `${it.items.length} điểm ngập gần nhau – bấm để mở rộng`,
          alt: `${it.items.length} điểm ngập`
        })
        mk.on('click', () => {
          const b = L.latLngBounds(it.items.map((p) => [p.lat, p.lng]))
          m.fitBounds(b.pad(0.5), { maxZoom: 17 })
        })
        g.addLayer(mk)
      } else {
        const p = it.point
        const selected = p.id === selectedId
        const mk = L.marker([p.lat, p.lng], {
          icon: pointIcon(p, selected),
          keyboard: true,
          title: `${p.place} – ${SEVERITY[p.severity]}`,
          alt: `${p.place} – ${SEVERITY[p.severity]}`,
          zIndexOffset: selected ? 1000 : SEV_RANK[p.severity] * 10
        })
        mk.on('click', () => cb.current.onSelect?.(p.id))
        // Nhãn ngắn xuất hiện khi chọn hoặc đủ mức thu phóng
        if (selected || m.getZoom() >= 17) {
          mk.bindTooltip(p.place, { permanent: true, direction: 'top', offset: [0, -18], className: 'fm-label' })
        }
        g.addLayer(mk)
      }
    }
  }, [points, selectedId, layers.active, zoomTick])

  // Lớp Thường ngập (lịch sử) – biểu tượng và viền khác
  useEffect(() => {
    const g = groups.current.history
    if (!g) return
    g.clearLayers()
    if (!layers.history) return
    history.forEach((h) => {
      L.marker([h.lat, h.lng], { icon: historyIcon(), title: `Thường ngập: ${h.place}`, keyboard: true })
        .bindPopup(
          `<div class="fm-popup"><p class="fm-popup__kicker">Thường ngập · dữ liệu lịch sử</p>
           <p class="fm-popup__title">${h.place}</p>
           <p>${h.count} lần ghi nhận · ${h.period}</p>
           <p class="fm-popup__src">Nguồn: ${h.source}</p>
           <p class="fm-popup__note">Không có nghĩa đang ngập hiện tại.</p></div>`
        )
        .addTo(g)
    })
  }, [history, layers.history])

  // Lớp Nguy cơ dự báo – vùng nét đứt
  useEffect(() => {
    const g = groups.current.forecast
    if (!g) return
    g.clearLayers()
    if (!layers.forecast) return
    forecasts.forEach((f) => {
      if (!f.polygon) return
      L.polygon(f.polygon, {
        color: SEVERITY_COLOR[f.level],
        weight: f.id === selectedForecastId ? 4 : 2,
        dashArray: '6 6',
        fillColor: SEVERITY_COLOR[f.level],
        fillOpacity: f.id === selectedForecastId ? 0.22 : 0.1
      })
        .bindPopup(
          `<div class="fm-popup"><p class="fm-popup__kicker">Dự báo · Mô phỏng</p>
           <p class="fm-popup__title">${f.title}</p>
           <p>Mức: ${SEVERITY[f.level]}</p>
           <p class="fm-popup__src">Xem căn cứ tại trang Cảnh báo.</p></div>`
        )
        .addTo(g)
    })
  }, [forecasts, layers.forecast, selectedForecastId])

  const focusedForecast = forecasts.find((f) => f.id === selectedForecastId)
  const focusedId = focusedForecast?.id
  const focusedPolygon = focusedForecast?.polygon
  const lastFocused = useRef(null)
  useEffect(() => {
    if (!focusedId || !layers.forecast) { lastFocused.current = null; return }
    if (lastFocused.current === focusedId || !focusedPolygon?.length) return
    map.current?.fitBounds(focusedPolygon, { padding: [48, 48], maxZoom: 15 })
    lastFocused.current = focusedId
  }, [focusedId, focusedPolygon, layers.forecast])

  // Đường bị ảnh hưởng – chỉ đoạn có hình học xác nhận
  useEffect(() => {
    const g = groups.current.roads
    if (!g) return
    g.clearLayers()
    if (!layers.roads) return
    roads.filter((r) => r.hasGeometry).forEach((r) => {
      L.polyline(r.line, { color: '#ffffff', weight: 10, opacity: 0.9 }).addTo(g)
      L.polyline(r.line, { color: SEVERITY_COLOR[r.severity], weight: 6, opacity: 0.95 })
        .bindPopup(`<div class="fm-popup"><p class="fm-popup__title">${r.name}</p><p>${r.from} → ${r.to}</p><p>${SEVERITY[r.severity]}</p></div>`)
        .addTo(g)
    })
  }, [roads, layers.roads])

  // Vị trí của tôi + vòng độ chính xác
  useEffect(() => {
    const g = groups.current.user
    if (!g) return
    g.clearLayers()
    if (!userLocation) return
    if (userLocation.accuracy) {
      L.circle([userLocation.lat, userLocation.lng], {
        radius: userLocation.accuracy, color: '#1D4ED8', weight: 1, fillOpacity: 0.08
      }).addTo(g)
    }
    L.circleMarker([userLocation.lat, userLocation.lng], {
      radius: 8, color: '#ffffff', weight: 3, fillColor: '#1D4ED8', fillOpacity: 1
    }).bindTooltip('Vị trí của bạn').addTo(g)
  }, [userLocation])

  return (
    <div className={`flood-map ${className}`}>
      <div ref={el} className="flood-map__canvas" role="region" aria-label={label} />
    </div>
  )
})
