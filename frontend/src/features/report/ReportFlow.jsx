import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '../../components/ui/Button.jsx'
import { TextField, TextArea, ChoiceGroup } from '../../components/ui/Field.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { Notice, InfoList, LiveRegion } from '../../components/ui/Feedback.jsx'
import { DataModeBadge, TimeStamp } from '../../components/ui/Badges.jsx'
import { PhotoCapture } from './PhotoCapture.jsx'
import { LocationPicker } from './LocationPicker.jsx'
import { AIResult } from './AIResult.jsx'
import { useSession } from '../../hooks/useData.js'
import { useOnlineStatus } from '../../hooks/useOnlineStatus.jsx'
import { analyzePhoto, submitReport, NetworkError, AuthError } from '../../services/api.js'
import { sessionDraftStore, saveDraft, getDraft, deleteDraft } from '../../services/drafts.js'
import { APP_CONFIG } from '../../app/config.js'
import { PHOTO_SOURCE, LOCATION_SOURCE, SEVERITY, AI_RESULT } from '../../locales/vi/labels.js'
import { toInputValue, formatFull } from '../../utils/time.js'
import '../../styles/report.css'

const newRequestId = () => `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const OBS_OPTIONS = [
  { value: 'light', label: 'Nhẹ' },
  { value: 'moderate', label: 'Vừa' },
  { value: 'severe', label: 'Nặng' },
  { value: 'unsure', label: 'Không chắc' }
]

const STEPS = ['Ảnh', 'Vị trí và thời điểm', 'Xem lại và gửi']

function Stepper({ step }) {
  return (
    <ol className="stepper" aria-label="Các bước báo ngập">
      {STEPS.map((s, i) => (
        <li key={s} className={`stepper__item ${i < step ? 'is-done' : ''} ${i === step ? 'is-current' : ''}`} aria-current={i === step ? 'step' : undefined}>
          <span className="stepper__bar" aria-hidden="true" />
          <span>Bước {i + 1}. {s}</span>
        </li>
      ))}
    </ol>
  )
}

function emptyDraft(params) {
  const lat = parseFloat(params.get('lat'))
  const lng = parseFloat(params.get('lng'))
  const hasPoint = !Number.isNaN(lat) && !Number.isNaN(lng)
  return {
    id: null,
    step: 0,
    photo: null,
    location: hasPoint
      ? { lat, lng, source: 'manual', place: params.get('ten') || '', inside: true, confirmed: false }
      : null,
    observedAt: toInputValue(new Date()),
    observation: { level: null, note: '' },
    ai: { status: 'pending' },
    requestId: newRequestId()
  }
}

/**
 * Luồng báo ngập 3 bước (mục 7). Trang riêng, không nhồi vào bảng nhỏ.
 * Giữ toàn bộ dữ liệu qua bước đăng nhập và quay lại đúng bước xác nhận (UX06).
 */
export default function ReportFlow() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const routeLoc = useLocation()
  const session = useSession()
  const online = useOnlineStatus()

  const [draft, setDraft] = useState(() => sessionDraftStore.get() || emptyDraft(params))
  const [errors, setErrors] = useState({})
  const [submit, setSubmit] = useState({ state: 'idle', error: null, report: null })
  const [saveMsg, setSaveMsg] = useState(null)
  const [live, setLive] = useState('')
  const aiCtrl = useRef(null)
  const headingRef = useRef(null)

  const patch = useCallback((p) => setDraft((d) => ({ ...d, ...(typeof p === 'function' ? p(d) : p) })), [])

  // Mở lại một nháp đã lưu trên thiết bị (?nhap=...)
  useEffect(() => {
    const id = params.get('nhap')
    if (!id) return
    getDraft(id).then((d) => { if (d) setDraft({ ...d, requestId: d.requestId || newRequestId() }) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Giữ bản nháp trong phiên để sống qua trang Đăng nhập
  useEffect(() => { sessionDraftStore.set(draft) }, [draft])

  // Chuyển bước → đưa focus lên tiêu đề, cuộn về đầu
  useEffect(() => {
    window.scrollTo({ top: 0 })
    headingRef.current?.focus()
  }, [draft.step])

  /* -------- AI: bắt đầu phân tích ngay sau bước 1, trong khi người dùng xác nhận vị trí -------- */
  const runAI = useCallback((photo) => {
    aiCtrl.current?.abort()
    if (!photo) return
    const c = new AbortController()
    aiCtrl.current = c
    patch({ ai: { status: 'analyzing' } })
    const timeout = setTimeout(() => {
      c.abort()
      patch({ ai: { status: 'timeout' } })
    }, APP_CONFIG.ai.timeoutMs)
    analyzePhoto({ size: photo.size }, { signal: c.signal })
      .then((res) => { if (!c.signal.aborted) patch({ ai: res }) })
      .catch((err) => { if (err?.name !== 'AbortError') patch({ ai: { status: 'error' } }) })
      .finally(() => clearTimeout(timeout))
  }, [patch])

  useEffect(() => () => aiCtrl.current?.abort(), [])

  const onPhoto = (photo) => {
    patch({ photo, requestId: newRequestId() })
    setErrors((e) => ({ ...e, photo: null }))
    runAI(photo)
  }

  /* -------- Kiểm tra từng bước -------- */
  function validateStep(step) {
    const e = {}
    if (step === 0 && !draft.photo) e.photo = 'Vui lòng chụp hoặc chọn một ảnh hiện trường.'
    if (step === 1) {
      if (!draft.location?.lat) e.location = 'Vui lòng chọn vị trí điểm ngập.'
      else if (!draft.location.confirmed) e.location = 'Vui lòng xác nhận vị trí của ảnh.'
      if (!draft.location?.place?.trim()) e.place = 'Vui lòng nhập tên đường hoặc mô tả vị trí.'
      if (!draft.observedAt) e.observedAt = 'Vui lòng nhập thời điểm quan sát.'
      else if (new Date(draft.observedAt).getTime() > Date.now() + 60_000) e.observedAt = 'Thời điểm quan sát không thể ở tương lai.'
    }
    setErrors(e)
    return Object.keys(e).filter((k) => e[k]).length === 0
  }

  const goNext = () => { if (validateStep(draft.step)) patch((d) => ({ step: d.step + 1 })) }
  const goBack = () => patch((d) => ({ step: Math.max(0, d.step - 1) }))

  const staleMinutes = draft.observedAt ? (Date.now() - new Date(draft.observedAt).getTime()) / 60000 : 0
  const isStale = staleMinutes > APP_CONFIG.photo.staleAfterMinutes

  /* -------- Lưu nháp trên thiết bị -------- */
  async function onSaveDraft() {
    const res = await saveDraft({ ...draft, ai: draft.ai?.status === 'analyzing' ? { status: 'pending' } : draft.ai })
    if (res.ok) {
      patch({ id: res.draft.id })
      setSaveMsg({ tone: 'success', text: 'Đã lưu nháp trên thiết bị này.' })
    } else if (res.quota) {
      setSaveMsg({ tone: 'error', text: 'Thiết bị không đủ dung lượng để lưu nháp. Nội dung vẫn được giữ trong phiên này; hãy giải phóng bộ nhớ rồi thử lại.' })
    } else {
      setSaveMsg({ tone: 'error', text: 'Chưa lưu được nháp trên thiết bị. Nội dung vẫn được giữ trong phiên này.' })
    }
  }

  /* -------- Gửi -------- */
  async function onSubmit() {
    if (submit.state === 'sending') return
    if (!session) {
      // Mời đăng nhập ngay trước khi gửi, giữ nguyên bản nháp và quay lại đúng bước
      sessionDraftStore.set(draft)
      navigate(`/dang-nhap?tiep=${encodeURIComponent(routeLoc.pathname + routeLoc.search)}`, { state: { reason: 'submit' } })
      return
    }
    setSubmit({ state: 'sending', error: null, report: null })
    setLive('Đang gửi báo cáo')
    try {
      const report = await submitReport({
        place: draft.location.place.trim(),
        area: draft.location.area,
        lat: draft.location.lat,
        lng: draft.location.lng,
        accuracy: draft.location.accuracy,
        locationSource: draft.location.source,
        photo: draft.photo.dataUrl,
        photoSource: draft.photo.source,
        capturedAt: draft.photo.capturedAt,
        declaredAt: draft.photo.source === 'library' ? new Date(draft.observedAt).toISOString() : null,
        observedAt: new Date(draft.observedAt).toISOString(),
        ai: draft.ai?.status === 'analyzing' ? { status: 'pending' } : draft.ai,
        observation: {
          level: draft.observation.level === 'unsure' ? null : draft.observation.level,
          note: draft.observation.note.trim() || null
        }
      }, { requestId: draft.requestId })
      if (draft.id) await deleteDraft(draft.id)
      sessionDraftStore.clear()
      setSubmit({ state: 'done', error: null, report })
      setLive(`Đã gửi báo cáo. Mã báo cáo ${report.id}`)
    } catch (err) {
      if (err instanceof AuthError) {
        // Phiên hết hạn lúc gửi: giữ nháp, mời đăng nhập lại, không tự gửi lại
        sessionDraftStore.set(draft)
        navigate(`/dang-nhap?tiep=${encodeURIComponent(routeLoc.pathname + routeLoc.search)}`, { state: { reason: 'expired' } })
        return
      }
      setSubmit({ state: 'failed', error: err instanceof NetworkError ? 'network' : 'unknown', report: null })
      setLive('Báo cáo chưa được gửi')
    }
  }

  /* ================= Màn hình thành công ================= */
  if (submit.state === 'done' && submit.report) {
    const r = submit.report
    return (
      <div className="report-shell">
        <ReportTopBar />
        <main id="main" className="page page--narrow">
          <LiveRegion message={live} />
          <section className="success" aria-labelledby="success-title">
            <span className="success__icon" aria-hidden="true"><Icon name="check-circle" size={40} /></span>
            <h1 id="success-title" className="page-title" tabIndex={-1} ref={headingRef}>Đã gửi vào hệ thống thử nghiệm</h1>
            <p className="muted">Báo cáo đang được kiểm tra trước khi công khai trên bản đồ.</p>
          </section>
          <section className="card">
            <InfoList items={[
              { label: 'Mã báo cáo', value: <strong className="mono">{r.id}</strong> },
              { label: 'Thời gian gửi', value: formatFull(r.receivedAt) },
              { label: 'Trạng thái', value: 'Đã gửi · Chờ kiểm tra' },
              { label: 'Nơi tiếp nhận', value: <span className="row">Hệ thống thử nghiệm <DataModeBadge mode="demo" size="sm" /></span> }
            ]} />
          </section>
          <div className="actions-bar actions-bar--stretch">
            <Button variant="primary" to={`/bao-cao/${r.id}`}>Xem báo cáo</Button>
            <Button variant="secondary" to="/">Về bản đồ</Button>
          </div>
        </main>
      </div>
    )
  }

  /* ================= Các bước ================= */
  return (
    <div className="report-shell">
      <ReportTopBar />
      <main id="main" className="page page--narrow report-page">
        <LiveRegion message={live} />
        <header className="stack">
          <h1 className="page-title" tabIndex={-1} ref={headingRef}>
            {draft.step === 0 ? 'Báo điểm ngập' : draft.step === 1 ? 'Xác nhận vị trí và thời điểm' : 'Xem lại và gửi báo cáo'}
          </h1>
          <Stepper step={draft.step} />
        </header>

        {!online ? (
          <Notice tone="offline" title="Đang mất kết nối mạng">
            Nội dung đang nhập vẫn được giữ. Bạn có thể lưu nháp trên thiết bị và gửi khi có mạng.
          </Notice>
        ) : null}

        {saveMsg ? <Notice tone={saveMsg.tone} live>{saveMsg.text}</Notice> : null}

        {/* ---------- Bước 1: Ảnh ---------- */}
        {draft.step === 0 ? (
          <section className="stack" aria-label="Cung cấp ảnh">
            <p className="muted">Chụp ảnh nơi đang ngập. Bước sau bạn sẽ xác nhận vị trí và thời điểm.</p>
            {errors.photo ? <Notice tone="error" live>{errors.photo}</Notice> : null}
            <PhotoCapture photo={draft.photo} onChange={onPhoto} allowLibrary />
          </section>
        ) : null}

        {/* ---------- Bước 2: Vị trí và thời điểm ---------- */}
        {draft.step === 1 ? (
          <>
            {Object.values(errors).filter(Boolean).length > 1 ? (
              <Notice tone="error" title="Vui lòng kiểm tra lại" live>
                <ul className="error-summary">
                  {Object.entries(errors).filter(([, v]) => v).map(([k, v]) => <li key={k}><a href={`#f-${k}`}>{v}</a></li>)}
                </ul>
              </Notice>
            ) : null}

            <section className="card stack" aria-labelledby="loc-title" id="f-location">
              <h2 id="loc-title" className="card__title">Vị trí điểm ngập</h2>
              <p className="small muted">Vị trí hiện tại của bạn có thể khác nơi chụp ảnh. Hãy đặt ghim đúng chỗ ngập.</p>
              <LocationPicker
                value={draft.location}
                onChange={(loc) => patch({ location: loc })}
                error={errors.location && draft.location?.lat ? null : errors.location}
              />
              <TextField
                id="f-place"
                label="Tên đường hoặc mô tả vị trí"
                hint="Có thể sửa tên hiển thị nếu gợi ý chưa đúng."
                value={draft.location?.place || ''}
                onChange={(e) => patch((d) => ({ location: { ...(d.location || {}), place: e.target.value, placeEdited: true } }))}
                error={errors.place}
                required
                autoComplete="off"
              />
              {draft.location?.lat ? (
                <div className={`confirm-box ${draft.location.confirmed ? 'is-on' : ''}`}>
                  <input
                    id="confirm-loc"
                    type="checkbox"
                    checked={!!draft.location.confirmed}
                    onChange={(e) => patch((d) => ({ location: { ...d.location, confirmed: e.target.checked } }))}
                  />
                  <label htmlFor="confirm-loc">
                    <strong>Tôi xác nhận đây là vị trí trong ảnh</strong>
                    <span className="small muted">{LOCATION_SOURCE[draft.location.source]}</span>
                  </label>
                </div>
              ) : null}
              {errors.location && draft.location?.lat ? <p className="field__error"><Icon name="error" size={16} /><span>{errors.location}</span></p> : null}
            </section>

            <section className="card stack" aria-labelledby="time-title">
              <h2 id="time-title" className="card__title">Thời điểm quan sát</h2>
              {draft.photo?.capturedAt ? (
                <p className="small">Thời gian chụp do website ghi nhận: <strong>{formatFull(draft.photo.capturedAt)}</strong></p>
              ) : (
                <Notice tone="info">Ảnh có sẵn trên thiết bị: hãy khai báo thời điểm bạn quan sát thấy ngập. Giờ gửi không được dùng làm giờ chụp.</Notice>
              )}
              <TextField
                id="f-observedAt"
                type="datetime-local"
                label={draft.photo?.source === 'library' ? 'Thời điểm quan sát (bạn khai báo)' : 'Thời điểm quan sát'}
                value={draft.observedAt}
                max={toInputValue(new Date())}
                onChange={(e) => patch({ observedAt: e.target.value })}
                error={errors.observedAt}
                required
              />
              {isStale && !errors.observedAt ? (
                <Notice tone="warning">Thời điểm này đã cách đây khá lâu. Tình trạng ngập có thể đã thay đổi; báo cáo vẫn được gửi để kiểm tra.</Notice>
              ) : null}
            </section>

            <section className="stack" aria-label="Phân tích ảnh">
              <h2 className="section-title">Phân tích ảnh</h2>
              <AIResult state={draft.ai} onRetry={() => runAI(draft.photo)} onRetake={() => patch({ step: 0, photo: null, ai: { status: 'pending' } })} />
            </section>
          </>
        ) : null}

        {/* ---------- Bước 3: Xem lại và gửi ---------- */}
        {draft.step === 2 ? (
          <>
            <section className="card stack" aria-labelledby="rv-title">
              <div className="card__head">
                <h2 id="rv-title" className="card__title">Thông tin báo cáo</h2>
                <Button size="sm" variant="ghost" icon="edit" onClick={() => patch({ step: 1 })}>Sửa</Button>
              </div>
              <div className="review-grid">
                <figure className="photo-frame">
                  <img src={draft.photo.dataUrl} alt="Ảnh hiện trường sẽ gửi" />
                  <figcaption className="photo-frame__tag">
                    <Icon name={draft.photo.source === 'camera' ? 'camera' : 'image'} size={14} />
                    {PHOTO_SOURCE[draft.photo.source]}
                  </figcaption>
                </figure>
                <InfoList items={[
                  { label: 'Vị trí', value: draft.location.place },
                  { label: 'Nguồn vị trí', value: LOCATION_SOURCE[draft.location.source] },
                  { label: 'Thời điểm quan sát', value: formatFull(new Date(draft.observedAt)) },
                  { label: 'Nguồn ảnh', value: PHOTO_SOURCE[draft.photo.source] }
                ]} />
              </div>
            </section>

            <section className="stack" aria-label="Kết quả phân tích">
              <h2 className="section-title">AI ước lượng</h2>
              <AIResult state={draft.ai} onRetry={() => runAI(draft.photo)} onRetake={() => patch({ step: 0, photo: null, ai: { status: 'pending' } })} />
            </section>

            <section className="card stack" aria-labelledby="obs-title">
              <h2 id="obs-title" className="card__title">Người gửi quan sát</h2>
              <p className="small muted">Bạn có thể đề xuất mức khác với AI. Kết quả AI vẫn được giữ nguyên để kiểm tra.</p>
              <ChoiceGroup
                legend="Mức ngập bạn thấy"
                value={draft.observation.level}
                onChange={(v) => patch((d) => ({ observation: { ...d.observation, level: v } }))}
                options={OBS_OPTIONS}
                columns={4}
              />
              <TextArea
                label="Mô tả thêm"
                optional
                rows={3}
                maxLength={500}
                placeholder="Ví dụ: nước ngập ngang mắt cá chân, xe máy đi chậm…"
                value={draft.observation.note}
                onChange={(e) => patch((d) => ({ observation: { ...d.observation, note: e.target.value } }))}
                hint="Không ghi họ tên, số điện thoại hay thông tin riêng tư."
              />
            </section>

            {!session ? (
              <Notice tone="info" title="Cần đăng nhập để gửi">
                Bấm Gửi báo cáo, bạn sẽ đăng nhập rồi quay lại đúng bước này. Ảnh và thông tin đã nhập được giữ nguyên.
              </Notice>
            ) : null}

            {submit.state === 'failed' ? (
              <Notice
                tone="error"
                title="Báo cáo chưa được gửi"
                live
                actions={
                  <>
                    <Button size="sm" variant="primary" icon="refresh" onClick={onSubmit}>Gửi lại</Button>
                    <Button size="sm" variant="secondary" icon="save" onClick={onSaveDraft}>Lưu nháp</Button>
                  </>
                }
              >
                {submit.error === 'network'
                  ? 'Không kết nối được máy chủ. Nội dung vẫn đang được giữ trong phiên này. Gửi lại sẽ dùng cùng mã yêu cầu nên không tạo báo cáo trùng.'
                  : 'Đã có lỗi khi gửi. Nội dung vẫn đang được giữ trong phiên này.'}
              </Notice>
            ) : null}
          </>
        ) : null}

        {/* ---------- Thanh hành động ---------- */}
        <div className="sticky-actions">
          {draft.step > 0 ? (
            <Button variant="ghost" icon="chevron-left" onClick={goBack} disabled={submit.state === 'sending'}>Quay lại</Button>
          ) : null}
          {draft.step > 0 ? (
            <Button variant="secondary" icon="save" onClick={onSaveDraft} disabled={submit.state === 'sending'}>Lưu nháp</Button>
          ) : null}
          {draft.step < 2 ? (
            <Button variant="primary" iconRight="chevron-right" onClick={goNext} disabled={draft.step === 0 && !draft.photo}>Tiếp tục</Button>
          ) : (
            <Button variant="primary" icon="send" onClick={onSubmit} loading={submit.state === 'sending'} disabled={!online && !!session}>
              {submit.state === 'sending' ? 'Đang gửi…' : 'Gửi báo cáo'}
            </Button>
          )}
        </div>
      </main>
    </div>
  )
}

function ReportTopBar() {
  return (
    <header className="report-top">
      <Link to="/" className="back-link"><Icon name="arrow-left" size={20} /><span>Về bản đồ</span></Link>
      {APP_CONFIG.dataMode === 'demo' ? <DataModeBadge mode="demo" size="sm" /> : null}
    </header>
  )
}
