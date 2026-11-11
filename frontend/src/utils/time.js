// Thống nhất múi giờ Việt Nam khi hiển thị; dữ liệu lưu theo ISO/UTC (mục 6.5).
const TZ = 'Asia/Ho_Chi_Minh'

const fullFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TZ, hour: '2-digit', minute: '2-digit',
  day: '2-digit', month: '2-digit', year: 'numeric'
})
const timeFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, day: '2-digit', month: '2-digit' })

const toDate = (v) => (v instanceof Date ? v : new Date(v))

/** "07:05, 10/11/2026" */
export function formatFull(value) {
  if (!value) return ''
  const d = toDate(value)
  return `${timeFmt.format(d)}, ${fullFmt.format(d).split(' ').pop()}`
}

/** "07:05" */
export function formatTime(value) {
  return value ? timeFmt.format(toDate(value)) : ''
}

/** "07:05 10/11" – dùng cho khoảng hiệu lực ngắn */
export function formatShort(value) {
  if (!value) return ''
  const d = toDate(value)
  return `${timeFmt.format(d)} ${dayFmt.format(d)}`
}

/** "12 phút trước" – luôn đi kèm khả năng xem mốc đầy đủ (title / chi tiết) */
export function formatRelative(value, now = Date.now()) {
  if (!value) return ''
  const diff = (now - toDate(value).getTime()) / 1000
  if (diff < 0) {
    const ahead = -diff
    if (ahead < 3600) return `sau ${Math.max(1, Math.round(ahead / 60))} phút`
    if (ahead < 86400) return `sau ${Math.round(ahead / 3600)} giờ`
    return formatShort(value)
  }
  if (diff < 60) return 'Vừa xong'
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} ngày trước`
  return formatFull(value)
}

/** Giá trị cho <input type="datetime-local"> theo giờ thiết bị */
export function toInputValue(value) {
  const d = toDate(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const minutesAgo = (m) => new Date(Date.now() - m * 60_000).toISOString()
export const minutesFromNow = (m) => new Date(Date.now() + m * 60_000).toISOString()

/** Khoảng thời gian bộ lọc → mili giây (null = tất cả thời gian) */
export const TIME_WINDOWS = {
  '6h': 6 * 3600_000,
  '24h': 24 * 3600_000,
  '7d': 7 * 86400_000,
  all: null
}
