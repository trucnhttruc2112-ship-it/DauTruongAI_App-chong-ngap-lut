import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import L from 'leaflet'

import { FloodMap } from './FloodMap.jsx'
import { PlaceSearch } from './PlaceSearch.jsx'
import { FloodList } from './FloodList.jsx'
import { FloodDetailPanel } from './FloodDetailPanel.jsx'
import { FilterSheet, ActiveFilterChips, FilterFields } from './Filters.jsx'
import { LayerControl, MapToolbar, AlertBanner, useLayerCount, MapErrorNotice } from './MapControls.jsx'
import { useMapState, countActiveFilters, DEFAULT_FILTERS } from './mapState.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { EmptyState, ListSkeleton, Notice, ResourceError } from '../../components/ui/Feedback.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { useResource, useIsDesktop, useIsTablet } from '../../hooks/useData.js'
import {
  getFloodPoints, getHistoryPoints, getForecasts, getAffectedRoads,
  filterPoints, isInsideSupportedArea
} from '../../services/api.js'
import { APP_CONFIG } from '../../app/config.js'
import { DEFAULT_AREA_NAME } from '../../locales/vi/labels.js'
import { formatShort } from '../../utils/time.js'

export function MapPage() {
  const { id: routeId } = useParams()
  const navigate = useNavigate()
  const { search } = useLocation()
  const forecastId = new URLSearchParams(search).get('du-bao')
  const state = useMapState()
  const {
    filters, setFilters, resetFilters, layers, setLayers, sheet, setSheet,
    userLocation, setUserLocation, appliedBounds, setAppliedBounds, view
  } = state

  const isDesktop = useIsDesktop()
  const isTablet = useIsTablet()

  const [panelOpen, setPanelOpen] = useState(true)      // cột danh sách máy tính/bảng
  const [filterOpen, setFilterOpen] = useState(false)   // bảng lọc (điện thoại)
  const [layersOpen, setLayersOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [moved, setMoved] = useState(false)             // hiện nút Tìm trong khu vực này
  const [tileFail, setTileFail] = useState(false)
  const [notice, setNotice] = useState(null)
  const mapRef = useRef(null)
  const listRef = useRef(null)
  const detailHead = useRef(null)

  /* ---------------- Dữ liệu ---------------- */
  const pointsRes = useResource(({ signal }) => getFloodPoints({ signal }), [], { topic: 'reports', refreshMs: 0 })
  const historyRes = useResource(getHistoryPoints, [])
  const forecastRes = useResource(getForecasts, [])
  const roadsRes = useResource(getAffectedRoads, [])

  const allPoints = pointsRes.data?.items || []
  const selectedForecast = forecastRes.data?.items.find((f) => f.id === forecastId)

  useEffect(() => {
    if (forecastId) setLayers((previous) => ({ ...previous, forecast: true }))
  }, [forecastId, setLayers])

  /* Bộ lọc: mức ngập, thời gian, khu vực, xác minh + phạm vi bản đồ đã áp dụng */
  const visiblePoints = useMemo(() => {
    let pts = filterPoints(allPoints, filters)
    if (appliedBounds) {
      const b = L.latLngBounds(appliedBounds)
      pts = pts.filter((p) => b.contains([p.lat, p.lng]))
    }
    const rank = { severe: 0, moderate: 1, light: 2, unknown: 3 }
    return [...pts].sort((a, b) =>
      rank[a.severity] - rank[b.severity] || new Date(b.observedAt) - new Date(a.observedAt))
  }, [allPoints, filters, appliedBounds])

  const selected = useMemo(
    () => visiblePoints.find((p) => p.id === routeId) || allPoints.find((p) => p.id === routeId),
    [visiblePoints, allPoints, routeId]
  )

  /* Cảnh báo liên quan quan trọng nhất */
  const topAlert = useMemo(() => {
    const sevRank = { severe: 0, moderate: 1, light: 2 }
    const fromPoints = visiblePoints
      .filter((p) => ['severe', 'moderate'].includes(p.severity) && p.floodCondition === 'active')
      .sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || new Date(b.observedAt) - new Date(a.observedAt))
      .map((p) => ({
        id: p.id, level: p.severity, title: `${p.place}`,
        summary: `${p.severity === 'severe' ? 'Ngập nặng' : 'Ngập vừa'} đang được ghi nhận`,
        dataMode: p.dataMode
      }))
    const fc = (forecastRes.data?.items || []).map((f) => ({
      id: f.id, level: f.level, title: f.title,
      summary: `Hiệu lực ${new Date(f.validFrom).getHours()}–${new Date(f.validTo).getHours()} giờ tới`,
      dataMode: f.dataMode
    }))
    return [...fromPoints, ...fc][0] || null
  }, [visiblePoints, forecastRes.data])

  /* ---------------- Tương tác ---------------- */

  const openPoint = useCallback((pointId, { fromList } = {}) => {
    navigate(`/diem-ngap/${pointId}${search}`, { state: { fromList: !!fromList } })
    if (!isDesktop) setSheet('half')
    if (isDesktop && !panelOpen) setPanelOpen(true)
  }, [navigate, search, isDesktop, panelOpen])

  const closeDetail = useCallback(() => {
    navigate(`/${search}`)
  }, [navigate, search])

  // Điểm từ liên kết ngoài: đưa về giữa bản đồ nếu nằm ngoài vùng nhìn
  useEffect(() => {
    if (!selected || !mapRef.current) return
    const b = mapRef.current.getBounds?.()
    if (b && !b.contains([selected.lat, selected.lng])) {
      mapRef.current.flyTo(selected.lat, selected.lng)
    }
  }, [selected])

  useEffect(() => { if (selected) requestAnimationFrame(() => detailHead.current?.focus()) }, [selected?.id]) // eslint-disable-line

  // Cập nhật vùng nhìn (không tự kéo người dùng khi dữ liệu mới về)
  const saveView = useCallback((v) => { view.current = v }, [view])

  const onMoveEnd = useCallback(() => {
    setMoved(true)
  }, [])

  const searchThisArea = useCallback(() => {
    setMoved(false)
    setAppliedBounds(mapRef.current?.getBounds())
    setSheet('half')
  }, [setAppliedBounds, setSheet])

  /** Vị trí của tôi: giải thích rồi mới xin quyền; từ chối vẫn tìm được địa điểm (UX02). */
  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setNotice({ tone: 'warning', title: 'Thiết bị không hỗ trợ định vị', text: 'Bạn vẫn có thể tìm tên đường hoặc chọn khu vực trên bản đồ.' })
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setUserLocation({ lat: latitude, lng: longitude, accuracy })
        mapRef.current?.flyTo(latitude, longitude, Math.max(view.current.zoom, 16))
        setLocating(false)
        if (!isInsideSupportedArea(latitude, longitude)) {
          setNotice({ tone: 'info', title: 'Ngoài khu vực có dữ liệu', text: 'Vị trí của bạn chưa thuộc khu vực có dữ liệu của dự án. Bản đồ vẫn xem được.' })
        }
      },
      () => {
        setLocating(false)
        setNotice({ tone: 'warning', title: 'Chưa lấy được vị trí của bạn', text: 'Quyền định vị bị từ chối hoặc hết thời gian chờ. Bạn vẫn tìm tên đường hoặc chọn khu vực được.' })
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }
    )
  }, [setUserLocation, view])

  const pickPlace = useCallback((p) => {
    if (p.outside) {
      setNotice({ tone: 'info', title: 'Địa điểm này chưa thuộc khu vực có dữ liệu của dự án', text: 'Không thể khẳng định địa điểm đó có ngập hay không.' })
      return
    }
    setNotice(null)
    mapRef.current?.flyTo(p.lat, p.lng, p.zoom)
  }, [])

  const onShowRoads = useCallback(() => {
    navigate('/duong-bi-anh-huong')
  }, [navigate])

  const nFilters = countActiveFilters(filters)
  const nLayers = useLayerCount(layers)
  const detailOpen = !!routeId

  /* Điện thoại: mở chi tiết thì nâng bảng; đóng thì về mức trước */
  useEffect(() => {
    if (!isDesktop && !isTablet) {
      if (detailOpen && sheet === 'collapsed') setSheet('half')
    }
  }, [detailOpen, isDesktop, isTablet]) // eslint-disable-line

  const emptyState = useMemo(() => {
    if (pointsRes.loading) return null
    if (appliedBounds) {
      return {
        title: 'Chưa có báo cáo ngập trong khu vực này',
        desc: 'Hãy thử mở rộng khu vực nhìn hoặc báo ngập nếu bạn thấy nước.',
        actions: <Button variant="secondary" onClick={() => setAppliedBounds(null)}>Xem toàn bộ khu vực</Button>
      }
    }
    return {
      title: 'Chưa có báo cáo phù hợp bộ lọc',
      desc: 'Có thể không có báo cáo nào trong khoảng thời gian hoặc mức ngập đã chọn.',
      actions: <Button variant="secondary" onClick={resetFilters}>Xóa bộ lọc</Button>
    }
  }, [pointsRes.loading, appliedBounds, setAppliedBounds, resetFilters])

  /* ---------------- Nội dung cột / bảng đáy ---------------- */

  const listBlock = (
    <div className="flood-column">
      {nFilters > 0 ? <ActiveFilterChips value={filters} onChange={setFilters} /> : null}
      <div className="flood-column__head">
        <h2 className="flood-column__title">
          Điểm ngập <span className="muted">({visiblePoints.length})</span>
        </h2>
        <Button size="sm" variant="ghost" icon="filter" onClick={() => setFilterOpen(true)}>
          Lọc{nFilters ? ` (${nFilters})` : ''}
        </Button>
      </div>
      <p className="small muted flood-column__scope">
        {appliedBounds ? 'Trong khu vực bản đồ đang xem' : 'Toàn bộ khu vực dự án'} · {filters.time === 'all' ? 'tất cả thời gian' : 'theo bộ lọc thời gian'}
      </p>
      <ResourceError resource={pointsRes} label="danh sách điểm ngập" />
      {layers.forecast ? <ResourceError resource={forecastRes} label="dự báo trên bản đồ" /> : null}
      {forecastId && !forecastRes.loading && !forecastRes.error && !selectedForecast ? (
        <Notice tone="info" title="Không tìm thấy vùng dự báo" actions={<Button size="sm" to="/canh-bao?tab=forecast">Xem dự báo hiện có</Button>}>
          Dự báo này không có trong dữ liệu hiện tại.
        </Notice>
      ) : null}
      {selectedForecast ? <Notice title={`Dự báo: ${selectedForecast.area || selectedForecast.title}`} actions={<Button size="sm" to="/canh-bao?tab=forecast">Về dự báo</Button>}>
        Hiệu lực {formatShort(selectedForecast.validFrom)} – {formatShort(selectedForecast.validTo)}. {layers.forecast ? 'Vùng dự báo được tô nét đứt trên bản đồ.' : 'Lớp dự báo đang tắt; mở mục Lớp để xem lại.'}
      </Notice> : null}
      {pointsRes.loading ? <ListSkeleton rows={4} /> :
        visiblePoints.length ? (
          <FloodList points={visiblePoints} selectedId={routeId} onSelect={(id) => openPoint(id, { fromList: true })} listRef={listRef} />
        ) : !pointsRes.error ? (
          <EmptyState icon={appliedBounds ? 'map' : 'filter'} title={emptyState?.title} description={emptyState?.desc} actions={emptyState?.actions} compact />
        ) : null}
    </div>
  )

  const detailBlock = detailOpen && pointsRes.error && !selected ? (
    <div className="stack"><Button onClick={closeDetail}>Về danh sách</Button><ResourceError resource={pointsRes} label="chi tiết điểm ngập" /></div>
  ) : detailOpen ? (
    <FloodDetailPanel
      point={selected}
      loading={pointsRes.loading && !selected}
      onClose={closeDetail}
      onShowRoads={onShowRoads}
      headingRef={detailHead}
    />
  ) : null

  const searchBlock = (
    <PlaceSearch onPick={pickPlace} />
  )

  const controls = (
    <MapToolbar
      onLayers={() => setLayersOpen(true)}
      onLocate={locate}
      locating={locating}
      onZoomIn={() => mapRef.current?.zoomIn()}
      onZoomOut={() => mapRef.current?.zoomOut()}
      activeLayerCount={nLayers}
    />
  )

  const mapEl = (
    <>
      <FloodMap
        ref={mapRef}
        points={visiblePoints}
        selectedId={routeId}
        onSelect={(id) => openPoint(id)}
        layers={layers}
        history={historyRes.data || []}
        forecasts={forecastRes.data?.items || []}
        selectedForecastId={forecastId}
        roads={roadsRes.data || []}
        userLocation={userLocation}
        initialView={{ center: view.current.center, zoom: view.current.zoom }}
        onViewChange={saveView}
        onMoveEnd={onMoveEnd}
        onTileError={() => setTileFail(true)}
      />
      {moved ? (
        <button type="button" className="area-search-btn" onClick={searchThisArea}>
          <Icon name="search" size={16} /> Tìm trong khu vực này
        </button>
      ) : null}
      {controls}
      {tileFail && (isDesktop || isTablet) ? <MapErrorNotice onRetry={() => { setTileFail(false); mapRef.current?.retryTiles() }} /> : null}
      {isDesktop ? null : (
        detailOpen ? null : (
          <Button
            variant="primary"
            size="md"
            icon="camera"
            className="fab-report"
            to={sheet === 'full' ? undefined : '/bao-ngap'}
            onClick={sheet === 'full' ? () => setSheet('half') : undefined}
            aria-hidden={sheet === 'full'}
            tabIndex={sheet === 'full' ? -1 : 0}
            disabled={sheet === 'full'}
          >
            Báo ngập
          </Button>
        )
      )}
      {!isDesktop && !isTablet ? (
        <div className={`bottom-sheet bottom-sheet--${sheet}`} role="region" aria-label="Danh sách điểm ngập">
          <div className="bottom-sheet__bar">
            <button type="button" className="bottom-sheet__toggle" onClick={() => setSheet(sheet === 'collapsed' ? 'half' : sheet === 'half' ? 'full' : 'collapsed')}>
              <span className="bottom-sheet__title">{detailOpen ? 'Chi tiết điểm ngập' : `Danh sách điểm ngập (${visiblePoints.length})`}</span>
              <span className="bottom-sheet__hint">
                {sheet === 'collapsed' ? 'Mở danh sách' : sheet === 'half' ? 'Mở đầy đủ' : 'Thu gọn'}
                <Icon name={sheet === 'collapsed' ? 'chevron-up' : sheet === 'half' ? 'chevron-up' : 'chevron-down'} size={16} />
              </span>
            </button>
          </div>
          <div className="bottom-sheet__content">
            {detailOpen ? detailBlock : listBlock}
          </div>
        </div>
      ) : null}
    </>
  )

  return (
    <div className="map-page">
      {/* Máy tính: thanh cảnh báo phía trên, cột trái là danh sách, phải là bản đồ */}
      {isDesktop || isTablet ? (
        <div className="map-desktop">
          <div className="map-desktop__side">
            {searchBlock}
            <div className="map-desktop__alert">
              {topAlert ? (
                <AlertBanner alert={topAlert} collapsed={state.alertCollapsed} onToggle={() => state.setAlertCollapsed(!state.alertCollapsed)} />
              ) : null}
            </div>
            {panelOpen ? (
              <>
                {detailOpen ? detailBlock : (
                  <>
                    <FilterFields value={filters} onChange={setFilters} />
                    {nFilters > 0 ? (
                      <button type="button" className="link-btn" onClick={resetFilters}>Xóa bộ lọc</button>
                    ) : null}
                    {listBlock}
                  </>
                )}
              </>
            ) : (
              <EmptyState compact icon="map" title="Danh sách đã đóng" description="Mở lại để xem các điểm ngập theo bộ lọc." actions={<Button size="sm" onClick={() => setPanelOpen(true)}>Mở danh sách</Button>} />
            )}
          </div>
          <div className="map-desktop__map">
            {mapEl}
          </div>
          {isTablet && !isDesktop ? null : null}
        </div>
      ) : (
        /* Điện thoại: tên khu vực + tìm kiếm ở trên, bản đồ là nội dung chính, bảng đáy phía dưới */
        <div className="map-mobile">
          <div className="map-mobile__top">
            <div className="map-mobile__area">
              <Icon name="pin" size={16} />
              <span>{DEFAULT_AREA_NAME}</span>
            </div>
            {searchBlock}
            <div className="map-mobile__alert">
              {topAlert ? (
                <AlertBanner alert={topAlert} collapsed={state.alertCollapsed} onToggle={() => state.setAlertCollapsed(!state.alertCollapsed)} />
              ) : null}
            </div>
            {tileFail ? <MapErrorNotice onRetry={() => { setTileFail(false); mapRef.current?.retryTiles() }} /> : null}
          </div>
          <div className="map-mobile__map">
            {mapEl}
          </div>
        </div>
      )}

      {notice ? (
        <div className="map-notice">
          <Notice tone={notice.tone} title={notice.title} onClose={() => setNotice(null)}>
            {notice.text}
          </Notice>
        </div>
      ) : null}

      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} value={filters} onApply={setFilters} />
      <LayerControl open={layersOpen} onClose={() => setLayersOpen(false)} layers={layers} onChange={setLayers} />
    </div>
  )
}
