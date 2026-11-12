import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button.jsx'
import { PasswordField, TextField } from '../../components/ui/Field.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { Notice } from '../../components/ui/Feedback.jsx'
import { BrandMark } from '../../app/CitizenLayout.jsx'
import { login, getSession } from '../../services/api.js'
import { sessionDraftStore } from '../../services/drafts.js'
import '../../styles/pages.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showDemo, setShowDemo] = useState(false)
  const [state, setState] = useState({ loading: false, error: null })
  const returnTo = params.get('tiep') || '/'

  useEffect(() => {
    const s = getSession()
    if (s) navigate(returnTo, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault()
    setState({ loading: true, error: null })
    try {
      const s = await login(username, password)
      // draft vẫn còn trong sessionDraftStore; ReportFlow sẽ tiếp tục đúng bước
      const dest = s.role === 'admin' && returnTo === '/' ? '/quan-ly' : returnTo
      navigate(dest, { replace: true, state: { loggedIn: true, role: s.role } })
    } catch (err) {
      setState({ loading: false, error: err.message || 'Đăng nhập chưa thành công.' })
    }
  }

  return (
    <div className="login-shell">
      <header className="login-top">
        <BrandMark />
      </header>
      <main className="login-main">
        <section className="login-card card" aria-labelledby="login-title">
          <div className="stack">
            <Link to={returnTo} className="back-link"><Icon name="arrow-left" size={18} /> Quay lại thao tác đang làm</Link>
            <h1 id="login-title" className="login-card__title">Đăng nhập thử nghiệm</h1>
            <p className="muted">Đăng nhập ngay trước khi gửi hoặc để xem báo cáo của bạn. Bản đồ vẫn xem được không cần tài khoản.</p>
          </div>
          {state.error ? <Notice tone="error" title="Đăng nhập chưa thành công" live>{state.error}</Notice> : null}
          <form className="stack" onSubmit={submit} noValidate>
            <TextField label="Tài khoản" required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nhập tài khoản thử nghiệm" />
            <PasswordField label="Mật khẩu" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nhập mật khẩu" />
            <Button type="submit" variant="primary" block loading={state.loading} icon="user">Đăng nhập</Button>
          </form>
          <div className="login-hint">
            <button type="button" className="link-btn" onClick={() => setShowDemo((v) => !v)} aria-expanded={showDemo}>Tài khoản thử nghiệm</button>
            {showDemo ? (
              <p className="small" style={{ marginTop: 'var(--space-2)' }}>
                Người dân: <code>nguoidan</code> · mật khẩu bất kỳ từ 6 ký tự.<br />
                Quản lý: <code>quanly</code> · mật khẩu bất kỳ từ 6 ký tự.<br />
                Đây chỉ là tài khoản mô phỏng; xác thực thật phải kiểm tra ở máy chủ.
              </p>
            ) : null}
          </div>
          <p className="small muted">Chưa triển khai OTP, đăng ký hay khôi phục qua SMS/email trong bản demo.</p>
        </section>
      </main>
    </div>
  )
}
