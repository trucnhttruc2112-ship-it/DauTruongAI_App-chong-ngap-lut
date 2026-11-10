import { useEffect, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './Button.jsx'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Giữ focus trong hộp thoại, Esc để đóng, đóng xong trả focus về nút mở (mục 14).
 */
export function useFocusTrap(open, containerRef, onClose) {
  const returnTo = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    returnTo.current = document.activeElement
    const node = containerRef.current
    const first = node?.querySelector('[data-autofocus]') || node?.querySelector(FOCUSABLE) || node
    first?.focus?.()

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current?.()
        return
      }
      if (e.key !== 'Tab' || !node) return
      const items = Array.from(node.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null)
      if (!items.length) { e.preventDefault(); node.focus(); return }
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault(); lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault(); firstEl.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      const el = returnTo.current
      if (el && typeof el.focus === 'function') setTimeout(() => el.focus(), 0)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
}

export function Dialog({ open, onClose, title, description, children, footer, size = 'md', busy = false }) {
  const ref = useRef(null)
  const titleId = useId()
  const descId = useId()
  const dismiss = () => { if (!busy) onClose?.() }
  useFocusTrap(open, ref, dismiss)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) dismiss() }}>
      <div
        ref={ref}
        className={`dialog dialog--${size}`}
        role="dialog"
        aria-modal="true"
        aria-busy={busy || undefined}
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <header className="dialog__header">
          <h2 id={titleId} className="dialog__title">{title}</h2>
          <IconButton icon="close" label="Đóng" onClick={dismiss} disabled={busy} />
        </header>
        {description ? <p id={descId} className="dialog__desc">{description}</p> : null}
        <div className="dialog__body">{children}</div>
        {footer ? <footer className="dialog__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body
  )
}

/**
 * Bảng mở từ đáy dạng hộp thoại (bộ lọc trên điện thoại, lớp bản đồ...).
 * Bo 16px ở hai góc trên. Điều khiển bằng nút, không bắt buộc kéo.
 */
export function SheetDialog({ open, onClose, title, children, footer }) {
  const ref = useRef(null)
  const titleId = useId()
  useFocusTrap(open, ref, onClose)
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])
  if (!open) return null
  return createPortal(
    <div className="overlay overlay--sheet" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div ref={ref} className="sheet-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <span className="sheet-handle" aria-hidden="true" />
        <header className="dialog__header">
          <h2 id={titleId} className="dialog__title">{title}</h2>
          <IconButton icon="close" label="Đóng" onClick={onClose} />
        </header>
        <div className="dialog__body">{children}</div>
        {footer ? <footer className="dialog__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body
  )
}
