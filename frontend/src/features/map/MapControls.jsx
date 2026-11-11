import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/ui/Icon.jsx'
import { IconButton } from '../../components/ui/Button.jsx'
import { Checkbox } from '../../components/ui/Field.jsx'
import { SheetDialog } from '../../components/ui/Dialog.jsx'
import { DataModeBadge } from '../../components/ui/Badges.jsx'
import { APP_CONFIG } from '../../app/config.js'
import { SEVERITY, SEVERITY_ORDER } from '../../locales/vi/labels.js'
import { SEVERITY_ICON } from '../../components/ui/Icon.jsx'

export const LAYER_META = {
  active: { label: 'Đang được báo ngập', desc: 'Báo cáo đã qua kiểm tra để công khai' },
  history: { label: 'Thường ngập', desc: 'Dữ liệu lịch sử, không phải tình trạng hiện tại' },
  forecast: { label: 'Nguy cơ dự báo', desc: APP_CONFIG.dataMode === 'live' ? 'Vùng nét đứt quanh khu vực hay ngập, có khoảng hiệu lực' : 'Vùng nét đứt, có khoảng hiệu lực · Mô phỏng' },
  roads: { label: 'Đường bị ảnh hưởng', desc: 'Chỉ đoạn có dữ liệu hình học đã xác nhận' }
}

/** Chọn lớp dữ liệu + danh sách nguồn chưa kết nối (mục 6.3). */
export function LayerControl({ open, onClose, layers, onChange }) {
  return (
    <SheetDialog open={open} onClose={onClose} title="Lớp bản đồ">
      <div className="stack">
        {Object.entries(LAYER_META).map(([key, m]) => (
          <Checkbox
            key={key}
            label={m.label}
            description={m.desc}
            checked={!!layers[key]}
            onChange={(v) => onChange({ ...layers, [key]: v })}
          />
        ))}
      </div>
      <div className="stack">
        <h3 className="small"><strong>Nguồn khác</strong></h3>
        <ul className="source-status">
          {['Trạm đo mực nước', 'Triều cường', 'Ảnh vệ tinh'].map((n) => (
            <li key={n}>
              <span>{n}</span>
              <DataModeBadge mode="offline" size="sm" />
            </li>
          ))}
        </ul>
        <p className="small muted">Các nguồn này chỉ xuất hiện trên bản đồ khi có dữ liệu được phép sử dụng.</p>
      </div>
      <FloodLegend />
    </SheetDialog>
  )
}

/** Chú giải: mức ngập luôn có chữ + biểu tượng; lớp lịch sử/dự báo có kiểu thể hiện riêng. */
export function FloodLegend({ compact = false }) {
  return (
    <div className={`legend ${compact ? 'legend--compact' : ''}`}>
      <h3 className="legend__title">Chú giải</h3>
      <ul className="legend__list">
        {SEVERITY_ORDER.map((s) => (
          <li key={s}>
            <span className={`legend__swatch fm-marker fm-marker--${s}`} aria-hidden="true">
              <Icon name={SEVERITY_ICON[s]} size={12} />
            </span>
            {SEVERITY[s]}
          </li>
        ))}
        <li><span className="legend__swatch fm-history" aria-hidden="true"><Icon name="history" size={12} /></span>Thường ngập (lịch sử)</li>
        <li><span className="legend__swatch legend__swatch--dash" aria-hidden="true" />Nguy cơ dự báo</li>
      </ul>
    </div>
  )
}

/** Cột công cụ trên bản đồ: lớp, vị trí của tôi, thu phóng. */
export function MapToolbar({ onLayers, onLocate, locating, onZoomIn, onZoomOut, activeLayerCount }) {
  return (
    <div className="map-tools" role="toolbar" aria-label="Công cụ bản đồ">
      <button type="button" className="map-tool map-tool--labeled" onClick={onLayers} aria-haspopup="dialog">
        <Icon name="layers" />
        <span>Lớp</span>
        {activeLayerCount > 1 ? <span className="map-tool__count">{activeLayerCount}</span> : null}
      </button>
      <button type="button" className="map-tool" onClick={onLocate} aria-label="Vị trí của tôi" title="Vị trí của tôi" disabled={locating}>
        {locating ? <span className="spinner" aria-hidden="true" /> : <Icon name="locate" />}
      </button>
      <div className="map-tool-group">
        <IconButton icon="plus" label="Phóng to" className="map-tool" onClick={onZoomIn} />
        <IconButton icon="minus" label="Thu nhỏ" className="map-tool" onClick={onZoomOut} />
      </div>
    </div>
  )
}

/**
 * Chỉ hiện MỘT cảnh báo liên quan quan trọng nhất trên bản đồ, rút gọn tối đa hai dòng,
 * có Xem tất cả; thu gọn được nhưng vẫn giữ chỉ báo để mở lại (mục 9).
 */
export function AlertBanner({ alert, collapsed, onToggle }) {
  if (!alert) return null
  if (collapsed) {
    return (
      <button type="button" className="alert-pill" onClick={onToggle} aria-label={`Mở cảnh báo: ${alert.title}`}>
        <Icon name="bell" size={18} />
        <span>1 cảnh báo</span>
      </button>
    )
  }
  return (
    <div className={`alert-banner alert-banner--${alert.level}`} role="region" aria-label="Cảnh báo liên quan">
      <Icon name="warning" className="alert-banner__icon" />
      <div className="alert-banner__body">
        <p className="alert-banner__text">
          <strong>{alert.title}</strong> {alert.summary}
        </p>
        <p className="alert-banner__meta">
          {alert.dataMode === 'demo' ? <span className="alert-banner__mode">Mô phỏng</span> : null}
          <Link to="/canh-bao">Xem tất cả</Link>
        </p>
      </div>
      <IconButton icon="chevron-up" label="Thu gọn cảnh báo" size="sm" onClick={onToggle} />
    </div>
  )
}

export function useLayerCount(layers) {
  return Object.values(layers).filter(Boolean).length
}

export function MapErrorNotice({ onRetry }) {
  const [hidden, setHidden] = useState(false)
  if (hidden) return null
  return (
    <div className="map-error" role="alert">
      <Icon name="error" />
      <div>
        <p><strong>Chưa tải được nền bản đồ</strong></p>
        <p className="small">Danh sách báo cáo vẫn sử dụng được.</p>
      </div>
      <div className="row">
        <button type="button" className="btn btn--secondary btn--sm" onClick={onRetry}>Thử lại</button>
        <IconButton icon="close" label="Ẩn thông báo" size="sm" onClick={() => setHidden(true)} />
      </div>
    </div>
  )
}
