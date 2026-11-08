/**
 * Quản lý định danh thiết bị ẩn danh (deviceId) cho người dùng NV4.
 * Lưu trữ trong localStorage (có bộ nhớ tạm in-memory làm fallback nếu bị chặn cookie/storage).
 */

const STORAGE_KEY = 'nv4_device_id';
let inMemoryFallbackId = null;

/**
 * Sinh UUID v4 chuẩn ẩn danh
 * @returns {string}
 */
export function generateUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback nếu crypto.randomUUID không khả dụng
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Lấy deviceId hiện tại hoặc tạo mới nếu chưa có.
 * @param {Storage} [customStorage] - Tham số tùy chọn để inject phục vụ test
 * @returns {string}
 */
export function getDeviceId(customStorage) {
  let storage = customStorage;
  if (!storage && typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
  }

  if (storage) {
    try {
      let id = storage.getItem(STORAGE_KEY);
      if (id && typeof id === 'string' && id.trim().length >= 10) {
        return id.trim();
      }
      id = generateUuid();
      storage.setItem(STORAGE_KEY, id);
      return id;
    } catch {
      // localStorage bị chặn quyền (VD: chế độ ẩn danh nghiêm ngặt)
    }
  }

  if (!inMemoryFallbackId) {
    inMemoryFallbackId = generateUuid();
  }
  return inMemoryFallbackId;
}
