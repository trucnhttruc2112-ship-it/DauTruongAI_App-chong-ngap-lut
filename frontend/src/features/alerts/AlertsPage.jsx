import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { Notice, EmptyState, ListSkeleton, Tabs, PageHeader, Card, ResourceError } from '../../components/ui/Feedback.jsx'
import { SeverityBadge, DataModeBadge, TimeStamp } from '../../components/ui/Badges.jsx'
import { useResource } from '../../hooks/useData.js'
import { getFloodPoints, getForecasts } from '../../services/api.js'
import { APP_CONFIG } from '../../app/config.js'
import { SEVERITY } from '../../locales/vi/labels.js'
import { formatShort, formatRelative } from '../../utils/time.js'
import { DEFAULT_AREA_NAME, SEVERITY_ORDER } from '../../locales/vi/labels.js'
import '../../styles/pages.css'

function RainBars({ rain }) {
  const max = Math.max(...rain.map((h) => h.mm), 1)
  return (
    <div className="rain-chart">
      <div className="rain-chart__bars" role="img" aria-label={`Lượng mưa dự báo 12 giờ, cao nhất ${max} mm/giờ`}>
        {rain.map((h, i) => (
          <div key={i} className="rain-chart__col" title={`${formatShort(h.at)}: ${h.mm} mm, xác suất mưa ${h.probability}%`}>
            <span className="rain-chart__bar" style={{ height: `${Math.max(4, (h.mm / max) * 100)}%` }} />
            <span className="rain-chart__hour">{new Date(h.at).getHours()}h</span>
          </div>
        ))}
      </div>
      <p className="small muted">
        Lượng mưa theo giờ (mm/giờ · nguồn mẫu). Xác suất mưa không phải xác suất ngập.
      </p>
    </div>
  )
}

function ForecastCard({ f, rain }) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="forecast-card">
      <div className="forecast-card__head">
        <div>
          <div className="row">
            <span className="forecast-card__kicker">Dự báo nguy cơ ngập</span>
            {f.dataMode === 'demo' ? <DataModeBadge mode="demo" size="sm" /> : null}
          </div>
          <h2 className="forecast-card__title">{f.area || f.title}</h2>
          <p className="small muted">
            Hiệu lực {formatShort(f.validFrom)} – {formatShort(f.validTo)}
          </p>
        </div>
        <SeverityBadge severity={f.level} />
      </div>

      <dl className="forecast-metrics">
        <div>
          <dt>Lượng mưa dự báo</dt>
          <dd>{f.rain.amount} <span className="muted small">/ {f.rain.window}</span></dd>
        </div>
        <div>
          <dt>Xác suất mưa</dt>
          <dd>{f.rain.probability}%</dd>
        </div>
        <div>
          <dt>Ban hành</dt>
          <dd>{formatShort(f.issuedAt)}</dd>
        </div>
      </dl>

      <p className="small muted">
        Xác suất mưa không phải xác suất ngập. Nguy cơ ngập là kết quả từ quy tắc của dự án, không phải dự báo ngập của nguồn thời tiết.
      </p>

      <button type="button" className="disclosure" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>Căn cứ, nguồn và giới hạn</span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} />
      </button>

      {open ? (
        <div className="stack">
          <div>
            <h3 className="small"><strong>Căn cứ</strong></h3>
            <ul className="bullets">
              {f.basis.map((b) => <li key={b}>{b}</li>)}
            </ul>
          </div>
          <p className="small muted">
            Phiên bản quy tắc: {f.ruleVersion}. Nguồn thời tiết: dữ liệu mẫu định dạng tương tự Open-Meteo.
            Giới hạn địa bàn: {f.area || DEFAULT_AREA_NAME}. Khu vực chỉ có dữ liệu cấp khu vực, không vẽ vùng chi tiết hơn.
          </p>
          {rain ? <RainBars rain={rain} /> : null}
          <div className="row">
            <Button size="sm" variant="secondary" icon="map" to={`/?du-bao=${encodeURIComponent(f.id)}`}>Xem trên bản đồ</Button>
          </div>
        </div>
      ) : null}
    </Card>
  )
}

export default function AlertsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'forecast' ? 'forecast' : 'current'
  const setTab = (next) => setParams((previous) => {
    const nextParams = new URLSearchParams(previous)
    nextParams.set('tab', next)
    return nextParams
  })
  const pointsRes = useResource(({ signal }) => getFloodPoints({ signal }), [], { topic: 'reports', refreshMs: 30000 })
  const fcRes = useResource(({ signal }) => getForecasts({ signal }), [])

  const currentAlerts = useMemo(() => {
    const pts = pointsRes.data?.items || []
    return [...pts]
      .filter((p) => p.floodCondition === 'active')
      .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
  }, [pointsRes.data])

  const forecasts = fcRes.data?.items || []
  const rain = fcRes.data?.rain

  return (
    <div className="page">
      <PageHeader
        title="Cảnh báo"
        description={`Tình hình ngập đang được ghi nhận và nguy cơ sắp tới tại ${DEFAULT_AREA_NAME}.`}
        actions={<Button size="sm" variant="secondary" icon="refresh" onClick={() => { pointsRes.reload(); fcRes.reload() }} loading={pointsRes.refreshing || fcRes.refreshing}>Làm mới</Button>}
      />

      <Tabs
        label="Nhóm cảnh báo"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'current', label: 'Đang ghi nhận', count: currentAlerts.length || undefined },
          { value: 'forecast', label: 'Nguy cơ sắp tới', count: forecasts.length || undefined }
        ]}
      />

      {tab === 'current' ? (
        <section id="panel-current" role="tabpanel" aria-labelledby="tab-current" className="stack">
          <p className="small muted">
            {pointsRes.fetchedAt ? <>Cập nhật {formatRelative(pointsRes.fetchedAt)} · nhịp làm mới đề xuất 30 giây khi trang đang mở.</> : 'Đang tải…'}
          </p>
          <ResourceError resource={pointsRes} label="cảnh báo hiện tại" />
          {pointsRes.loading ? <ListSkeleton rows={3} /> : currentAlerts.length ? (
            <ul className="alert-list">
              {currentAlerts.map((a) => (
                <li key={a.id}>
                  <Card className={`alert-card alert-card--${a.severity}`}>
                    <div className="alert-card__head">
                      <div>
                        <p className="alert-card__area">{a.area || DEFAULT_AREA_NAME}</p>
                        <h2 className="alert-card__title">{a.place}</h2>
                      </div>
                      <SeverityBadge severity={a.severity} />
                    </div>
                    <dl className="info-list">
                      <div className="info-list__row"><dt>Khoảng ghi nhận</dt><dd><TimeStamp value={a.observedAt} /> – cập nhật <TimeStamp value={a.updatedAt} /></dd></div>
                      <div className="info-list__row"><dt>Căn cứ</dt><dd>{a.source}</dd></div>
                      <div className="info-list__row"><dt>Xác minh</dt><dd>{a.verificationStatus === 'verified' ? 'Đã xác minh' : a.verificationStatus === 'checking' ? 'Đang kiểm tra' : 'Chưa kiểm tra'}</dd></div>
                      <div className="info-list__row"><dt>Nguồn</dt><dd className="row">{a.dataMode === 'demo' ? <DataModeBadge mode="demo" size="sm" /> : null}Báo cáo người dân qua website</dd></div>
                    </dl>
                    <div className="row">
                      <Button size="sm" variant="secondary" to={`/diem-ngap/${a.id}`}>Xem chi tiết điểm</Button>
                      <Link to="/canh-bao" className="small">Xem tất cả</Link>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          ) : !pointsRes.error ? (
            <EmptyState
              icon="check-circle"
              title="Chưa có cảnh báo ngập đang ghi nhận"
              description="Khu vực này chưa có báo cáo ngập đã công khai trong khoảng thời gian gần đây."
              actions={<Button variant="secondary" to="/">Mở bản đồ</Button>}
            />
          ) : null}
        </section>
      ) : (
        <section id="panel-forecast" role="tabpanel" aria-labelledby="tab-forecast" className="stack">
          <div className="horizon-row" role="group" aria-label="Khoảng dự báo">
            <span className="horizon-chip is-active">6–12 giờ</span>
            <span className="horizon-chip is-disabled" title="Chưa có dữ liệu ở khoảng này">1–3 giờ</span>
            <span className="horizon-chip is-disabled" title="Ngoài kịch bản mẫu">Ngày mai</span>
          </div>
          <p className="small muted">
            Ưu tiên khoảng 6–12 giờ. Các khoảng khác chỉ hiển thị khi nguồn dữ liệu hỗ trợ.
          </p>

          <ResourceError resource={fcRes} label="dự báo" />
          {fcRes.loading ? <ListSkeleton rows={2} /> : forecasts.length ? (
            <div className="stack">
              {forecasts.map((f) => <ForecastCard key={f.id} f={f} rain={rain} />)}
              {APP_CONFIG.dataMode === 'demo' || fcRes.data?.rainMode === 'sample' ? (
                <Notice tone="demo" title="Dự báo ngập trong khu trình diễn">
                  Đây là kịch bản nguy cơ mẫu do nhóm tạo, không phải dự báo từ máy chủ thật. Ngoài kịch bản, hệ thống chỉ hiển thị thông tin thời tiết nguồn.
                </Notice>
              ) : (
                <Notice tone="info" title="Cách tính nguy cơ">
                  Máy chủ dự báo cộng lượng mưa Open-Meteo trong 3 giờ tại các khu vực hay ngập: từ 15 mm là nhẹ, 30 mm là vừa, 50 mm (ở nơi đã ngập từ 3 lần) là nặng. Đây là mô hình đơn giản của nhóm, không phải dự báo thủy văn chính thức.
                </Notice>
              )}
            </div>
          ) : !fcRes.error ? (
            <EmptyState icon="rain" title="Chưa có dự báo ngập cho khu vực này" description="Hiện chỉ có thể xem thông tin mưa từ nguồn thời tiết." />
          ) : null}

          {rain ? (
            <Card>
              <div className="card__head">
                <h2 className="card__title">Thông tin mưa tham khảo</h2>
                <DataModeBadge mode="sample" size="sm" />
              </div>
              <RainBars rain={rain} />
              <p className="small muted">
                Nguồn: {fcRes.data?.rainSource}. Lượng mưa có đơn vị mm theo giờ; xác suất mưa có đơn vị %. Không đổi xác suất mưa thành xác suất ngập.
              </p>
            </Card>
          ) : null}

          <Notice tone="info" title="Chưa bật thông báo đẩy và SMS">
            Bản đầu chưa gửi thông báo đẩy/SMS và chưa theo dõi khu vực cá nhân. Website chỉ lấy vị trí khi bạn bấm “Vị trí của tôi”.
          </Notice>
        </section>
      )}
    </div>
  )
}
