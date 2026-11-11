import { Icon } from './Icon.jsx'
import { Button } from './Button.jsx'

/** Phân biệt lỗi tải với danh sách rỗng, giữ nội dung đã tải khi cập nhật thất bại. */
export function ResourceError({ resource, label }) {
  if (!resource.error) return null
  return (
    <Notice tone="error" live title={`Chưa tải được ${label}`}
      actions={<Button size="sm" icon="refresh" onClick={resource.reload} loading={resource.loading || resource.refreshing}>Thử lại</Button>}>
      {resource.data != null
        ? 'Đang giữ dữ liệu lần tải trước; thông tin có thể chưa được cập nhật. Hãy thử lại.'
        : 'Không thể kiểm tra dữ liệu lúc này. Hãy kiểm tra kết nối và thử lại.'}
    </Notice>
  )
}

/**
 * Trạng thái trống / chưa có dữ liệu (mục 12). Hình minh họa nhỏ, không phủ lên bản đồ.
 */
export function EmptyState({ icon = 'info', title, description, actions, compact = false }) {
  return (
    <div className={`empty ${compact ? 'empty--compact' : ''}`} role="status">
      <span className="empty__icon" aria-hidden="true"><Icon name={icon} size={compact ? 24 : 32} /></span>
      <p className="empty__title">{title}</p>
      {description ? <p className="empty__desc">{description}</p> : null}
      {actions ? <div className="empty__actions">{actions}</div> : null}
    </div>
  )
}

/**
 * Thông báo trong trang: info | warning | error | success | demo.
 * Không dùng thông báo thoáng qua làm nơi duy nhất báo kết quả quan trọng.
 */
export function Notice({ tone = 'info', title, children, actions, icon, live, className = '' }) {
  const defaultIcon = {
    info: 'info', warning: 'warning', error: 'error', success: 'check-circle', demo: 'info', offline: 'wifi-off'
  }[tone]
  return (
    <div
      className={`notice notice--${tone} ${className}`}
      role={live ? (tone === 'error' ? 'alert' : 'status') : undefined}
    >
      <Icon name={icon || defaultIcon} size={20} className="notice__icon" />
      <div className="notice__body">
        {title ? <p className="notice__title">{title}</p> : null}
        {children ? <div className="notice__text">{children}</div> : null}
        {actions ? <div className="notice__actions">{actions}</div> : null}
      </div>
    </div>
  )
}

/** Khung giữ chỗ khi tải – tránh nhảy bố cục. */
export function Skeleton({ width = '100%', height = 16, radius = 6, className = '' }) {
  return <span className={`skeleton ${className}`} style={{ width, height, borderRadius: radius }} aria-hidden="true" />
}

export function ListSkeleton({ rows = 4 }) {
  return (
    <div className="list-skeleton" role="status" aria-label="Đang tải danh sách">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="list-skeleton__row">
          <Skeleton width={64} height={64} radius={8} />
          <div className="list-skeleton__lines">
            <Skeleton width="70%" height={18} />
            <Skeleton width="45%" height={14} />
            <Skeleton width="55%" height={14} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Tabs có thể truy cập bằng bàn phím (mũi tên trái/phải). */
export function Tabs({ tabs, value, onChange, label, className = '' }) {
  const onKey = (e, idx) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const dir = e.key === 'ArrowRight' ? 1 : -1
    const next = tabs[(idx + dir + tabs.length) % tabs.length]
    onChange(next.value)
    requestAnimationFrame(() => document.getElementById(`tab-${next.value}`)?.focus())
  }
  return (
    <div className={`tabs ${className}`} role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.value}
          id={`tab-${t.value}`}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          aria-controls={`panel-${t.value}`}
          tabIndex={value === t.value ? 0 : -1}
          className={`tab ${value === t.value ? 'is-active' : ''}`}
          onClick={() => onChange(t.value)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.label}
          {typeof t.count === 'number' ? <span className="tab__count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function PageHeader({ title, description, actions, back }) {
  return (
    <header className="page-header">
      {back}
      <div className="page-header__row">
        <div>
          <h1 className="page-title">{title}</h1>
          {description ? <p className="page-desc">{description}</p> : null}
        </div>
        {actions ? <div className="page-header__actions">{actions}</div> : null}
      </div>
    </header>
  )
}

export function Card({ as: Tag = 'section', className = '', children, ...rest }) {
  return <Tag className={`card ${className}`} {...rest}>{children}</Tag>
}

/** Danh sách mô tả cặp nhãn – giá trị. */
export function InfoList({ items }) {
  return (
    <dl className="info-list">
      {items.filter(Boolean).map((it) => (
        <div key={it.label} className="info-list__row">
          <dt>{it.label}</dt>
          <dd>{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Thông báo cho công cụ đọc màn hình (trạng thái gửi...). */
export function LiveRegion({ message }) {
  return <p className="sr-only" role="status" aria-live="polite">{message}</p>
}
