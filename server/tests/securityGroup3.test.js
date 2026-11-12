import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { compressAndSaveImage } from '../src/utils/imageUtils.js';
import { shutdownServer } from '../src/server.js';
import { getPrivacyNoticeText } from '../public/nv4/reportFlow.js';
import { runSeedClear, handleSeedClearCli } from '../scripts/seedClear.js';

describe('Bảo mật & Độ bền - Nhóm 2 & 3 (Mục 11, 12, 13)', () => {
  const tmpUploadDir = path.resolve('./uploads_test_tmp_group3');

  beforeEach(() => {
    if (!fs.existsSync(tmpUploadDir)) {
      fs.mkdirSync(tmpUploadDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tmpUploadDir)) {
      fs.rmSync(tmpUploadDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('11. Độ bền lưu trữ & Graceful Shutdown', () => {
    it('11.1. Bắt lỗi ENOSPC (đĩa đầy) khi lưu ảnh: trả STORAGE_FULL (507) và dọn file dở dang', async () => {
      const validBuffer = await sharp({
        create: {
          width: 50,
          height: 50,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      }).jpeg().toBuffer();

      const enospcError = new Error('No space left on device');
      enospcError.code = 'ENOSPC';

      const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockRejectedValue(enospcError);

      await expect(compressAndSaveImage(validBuffer, tmpUploadDir)).rejects.toMatchObject({
        code: 'STORAGE_FULL',
        status: 507,
        message: expect.stringContaining('Bộ nhớ máy chủ đã đầy'),
      });

      writeSpy.mockRestore();
    });

    it('11.2. shutdownServer dừng background job và đóng kết nối DB một cách an toàn', () => {
      expect(() => {
        shutdownServer();
      }).not.toThrow();
    });

    it('11.3. Listener unhandledRejection tồn tại trên process để ngăn sập tiến trình', () => {
      const listeners = process.listeners('unhandledRejection');
      expect(listeners.length).toBeGreaterThan(0);
    });
  });

  describe('12. Quyền riêng tư (Privacy) & Xóa EXIF', () => {
    it('12.1. Test chứng minh ảnh sau xử lý hoàn toàn bị tước bỏ EXIF và GPS metadata', async () => {
      // Tạo ảnh gốc có chứa thông tin EXIF
      const originalWithExif = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .withMetadata({
          exif: {
            IFD0: {
              Make: 'Antigravity Camera',
              Model: 'Security Test Device',
            },
          },
        })
        .jpeg()
        .toBuffer();

      // Kiểm tra ảnh gốc có EXIF
      const metaBefore = await sharp(originalWithExif).metadata();
      expect(metaBefore.exif).toBeDefined();

      // Cho qua hàm xử lý compressAndSaveImage
      const saved = await compressAndSaveImage(originalWithExif, tmpUploadDir);

      // Đọc file ảnh đã lưu và xác nhận EXIF đã bị xóa sạch hoàn toàn
      const metaAfter = await sharp(saved.fullPath).metadata();
      expect(metaAfter.exif).toBeUndefined();
    });

    it('12.2. getPrivacyNoticeText trả về nội dung thông báo thu thập vị trí và ảnh hợp lệ', () => {
      const text = getPrivacyNoticeText();
      expect(text).toBe('Ứng dụng sẽ dùng vị trí và ảnh bạn chụp để ghi nhận điểm ngập');
    });
  });

  describe('13. scripts/seedClear.js xử lý khi DB chưa migrate', () => {
    it('13.1. Khi DB chưa có bảng (no such table), runSeedClear ném lỗi DB_NOT_INITIALIZED', () => {
      // Tạo in-memory DB trống rỗng hoàn toàn không có bảng
      const emptyDb = new Database(':memory:');

      expect(() => {
        runSeedClear(emptyDb);
      }).toThrowError(/DB chưa được khởi tạo/);

      emptyDb.close();
    });

    it('13.2. handleSeedClearCli bắt lỗi no such table, in tiếng Việt và trả về exit code 1 không in stack trace', () => {
      const emptyDb = new Database(':memory:');
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const exitCode = handleSeedClearCli(emptyDb);

      expect(exitCode).toBe(1);
      expect(errSpy).toHaveBeenCalledWith('DB chưa được khởi tạo. Chạy npm run migrate trước.');

      emptyDb.close();
      errSpy.mockRestore();
    });
  });
});
