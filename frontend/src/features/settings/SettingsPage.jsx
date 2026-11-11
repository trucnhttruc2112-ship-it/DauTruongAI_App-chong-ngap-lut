import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '../../components/ui/Button.jsx'
import { ChoiceGroup } from '../../components/ui/Field.jsx'
import { Notice, PageHeader, Card } from '../../components/ui/Feedback.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { SeverityBadge, VerificationBadge, ProcessingBadge, FloodConditionBadge, DataModeBadge } from '../../components/ui/Badges.jsx'
import { useTheme } from '../../hooks/useTheme.jsx'
import { useSession, useDemoTools } from '../../hooks/useData.js'
import { logout, setDemoTools, resetDemoData, getDemoTools } from '../../services/api.js'
import { APP_CONFIG } from '../../app/config.js'
import { SEVERITY, SEVERITY_ORDER, VERIFICATION, PROCESSING, FLOOD_CONDITION } from '../../locales/vi/labels.js'
import '../../styles/pages.css'

function ThemeOption({ value, label, icon, desc }) {
  const { preference, setTheme } = useTheme()
  const on = preference === value
  return (
    <button type="button" className={`choice ${on ? 'is-on' : ''}`} onClick={() => setTheme(value)} aria-pressed={on} style={{ textAlign: 'left' }}>
      <Icon name={icon} size={20} />
      <span className="choice__text">
        <span className="choice__label">{label}</span>
        <span className="choice__desc">{desc}</span>
      </span>
    </button>
  )
}

export default function SettingsPage() {
  const session = useSession()
  const tools = useDemoTools()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function onReset() {
    setBusy(true)
    await resetDemoData()
    setBusy(false)
    setMsg('Đã khôi phục dữ liệu mẫu của bản trình diễn.')
  }

  return (
    <div className="page">
      <PageHeader title="Tùy chọn" description="Giao diện, tài khoản và giải thích dữ liệu." />

      <div className="settings-grid">
        <Card className="stack">
          <h2 className="card__title">Giao diện</h2>
          <div className="stack">
            <ThemeOption value="light" label="Sáng" icon="sun" desc="Nền trắng, chữ xanh đậm. Mặc định cho người dùng mới." />
            <ThemeOption value="dark" label="Tối" icon="moon" desc="Nền tối, giữ nguyên màu mức ngập và ảnh hiện trường." />
            <ThemeOption value="system" label="Theo thiết bị" icon="device" desc="Tự đổi theo cài đặt hệ thống." />
          </div>
          <Notice tone="info" title="Bản đồ trong chế độ tối">
            Nền bản đồ đường phố vẫn dùng lớp sáng trong khung tối vì chưa có lớp bản đồ tối được phép sử dụng. Website không đảo màu bản đồ để tránh đổi sai màu nguy cơ và ảnh hiện trường.
          </Notice>
        </Card>

        <Card className="stack">
          <h2 className="card__title">Tài khoản</h2>
          {session ? (
            <>
              <p className="row"><Icon name="user" /> <strong>{session.name}</strong></p>
              <p className="small muted">
                Vai trò: {session.role === 'admin' ? 'Quản lý khu vực (thử nghiệm)' : 'Người dân (thử nghiệm)'}
                {session.area ? ` · ${session.area}` : ''}
              </p>
              {session.role === 'admin' ? (
                <Button variant="secondary" icon="shield" to="/quan-ly">Mở khu vực quản lý</Button>
              ) : null}
              <Button variant="ghost" icon="logout" onClick={() => { logout(); setMsg('Đã đăng xuất khỏi tài khoản thử nghiệm.') }}>Đăng xuất</Button>
            </>
          ) : (
            <>
              <p className="small muted">Bạn đang xem với tư cách khách. Không cần đăng nhập để xem bản đồ và cảnh báo.</p>
              <Button variant="primary" icon="user" to={`/dang-nhap?tiep=${encodeURIComponent('/tuy-chon')}`}>Đăng nhập</Button>
              <p className="small muted">Bản trình diễn dùng tài khoản thử nghiệm; mật khẩu quản lý không đặt trong mã nguồn giao diện.</p>
            </>
          )}
          {msg ? <Notice tone="success" live>{msg}</Notice> : null}
        </Card>

        <Card className="stack">
          <h2 className="card__title">Giải thích dữ liệu</h2>
          <p className="small muted">Mức ngập, xác minh và quy trình xử lý là ba thông tin độc lập, không dùng chung một trạng thái.</p>
          <div className="stack">
            <h3 className="small"><strong>Mức ngập</strong></h3>
            <ul className="legend__list" style={{ listStyle: 'none' }}>
              {SEVERITY_ORDER.map((s) => (
                <li key={s} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <SeverityBadge severity={s} size="sm" />
                  <span className="small muted">{SEVERITY[s]}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="stack">
            <h3 className="small"><strong>Trạng thái xác minh</strong></h3>
            <div className="row">{Object.keys(VERIFICATION).map((v) => <VerificationBadge key={v} status={v} size="sm" />)}</div>
            <h3 className="small"><strong>Quy trình xử lý</strong></h3>
            <div className="row">{Object.keys(PROCESSING).map((v) => <ProcessingBadge key={v} status={v} size="sm" />)}</div>
            <h3 className="small"><strong>Tình trạng ngập</strong></h3>
            <div className="row">{Object.keys(FLOOD_CONDITION).map((v) => <FloodConditionBadge key={v} status={v} size="sm" />)}</div>
          </div>
          <div className="stack">
            <h3 className="small"><strong>Nhãn nguồn dữ liệu</strong></h3>
            <div className="row">
              <DataModeBadge mode="demo" size="sm" />
              <DataModeBadge mode="sample" size="sm" />
              <DataModeBadge mode="live" size="sm" />
              <DataModeBadge mode="offline" size="sm" />
            </div>
            <p className="small muted">
              Nhãn Mô phỏng nghĩa là kết quả do nhóm tạo cho bản trình diễn, chưa phải dữ liệu thật. Đóng báo cáo không tự đồng nghĩa đường đã hết ngập.
            </p>
          </div>
          <p className="small muted">
            Ẩn/hiện một điểm trên bản đồ công khai theo quyết định kiểm tra; báo cáo “không thấy ngập” không tự trở thành điểm ngập.
          </p>
        </Card>

        <Card className="stack">
          <div className="card__head">
            <h2 className="card__title">Công cụ trình diễn</h2>
            <DataModeBadge mode="demo" size="sm" />
          </div>
          <p className="small muted">Chỉ dùng để thử các trạng thái trong bản demo. Không ảnh hưởng khi nối máy chủ thật.</p>
          <div className="stack">
            <ChoiceGroup
              legend="Kết quả AI khi phân tích ảnh"
              value={tools.aiMode}
              onChange={(v) => setDemoTools({ aiMode: v })}
              options={[
                { value: 'auto', label: 'Tự động' },
                { value: 'insufficient', label: 'Không đủ thông tin' },
                { value: 'no-sign', label: 'Không thấy dấu hiệu rõ' },
                { value: 'error', label: 'Lỗi kết nối' },
                { value: 'timeout', label: 'Mất thời gian chờ' }
              ]}
              columns={2}
              size="sm"
            />
          </div>
          {APP_CONFIG.dataMode === 'live' ? (
            <ChoiceGroup
              legend="Kịch bản mưa cho trang Dự báo (máy chủ NV5)"
              value={tools.rainScenario || ''}
              onChange={(v) => setDemoTools({ rainScenario: v })}
              options={[
                { value: '', label: 'Dự báo thật (Open-Meteo)' },
                { value: 'trung_binh', label: 'Mô phỏng mưa vừa (20 mm/3 giờ)' },
                { value: 'cao', label: 'Mô phỏng mưa lớn (36 mm/3 giờ)' },
                { value: 'rat_cao', label: 'Mô phỏng mưa rất lớn (60 mm/3 giờ)' }
              ]}
              columns={1}
              size="sm"
            />
          ) : null}
          <div className="settings-row">
            <div>
              <p className="settings-row__label">Giả lập mất mạng khi gửi</p>
              <p className="settings-row__desc">Báo cáo sẽ không được gửi, nội dung giữ trong phiên, thử lại dùng cùng mã yêu cầu.</p>
            </div>
            <Button
              size="sm"
              variant={tools.networkFail ? 'danger' : 'secondary'}
              onClick={() => setDemoTools({ networkFail: !tools.networkFail })}
              aria-pressed={tools.networkFail}
            >
              {tools.networkFail ? 'Đang bật' : 'Đang tắt'}
            </Button>
          </div>
          <div className="settings-row">
            <div>
              <p className="settings-row__label">Dữ liệu mẫu</p>
              <p className="settings-row__desc">Khôi phục báo cáo và trạng thái về dữ liệu mẫu ban đầu.</p>
            </div>
            <Button size="sm" variant="secondary" icon="refresh" onClick={onReset} loading={busy}>Khôi phục</Button>
          </div>
          <p className="small muted">
            Bản nháp được lưu trên thiết bị này; vào <Link to="/bao-cao-cua-toi">Báo cáo của tôi → Bản nháp</Link> để xóa.
          </p>
        </Card>
      </div>

      <Notice tone="demo" title="Phạm vi bản trình diễn">
        {APP_CONFIG.dataMode === 'live'
          ? 'Báo cáo, AI phân tích ảnh, trang phường và dự báo đã nối máy chủ thật. Tìm đường, tiếp nhận của phường thật và đăng nhập chính thức vẫn là mô phỏng.'
          : 'Các phần cần dữ liệu thật như dự báo, tìm đường, tiếp nhận địa phương và đăng nhập chính thức chỉ mô phỏng. Không có nút hoạt động giả: phần chưa bật được ghi rõ trạng thái.'}
      </Notice>
    </div>
  )
}
