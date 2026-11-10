import { NavLink, Outlet, useLocation, Navigate, Link } from 'react-router-dom'
import { Icon } from '../../components/ui/Icon.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { DataModeBadge } from '../../components/ui/Badges.jsx'
import { useSession } from '../../hooks/useData.js'
import { logout } from '../../services/api.js'
import '../../styles/admin.css'

const nav = [
  { to: '/quan-ly', label: 'Báo cáo', icon: 'report', end: true },
  { to: '/quan-ly/ban-do', label: 'Bản đồ địa bàn', icon: 'map' },
  { to: '/quan-ly/nguon-du-lieu', label: 'Nguồn dữ liệu', icon: 'database' }
]

export default function AdminLayout() {
  const session = useSession()
  const { pathname } = useLocation()
  if (!session) return <Navigate to={`/dang-nhap?tiep=${encodeURIComponent(pathname)}`} replace />
  if (session.role !== 'admin') return <Navigate to="/" replace />
  return (
    <div className="admin-shell">
      <a href="#admin-main" className="skip-link">Bỏ qua đến nội dung chính</a>
      <header className="admin-header">
        <div className="admin-header__brand">
          <Link to="/quan-ly" className="admin-mark"><Icon name="shield" size={20} /></Link>
          <div><strong>Quản lý khu vực</strong><span>Biên Hòa · khu trình diễn</span></div>
        </div>
        <div className="admin-header__end"><DataModeBadge mode="demo" size="sm" /><Button size="sm" variant="ghost" icon="logout" onClick={() => { logout(); window.location.href = '/' }}>Đăng xuất</Button></div>
      </header>
      <div className="admin-body">
        <aside className="admin-sidebar">
          <nav aria-label="Điều hướng quản lý">
            {nav.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `admin-nav__link ${isActive ? 'is-active' : ''}`}><Icon name={n.icon} size={18} /><span>{n.label}</span></NavLink>)}
          </nav>
          <div className="admin-sidebar__foot"><Link to="/">← Về giao diện người dân</Link></div>
        </aside>
        <main id="admin-main" className="admin-main"><Outlet /></main>
      </div>
      <nav className="admin-mobile-nav" aria-label="Điều hướng quản lý">
        {nav.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => isActive ? 'is-active' : ''}><Icon name={n.icon} size={20} /><span>{n.label}</span></NavLink>)}
      </nav>
    </div>
  )
}
