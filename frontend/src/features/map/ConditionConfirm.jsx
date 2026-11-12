import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button.jsx'
import { Dialog } from '../../components/ui/Dialog.jsx'
import { ChoiceGroup, TextArea } from '../../components/ui/Field.jsx'
import { Notice } from '../../components/ui/Feedback.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { useSession } from '../../hooks/useData.js'
import { submitConditionObservation, NetworkError } from '../../services/api.js'
import { FLOOD_CONDITION } from '../../locales/vi/labels.js'

const LEVELS = [
  { value: 'light', label: 'Nhẹ' },
  { value: 'moderate', label: 'Vừa' },
  { value: 'severe', label: 'Nặng' }
]

/**
 * Người đang ở hiện trường xác nhận "Vẫn ngập" hoặc "Đã hết ngập".
 * Đây là gửi quan sát mới để kiểm tra (mục 6.5) – không xóa điểm công khai bằng một lần bấm.
 */
export function ConditionConfirm({ point }) {
  const session = useSession()
  const navigate = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(null) // 'still' | 'clear' | null
  const [level, setLevel] = useState(point.severity !== 'unknown' ? point.severity : null)
  const [note, setNote] = useState('')
  const [state, setState] = useState({ busy: false, error: null, done: null })

  function start(kind) {
    if (!session) {
      navigate(`/dang-nhap?tiep=${encodeURIComponent(loc.pathname)}`)
      return
    }
    setState({ busy: false, error: null, done: null })
    setLevel(point.severity !== 'unknown' ? point.severity : null)
    setOpen(kind)
  }

  async function send() {
    if (state.busy) return
    setState({ busy: true, error: null, done: null })
    try {
      await submitConditionObservation(point.id, { still: open === 'still', level: open === 'still' ? level : null, note: note.trim() })
      setState({ busy: false, error: null, done: open })
      setOpen(null)
      setNote('')
    } catch (err) {
      setState({ busy: false, error: err instanceof NetworkError ? 'Chưa gửi được do lỗi kết nối. Nội dung vẫn được giữ, hãy thử lại.' : err.message, done: null })
    }
  }

  const pendingClear = point.floodCondition === 'reported-clear'

  return (
    <section className="condition-box" aria-labelledby={`cond-${point.id}`}>
      <div className="condition-box__head">
        <h3 id={`cond-${point.id}`} className="condition-box__title">Bạn đang ở gần đây?</h3>
        <p className="small muted">Cho biết tình trạng hiện tại để phường cập nhật nhanh hơn.</p>
      </div>

      {pendingClear ? (
        <Notice tone="info" title={FLOOD_CONDITION['reported-clear']}>
          Đã có người báo nước rút. Điểm vẫn hiển thị cho đến khi phường xác nhận hết ngập.
        </Notice>
      ) : null}

      {state.done ? (
        <Notice tone="success" live title="Đã gửi quan sát">
          {state.done === 'still'
            ? 'Cảm ơn bạn. Thời điểm cập nhật của điểm đã được làm mới.'
            : 'Cảm ơn bạn. Phường sẽ kiểm tra trước khi xác nhận hết ngập; điểm chưa bị gỡ khỏi bản đồ.'}
        </Notice>
      ) : null}

      <div className="condition-box__actions">
        <button type="button" className="condition-btn condition-btn--still" onClick={() => start('still')}>
          <Icon name="water" size={22} />
          <span><strong>Vẫn còn ngập</strong><span className="small">Xác nhận nước chưa rút</span></span>
        </button>
        <button type="button" className="condition-btn condition-btn--clear" onClick={() => start('clear')}>
          <Icon name="check-circle" size={22} />
          <span><strong>Đã hết ngập</strong><span className="small">Gửi để phường kiểm tra</span></span>
        </button>
      </div>
      {!session ? <p className="small muted">Cần đăng nhập để gửi xác nhận.</p> : null}

      <Dialog
        open={!!open}
        busy={state.busy}
        onClose={() => setOpen(null)}
        title={open === 'still' ? 'Xác nhận vẫn còn ngập' : 'Báo đã hết ngập'}
        description={point.place}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(null)} disabled={state.busy}>Hủy</Button>
            <Button variant="primary" icon="send" onClick={send} loading={state.busy}>Gửi xác nhận</Button>
          </>
        }
      >
        {state.error ? <Notice tone="error" live>{state.error}</Notice> : null}
        {open === 'still' ? (
          <ChoiceGroup legend="Mức ngập bạn thấy lúc này" value={level} onChange={setLevel} options={LEVELS} columns={3} />
        ) : (
          <Notice tone="info">
            Xác nhận của bạn được ghi là “Có thông tin hết ngập”. Điểm chỉ chuyển sang “Đã xác nhận hết ngập” sau khi phường kiểm tra.
          </Notice>
        )}
        <TextArea label="Ghi chú" optional rows={2} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={open === 'still' ? 'Ví dụ: nước dâng thêm, xe máy chết máy…' : 'Ví dụ: đường khô, còn đọng nước ở lề…'} />
        <p className="small muted">
          Muốn gửi kèm ảnh mới? Dùng <strong>Báo thông tin mới tại đây</strong> trong chi tiết điểm.
        </p>
      </Dialog>
    </section>
  )
}
