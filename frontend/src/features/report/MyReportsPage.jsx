import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button, IconButton } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { Notice, EmptyState, ListSkeleton, Tabs, PageHeader } from '../../components/ui/Feedback.jsx'
import { ProcessingBadge, VerificationBadge, PublicationBadge, DataModeBadge } from '../../components/ui/Badges.jsx'
import { useResource, useSession } from '../../hooks/useData.js'
import { getMyReports } from '../../services/api.js'
import { listDrafts, deleteDraft } from '../../services/drafts.js'
import { PROCESSING } from '../../locales/vi/labels.js'
import { formatFull, formatRelative } from '../../utils/time.js'
import { APP_CONFIG } from '../../app/config.js'

const PROCESSING_FILTERS = ['all', 'submitted', 'received', 'needs-info', 'in-progress', 'closed']

/** Danh sách nháp lưu trên thiết bị này (mục 8). */
function DraftList({ onCount }) {
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    const list = await listDrafts()
    setDrafts(list)
    onCount?.(list.length)
    setLoading(false)
  }, [onCount])

  useEffect(() => { load() }, [load])

  async function remove(id) {
    await deleteDraft(id)
    load()
  }

  if (loading) return <ListSkeleton rows={2} />
  if (!drafts.length) {
    return (
      <EmptyState
        icon="save"
        title="Chưa có bản nháp trên thiết bị này"
        description="Bản nháp được lưu cục bộ trên thiết bị đang dùng. Nháp không đồng nghĩa bản đồ dùng được khi mất mạng."
        actions={<Button variant="secondary" to="/bao-ngap">Báo ngập</Button>}
      />
    )
  }
  return (
    <>
      <p className="small muted">Bản nháp thuộc thiết bị này, không tự đồng bộ sang thiết bị khác.</p>
      <ul className="report-list">
        {drafts.map((d) => (
          <li key={d.id}>
            <div className="report-row">
              <span className="thumb">{d.photo?.dataUrl ? <img src={d.photo.dataUrl} alt="" /> : null}</span>
              <div className="report-row__body">
                <span className="report-row__title">{d.location?.place || 'Bản nháp chưa có vị trí'}</span>
                <span className="report-row__meta">
                  <span>Lưu {formatRelative(d.savedAt)}</span>
                  <span>Bước {Number(d.step ?? 0) + 1}/3</span>
                </span>
              </div>
              <div className="row">
                <Button size="sm" variant="secondary" onClick={() => navigate(`/bao-ngap?nhap=${encodeURIComponent(d.id)}`)}>
                  Tiếp tục
                </Button>
                <IconButton icon="trash" label="Xóa bản nháp này" size="sm" onClick={() => remove(d.id)} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function MyReportsPage() {
  const session = useSession()
  const [tab, setTab] = useState('sent')
  const [filter, setFilter] = useState('all')
  const [draftCount, setDraftCount] = useState(0)

  const res = useResource(({ signal }) => getMyReports({ signal }), [session?.id], {
    refreshMs: 30000,
    topic: 'reports'
  })

  const items = res.data?.items || []
  const filtered = filter === 'all' ? items : items.filter((r) => r.processingStatus === filter)

  return (
    <div className="page">
      <PageHeader
        title="Báo cáo của tôi"
        description="Theo dõi báo cáo đã gửi và bản nháp trên thiết bị này."
        actions={
          <Button variant="primary" icon="camera" to="/bao-ngap">Báo ngập</Button>
        }
      />

      <Tabs
        label="Nhóm báo cáo"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'sent', label: 'Đã gửi', count: items.length || undefined },
          { value: 'drafts', label: 'Bản nháp', count: draftCount || undefined }
        ]}
      />

      {tab === 'sent' ? (
        <section id="panel-sent" role="tabpanel" aria-labelledby="tab-sent" className="stack">
          {!session ? (
            <EmptyState
              icon="user"
              title="Đăng nhập để xem báo cáo đã gửi"
              description="Bạn vẫn xem bản đồ và báo ngập được mà không cần tài khoản. Báo cáo đã gửi cần đăng nhập để theo dõi."
              actions={<Button variant="primary" to={`/dang-nhap?tiep=${encodeURIComponent('/bao-cao-cua-toi')}`}>Đăng nhập</Button>}
            />
          ) : (
            <>
              <div className="row row--between">
                <p className="small muted">
                  {res.fetchedAt ? <>Cập nhật {formatRelative(res.fetchedAt)}</> : 'Đang tải…'}
                  <span className="muted"> · tự kiểm tra mỗi 30 giây khi trang đang mở</span>
                </p>
                <Button size="sm" variant="secondary" icon="refresh" onClick={res.reload} loading={res.refreshing}>Làm mới</Button>
              </div>

              {res.error ? (
                <Notice tone="error" title="Chưa tải được cập nhật mới" live>
                  Đang hiển thị dữ liệu lần tải gần nhất{res.fetchedAt ? ` (${formatFull(res.fetchedAt)})` : ''}. Trạng thái không bị đổi về mặc định.
                </Notice>
              ) : null}

              <div className="status-filters" role="group" aria-label="Lọc theo trạng thái xử lý">
                {PROCESSING_FILTERS.map((f) => (
                  <button key={f} type="button" className="status-chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                    {f === 'all' ? 'Tất cả' : PROCESSING[f]}
                  </button>
                ))}
              </div>

              {res.loading ? <ListSkeleton rows={4} /> : filtered.length ? (
                <ul className="report-list">
                  {filtered.map((r) => (
                    <li key={r.id}>
                      <Link to={`/bao-cao/${r.id}`} className="report-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <span className="thumb">{r.photo ? <img src={r.photo} alt="" loading="lazy" /> : null}</span>
                        <span className="report-row__body">
                          <span className="report-row__title">{r.place}</span>
                          <span className="report-row__meta">
                            <span className="mono">{r.id}</span>
                            <span>Gửi {formatRelative(r.receivedAt)}</span>
                          </span>
                          <span className="row">
                            <ProcessingBadge status={r.processingStatus} size="sm" />
                            <VerificationBadge status={r.verificationStatus} size="sm" />
                            {r.publicationStatus === 'pending' ? <PublicationBadge status="pending" size="sm" /> : null}
                          </span>
                        </span>
                        <Icon name="chevron-right" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon="report"
                  title={filter === 'all' ? 'Chưa có báo cáo nào' : `Không có báo cáo ở trạng thái “${PROCESSING[filter]}”`}
                  description={filter === 'all' ? 'Báo cáo bạn gửi sẽ xuất hiện ở đây ngay sau khi được hệ thống xác nhận.' : 'Thử chọn trạng thái khác.'}
                  actions={filter === 'all' ? <Button variant="secondary" to="/bao-ngap">Báo ngập</Button> : <Button variant="ghost" onClick={() => setFilter('all')}>Xem tất cả</Button>}
                />
              )}
              {res.data && APP_CONFIG.dataMode === 'demo' ? <p className="small muted row"><DataModeBadge mode="demo" size="sm" /> Dữ liệu mẫu cho bản trình diễn.</p> : null}
            </>
          )}
        </section>
      ) : (
        <section id="panel-drafts" role="tabpanel" aria-labelledby="tab-drafts">
          <DraftList onCount={setDraftCount} />
        </section>
      )}
    </div>
  )
}
