// Nháp báo cáo – lưu bền vững trên IndexedDB của thiết bị hiện tại (mục 7.5, 13.5).
// Bản nháp trong phiên (sessionDraft) giữ dữ liệu khi chuyển sang trang Đăng nhập rồi quay lại.
import { idb, STORES, isQuotaError } from './storage.js'

export async function saveDraft(draft) {
  const now = new Date().toISOString()
  const record = { ...draft, id: draft.id || `nhap-${Date.now()}`, savedAt: now }
  try {
    await idb.set(STORES.drafts, record.id, record)
    return { ok: true, draft: record }
  } catch (err) {
    return { ok: false, quota: isQuotaError(err), error: err }
  }
}

export async function listDrafts() {
  try {
    const all = await idb.values(STORES.drafts)
    return (all || []).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
  } catch (_) {
    return []
  }
}

export async function getDraft(id) {
  try { return await idb.get(STORES.drafts, id) } catch (_) { return null }
}

export async function deleteDraft(id) {
  try { await idb.del(STORES.drafts, id); return true } catch (_) { return false }
}

/* Bản nháp trong phiên – bộ nhớ, sống qua điều hướng nhưng không qua tải lại trang */
let sessionDraft = null
export const sessionDraftStore = {
  get: () => sessionDraft,
  set: (d) => { sessionDraft = d },
  clear: () => { sessionDraft = null }
}
