import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button.jsx'
import { TextField, Select, ChoiceGroup } from '../../components/ui/Field.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { Notice, EmptyState, ListSkeleton, PageHeader } from '../../components/ui/Feedback.jsx'
import { SeverityBadge, VerificationBadge, ProcessingBadge, DataModeBadge } from '../../components/ui/Badges.jsx'
import { useResource } from '../../hooks/useData.js'
import { getAdminReports } from '../../services/api.js'
import { APP_CONFIG } from '../../app/config.js'
import { VERIFICATION, PROCESSING, SEVERITY, SEVERITY_ORDER } from '../../locales/vi/labels.js'
import { formatFull, formatRelative } from '../../utils/time.js'

const statusOptions = [{ value: '', label: 'Tất cả trạng thái' }, ...Object.entries(PROCESSING).map(([value, label]) => ({ value, label }))]
const verifyOptions = [{ value: '', label: 'Tất cả xác minh' }, ...Object.entries(VERIFICATION).map(([value, label]) => ({ value, label }))]

export default function AdminReportsPage() {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [processing, setProcessing] = useState('')
  const [verification, setVerification] = useState('')
  const [severity, setSeverity] = useState('')
  const [page, setPage] = useState(1)
  const res = useResource(({ signal }) => getAdminReports({ signal, page, filters: { processing: processing ? [processing] : [], verification: verification ? [verification] : [], severities: severity ? [severity] : [] }, query: search }), [page, processing, verification, severity, search], { topic: 'reports', refreshMs: 30000 })
  const data = res.data
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  function submitSearch(e) { e.preventDefault(); setPage(1); setSearch(query) }
  return (
    <div className="admin-page">
      <PageHeader title="Báo cáo" description="Kiểm tra, xác minh và cập nhật báo cáo trong địa bàn được phân quyền." actions={<Button size="sm" variant="secondary" icon="refresh" onClick={res.reload} loading={res.refreshing}>Làm mới</Button>} />
      <div className="admin-kpis">
        <button type="button" className="admin-kpi" onClick={() => { setProcessing('submitted'); setPage(1) }}><span>Chờ kiểm tra</span><strong>{data?.counts?.pending ?? '—'}</strong></button>
        <button type="button" className="admin-kpi" onClick={() => { setProcessing('needs-info'); setPage(1) }}><span>Cần bổ sung</span><strong>{data?.counts?.needsInfo ?? '—'}</strong></button>
        <button type="button" className="admin-kpi" onClick={() => { setVerification('checking'); setPage(1) }}><span>Đang kiểm tra</span><strong>{data?.counts?.checking ?? '—'}</strong></button>
      </div>
      <section className="admin-toolbar card">
        <form className="admin-search" onSubmit={submitSearch}><TextField label="Tìm báo cáo" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mã báo cáo, vị trí…" leadingIcon="search" /><Button type="submit" variant="primary" icon="search">Tìm</Button></form>
        <div className="admin-filters"><Select label="Mức ngập" value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1) }} options={[{ value: '', label: 'Tất cả mức ngập' }, ...SEVERITY_ORDER.map((v) => ({ value: v, label: SEVERITY[v] }))]} /><Select label="Xác minh" value={verification} onChange={(e) => { setVerification(e.target.value); setPage(1) }} options={verifyOptions} /><Select label="Xử lý" value={processing} onChange={(e) => { setProcessing(e.target.value); setPage(1) }} options={statusOptions} /></div>
      </section>
      {res.error && !data ? <Notice tone="error" title="Không tải được danh sách" live>{res.error.message}</Notice> : null}
      {res.loading && !data ? <ListSkeleton rows={6} /> : data?.items?.length ? <>
        <div className="admin-table-wrap"><table className="admin-table"><caption className="sr-only">Danh sách báo cáo khu vực</caption><thead><tr><th>Mã / vị trí</th><th>Ảnh</th><th>Mức ngập</th><th>Ghi nhận</th><th>Xác minh</th><th>Xử lý</th><th></th></tr></thead><tbody>{data.items.map((r) => <tr key={r.id}><td><Link to={`/quan-ly/bao-cao/${r.id}`} className="admin-report-link"><strong>{r.id}</strong><span>{r.place}</span></Link></td><td><span className="thumb">{r.photo ? <img src={r.photo} alt="" /> : null}</span></td><td><SeverityBadge severity={r.severity} size="sm" /></td><td><time dateTime={r.observedAt} title={formatFull(r.observedAt)}>{formatRelative(r.observedAt)}</time></td><td><VerificationBadge status={r.verificationStatus} size="sm" /></td><td><ProcessingBadge status={r.processingStatus} size="sm" /></td><td><Link to={`/quan-ly/bao-cao/${r.id}`} className="icon-link" aria-label={`Mở ${r.id}`}><Icon name="chevron-right" /></Link></td></tr>)}</tbody></table></div>
        <div className="admin-pagination"><span className="small muted">{data.total} báo cáo · trang {page}/{pages}</span><div className="row"><Button size="sm" variant="secondary" icon="chevron-left" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Trước</Button><Button size="sm" variant="secondary" iconRight="chevron-right" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}>Sau</Button></div></div>
      </> : <EmptyState icon="report" title="Không có báo cáo phù hợp" description="Thử xóa bộ lọc hoặc mở rộng tìm kiếm." actions={<Button variant="secondary" onClick={() => { setQuery(''); setSearch(''); setProcessing(''); setVerification(''); setSeverity(''); setPage(1) }}>Xóa bộ lọc</Button>} />}
      {APP_CONFIG.dataMode === 'demo' ? <Notice tone="demo" title="Dữ liệu khu vực trình diễn"><span className="row"><DataModeBadge mode="demo" size="sm" /> Các báo cáo trong danh sách là dữ liệu mẫu, không phải tiếp nhận địa phương thật.</span></Notice> : null}
    </div>
  )
}
