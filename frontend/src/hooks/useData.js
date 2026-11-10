import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { subscribe, getSession, getDemoTools } from '../services/api.js'

/** Phiên đăng nhập thử nghiệm, tự cập nhật khi đăng nhập/đăng xuất. */
export function useSession() {
  const [session, setSession] = useState(getSession)
  useEffect(() => subscribe((topic) => { if (topic === 'session') setSession(getSession()) }), [])
  const valid = session && session.expiresAt > Date.now() ? session : null
  return valid
}

export function useDemoTools() {
  const [tools, setTools] = useState(getDemoTools)
  useEffect(() => subscribe((t) => { if (t === 'demo-tools') setTools(getDemoTools()) }), [])
  return tools
}

/**
 * Tải dữ liệu bất đồng bộ với: hủy yêu cầu cũ, giữ dữ liệu cũ khi lỗi (mục 8),
 * làm mới định kỳ khi trang đang hiển thị, dừng khi chuyển nền và tải lại khi quay lại.
 */
export function useResource(loader, deps = [], { refreshMs = 0, topic } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true, refreshing: false, fetchedAt: null })
  const ctrl = useRef(null)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const run = useCallback(async (mode = 'load') => {
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setState((s) => ({ ...s, loading: s.data == null, refreshing: s.data != null, error: mode === 'load' ? null : s.error }))
    try {
      const data = await loaderRef.current({ signal: c.signal })
      if (c.signal.aborted) return
      setState({ data, error: null, loading: false, refreshing: false, fetchedAt: new Date().toISOString() })
    } catch (err) {
      if (err?.name === 'AbortError') return
      setState((s) => ({ ...s, error: err, loading: false, refreshing: false }))
    }
  }, [])

  useEffect(() => {
    run('load')
    return () => ctrl.current?.abort()
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  // Thay đổi trong kho mô phỏng (vd. quản lý vừa duyệt) → tải lại nhẹ
  useEffect(() => {
    if (!topic) return
    return subscribe((t) => { if (t === topic) run('refresh') })
  }, [topic, run])

  useEffect(() => {
    if (!refreshMs) return
    let timer = null
    const start = () => { stop(); timer = setInterval(() => run('refresh'), refreshMs) }
    const stop = () => { if (timer) clearInterval(timer); timer = null }
    const onVis = () => {
      if (document.visibilityState === 'visible') { run('refresh'); start() } else stop()
    }
    start()
    document.addEventListener('visibilitychange', onVis)
    return () => { stop(); document.removeEventListener('visibilitychange', onVis) }
  }, [refreshMs, run])

  return { ...state, reload: () => run('refresh') }
}

/** Theo dõi media query (bố cục 320-767 / 768-1023 / 1024+). */
export function useMediaQuery(query) {
  const sub = useCallback((cb) => {
    const mq = window.matchMedia(query)
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }, [query])
  return useSyncExternalStore(sub, () => window.matchMedia(query).matches, () => false)
}

export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')
export const useIsTablet = () => useMediaQuery('(min-width: 768px)')

/** Bộ đếm "bây giờ" để thời gian tương đối tự cập nhật. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
