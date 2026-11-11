import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import { Icon } from '../components/ui/Icon.jsx'
import { Button } from '../components/ui/Button.jsx'
import { DataModeBadge } from '../components/ui/Badges.jsx'
import { APP_NAME, APP_DESCRIPTION } from '../locales/vi/labels.js'
import { APP_CONFIG } from './config.js'
import { MapStateProvider } from '../features/map/mapState.jsx'
import { ChatWidget } from '../features/chat/ChatWidget.jsx'
import { useOnlineStatus } from '../hooks/useOnlineStatus.jsx'

/** 4 mục chính: Bản đồ · Cảnh báo · Báo cáo · Tùy chọn (mục 3). */
export const CITIZEN_NAV = [
  { to: '/', label: 'Bản đồ', icon: 'map', match: (p) => p === '/' || p.startsWith('/diem-ngap') || p.startsWith('/duong-bi-anh-huong') || p.startsWith('/tim-duong') },
  { to: '/canh-bao', label: 'Cảnh báo', icon: 'bell', match: (p) => p.startsWith('/canh-bao') },
  { to: '/bao-cao-cua-toi', label: 'Báo cáo', icon: 'report', match: (p) => p.startsWith('/bao-cao') },
  { to: '/tuy-chon', label: 'Tùy chọn', icon: 'settings', match: (p) => p.startsWith('/tuy-chon') }
]

export function BrandMark({ to = '/', subtitle = APP_DESCRIPTION }) {
  return (
    <Link to={to} className="brand" aria-label={`${APP_NAME} – về bản đồ`}>
      <span className="brand__mark" aria-hidden="true"><Icon name="water" size={20} /></span>
      <span className="brand__text">
        <span className="brand__name">{APP_NAME}</span>
        <span className="brand__sub">{subtitle}</span>
      </span>
    </Link>
  )
}

/** Thanh đầu trang trên máy tính (~64px): mục chính ở giữa, nút Báo ngập ở bên phải. */
export function AppHeader() {
  const { pathname } = useLocation()
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <BrandMark />
        <nav className="top-nav" aria-label="Điều hướng chính">
          {CITIZEN_NAV.map((item) => {
            const active = item.match(pathname)
            return (
              <NavLink key={item.to} to={item.to} className={`top-nav__link ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
        <div className="app-header__end">
          {APP_CONFIG.dataMode === 'demo' ? <DataModeBadge mode="demo" size="sm" /> : null}
          <Button variant="primary" icon="camera" to="/bao-ngap">Báo ngập</Button>
        </div>
      </div>
    </header>
  )
}

/** Thanh điều hướng dưới trên điện thoại – không đè lên nút gửi hay nội dung. */
export function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav className="bottom-nav" aria-label="Điều hướng chính">
      {CITIZEN_NAV.map((item) => {
        const active = item.match(pathname)
        return (
          <NavLink key={item.to} to={item.to} className={`bottom-nav__link ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

export function OfflineBar() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div className="offline-bar" role="status">
      <Icon name="wifi-off" size={18} />
      <span>Đang mất kết nối mạng. Dữ liệu hiển thị là lần tải gần nhất.</span>
    </div>
  )
}

export function CitizenLayout() {
  const { pathname } = useLocation()
  const isMap = pathname === '/' || pathname.startsWith('/diem-ngap')
  return (
    <MapStateProvider>
      <div className={`citizen-shell ${isMap ? 'citizen-shell--map' : ''}`}>
        <a href="#main" className="skip-link">Bỏ qua đến nội dung chính</a>
        <AppHeader />
        <OfflineBar />
        <main id="main" className="citizen-main" tabIndex={-1}>
          <Outlet />
        </main>
        <BottomNav />
        {APP_CONFIG.dataMode === 'live' ? <ChatWidget /> : null}
      </div>
    </MapStateProvider>
  )
}
