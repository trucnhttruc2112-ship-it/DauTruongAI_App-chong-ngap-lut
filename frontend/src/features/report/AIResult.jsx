import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { SeverityBadge, DataModeBadge } from '../../components/ui/Badges.jsx'
import { AI_RESULT } from '../../locales/vi/labels.js'

/**
 * Kết quả AI (mục 7.3): Chờ phân tích, Đang phân tích, Có kết quả, Không đủ thông tin, Lỗi kết nối.
 * - Không tạo phần trăm tiến độ giả; không hiện độ sâu/độ tin cậy khi không có.
 * - AI lỗi/thiếu thông tin KHÔNG được hiển thị thành "Không ngập" (UX05).
 * - Hết thời gian chờ: hướng dẫn lựa chọn rõ thay vì vòng xoay vô hạn.
 */
export function AIResult({ state, onRetry, onRetake }) {
  const s = state?.status || 'pending'

  if (s === 'pending') {
    return (
      <div className="ai-card ai-card--pending" role="status">
        <Icon name="clock" />
        <div><p className="ai-card__title">Chờ phân tích</p><p className="small muted">Ảnh sẽ được phân tích sau khi bạn chọn.</p></div>
      </div>
    )
  }

  if (s === 'analyzing') {
    return (
      <div className="ai-card ai-card--pending" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <div>
          <p className="ai-card__title">Đang phân tích ảnh</p>
          <p className="small muted">Bạn có thể tiếp tục xác nhận vị trí trong lúc chờ.</p>
        </div>
      </div>
    )
  }

  if (s === 'error' || s === 'timeout') {
    return (
      <div className="ai-card ai-card--error" role="alert">
        <Icon name={s === 'timeout' ? 'clock' : 'wifi-off'} />
        <div className="stack">
          <div>
            <p className="ai-card__title">{s === 'timeout' ? 'Phân tích mất nhiều thời gian hơn dự kiến' : 'Chưa kết nối được dịch vụ phân tích ảnh'}</p>
            <p className="small">Báo cáo chưa có kết quả AI – điều này <strong>không</strong> có nghĩa là không ngập.</p>
          </div>
          <div className="actions-bar">
            <Button size="sm" variant="secondary" icon="refresh" onClick={onRetry}>Thử lại</Button>
            <Button size="sm" variant="ghost" icon="camera" onClick={onRetake}>Chụp lại</Button>
          </div>
          <p className="small muted">Hoặc tiếp tục gửi để người quản lý kiểm tra.</p>
        </div>
      </div>
    )
  }

  if (s === 'insufficient' || state.outcome === 'insufficient') {
    return (
      <div className="ai-card ai-card--unknown" role="status">
        <Icon name="help" />
        <div className="stack">
          <div>
            <p className="ai-card__title">{AI_RESULT.insufficient}</p>
            <p className="small">{state.note || 'Ảnh chưa đủ rõ để ước lượng mức ngập.'}</p>
          </div>
          <div className="actions-bar">
            <Button size="sm" variant="secondary" icon="camera" onClick={onRetake}>Chụp lại</Button>
          </div>
          <p className="small muted">Hoặc tiếp tục gửi để kiểm tra.</p>
          {state.dataMode === 'demo' ? <DataModeBadge mode="demo" size="sm" /> : null}
        </div>
      </div>
    )
  }

  const flood = state.outcome === 'flood'
  return (
    <div className={`ai-card ${flood ? 'ai-card--flood' : 'ai-card--clear'}`} role="status">
      <Icon name={flood ? 'water' : 'info'} />
      <div className="stack">
        <div>
          <p className="ai-card__kicker">AI ước lượng</p>
          <p className="ai-card__title">{AI_RESULT[state.outcome]}</p>
        </div>
        {state.level ? <div><SeverityBadge severity={state.level} /></div> : null}
        {!flood ? (
          <p className="small">Không thấy dấu hiệu rõ trong ảnh không đồng nghĩa với đường an toàn. Bạn có thể ghi lại quan sát của mình bên dưới.</p>
        ) : null}
        <p className="small muted">
          Mức ước lượng từ một ảnh, không phải độ sâu đo được và không bảo đảm xe đi qua an toàn.
        </p>
        {state.dataMode === 'demo' ? <DataModeBadge mode="demo" size="sm" /> : null}
      </div>
    </div>
  )
}
