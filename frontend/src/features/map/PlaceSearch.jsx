import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '../../components/ui/Icon.jsx'
import { searchPlaces } from '../../services/api.js'

/**
 * Ô tìm tên đường/khu vực, gợi ý có ngữ cảnh địa bàn (mục 6.4).
 * Combobox có thể dùng bằng bàn phím; hủy yêu cầu tìm cũ khi gõ tiếp.
 */
export function PlaceSearch({ onPick, placeholder = 'Tìm tên đường, khu vực', className = '', label = 'Tìm địa điểm' }) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [busy, setBusy] = useState(false)
  const listId = useId()
  const inputId = useId()
  const ctrl = useRef(null)
  const wrap = useRef(null)

  useEffect(() => {
    if (!q.trim()) { setItems([]); setBusy(false); return }
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setBusy(true)
    const t = setTimeout(() => {
      searchPlaces(q, { signal: c.signal })
        .then((r) => { if (!c.signal.aborted) { setItems(r); setActive(-1); setBusy(false) } })
        .catch(() => {})
    }, 160)
    return () => { clearTimeout(t); c.abort() }
  }, [q])

  useEffect(() => {
    const onDoc = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [])

  const pick = (p) => {
    setQ(p.name)
    setOpen(false)
    onPick?.(p)
  }

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(items.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    else if (e.key === 'Enter' && open && active >= 0 && items[active]) { e.preventDefault(); pick(items[active]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  const showList = open && q.trim().length > 0

  return (
    <div ref={wrap} className={`place-search ${className}`}>
      <label htmlFor={inputId} className="sr-only">{label}</label>
      <div className="place-search__box">
        <Icon name="search" className="place-search__icon" />
        <input
          id={inputId}
          type="search"
          className="place-search__input"
          placeholder={placeholder}
          value={q}
          autoComplete="off"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />
        {q ? (
          <button type="button" className="place-search__clear" onClick={() => { setQ(''); setItems([]) }} aria-label="Xóa nội dung tìm">
            <Icon name="close" size={18} />
          </button>
        ) : null}
      </div>
      {showList ? (
        <ul id={listId} role="listbox" className="place-search__list" aria-label="Gợi ý địa điểm">
          {busy && !items.length ? <li className="place-search__empty">Đang tìm…</li> : null}
          {!busy && !items.length ? (
            <li className="place-search__empty">Chưa tìm thấy địa điểm trong danh mục của dự án.</li>
          ) : null}
          {items.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`place-search__opt ${i === active ? 'is-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(p)}
            >
              <Icon name="pin" size={18} />
              <span>
                <span className="place-search__name">{p.name}</span>
                <span className="place-search__ctx">{p.context}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
