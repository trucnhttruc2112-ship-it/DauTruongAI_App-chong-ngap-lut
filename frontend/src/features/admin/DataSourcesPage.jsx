import { Button } from '../../components/ui/Button.jsx'
import { Notice, ListSkeleton, PageHeader } from '../../components/ui/Feedback.jsx'
import { DataModeBadge } from '../../components/ui/Badges.jsx'
import { useResource } from '../../hooks/useData.js'
import { getDataSources } from '../../services/api.js'
import { formatFull, formatRelative } from '../../utils/time.js'

const STATUS = { connected: 'Đang nhận', stale: 'Dữ liệu cũ', offline: 'Chưa kết nối' }

/** Nguồn dữ liệu (mục 11.3): tên, địa bàn, trạng thái, lần nhận, nhãn Thật/Mẫu/Chưa kết nối. */
export default function DataSourcesPage() {
  const res = useResource(({ signal }) => getDataSources({ signal }), [])
  return (
    <div className="admin-page">
      <PageHeader title="Nguồn dữ liệu" description="Trạng thái kết nối từng nguồn. Không hiển thị số đo giả khi nguồn chưa kết nối."
        actions={<Button size="sm" variant="secondary" icon="refresh" onClick={res.reload} loading={res.refreshing}>Làm mới</Button>} />
      {res.loading ? <ListSkeleton rows={5} /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption className="sr-only">Danh sách nguồn dữ liệu</caption>
            <thead><tr><th>Nguồn</th><th>Địa bàn</th><th>Trạng thái</th><th>Lần nhận gần nhất</th><th>Nhãn</th></tr></thead>
            <tbody>
              {(res.data || []).map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong><div className="small muted">{s.note}</div></td>
                  <td>{s.area}</td>
                  <td><span className={`src-status src-status--${s.status}`}>{STATUS[s.status]}</span></td>
                  <td>{s.lastReceived ? <time dateTime={s.lastReceived} title={formatFull(s.lastReceived)}>{formatRelative(s.lastReceived)}</time> : '—'}</td>
                  <td><DataModeBadge mode={s.mode} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Notice tone="info">Ngưỡng coi dữ liệu là cũ cần được cấu hình theo từng nguồn; hiện vẫn hiển thị thời điểm cập nhật để người quản lý tự đánh giá.</Notice>
    </div>
  )
}
