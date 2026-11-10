import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { Notice, EmptyState, ListSkeleton, PageHeader, Tabs, ResourceError } from '../../components/ui/Feedback.jsx'
import { MapErrorNotice } from '../map/MapControls.jsx'
import { SeverityBadge, VerificationBadge, FloodConditionBadge, PublicationBadge, DataModeBadge } from '../../components/ui/Badges.jsx'
import { FloodMap } from '../map/FloodMap.jsx'
import { useResource, useIsDesktop } from '../../hooks/useData.js'
import { getWardSummary, getWardPoints } from '../../services/api.js'
import { FLOOD_CONDITION } from '../../locales/vi/labels.js'
import { formatFull, formatRelative } from '../../utils/time.js'

const CONDITION_FILTERS = ['all', 'active', 'reported-clear', 'confirmed-clear', 'no-update']
const SEV_RANK = { severe: 0, moderate: 1, light: 2, unknown: 3 }

/**
 * Trang phường: tổng hợp theo khu vực + danh sách điểm ngập + bản đồ địa bàn.
 * Máy tính: danh sách và bản đồ cạnh nhau. Điện thoại: chuyển tab Danh sách / Bản đồ.
 */
export default function AdminMapPage() {
  const isDesktop = useIsDesktop()
  const [area, setArea] = useState('')
  const [cond, setCond] = useState('active')
  const [view, setView] = useState('list')
  const [selected, setSelected] = useState(null)
  const [tileError, setTileError] = useState(false)
  const mapRef = useRef(null)

  const summary = useResource(({ signal }) => getWardSummary({ signal }), [], { topic: 'reports', refreshMs: 30000 })
  const pointsRes = useResource(({ signal }) => getWardPoints({ area, signal }), [area], { topic: 'reports', refreshMs: 30000 })

  const points = useMemo(() => {
    const all = pointsRes.data || []
    return all
      .filter((r) => cond === 'all' || r.floodCondition === cond)
      .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || new Date(b.observedAt) - new Date(a.observedAt))
  }, [pointsRes.data, cond])

  const selectedPoint = points.find((point) => point.id === selected)
  useEffect(() => {
    if (!selectedPoint || (!isDesktop && view !== 'map')) return
    const frame = requestAnimationFrame(() => mapRef.current?.flyTo(selectedPoint.lat, selectedPoint.lng, 17))
    return () => cancelAnimationFrame(frame)
  }, [selectedPoint?.id, selectedPoint?.lat, selectedPoint?.lng, view, isDesktop])

  const counts = useMemo(() => {
    const all = pointsRes.data || []
    return Object.fromEntries(CONDITION_FILTERS.map((c) => [c, c === 'all' ? all.length : all.filter((r) => r.floodCondition === c).length]))
  }, [pointsRes.data])

  function focus(r) {
    setSelected(r.id)
    if (!isDesktop) setView('map')
  }

  const list = pointsRes.loading && !pointsRes.data ? <ListSkeleton rows={5} /> : points.length ? (
    <ul className="ward-list">
      {points.map((r) => (
        <li key={r.id} className={`ward-item ${selected === r.id ? 'is-selected' : ''}`}>
          <button type="button" className="ward-item__main" onClick={() => focus(r)} aria-label={`Xem ${r.place} trên bản đồ`}>
            <span className="thumb">{r.photo ? <img src={r.photo} alt="" loading="lazy" /> : null}</span>
            <span className="ward-item__body">
              <span className="ward-item__title">{r.place}</span>
              <span className="row">
                <SeverityBadge severity={r.severity} size="sm" />
                <FloodConditionBadge status={r.floodCondition} size="sm" />
              </span>
              <span className="ward-item__meta">
                <span className="mono">{r.id}</span> · {r.area} · cập nhật <time dateTime={r.updatedAt} title={formatFull(r.updatedAt)}>{formatRelative(r.updatedAt)}</time>
              </span>
              <span className="row">
                <VerificationBadge status={r.verificationStatus} size="sm" />
                {r.publicationStatus !== 'public' ? <PublicationBadge status={r.publicationStatus} size="sm" /> : null}
              </span>
            </span>
          </button>
          <Button size="sm" variant={r.floodCondition === 'reported-clear' ? 'primary' : 'secondary'} to={`/quan-ly/bao-cao/${r.id}`}>
            {r.floodCondition === 'reported-clear' ? 'Xác nhận' : 'Xử lý'}
          </Button>
        </li>
      ))}
    </ul>
  ) : !pointsRes.error ? (
    <EmptyState compact icon="check-circle" title="Không có điểm phù hợp" description="Thử chọn khu vực hoặc tình trạng khác." actions={<Button size="sm" variant="secondary" onClick={() => { setCond('all'); setArea('') }}>Xem tất cả</Button>} />
  ) : null

  const map = (
    <div className="ward-map">
      <FloodMap
        ref={mapRef}
        points={points}
        selectedId={selected}
        onSelect={(id) => setSelected(id)}
        layers={{ active: true }}
        initialView={selectedPoint ? { center: [selectedPoint.lat, selectedPoint.lng], zoom: 17 } : undefined}
        onTileError={() => setTileError(true)}
        label="Bản đồ địa bàn phường"
      />
      {tileError ? <MapErrorNotice onRetry={() => { setTileError(false); mapRef.current?.retryTiles() }} /> : null}
      {selected ? (() => {
        const r = points.find((p) => p.id === selected)
        if (!r) return null
        return (
          <div className="ward-map__card">
            <div className="row row--between">
              <strong>{r.place}</strong>
              <button type="button" className="icon-link" onClick={() => setSelected(null)} aria-label="Đóng"><Icon name="close" size={18} /></button>
            </div>
            <div className="row"><SeverityBadge severity={r.severity} size="sm" /><FloodConditionBadge status={r.floodCondition} size="sm" /></div>
            <Button size="sm" variant="primary" to={`/quan-ly/bao-cao/${r.id}`}>Mở báo cáo</Button>
          </div>
        )
      })() : null}
    </div>
  )

  return (
    <div className="admin-page">
      <PageHeader
        title="Trang phường · Bản đồ địa bàn"
        description="Xem điểm ngập theo khu vực và xác nhận tình trạng. Các khu vực hiện đang được hiển thị bằng dữ liệu mô phỏng."
        actions={<Button size="sm" variant="secondary" icon="refresh" onClick={() => { summary.reload(); pointsRes.reload() }} loading={pointsRes.refreshing}>Làm mới</Button>}
      />

      {/* Tổng hợp theo khu vực – bấm để lọc */}
      <section aria-label="Tổng hợp theo khu vực">
        <ResourceError resource={summary} label="tổng hợp khu vực" />
        {summary.loading ? <ListSkeleton rows={1} /> : summary.data ? <div className="ward-areas">
          <button type="button" className={`ward-area ${area === '' ? 'is-active' : ''}`} onClick={() => setArea('')} aria-pressed={area === ''}>
            <span className="ward-area__name">Toàn địa bàn</span>
            <span className="ward-area__num">{(summary.data?.items || []).reduce((s, w) => s + w.active, 0)}</span>
            <span className="ward-area__label">đang ngập</span>
          </button>
          {(summary.data?.items || []).map((w) => (
            <button key={w.area} type="button" className={`ward-area ${area === w.area ? 'is-active' : ''}`} onClick={() => setArea(w.area)} aria-pressed={area === w.area}>
              <span className="ward-area__name">{w.area}</span>
              <span className="ward-area__num">{w.active}</span>
              <span className="ward-area__label">
                đang ngập{w.severe ? ` · ${w.severe} nặng` : ''}{w.reportedClear ? ` · ${w.reportedClear} chờ xác nhận hết` : ''}
              </span>
            </button>
          ))}
        </div> : null}
      </section>

      {counts['reported-clear'] ? (
        <Notice tone="warning" title={`${counts['reported-clear']} điểm có thông tin hết ngập cần xác nhận`}
          actions={<Button size="sm" variant="primary" onClick={() => setCond('reported-clear')}>Xem các điểm này</Button>}>
          Người dân đã báo nước rút. Hãy kiểm tra trước khi chuyển sang “Đã xác nhận hết ngập”.
        </Notice>
      ) : null}

      <ResourceError resource={pointsRes} label="danh sách điểm ngập" />
      <div className="status-filters" role="group" aria-label="Lọc theo tình trạng ngập">
        {CONDITION_FILTERS.map((c) => (
          <button key={c} type="button" className="status-chip" aria-pressed={cond === c} onClick={() => setCond(c)}>
            {c === 'all' ? 'Tất cả' : FLOOD_CONDITION[c]} {pointsRes.data ? <span className="tab__count">{counts[c] ?? 0}</span> : null}
          </button>
        ))}
      </div>

      {!isDesktop ? (
        <Tabs label="Chế độ xem" value={view} onChange={setView} tabs={[{ value: 'list', label: 'Danh sách', count: points.length }, { value: 'map', label: 'Bản đồ' }]} />
      ) : null}

      {isDesktop ? (
        <div className="ward-split">
          <div className="ward-split__list">{list}</div>
          <div className="ward-split__map">{map}</div>
        </div>
      ) : <div id={`panel-${view}`} role="tabpanel" aria-labelledby={`tab-${view}`}>{view === 'list' ? list : map}</div>}

      <p className="small muted row"><DataModeBadge mode="demo" size="sm" /> Địa bàn và tọa độ minh họa; ranh giới thật lấy từ dữ liệu dự án.</p>
    </div>
  )
}
