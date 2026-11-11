import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/ui/Icon.jsx'
import { APP_CONFIG } from '../../app/config.js'
import { getFloodPoints, getForecasts } from '../../services/api.js'
import './chat.css'

const SUGGESTIONS = ['Chỗ nào đang ngập?', 'Tối nay có mưa lớn không?', 'Làm sao để báo ngập?', 'Xe chết máy do ngập thì làm gì?']
const HELLO = 'Chào bạn! Mình trả lời về điểm ngập, mưa sắp tới và cách giữ an toàn khi ngập. Bạn muốn hỏi gì?'

// Gom dữ liệu hiện có của app để gửi kèm câu hỏi
async function buildContext() {
  const context = { now: new Date().toISOString(), points: [], forecasts: [] }
  try {
    const { items } = await getFloodPoints()
    context.points = items.map((p) => ({
      place: p.place, area: p.area, severity: p.severity, observedAt: p.observedAt,
      verified: p.verificationStatus === 'verified', simulated: p.dataMode === 'demo'
    }))
  } catch (_) { /* không có điểm ngập thì vẫn hỏi được */ }
  try {
    const { items } = await getForecasts()
    context.forecasts = items.map((f) => ({
      place: f.place || f.area, level: f.level, from: f.validFrom, to: f.validTo,
      rain3h: parseFloat(f.rain.amount), simulated: f.dataMode === 'demo'
    }))
  } catch (err) {
    context.forecastError = err.hint || 'Chưa lấy được dự báo mưa.'
  }
  return context
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([{ role: 'assistant', text: HELLO }])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const bottom = useRef(null)

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [messages, busy, open])

  async function ask(question) {
    const message = question.trim()
    if (!message || busy) return
    const history = messages.slice(1).map((m) => ({ role: m.role, text: m.text }))
    setMessages((m) => [...m, { role: 'user', text: message }])
    setText('')
    setBusy(true)
    try {
      const context = await buildContext()
      const res = await fetch(`${APP_CONFIG.api.ai}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history, context })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error?.message || 'Lỗi máy chủ')
      setMessages((m) => [...m, { role: 'assistant', text: data.reply, auto: data.mode === 'mock' }])
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', text: 'Chưa kết nối được trợ lý. Bạn kiểm tra máy chủ AI (cổng 3001) rồi thử lại nhé.', error: true }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {!open && (
        <button type="button" className="chat-fab" onClick={() => setOpen(true)} aria-label="Mở hỏi đáp về ngập">
          <Icon name="help" size={22} />
          <span>Hỏi đáp</span>
        </button>
      )}
      {open && (
        <section className="chat-panel" role="dialog" aria-label="Hỏi đáp về ngập">
          <header className="chat-panel__head">
            <span><Icon name="ai" size={18} /> Hỏi đáp về ngập</span>
            <button type="button" className="chat-panel__close" onClick={() => setOpen(false)} aria-label="Đóng hỏi đáp">
              <Icon name="close" size={18} />
            </button>
          </header>
          <div className="chat-panel__body" aria-live="polite">
            {messages.map((m, i) => (
              <p key={i} className={`chat-msg chat-msg--${m.role} ${m.error ? 'is-error' : ''}`}>{m.text}</p>
            ))}
            {busy && <p className="chat-msg chat-msg--assistant chat-msg--wait">Đang trả lời...</p>}
            {messages.length === 1 && (
              <div className="chat-suggest">
                {SUGGESTIONS.map((s) => <button type="button" key={s} onClick={() => ask(s)}>{s}</button>)}
              </div>
            )}
            <div ref={bottom} />
          </div>
          <form className="chat-panel__form" onSubmit={(e) => { e.preventDefault(); ask(text) }}>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Nhập câu hỏi..." aria-label="Câu hỏi" />
            <button type="submit" disabled={busy || !text.trim()} aria-label="Gửi"><Icon name="send" size={18} /></button>
          </form>
          <p className="chat-panel__note">Trả lời dựa trên dữ liệu trong app, không thay cho tin của cơ quan chức năng. Nguy hiểm gọi 112.</p>
        </section>
      )}
    </>
  )
}
