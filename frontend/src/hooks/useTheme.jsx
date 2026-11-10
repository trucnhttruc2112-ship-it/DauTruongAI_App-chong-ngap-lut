import { createContext, useContext, useEffect, useState, useCallback } from 'react'

/**
 * Quản lý chế độ hiển thị: Sáng, Tối, Theo thiết bị.
 * Mặc định Sáng (theo khảo sát 3/5).
 * Lưu cục bộ và áp dụng trước khi vẽ để giảm chớp nền.
 */
const ThemeContext = createContext(null)
const STORAGE_KEY = 'flood-ui-theme'

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
    if (saved === 'system') return 'system'
  } catch (_) { /* ignore */ }
  return 'light'
}

function resolveTheme(pref) {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(getInitialTheme)
  const [resolved, setResolved] = useState(() => resolveTheme(getInitialTheme()))

  useEffect(() => {
    const r = resolveTheme(preference)
    setResolved(r)
    document.documentElement.setAttribute('data-theme', r)
    try { localStorage.setItem(STORAGE_KEY, preference) } catch (_) {}
  }, [preference])

  // Theo thiết bị: cập nhật khi hệ thống đổi
  useEffect(() => {
    if (preference !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setResolved(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [preference])

  const setTheme = useCallback((p) => setPreference(p), [])

  return (
    <ThemeContext.Provider value={{ preference, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme phải dùng trong ThemeProvider')
  return ctx
}
