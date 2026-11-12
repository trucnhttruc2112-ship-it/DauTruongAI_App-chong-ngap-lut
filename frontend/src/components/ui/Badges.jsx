import { Icon, SEVERITY_ICON } from './Icon.jsx'
import {
  SEVERITY, SEVERITY_SHORT, VERIFICATION, PROCESSING, FLOOD_CONDITION, PUBLICATION, DATA_MODE
} from '../../locales/vi/labels.js'
import { formatFull, formatRelative } from '../../utils/time.js'

/**
 * Nhãn mức ngập: luôn kèm chữ + biểu tượng, màu chỉ là tín hiệu phụ (mục 4.1).
 */
export function SeverityBadge({ severity = 'unknown', short = false, size = 'md' }) {
  const label = short ? SEVERITY_SHORT[severity] : SEVERITY[severity]
  return (
    <span className={`badge badge--sev badge--sev-${severity} badge--${size}`}>
      <Icon name={SEVERITY_ICON[severity]} size={size === 'sm' ? 14 : 16} />
      <span>{label}</span>
    </span>
  )
}

const VERIFY_ICON = {
  unchecked: 'clock', checking: 'refresh', verified: 'shield', insufficient: 'help', invalid: 'close'
}

/** Nhãn xác minh – tách biệt khỏi mức ngập. */
export function VerificationBadge({ status = 'unchecked', size = 'md' }) {
  return (
    <span className={`badge badge--outline badge--verify-${status} badge--${size}`}>
      <Icon name={VERIFY_ICON[status]} size={14} />
      <span>{VERIFICATION[status]}</span>
    </span>
  )
}

/** Nhãn quy trình xử lý. */
export function ProcessingBadge({ status = 'submitted', size = 'md' }) {
  return (
    <span className={`badge badge--neutral badge--proc-${status} badge--${size}`}>
      <span className="badge__dot" aria-hidden="true" />
      <span>{PROCESSING[status]}</span>
    </span>
  )
}

export function FloodConditionBadge({ status = 'active', size = 'md' }) {
  return (
    <span className={`badge badge--neutral badge--cond-${status} badge--${size}`}>
      <Icon name={status === 'active' ? 'water' : status === 'no-update' ? 'clock' : 'check'} size={14} />
      <span>{FLOOD_CONDITION[status]}</span>
    </span>
  )
}

export function PublicationBadge({ status = 'pending', size = 'md' }) {
  return (
    <span className={`badge badge--neutral badge--pub-${status} badge--${size}`}>
      <Icon name={status === 'public' ? 'eye' : status === 'pending' ? 'clock' : 'eye-off'} size={14} />
      <span>{PUBLICATION[status]}</span>
    </span>
  )
}

/**
 * Nhãn nguồn dữ liệu / chế độ dữ liệu. Nhãn Mô phỏng phải xuất hiện ngay
 * nơi cần quyết định, không chỉ ở chân trang (mục 9, UX11).
 */
export function DataModeBadge({ mode = 'demo', size = 'md' }) {
  return (
    <span className={`badge badge--mode badge--mode-${mode} badge--${size}`}>
      <Icon name={mode === 'live' ? 'check-circle' : mode === 'offline' ? 'wifi-off' : 'info'} size={14} />
      <span>{DATA_MODE[mode]}</span>
    </span>
  )
}

/** Dòng nguồn + thời điểm. Thời gian tương đối kèm mốc đầy đủ khi rê/chạm (mục 6.5). */
export function DataSourceLabel({ source, mode, at, atLabel = 'Cập nhật', className = '' }) {
  return (
    <p className={`source-label ${className}`}>
      {mode ? <DataModeBadge mode={mode} size="sm" /> : null}
      {source ? <span>Nguồn: {source}</span> : null}
      {at ? (
        <span>
          {atLabel}{' '}
          <time dateTime={at} title={formatFull(at)}>{formatRelative(at)}</time>
        </span>
      ) : null}
    </p>
  )
}

export function TimeStamp({ value, prefix }) {
  if (!value) return null
  return (
    <span className="timestamp">
      {prefix ? `${prefix} ` : null}
      <time dateTime={value} title={formatFull(value)}>{formatRelative(value)}</time>
      <span className="timestamp__full"> · {formatFull(value)}</span>
    </span>
  )
}
