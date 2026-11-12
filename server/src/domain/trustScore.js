/**
 * Tính điểm độ tin cậy của điểm ngập (thang điểm 0 - 100).
 * 
 * BẢNG TRỌNG SỐ VÀ CÔNG THỨC MINH BẠCH:
 * 1. AI Confidence (40%):
 *    - Tối đa 40 điểm: aiConfidence * 40 (với aiConfidence trong khoảng 0.0 - 1.0).
 * 2. GPS Accuracy (20%):
 *    - Tối đa 20 điểm:
 *      + Sai số <= 10m: trọn vẹn 20 điểm.
 *      + 10m < Sai số <= 100m: giảm tuyến tính từ 20 về 0 theo công thức: 20 * (1 - (accuracy - 10) / 90).
 *      + Sai số > 100m: 0 điểm.
 * 3. Nguồn chụp trực tiếp (15%):
 *    - 'camera': 15 điểm (chụp trực tiếp từ thiết bị).
 *    - 'gallery': 5 điểm (chọn từ thư viện ảnh, nguy cơ ảnh cũ).
 *    - 'manual-pin' hoặc khác: 0 điểm.
 * 4. Xác nhận từ cộng đồng (20%):
 *    - Mỗi lượt xác nhận 'still' (+7 điểm), tối đa 20 điểm.
 *    - Mỗi lượt xác nhận 'ended' (-15 điểm phạt).
 * 5. Số báo cáo độc lập (5%):
 *    - Báo cáo gốc được tính trong AI/GPS/nguồn.
 *    - Mỗi lượt báo cáo gộp thêm (+2.5 điểm), tối đa 5 điểm.
 * 
 * Kết quả cuối cùng được làm tròn thành số nguyên và ép chặt trong đoạn [0, 100].
 * 
 * @param {object} params
 * @param {number} [params.aiConfidence=0] Độ tin cậy của AI (0.0 - 1.0)
 * @param {number} [params.gpsAccuracyM=50] Sai số GPS tính bằng mét
 * @param {'camera' | 'gallery' | 'manual-pin'} [params.source='camera'] Nguồn báo cáo
 * @param {number} [params.confirmStill=0] Số thiết bị xác nhận vẫn còn ngập
 * @param {number} [params.confirmEnded=0] Số thiết bị xác nhận đã hết ngập
 * @param {number} [params.reportCount=1] Tổng số lượt báo cáo gộp vào điểm này
 * @returns {number} Điểm tin cậy nguyên từ 0 đến 100
 */
export function computeTrustScore({
  aiConfidence = 0,
  gpsAccuracyM = 50,
  source = 'camera',
  confirmStill = 0,
  confirmEnded = 0,
  reportCount = 1,
} = {}) {
  // 1. Điểm AI (0 - 40)
  const validAiConf = Math.max(0, Math.min(1, typeof aiConfidence === 'number' ? aiConfidence : 0));
  const aiScore = validAiConf * 40;

  // 2. Điểm GPS (0 - 20)
  let gpsScore = 0;
  if (typeof gpsAccuracyM === 'number' && gpsAccuracyM >= 0) {
    if (gpsAccuracyM <= 10) {
      gpsScore = 20;
    } else if (gpsAccuracyM <= 100) {
      gpsScore = 20 * (1 - (gpsAccuracyM - 10) / 90);
    } else {
      gpsScore = 0;
    }
  }

  // 3. Điểm nguồn (0 - 15)
  let sourceScore = 0;
  if (source === 'camera') {
    sourceScore = 15;
  } else if (source === 'gallery') {
    sourceScore = 5;
  } else {
    sourceScore = 0;
  }

  // 4. Điểm xác nhận cộng đồng (0 - 20, có trừ điểm phạt)
  const stillScore = Math.min(20, Math.max(0, (confirmStill || 0) * 7));
  const endedPenalty = Math.max(0, (confirmEnded || 0) * 15);
  const communityScore = stillScore - endedPenalty;

  // 5. Điểm số báo cáo độc lập (0 - 5)
  const additionalReports = Math.max(0, (reportCount || 1) - 1);
  const multiReportScore = Math.min(5, additionalReports * 2.5);

  // Tổng điểm
  const total = aiScore + gpsScore + sourceScore + communityScore + multiReportScore;

  // Làm tròn và giới hạn [0, 100]
  const rounded = Math.round(total);
  return Math.max(0, Math.min(100, rounded));
}

export default { computeTrustScore };
