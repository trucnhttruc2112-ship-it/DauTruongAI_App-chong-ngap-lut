import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { mapNv3Response } from '../../src/domain/aiContract.js';

const fixturesPath = path.resolve(__dirname, '../fixtures/nv3-responses.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

describe('Domain: aiContract.js - mapNv3Response()', () => {
  it('1. Ánh xạ trường hợp ngập (flooded): isFlood=true, severity đúng, confidence gốc', () => {
    const res = mapNv3Response(fixtures.flooded);

    expect(res.isFlood).toBe(true);
    expect(res.severity).toBe('high');
    expect(res.confidence).toBe(0.92);
    expect(res.description).toContain('Đoạn đường ngập sâu');
    expect(res.reason).toContain('Nước ngập lút nửa bánh xe');
    expect(res.flags).not.toContain('AI_CONFIDENCE_ESTIMATED');
    expect(res.error).toBeNull();
  });

  it('2. Ánh xạ trường hợp không ngập (not_flooded): isFlood=false, severity chuyển none -> low', () => {
    const res = mapNv3Response(fixtures.not_flooded);

    expect(res.isFlood).toBe(false);
    expect(res.severity).toBe('low');
    expect(res.confidence).toBe(0.95);
    expect(res.description).toContain('Không phát hiện dấu hiệu');
    expect(res.error).toBeNull();
  });

  it('3. Ánh xạ trường hợp không chắc (uncertain): isFlood=null, cờ AI_NEEDS_VERIFICATION', () => {
    const res = mapNv3Response(fixtures.uncertain);

    expect(res.isFlood).toBe(null);
    expect(res.severity).toBe('low');
    expect(res.confidence).toBe(0.35);
    expect(res.flags).toContain('AI_NEEDS_VERIFICATION');
    expect(res.error).toBeNull();
  });

  it('4. Ước lượng confidence khi NV3 chưa cung cấp: gắn cờ AI_CONFIDENCE_ESTIMATED', () => {
    const res = mapNv3Response(fixtures.missing_confidence);

    expect(res.isFlood).toBe(true);
    expect(res.confidence).toBe(0.75); // hằng số rules.js cho flooded
    expect(res.flags).toContain('AI_CONFIDENCE_ESTIMATED');
  });

  it('5. Sử dụng confidence khi NV3 có gửi về: không gắn cờ ước lượng', () => {
    const res = mapNv3Response(fixtures.has_confidence);

    expect(res.isFlood).toBe(true);
    expect(res.confidence).toBe(0.82);
    expect(res.flags).not.toContain('AI_CONFIDENCE_ESTIMATED');
  });

  it('6. Phát hiện mâu thuẫn giữa isFlooded và status: isFlood=null, gắn cờ AI_INCONSISTENT', () => {
    const res = mapNv3Response(fixtures.conflict_status_is_flooded);

    expect(res.isFlood).toBe(null); // Coi là uncertain
    expect(res.confidence).toBe(0.3); // Ước lượng theo uncertain
    expect(res.flags).toContain('AI_INCONSISTENT');
    expect(res.flags).toContain('AI_NEEDS_VERIFICATION');
  });

  it('7. Xử lý enum lạ hoặc phản hồi sai định dạng: trả AI_INVALID_RESPONSE', () => {
    const res = mapNv3Response(fixtures.invalid_enum);

    expect(res.isFlood).toBe(null);
    expect(res.error).toBe('AI_INVALID_RESPONSE');
    expect(res.flags).toContain('AI_INVALID_RESPONSE');

    // Dữ liệu null hoặc chuỗi
    const resNull = mapNv3Response(null);
    expect(resNull.error).toBe('AI_INVALID_RESPONSE');
  });

  it('8. Xử lý severity unknown khi flooded: chuyển về low kèm cờ AI_SEVERITY_UNKNOWN', () => {
    const raw = {
      isFlooded: true,
      status: 'flooded',
      severity: 'unknown',
      evidence: ['Nước đọng vỉa hè'],
      summary: 'Ngập chưa rõ mức độ',
    };

    const res = mapNv3Response(raw);
    expect(res.isFlood).toBe(true);
    expect(res.severity).toBe('low');
    expect(res.flags).toContain('AI_SEVERITY_UNKNOWN');
  });

  it('9. Cắt gọt độ dài description <= 300 và loại ký tự điều khiển trong evidence', () => {
    const longSummary = 'A'.repeat(500);
    const raw = {
      status: 'flooded',
      severity: 'medium',
      summary: longSummary,
      evidence: ['Mục 1\x00\x08 điều khiển', 'Mục 2\x1F nguy hại'],
    };

    const res = mapNv3Response(raw);
    expect(res.description.length).toBeLessThanOrEqual(300);
    expect(res.reason).not.toContain('\x00');
    expect(res.reason).not.toContain('\x1F');
  });
});
