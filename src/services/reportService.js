import fs from 'fs';
import crypto from 'crypto';
import { z } from 'zod';
import { ENV } from '../config/env.js';
import RULES from '../config/rules.js';
import { getDb } from '../db/connection.js';
import floodPointRepo from '../repositories/floodPointRepo.js';
import reportRepo from '../repositories/reportRepo.js';
import eventRepo from '../repositories/eventRepo.js';
import { validateReportContext } from '../domain/reportValidator.js';
import { findMergeTarget } from '../domain/dedupe.js';
import { decideInitialStatus, promotePendingToActive } from '../domain/lifecycle.js';
import { computeTrustScore } from '../domain/trustScore.js';
import { sha256Hex } from '../domain/imageHash.js';
import { validateImageMagicBytes, compressAndSaveImage } from '../utils/imageUtils.js';
import { analyzeImage } from './aiAnalyzer.js';
import { geocodeService } from './geocodeService.js';

// Schema xác thực đầu vào bằng Zod
const ReportPayloadSchema = z.object({
  lat: z.coerce.number({ invalid_type_error: 'Vĩ độ (lat) phải là số' }),
  lng: z.coerce.number({ invalid_type_error: 'Kinh độ (lng) phải là số' }),
  accuracyM: z.coerce.number({ invalid_type_error: 'Sai số GPS (accuracyM) phải là số' }),
  capturedAt: z.string().min(1, 'Thời điểm chụp ảnh (capturedAt) không được để trống'),
  deviceId: z.string().min(1, 'Mã thiết bị (deviceId) không được để trống'),
  source: z.enum(RULES.SOURCES).default('camera'),
  note: z.string().max(200, 'Ghi chú tối đa 200 ký tự').optional().nullable(),
});

const SEVERITY_LEVELS = { low: 1, medium: 2, high: 3 };

export class ReportService {
  /**
   * Pipeline xử lý toàn bộ quy trình gửi báo cáo ngập:
   * 1. Validate Zod + File ảnh (magic bytes)
   * 2. Validate ngữ cảnh không gian/thời gian (reportValidator)
   * 3. Chống trùng ảnh (SHA-256)
   * 4. Nén và lưu ảnh (Sharp, xóa EXIF/GPS)
   * 5. Phân tích AI (NV3 aiAnalyzer)
   * 6. Quyết định trạng thái & Gộp trùng
   * 7. Transaction ghi CSDL & Rollback xóa ảnh nếu lỗi
   */
  async processReport({ file, body = {}, now = new Date(), options = {} }) {
    const nowDate = now instanceof Date ? now : new Date(now);

    // 1. Kiểm tra file ảnh tải lên
    if (!file || !file.buffer) {
      const err = new Error('Vui lòng tải lên hình ảnh hiện trường ngập lụt');
      err.code = 'MISSING_IMAGE';
      err.status = 400;
      throw err;
    }

    if (file.buffer.length > RULES.MAX_UPLOAD_FILE_SIZE_BYTES) {
      const err = new Error(`Dung lượng ảnh vượt quá giới hạn cho phép (${RULES.MAX_UPLOAD_FILE_SIZE_BYTES / (1024 * 1024)}MB)`);
      err.code = 'IMAGE_TOO_LARGE';
      err.status = 400;
      throw err;
    }

    // Kiểm tra magic bytes của ảnh
    const magicCheck = validateImageMagicBytes(file.buffer);
    if (!magicCheck.valid) {
      const err = new Error('Tệp tải lên không phải là định dạng ảnh hợp lệ (chỉ chấp nhận JPEG, PNG, WEBP)');
      err.code = 'INVALID_IMAGE_FILE';
      err.status = 400;
      throw err;
    }

    // 2. Validate tham số đầu vào bằng Zod
    const parseResult = ReportPayloadSchema.safeParse(body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      const err = new Error(firstIssue ? firstIssue.message : 'Dữ liệu báo cáo không hợp lệ');
      err.code = 'VALIDATION_ERROR';
      err.status = 400;
      err.details = parseResult.error.issues;
      throw err;
    }
    const validated = parseResult.data;

    // 3. Validate ngữ cảnh (vị trí Đồng Nai, GPS accuracy, thời gian chụp)
    const contextResult = validateReportContext({
      lat: validated.lat,
      lng: validated.lng,
      accuracyM: validated.accuracyM,
      capturedAt: validated.capturedAt,
      now: nowDate,
      source: validated.source,
    });

    if (!contextResult.ok) {
      const firstError = contextResult.errors[0];
      const err = new Error(firstError ? firstError.message : 'Ngữ cảnh báo cáo không hợp lệ');
      err.code = firstError ? firstError.code : 'INVALID_CONTEXT';
      err.status = 422;
      err.errors = contextResult.errors;
      throw err;
    }

    // 4. Kiểm tra mã băm SHA-256 chống trùng lặp ảnh đã gửi
    const imageSha256 = sha256Hex(file.buffer);
    const existingImage = reportRepo.findBySha256(imageSha256);
    if (existingImage) {
      const err = new Error('Ảnh này đã được gửi trước đó trong một báo cáo khác');
      err.code = 'DUPLICATE_IMAGE';
      err.status = 409;
      throw err;
    }

    // 5. Nén và ghi ảnh vào đĩa (Sharp xóa EXIF, resize max 1280, nén JPEG q80)
    const savedImage = await compressAndSaveImage(file.buffer, ENV.UPLOAD_DIR, nowDate);
    const savedFullPath = savedImage.fullPath;

    try {
      // 6. Phân tích AI
      let aiResult;
      try {
        aiResult = await analyzeImage(
          file.buffer,
          {
            filename: file.originalname,
            note: validated.note,
            simulate: options.simulate || body.simulate,
          },
          options.aiMode || ENV.AI_MODE
        );
      } catch (aiErr) {
        // Xử lý lỗi AI_NOT_CONFIGURED hoặc lỗi gọi AI như "AI lỗi" -> isFlood: null, điểm ngập pending
        aiResult = {
          isFlood: null,
          confidence: 0,
          severity: 'low',
          estimatedDepthCm: null,
          description: '',
          reason: aiErr.message,
          error: aiErr.code || 'AI_ERROR',
        };
      }

      // Quyết định trạng thái ban đầu ('active' | 'pending' | 'rejected')
      const initialStatus = decideInitialStatus(aiResult);

      // 7. Tìm điểm ngập trùng lặp trong bán kính 50m và cửa sổ 6 giờ
      const activePendingCandidates = floodPointRepo.list({ status: ['active', 'pending'] });
      const mergeTarget = findMergeTarget({ lat: validated.lat, lng: validated.lng }, activePendingCandidates, nowDate);

      // Reverse Geocoding (ước lượng phường gần nhất nếu chưa có ranh giới polygon)
      const geoInfo = await geocodeService.reverse(validated.lat, validated.lng);

      // Thu thập cờ độ tin cậy bao gồm cờ ước lượng phường (WARD_ESTIMATED)
      const finalReportFlags = [...contextResult.flags];
      if (geoInfo.isWardEstimated) {
        finalReportFlags.push('WARD_ESTIMATED');
      }

      // 8. Thực hiện giao dịch cơ sở dữ liệu (Transaction)
      const db = getDb();
      let createdOrUpdatedFloodPoint = null;
      let finalReportId = null;
      let isMerged = false;
      let responseMessage = '';

      const executeTransaction = db.transaction(() => {
        // Mô phỏng lỗi cố ý để kiểm tra tính toàn vẹn Transaction Rollback & Xóa file
        if (options.simulateErrorMidway) {
          throw new Error('Mô phỏng lỗi ngoại lệ giữa chừng trong giao dịch CSDL');
        }

        const reportId = `rep_${crypto.randomUUID()}`;
        finalReportId = reportId;

        // Trường hợp A: Gộp vào điểm ngập đã có
        if (mergeTarget) {
          isMerged = true;
          const newReportCount = (mergeTarget.reportCount || 1) + 1;
          const lastUpdatedAt = nowDate.toISOString();

          // Nâng cấp mức độ nghiêm trọng nếu AI lần này đánh giá cao hơn và tự tin >= 0.6
          let newSeverity = mergeTarget.severity;
          if (
            aiResult.confidence >= RULES.AI_MIN_CONFIDENCE_ACTIVE &&
            (SEVERITY_LEVELS[aiResult.severity] || 0) > (SEVERITY_LEVELS[mergeTarget.severity] || 0)
          ) {
            newSeverity = aiResult.severity;
          }

          // Lưu báo cáo mới liên kết vào mergeTarget
          reportRepo.insert({
            id: reportId,
            floodPointId: mergeTarget.id,
            deviceId: validated.deviceId,
            lat: validated.lat,
            lng: validated.lng,
            accuracyM: validated.accuracyM,
            capturedAt: new Date(validated.capturedAt).toISOString(),
            createdAt: nowDate.toISOString(),
            imagePath: savedImage.relativeUrl,
            imageSha256,
            aiJson: aiResult,
            trustFlags: finalReportFlags,
            isDemo: 0,
          });

          // Kiểm tra khả năng nâng cấp từ 'pending' lên 'active'
          let currentStatus = mergeTarget.status;
          if (currentStatus === 'pending') {
            const allReportsForPoint = reportRepo.listByFloodPointId(mergeTarget.id);
            const promotedStatus = promotePendingToActive(mergeTarget, allReportsForPoint);
            if (promotedStatus === 'active') {
              currentStatus = 'active';
              // Mở 1 flood_event mới nếu chưa có
              const openEvt = eventRepo.findOpenEvent(mergeTarget.id);
              if (!openEvt) {
                eventRepo.insert({
                  id: `evt_${crypto.randomUUID()}`,
                  floodPointId: mergeTarget.id,
                  startedAt: nowDate.toISOString(),
                  endedAt: null,
                  endReason: null,
                  isDemo: 0,
                });
              }
            }
          }

          // Tính lại trustScore
          const updatedTrustScore = computeTrustScore({
            aiConfidence: aiResult.confidence,
            gpsAccuracyM: validated.accuracyM,
            source: validated.source,
            confirmStill: mergeTarget.confirmStill,
            confirmEnded: mergeTarget.confirmEnded,
            reportCount: newReportCount,
          });

          // Cập nhật điểm ngập
          floodPointRepo.update(mergeTarget.id, {
            reportCount: newReportCount,
            lastUpdatedAt,
            severity: newSeverity,
            status: currentStatus,
            trustScore: updatedTrustScore,
          });

          createdOrUpdatedFloodPoint = floodPointRepo.findById(mergeTarget.id);
          responseMessage = 'Cảm ơn bạn! Báo cáo đã được ghi nhận và gộp vào điểm ngập gần đó.';
          return;
        }

        // Trường hợp B: Bị AI từ chối (isFlood=false) -> KHÔNG tạo điểm ngập trên bản đồ
        if (initialStatus === 'rejected') {
          isMerged = false;
          // Vẫn lưu báo cáo độc lập để phục vụ kiểm toán / hậu kiểm
          reportRepo.insert({
            id: reportId,
            floodPointId: null,
            deviceId: validated.deviceId,
            lat: validated.lat,
            lng: validated.lng,
            accuracyM: validated.accuracyM,
            capturedAt: new Date(validated.capturedAt).toISOString(),
            createdAt: nowDate.toISOString(),
            imagePath: savedImage.relativeUrl,
            imageSha256,
            aiJson: aiResult,
            trustFlags: finalReportFlags,
            isDemo: 0,
          });

          createdOrUpdatedFloodPoint = null;
          responseMessage = 'Báo cáo của bạn đã được ghi nhận, tuy nhiên hệ thống AI không phát hiện tình trạng ngập nước.';
          return;
        }

        // Trường hợp C: Tạo điểm ngập mới ('active' hoặc 'pending')
        isMerged = false;
        const newPointId = `fp_${crypto.randomUUID()}`;

        const trustScore = computeTrustScore({
          aiConfidence: aiResult.confidence,
          gpsAccuracyM: validated.accuracyM,
          source: validated.source,
          confirmStill: 0,
          confirmEnded: 0,
          reportCount: 1,
        });

        floodPointRepo.insert({
          id: newPointId,
          lat: validated.lat,
          lng: validated.lng,
          address: geoInfo?.address || null,
          street: geoInfo?.street || null,
          wardId: geoInfo?.wardId || null,
          status: initialStatus,
          severity: aiResult.severity || 'low',
          estimatedDepthCm: aiResult.estimatedDepthCm ?? null,
          trustScore,
          confirmStill: 0,
          confirmEnded: 0,
          reportCount: 1,
          isFloodProne: 0,
          floodEventCount: initialStatus === 'active' ? 1 : 0,
          firstReportedAt: nowDate.toISOString(),
          lastUpdatedAt: nowDate.toISOString(),
          isDemo: 0,
        });

        reportRepo.insert({
          id: reportId,
          floodPointId: newPointId,
          deviceId: validated.deviceId,
          lat: validated.lat,
          lng: validated.lng,
          accuracyM: validated.accuracyM,
          capturedAt: new Date(validated.capturedAt).toISOString(),
          createdAt: nowDate.toISOString(),
          imagePath: savedImage.relativeUrl,
          imageSha256,
          aiJson: aiResult,
          trustFlags: finalReportFlags,
          isDemo: 0,
        });

        // Nếu trạng thái khởi tạo là 'active', tạo 1 flood_event tương ứng
        if (initialStatus === 'active') {
          eventRepo.insert({
            id: `evt_${crypto.randomUUID()}`,
            floodPointId: newPointId,
            startedAt: nowDate.toISOString(),
            endedAt: null,
            endReason: null,
            isDemo: 0,
          });
        }

        createdOrUpdatedFloodPoint = floodPointRepo.findById(newPointId);
        responseMessage = 'Cảm ơn bạn! Báo cáo điểm ngập mới đã được tiếp nhận thành công.';
      });

      // Thực thi Transaction
      executeTransaction();

      return {
        ok: true,
        data: {
          floodPoint: createdOrUpdatedFloodPoint,
          report: { id: finalReportId },
          merged: isMerged,
          aiResult,
          message: responseMessage,
        },
      };
    } catch (transactionErr) {
      // RULE 19: Lỗi giữa chừng thì rollback và xóa file ảnh đã ghi
      try {
        if (fs.existsSync(savedFullPath)) {
          fs.unlinkSync(savedFullPath);
        }
      } catch (cleanupErr) {
        console.error('Lỗi khi dọn dẹp file ảnh sau rollback:', cleanupErr.message);
      }
      throw transactionErr;
    }
  }
}

export const reportService = new ReportService();
export default reportService;
