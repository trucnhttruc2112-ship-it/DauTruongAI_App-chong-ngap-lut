import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { Notice, EmptyState, ListSkeleton, PageHeader, Card } from '../../components/ui/Feedback.jsx'
import { SeverityBadge, DataModeBadge, TimeStamp } from '../../components/ui/Badges.jsx'
import { useResource } from '../../hooks/useData.js'
import { getAffectedRoads, getFloodPoints } from '../../services/api.js'
import { useMapState } from '../map/mapState.jsx'
import '../../styles/pages.css'

/**
 * Đường bị ảnh hưởng (mục 10): danh sách đoạn có dữ liệu, kết nối lớp trên bản đồ.
 * Mục chỉ có điểm → "Điểm ngập tại đường X", không mô tả cả tuyến bị chặn.
 */
export default function AffectedRoadsPage() {
  const navigate = useNavigate()
  const { setLayers } = useMapState()
  const roadsRes = useResource(getAffectedRoads, [])
  const pointsRes = useResource(({ signal }) => getFloodPoints({ signal }), [])
  const roads = roadsRes.data || []

  // Điểm ngập đơn lẻ (chưa có đoạn) ở khu trình diễn
  const pointOnly = (pointsRes.data?.items || [])
    .filter((p) => p.severity !== 'unknown' && !roads.some((r) => r.reportId === p.id))
    .slice(0, 3)

  function openOnMap() {
    setLayers((l) => ({ ...l, roads: true }))
    navigate('/')
  }

  return (
    <div className="page">
      <PageHeader
        title="Đường bị ảnh hưởng"
        description="Danh sách các đoạn đường có dữ liệu ảnh hưởng do ngập, kết nối với lớp trên bản đồ."
        actions={<Button variant="primary" icon="map" onClick={openOnMap}>Mở lớp trên bản đồ</Button>}
      />

      <Notice tone="info">
        Chỉ các đoạn có hình học hoặc liên kết được xác nhận mới được vẽ trên bản đồ. Một điểm báo ngập đơn lẻ không tự kéo dài thành cả con đường bị ngập.
      </Notice>

      {roadsRes.loading ? <ListSkeleton rows={3} /> : roadsRes.error ? (
        <Notice tone="error" title="Chưa tải được danh sách" live actions={<Button size="sm" variant="secondary" onClick={roadsRes.reload}>Thử lại</Button>}>
          Danh sách vẫn sẽ hiển thị khi có kết nối lại.
        </Notice>
      ) : roads.length ? (
        <ul className="road-list">
          {roads.map((r) => (
            <li key={r.id}>
              <Card className="road-card">
                <div className="road-card__head">
                  <h2 className="road-card__title">{r.name}</h2>
                  <SeverityBadge severity={r.severity} />
                </div>
                {r.hasGeometry ? (
                  <p className="road-card__segment">
                    <span className="road-card__line" style={{ background: '#DC2626' }} aria-hidden="true" />
                    Đoạn: {r.from} → {r.to}
                  </p>
                ) : (
                  <p className="road-card__segment">
                    <Icon name="pin" size={16} />
                    Điểm ngập tại đường {r.name} – chưa có dữ liệu cho toàn tuyến
                  </p>
                )}
                <TimeStamp value={r.observedAt} prefix="Ghi nhận" />
                <div className="row row--between">
                  <span className="source-label">
                    {r.dataMode === 'demo' ? <DataModeBadge mode="demo" size="sm" /> : null}
                    <span>Nguồn: {r.source}</span>
                  </span>
                  <Button size="sm" variant="secondary" onClick={openOnMap}>Xem trên bản đồ</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="road"
          title="Chưa có đoạn đường nào được ghi nhận ảnh hưởng"
          description="Danh sách sẽ có khi có báo cáo ngập kèm liên kết đoạn đường được xác nhận."
          actions={<Button variant="secondary" to="/">Về bản đồ</Button>}
        />
      )}

      {pointOnly.length ? (
        <section className="stack" aria-labelledby="pointonly-title">
          <h2 id="pointonly-title" className="section-title">Điểm ngập chưa gắn với đoạn đường</h2>
          <p className="small muted">Các điểm này được ghi nhận nhưng chưa đủ dữ liệu để mô tả cả tuyến.</p>
          <ul className="road-list">
            {pointOnly.map((p) => (
              <li key={p.id}>
                <Card className="road-card">
                  <div className="road-card__head">
                    <h3 className="road-card__title">Điểm ngập tại {p.place}</h3>
                    <SeverityBadge severity={p.severity} size="sm" />
                  </div>
                  <TimeStamp value={p.observedAt} prefix="Ghi nhận" />
                  <div className="row">
                    <Button size="sm" variant="secondary" to={`/diem-ngap/${p.id}`}>Xem chi tiết</Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Notice tone="info" title="Tìm đường thay thế chưa được bật">
        Chức năng tính tuyến tránh ngập chỉ hoạt động khi có dịch vụ tính tuyến và dữ liệu ngập phù hợp. Xem trạng thái tại trang <strong>Tìm đường</strong>.
      </Notice>
    </div>
  )
}
