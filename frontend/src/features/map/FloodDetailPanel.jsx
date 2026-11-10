import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, IconButton } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import {
  SeverityBadge, VerificationBadge, FloodConditionBadge, DataModeBadge, TimeStamp
} from '../../components/ui/Badges.jsx'
import { InfoList, Notice, Skeleton } from '../../components/ui/Feedback.jsx'
import { SEVERITY, AI_RESULT, PHOTO_SOURCE, LOCATION_SOURCE, PROCESSING } from '../../locales/vi/labels.js'
import { formatFull } from '../../utils/time.js'
import { ConditionConfirm } from './ConditionConfirm.jsx'

function AiSummary({ ai }) {
  if (!ai || ai.status === 'pending') return 'Chưa phân tích'
  if (ai.status === 'error') return 'Chưa phân tích được'
  const base = AI_RESULT[ai.outcome] || 'Không đủ thông tin'
  return ai.level ? `${base} · ước lượng ${SEVERITY[ai.level].toLowerCase()}` : base
}

/**
 * Chi tiết điểm ngập (mục 6.5). Thông tin đầu: tên, mức, thời điểm, cập nhật, ảnh.
 * Bên dưới: nguồn, xác minh, mức AI và mô tả người gửi nếu khác nhau.
 */
export function FloodDetailPanel({ point, loading, onClose, onShowRoads, headingRef }) {
  const [more, setMore] = useState(false)

  if (loading || !point) {
    return (
      <div className="detail-panel" aria-busy="true">
        <div className="detail-panel__top">
          <Skeleton width="60%" height={22} />
          <IconButton icon="close" label="Đóng chi tiết" onClick={onClose} />
        </div>
        <Skeleton height={180} radius={12} />
        <Skeleton width="80%" />
        <Skeleton width="50%" />
      </div>
    )
  }

  const aiDiffers = point.ai?.level && point.observation?.level && point.ai.level !== point.observation.level

  return (
    <article className="detail-panel" aria-labelledby="detail-title">
      <div className="detail-panel__top">
        <button type="button" className="back-link" onClick={onClose}>
          <Icon name="chevron-left" />
          <span>Danh sách</span>
        </button>
        <IconButton icon="close" label="Đóng chi tiết" onClick={onClose} />
      </div>

      <header className="detail-panel__head">
        <h2 id="detail-title" className="detail-panel__title" ref={headingRef} tabIndex={-1}>{point.place}</h2>
        <div className="row">
          <SeverityBadge severity={point.severity} />
          <FloodConditionBadge status={point.floodCondition} size="sm" />
          {point.dataMode === 'demo' ? <DataModeBadge mode="demo" size="sm" /> : null}
        </div>
        <p className="small muted">
          <TimeStamp value={point.observedAt} prefix="Ghi nhận" />
        </p>
        <p className="small muted">
          <TimeStamp value={point.updatedAt} prefix="Cập nhật" />
        </p>
      </header>

      {point.photo ? (
        <figure className="photo-frame">
          <img src={point.photo} alt={`Ảnh hiện trường tại ${point.place}`} />
          <figcaption className="photo-frame__tag">
            <Icon name={point.photoSource === 'camera' ? 'camera' : 'image'} size={14} />
            {point.photoSource === 'camera' ? 'Chụp trực tiếp' : 'Ảnh có sẵn'}
          </figcaption>
        </figure>
      ) : null}

      {point.severity === 'unknown' ? (
        <Notice tone="info" title="Chưa xác định mức ngập">
          Ảnh chưa đủ rõ để ước lượng. Báo cáo vẫn được ghi nhận để kiểm tra; điều này không có nghĩa là không ngập.
        </Notice>
      ) : null}

      <section className="detail-panel__section">
        <InfoList items={[
          { label: 'Nguồn', value: point.source },
          { label: 'Xác minh', value: <VerificationBadge status={point.verificationStatus} size="sm" /> },
          { label: 'AI ước lượng', value: <AiSummary ai={point.ai} /> },
          point.observation?.level || point.observation?.note ? {
            label: 'Người gửi quan sát',
            value: (
              <>
                {point.observation.level ? SEVERITY[point.observation.level] : null}
                {point.observation.note ? <span className="block muted small">“{point.observation.note}”</span> : null}
              </>
            )
          } : null,
          { label: 'Vị trí', value: LOCATION_SOURCE[point.locationSource] },
          { label: 'Ảnh', value: PHOTO_SOURCE[point.photoSource] }
        ]} />
        {aiDiffers ? (
          <p className="small muted">AI ước lượng và người gửi quan sát khác nhau; cả hai được giữ để kiểm tra.</p>
        ) : null}
      </section>

      <ConditionConfirm key={point.id} point={point} />

      <div className="detail-panel__actions">
        <Button variant="secondary" icon="road" onClick={onShowRoads}>Xem đường bị ảnh hưởng</Button>
        <Button variant="primary" icon="camera" to={`/bao-ngap?lat=${point.lat}&lng=${point.lng}&ten=${encodeURIComponent(point.place)}`}>
          Báo thông tin mới tại đây
        </Button>
      </div>

      <button type="button" className="disclosure" aria-expanded={more} onClick={() => setMore((m) => !m)}>
        <span>Lịch sử cập nhật và tình trạng xử lý</span>
        <Icon name={more ? 'chevron-up' : 'chevron-down'} />
      </button>
      {more ? (
        <section className="detail-panel__section">
          <p className="small"><strong>Xử lý:</strong> {PROCESSING[point.processingStatus]}</p>
          <ol className="timeline">
            {point.history.map((h, i) => (
              <li key={i} className="timeline__item">
                <span className={`timeline__dot timeline__dot--${h.kind}`} aria-hidden="true" />
                <p className="timeline__text">{h.text}</p>
                <p className="timeline__meta">{h.actor} · <time dateTime={h.at}>{formatFull(h.at)}</time></p>
              </li>
            ))}
          </ol>
          {point.related?.length ? (
            <>
              <h3 className="small"><strong>Điểm khác cùng khu vực</strong></h3>
              <ul className="related-list">
                {point.related.map((r) => (
                  <li key={r.id}>
                    <Link to={`/diem-ngap/${r.id}`}>{r.place}</Link>
                    <span className="small muted"> · {SEVERITY[r.severity]}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}
    </article>
  )
}
