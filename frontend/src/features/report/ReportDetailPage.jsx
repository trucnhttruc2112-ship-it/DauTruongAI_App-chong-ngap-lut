import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import L from 'leaflet'

import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { TextArea } from '../../components/ui/Field.jsx'
import { Dialog } from '../../components/ui/Dialog.jsx'
import { Notice, ListSkeleton, InfoList, EmptyState } from '../../components/ui/Feedback.jsx'
import {
  SeverityBadge, VerificationBadge, ProcessingBadge, FloodConditionBadge,
  PublicationBadge, DataModeBadge
} from '../../components/ui/Badges.jsx'
import { useResource, useSession } from '../../hooks/useData.js'
import { getReport, addReportInfo } from '../../services/api.js'
import { PROCESSING, VERIFICATION, FLOOD_CONDITION, AI_RESULT, PHOTO_SOURCE, LOCATION_SOURCE, SEVERITY } from '../../locales/vi/labels.js'
import { formatFull, formatRelative } from '../../utils/time.js'
import '../../styles/report.css'

function Timeline({ history }) {
  return (
    <ol className="timeline">
      {history.map((h, i) => (
        <li key={i} className="timeline__item">
          <span className={`timeline__dot timeline__dot--${h.kind}`} aria-hidden="true" />
          <p className="timeline__text">{h.text}</p>
          <p className="timeline__meta">
            {h.actor} · <time dateTime={h.at} title={formatFull(h.at)}>{formatRelative(h.at)}</time>
          </p>
        </li>
      ))}
    </ol>
  )
}

function MiniLocationMap({ lat, lng }) {
  const [ready, setReady] = useState(false)
  return (
    <div className="mini-map" ref={(el) => {
      if (!el || ready) return
      setReady(true)
      const m = L.map(el, { center: [lat, lng], zoom: 16, zoomControl: true, attributionControl: true })
      m.attributionControl.setPrefix(false)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(m)
      L.circleMarker([lat, lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#1D4ED8', fillOpacity: 1 }).addTo(m)
      setTimeout(() => m.invalidateSize(), 60)
    }} aria-label="Vị trí báo cáo trên bản đồ" />
  )
}

export default function ReportDetailPage() {
  const { id } = useParams()
  const session = useSession()
  const res = useResource(({ signal }) => getReport(id, { signal }), [id, session?.id], { refreshMs: 30000, topic: 'reports' })
  const r = res.data
  const [suppOpen, setSuppOpen] = useState(false)
  const [suppNote, setSuppNote] = useState('')
  const [suppErr, setSuppErr] = useState(null)
  const [suppBusy, setSuppBusy] = useState(false)
  const [suppDone, setSuppDone] = useState(false)

  async function submitSupp() {
    if (!suppNote.trim()) { setSuppErr('Vui lòng mô tả thông tin bổ sung.'); return }
    setSuppBusy(true)
    try {
      await addReportInfo(id, { note: suppNote.trim() })
      setSuppOpen(false)
      setSuppDone(true)
      setSuppNote('')
      res.reload()
    } catch (e) {
      setSuppErr(e.message || 'Chưa gửi được thông tin bổ sung.')
    }
    setSuppBusy(false)
  }

  if (!session) {
    return (
      <div className="page page--narrow">
        <EmptyState
          icon="user"
          title="Cần đăng nhập để xem báo cáo"
          description="Báo cáo chứa thông tin gửi của bạn. Đăng nhập để xem trạng thái và lịch sử xử lý."
          actions={
            <>
              <Button variant="primary" to={`/dang-nhap?tiep=${encodeURIComponent(`/bao-cao/${id}`)}`}>Đăng nhập</Button>
              <Button variant="secondary" to="/">Về bản đồ</Button>
            </>
          }
        />
      </div>
    )
  }

  if (res.loading && !r) return <div className="page page--narrow"><ListSkeleton rows={3} /></div>
  if (res.error && !r) {
    return (
      <div className="page page--narrow">
        <Notice tone="error" title="Không mở được báo cáo" live>{res.error.message}</Notice>
        <Button variant="secondary" to="/bao-cao-cua-toi">Về danh sách báo cáo</Button>
      </div>
    )
  }
  if (!r) return null

  return (
    <div className="page page--narrow">
      <Link to="/bao-cao-cua-toi" className="back-link"><Icon name="chevron-left" /> Báo cáo của tôi</Link>

      <header className="stack">
        <div className="row row--between">
          <h1 className="page-title">{r.place}</h1>
          {r.dataMode === 'demo' ? <DataModeBadge mode="demo" size="sm" /> : null}
        </div>
        <p className="small muted"><span className="mono">{r.id}</span> · Gửi {formatRelative(r.receivedAt)} · <time dateTime={r.receivedAt}>{formatFull(r.receivedAt)}</time></p>
        <div className="row row--between">
          <p className="small muted">Cập nhật {formatRelative(r.updatedAt)}</p>
          <Button size="sm" variant="secondary" icon="refresh" onClick={res.reload} loading={res.refreshing}>Làm mới</Button>
        </div>
      </header>

      {res.error ? <Notice tone="error" title="Chưa tải được cập nhật mới" live>Đang giữ dữ liệu lần tải gần nhất.</Notice> : null}
      {suppDone ? <Notice tone="success" live>Đã gửi thông tin bổ sung. Trạng thái xử lý đã cập nhật.</Notice> : null}

      {/* Ba nhóm trạng thái độc lập + công khai */}
      <section className="card" aria-label="Trạng thái báo cáo">
        <InfoList items={[
          { label: 'Xác minh', value: <VerificationBadge status={r.verificationStatus} /> },
          { label: 'Xử lý', value: <ProcessingBadge status={r.processingStatus} /> },
          { label: 'Tình trạng ngập', value: <FloodConditionBadge status={r.floodCondition} /> },
          { label: 'Công khai', value: <PublicationBadge status={r.publicationStatus} /> }
        ]} />
        <p className="small muted" style={{ marginTop: 'var(--space-2)' }}>
          Đóng báo cáo không tự đồng nghĩa đường đã hết ngập. Các trạng thái được cập nhật riêng.
        </p>
      </section>

      {r.processingStatus === 'needs-info' && r.request ? (
        <Notice
          tone="warning"
          title="Cần bổ sung thông tin"
          actions={<Button size="sm" variant="primary" icon="edit" onClick={() => setSuppOpen(true)}>Bổ sung thông tin</Button>}
        >
          {r.request}
        </Notice>
      ) : null}

      {r.verificationStatus === 'invalid' && r.reason ? (
        <Notice tone="error" title="Báo cáo không hợp lệ">{r.reason}</Notice>
      ) : null}

      <section className="card stack" aria-labelledby="content-title">
        <h2 id="content-title" className="card__title">Thông tin đã gửi</h2>
        <figure className="photo-frame">
          <img src={r.photo} alt={`Ảnh báo cáo tại ${r.place}`} />
          <figcaption className="photo-frame__tag">
            <Icon name={r.photoSource === 'camera' ? 'camera' : 'image'} size={14} />
            {PHOTO_SOURCE[r.photoSource]}
          </figcaption>
        </figure>
        <MiniLocationMap lat={r.lat} lng={r.lng} />
        <InfoList items={[
          { label: 'Vị trí', value: r.place },
          { label: 'Khu vực', value: r.area || '—' },
          { label: 'Nguồn vị trí', value: LOCATION_SOURCE[r.locationSource] + (r.accuracy ? ` · sai số ${r.accuracy} m` : '') },
          { label: 'Quan sát lúc', value: formatFull(r.observedAt) },
          r.capturedAt ? { label: 'Giờ chụp (thiết bị)', value: formatFull(r.capturedAt) } : null,
          r.declaredAt ? { label: 'Giờ người gửi khai báo', value: formatFull(r.declaredAt) } : null,
          { label: 'Máy chủ nhận', value: formatFull(r.receivedAt) }
        ]} />
      </section>

      <section className="card stack" aria-labelledby="ai-title">
        <h2 id="ai-title" className="card__title">AI ước lượng và quan sát của bạn</h2>
        <div className="ai-result-row">
          <div>
            <p className="small muted">AI ước lượng</p>
            <p className="row">
              {r.ai?.status === 'done' || r.ai?.status === 'insufficient'
                ? AI_RESULT[r.ai.outcome]
                : r.ai?.status === 'pending' ? 'Chờ phân tích' : 'Chưa phân tích được'}
              {r.ai?.level ? <SeverityBadge severity={r.ai.level} size="sm" /> : null}
            </p>
          </div>
          <div>
            <p className="small muted">Bạn quan sát</p>
            <p className="row">
              {r.observation?.level ? <SeverityBadge severity={r.observation.level} size="sm" /> : 'Không đề xuất mức'}
            </p>
          </div>
        </div>
        {r.observation?.note ? <p className="small">“{r.observation.note}”</p> : null}
        <p className="small muted">Kết quả AI và quan sát của bạn được giữ riêng để người kiểm tra đối chiếu.</p>
      </section>

      <section className="card" aria-labelledby="hist-title">
        <h2 id="hist-title" className="card__title">Lịch sử xử lý</h2>
        <Timeline history={r.history} />
      </section>

      <Dialog
        open={suppOpen}
        onClose={() => setSuppOpen(false)}
        title="Bổ sung thông tin"
        description={r.request}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuppOpen(false)}>Hủy</Button>
            <Button variant="primary" onClick={submitSupp} loading={suppBusy}>Gửi bổ sung</Button>
          </>
        }
      >
        {suppErr ? <Notice tone="error" live>{suppErr}</Notice> : null}
        <TextArea
          label="Thông tin bổ sung"
          required
          rows={4}
          value={suppNote}
          onChange={(e) => setSuppNote(e.target.value)}
          placeholder="Mô tả rõ vị trí, thời điểm hoặc thông tin còn thiếu…"
          hint="Không ghi họ tên, số điện thoại hay thông tin riêng tư."
        />
      </Dialog>

      <div className="row">
        <Button variant="secondary" icon="map" to="/">Về bản đồ</Button>
      </div>
    </div>
  )
}
