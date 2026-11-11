// Kho khóa–giá trị nhỏ trên IndexedDB. Dùng cho nháp có ảnh (mục 13.5) và
// cơ sở dữ liệu mô phỏng của bản trình diễn. Không lưu ảnh vào localStorage.

const DB_NAME = 'ban-do-ngap'
const DB_VERSION = 1
export const STORES = { drafts: 'drafts', mock: 'mock' }

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB không khả dụng'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      Object.values(STORES).forEach((name) => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name)
      })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(store, mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const s = t.objectStore(store)
    let result
    Promise.resolve(fn(s)).then((r) => { result = r })
    t.oncomplete = () => resolve(result?.result !== undefined ? result.result : result)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  }))
}

export const idb = {
  get: (store, key) => tx(store, 'readonly', (s) => s.get(key)),
  set: (store, key, value) => tx(store, 'readwrite', (s) => { s.put(value, key) }),
  del: (store, key) => tx(store, 'readwrite', (s) => { s.delete(key) }),
  values: (store) => tx(store, 'readonly', (s) => s.getAll())
}

/** Lỗi đầy bộ nhớ → thông báo thật cho người dùng (mục 7.5). */
export function isQuotaError(err) {
  return err && (err.name === 'QuotaExceededError' || err.code === 22 || /quota/i.test(err.message || ''))
}

/** Lưu nhẹ vào localStorage (chế độ giao diện, phiên đăng nhập thử nghiệm). */
export const local = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key)
      return raw == null ? fallback : JSON.parse(raw)
    } catch (_) { return fallback }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true } catch (_) { return false }
  },
  remove(key) {
    try { localStorage.removeItem(key) } catch (_) {}
  }
}
