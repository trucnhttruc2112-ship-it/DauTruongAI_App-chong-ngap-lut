import { forwardRef } from 'react'
import { SeverityBadge, VerificationBadge } from '../../components/ui/Badges.jsx'
import { formatFull, formatRelative } from '../../utils/time.js'

/** Một dòng danh sách – cùng mở chi tiết như chọn marker (mục 6.2). */
export const FloodListItem = forwardRef(function FloodListItem({ point, selected, onSelect }, ref) {
  return (
    <li className="flood-item-wrap">
      <button
        ref={ref}
        type="button"
        className={`flood-item ${selected ? 'is-selected' : ''}`}
        onClick={() => onSelect(point.id)}
        aria-current={selected ? 'true' : undefined}
        data-point-id={point.id}
      >
        <span className="thumb">{point.photo ? <img src={point.photo} alt="" loading="lazy" /> : null}</span>
        <span className="flood-item__body">
          <span className="flood-item__title">{point.place}</span>
          <span className="flood-item__badges">
            <SeverityBadge severity={point.severity} size="sm" />
            <VerificationBadge status={point.verificationStatus} size="sm" />
          </span>
          <span className="flood-item__meta">
            Ghi nhận <time dateTime={point.observedAt} title={formatFull(point.observedAt)}>{formatRelative(point.observedAt)}</time>
            {point.area ? ` · ${point.area}` : ''}
          </span>
        </span>
      </button>
    </li>
  )
})

export function FloodList({ points, selectedId, onSelect, listRef }) {
  return (
    <ul className="flood-list" ref={listRef} aria-label="Danh sách điểm ngập">
      {points.map((p) => (
        <FloodListItem key={p.id} point={p} selected={p.id === selectedId} onSelect={onSelect} />
      ))}
    </ul>
  )
}
