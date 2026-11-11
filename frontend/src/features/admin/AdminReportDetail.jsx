import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { Dialog } from '../../components/ui/Dialog.jsx'
import { TextArea, ChoiceGroup } from '../../components/ui/Field.jsx'
import { Notice, ListSkeleton, InfoList, Card, ResourceError } from '../../components/ui/Feedback.jsx'
import {
  SeverityBadge, VerificationBadge, ProcessingBadge, FloodConditionBadge, PublicationBadge, DataModeBadge
} from '../../components/ui/Badges.jsx'
import { FloodMap } from '../map/FloodMap.jsx'
import { useResource } from '../../hooks/useData.js'
import {
  getReport, updateReportStatus, confirmFloodCondition, addAdminNote,
  allowedActions, ACTION_META, ConflictError
} from '../../services/api.js'
import { AI_RESULT, PHOTO_SOURCE, LOCATION_SOURCE, SEVERITY } from '../../locales/vi/labels.js'
import { formatFull, formatRelative } from '../../utils/time.js'

/**
 * Chi tiết báo cáo phía phường (mục 11.2).
 * Cột nội dung: ảnh, bản đồ, thời gian/vị trí, AI, quan sát. Cột thao tác: xác minh, xử lý,
 * xác nhận vẫn ngập/hết ngập, phản hồi, lịch sử.
 */
export default function AdminReportDetail() {
  const { id } = useParams()
  const res = useResource(({ signal }) => getReport(id, { signal }), [id], { topic: 'reports' })
  const r = res.data
  const [dlg, setDlg] = useState(null) // { kind: 'action'|'condition'|'note', action?, condition? }
  const [reason, setReason] = useState('')
  const [closeOutcome, setCloseOutcome] = useState('unchanged')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [conflict, setConflict] = useState(false)
  const [ok, setOk] = useState(null)

  function open(d) { setDlg(d); setReason(''); setErr(null); setCloseOutcome('unchanged') }

  async function confirm() {
    if (busy || !dlg) return
    const meta = dlg.kind === 'action' ? ACTION_META[dlg.action] : null
    if (meta?.needsReason && !reason.trim()) { setErr('Vui lòng nhập lý do.'); return }
    if (dlg.kind === 'action' && dlg.action === 'close' && closeOutcome === 'other' && !reason.trim()) { setErr('Đóng với kết quả khác dự kiến cần ghi lý do.'); return }
    if (dlg.kind === 'note' && !reason.trim()) { setErr('Vui lòng nhập nội dung phản hồi.'); return }
    setBusy(true); setErr(null)
    try {
      if (dlg.kind === 'action') {
        await updateReportStatus(r.id, { action: dlg.action, reason: reason.trim(), version: r.version, closeOutcome: closeOutcome === 'confirmed-clear' ? 'confirmed-clear' : null })
        setOk(`Đã cập nhật: ${meta.label}`)
      } else if (dlg.kind === 'condition') {
        await confirmFloodCondition(r.id, { condition: dlg.condition, note: reason.trim(), version: r.version })
        setOk(dlg.condition === 'confirmed-clear' ? 'Đã xác nhận hết ngập.' : 'Đã xác nhận vẫn còn ngập.')
      } else {
        await addAdminNote(r.id, { text: reason.trim(), version: r.version })
        setOk('Đã gửi phản hồi cho người gửi.')
      }
      setDlg(null)
      res.reload()
    } catch (e) {
      if (e instanceof ConflictError) { setConflict(true); setDlg(null) }
      else setErr(e.message || 'Chưa cập nhật được. Vui lòng thử lại.')
    }
    setBusy(false)
  }

  if (res.loading && !r) return <div className="admin-page"><ListSkeleton rows={4} /></div>
  if (res.error && !r) return <div className="admin-page"><ResourceError resource={res} label="báo cáo" /><Button to="/quan-ly/ban-do">Về trang phường</Button></div>
  if (!r) return <div className="admin-page"><Notice tone="error" title="Không tìm thấy báo cáo">{res.error?.message}</Notice><Button variant="secondary" to="/quan-ly">Về danh sách</Button></div>

  const actions = allowedActions(r)
  const meta = dlg?.kind === 'action' ? ACTION_META[dlg.action] : null
  const aiText = r.ai?.status === 'done' || r.ai?.status === 'insufficient' ? AI_RESULT[r.ai.outcome] : 'Chưa có kết quả AI'

  return (
    <div className="admin-page">
      <Link to="/quan-ly" className="back-link"><Icon name="chevron-left" /> Danh sách báo cáo</Link>
      <Link to="/quan-ly/ban-do" className="back-link"><Icon name="map" /> Về trang phường</Link>
      <ResourceError resource={res} label="cập nhật báo cáo" />
      <header className="row row--between">
        <div>
          <h1 className="page-title">{r.place}</h1>
          <p className="small muted"><span className="mono">{r.id}</span> · {r.area} · nhận {formatFull(r.receivedAt)} · phiên bản {r.version}</p>
        </div>
        <div className="row"><SeverityBadge severity={r.severity} /><DataModeBadge mode="demo" size="sm" /></div>
      </header>

      {conflict ? (
        <Notice tone="warning" title="Báo cáo đã có phiên bản mới" live actions={<Button size="sm" variant="primary" icon="refresh" onClick={() => { setConflict(false); res.reload() }}>Tải lại</Button>}>
          Người khác vừa cập nhật báo cáo này. Tải lại để xem thay đổi trước khi thao tác, tránh ghi đè.
        </Notice>
      ) : null}
      {ok ? <Notice tone="success" live>{ok}</Notice> : null}

      <div className="admin-detail">
        {/* ----- Cột nội dung ----- */}
        <div className="stack stack--lg">
          <Card className="stack">
            {r.photo ? (
              <figure className="photo-frame photo-frame--wide">
                <img src={r.photo} alt={`Ảnh hiện trường ${r.place}`} />
                <figcaption className="photo-frame__tag"><Icon name={r.photoSource === 'camera' ? 'camera' : 'image'} size={14} />{PHOTO_SOURCE[r.photoSource]}</figcaption>
              </figure>
            ) : <p className="small muted">Điểm này chưa có ảnh hiện trường.</p>}
            <div className="mini-map">
              <FloodMap points={[r]} selectedId={r.id} layers={{ active: true }} initialView={{ center: [r.lat, r.lng], zoom: 16 }} label="Vị trí báo cáo" />
            </div>
            <InfoList items={[
              { label: 'Vị trí', value: `${r.place} (${r.lat.toFixed(5)}, ${r.lng.toFixed(5)})` },
              { label: 'Nguồn vị trí', value: LOCATION_SOURCE[r.locationSource] + (r.accuracy ? ` · sai số ${r.accuracy} m` : '') },
              { label: 'Quan sát lúc', value: formatFull(r.observedAt) },
              r.capturedAt ? { label: 'Giờ chụp (thiết bị)', value: formatFull(r.capturedAt) } : null,
              r.declaredAt ? { label: 'Giờ người gửi khai báo', value: formatFull(r.declaredAt) } : null,
              { label: 'Máy chủ nhận', value: formatFull(r.receivedAt) }
            ]} />
          </Card>
          <Card className="stack">
            <h2 className="card__title">AI ước lượng và người gửi quan sát</h2>
            <div className="ai-result-row">
              <div><p className="small muted">AI ước lượng</p><p className="row">{aiText}{r.ai?.level ? <SeverityBadge severity={r.ai.level} size="sm" /> : null}</p></div>
              <div><p className="small muted">Người gửi quan sát</p><p className="row">{r.observation?.level ? <SeverityBadge severity={r.observation.level} size="sm" /> : 'Không đề xuất mức'}</p></div>
            </div>
            {r.observation?.note ? <p className="small">“{r.observation.note}”</p> : null}
            {r.extraNote ? <Notice tone="info" title="Người gửi đã bổ sung">{r.extraNote}</Notice> : null}
            <p className="small muted">Nguồn đối chiếu: Chưa có nguồn đối chiếu (trạm đo, camera giao thông chưa kết nối).</p>
          </Card>
          {r.observations?.length ? (
            <Card className="stack">
              <h2 className="card__title">Quan sát mới từ người dân</h2>
              <ul className="obs-list">
                {r.observations.map((o, i) => (
                  <li key={i}>
                    <Icon name={o.still ? 'water' : 'check-circle'} size={18} />
                    <span><strong>{o.still ? 'Vẫn còn ngập' : 'Đã hết ngập'}</strong>{o.level ? ` · ${SEVERITY[o.level]}` : ''}{o.note ? ` – “${o.note}”` : ''}<span className="small muted"> · {formatRelative(o.at)}</span></span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        {/* ----- Cột thao tác ----- */}
        <div className="stack stack--lg">
          <Card className="stack">
            <h2 className="card__title">Trạng thái</h2>
            <InfoList items={[
              { label: 'Xác minh', value: <VerificationBadge status={r.verificationStatus} /> },
              { label: 'Xử lý', value: <ProcessingBadge status={r.processingStatus} /> },
              { label: 'Tình trạng ngập', value: <FloodConditionBadge status={r.floodCondition} /> },
              { label: 'Công khai', value: <PublicationBadge status={r.publicationStatus} /> }
            ]} />
          </Card>

          <Card className="stack condition-card">
            <h2 className="card__title">Xác nhận tình trạng ngập</h2>
            {r.floodCondition === 'reported-clear' ? (
              <Notice tone="warning">Người dân đã báo hết ngập. Kiểm tra hiện trường hoặc nguồn đối chiếu rồi xác nhận.</Notice>
            ) : null}
            <div className="condition-box__actions">
              <button type="button" className="condition-btn condition-btn--still" disabled={r.floodCondition === 'active'} onClick={() => open({ kind: 'condition', condition: 'active' })}>
                <Icon name="water" size={22} /><span><strong>Vẫn ngập</strong><span className="small">Giữ trên bản đồ</span></span>
              </button>
              <button type="button" className="condition-btn condition-btn--clear" disabled={r.floodCondition === 'confirmed-clear'} onClick={() => open({ kind: 'condition', condition: 'confirmed-clear' })}>
                <Icon name="check-circle" size={22} /><span><strong>Đã hết ngập</strong><span className="small">Gỡ khỏi lớp đang ngập</span></span>
              </button>
            </div>
            <p className="small muted">Tình trạng ngập độc lập với xử lý: xác nhận hết ngập không tự đóng báo cáo, đóng báo cáo không tự thành hết ngập.</p>
          </Card>

          <Card className="stack">
            <h2 className="card__title">Xác minh và xử lý</h2>
            <div className="admin-actions">
              {actions.map((a) => (
                <Button key={a} variant={ACTION_META[a].tone === 'danger' ? 'danger' : ACTION_META[a].tone === 'primary' ? 'primary' : 'secondary'} onClick={() => open({ kind: 'action', action: a })}>
                  {ACTION_META[a].label}
                </Button>
              ))}
              {!actions.length ? <p className="small muted">Không còn hành động phù hợp với trạng thái hiện tại.</p> : null}
            </div>
            <Button variant="ghost" icon="send" onClick={() => open({ kind: 'note' })}>Phản hồi người gửi</Button>
          </Card>

          <Card>
            <h2 className="card__title">Lịch sử</h2>
            <ol className="timeline">
              {r.history.map((h, i) => (
                <li key={i} className="timeline__item">
                  <span className={`timeline__dot timeline__dot--${h.kind}`} aria-hidden="true" />
                  <p className="timeline__text">{h.text}</p>
                  <p className="timeline__meta">{h.actor} · <time dateTime={h.at} title={formatFull(h.at)}>{formatRelative(h.at)}</time></p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <Dialog
        open={!!dlg}
        busy={busy}
        onClose={() => setDlg(null)}
        title={dlg?.kind === 'condition' ? (dlg.condition === 'confirmed-clear' ? 'Xác nhận đã hết ngập' : 'Xác nhận vẫn còn ngập') : dlg?.kind === 'note' ? 'Phản hồi người gửi' : meta?.label}
        description={r.place}
        footer={<><Button variant="ghost" onClick={() => setDlg(null)} disabled={busy}>Hủy</Button><Button variant={meta?.tone === 'danger' ? 'danger' : 'primary'} onClick={confirm} loading={busy}>Xác nhận</Button></>}
      >
        {err ? <Notice tone="error" live>{err}</Notice> : null}
        {dlg?.kind === 'action' && dlg.action === 'close' ? (
          <ChoiceGroup legend="Kết quả xử lý" value={closeOutcome} onChange={setCloseOutcome} columns={1} options={[
            { value: 'unchanged', label: 'Giữ nguyên tình trạng ngập', description: 'Đóng báo cáo, không đổi tình trạng ngập' },
            { value: 'confirmed-clear', label: 'Đồng thời xác nhận hết ngập', description: 'Chỉ chọn khi đã kiểm tra nước rút' },
            { value: 'other', label: 'Kết quả khác dự kiến', description: 'Cần ghi lý do' }
          ]} />
        ) : null}
        {dlg?.kind === 'condition' && dlg.condition === 'confirmed-clear' ? (
          <Notice tone="info">Điểm sẽ không còn ở lớp “Đang được báo ngập”. Lịch sử vẫn được giữ.</Notice>
        ) : null}
        {(dlg?.kind !== 'action' || meta?.needsReason || meta?.reasonLabel) ? (
          <TextArea
            label={dlg?.kind === 'note' ? 'Nội dung phản hồi (người gửi sẽ thấy)' : dlg?.kind === 'condition' ? 'Căn cứ xác nhận' : meta?.reasonLabel || 'Lý do'}
            required={dlg?.kind === 'note' || !!meta?.needsReason}
            optional={dlg?.kind === 'condition' || (!meta?.needsReason && dlg?.kind === 'action')}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        ) : null}
      </Dialog>
    </div>
  )
}
