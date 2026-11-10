import { createContext, useContext, useMemo, useRef, useState, useCallback } from 'react'
import { APP_CONFIG } from '../../app/config.js'

/**
 * Trạng thái bản đồ dùng chung: bộ lọc, lớp bật, vùng đang xem, mức mở bảng đáy,
 * vị trí cuộn danh sách. Đặt ở khung trang để không mất khi mở/đóng chi tiết
 * hoặc chuyển sang trang khác rồi quay lại (mục 3, UX03).
 */
const MapStateContext = createContext(null)

export const DEFAULT_FILTERS = { severities: [], time: '24h', areas: [], verification: [] }
export const DEFAULT_LAYERS = { active: true, history: false, forecast: false, roads: false }

export function countActiveFilters(f) {
  return (f.severities.length ? 1 : 0) + (f.time !== '24h' ? 1 : 0) + (f.areas.length ? 1 : 0) + (f.verification.length ? 1 : 0)
}

export function MapStateProvider({ children }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [layers, setLayers] = useState(DEFAULT_LAYERS)
  const [sheet, setSheet] = useState('collapsed') // collapsed | half | full
  const [alertCollapsed, setAlertCollapsed] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  /** Vùng bản đồ đã áp dụng cho danh sách (cập nhật khi bấm "Tìm trong khu vực này") */
  const [appliedBounds, setAppliedBounds] = useState(null)
  const view = useRef({ center: APP_CONFIG.map.center, zoom: APP_CONFIG.map.zoom })
  const listScroll = useRef(0)

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), [])

  const value = useMemo(() => ({
    filters, setFilters, resetFilters,
    layers, setLayers,
    sheet, setSheet,
    alertCollapsed, setAlertCollapsed,
    userLocation, setUserLocation,
    appliedBounds, setAppliedBounds,
    view, listScroll
  }), [filters, layers, sheet, alertCollapsed, userLocation, appliedBounds, resetFilters])

  return <MapStateContext.Provider value={value}>{children}</MapStateContext.Provider>
}

export function useMapState() {
  const ctx = useContext(MapStateContext)
  if (!ctx) throw new Error('useMapState phải dùng trong MapStateProvider')
  return ctx
}
