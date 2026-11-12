import { describe, it, expect } from 'vitest';
import {
  clusterKey,
  computeFloodProne,
  normalizeVietnamese,
} from '../../src/domain/floodProne.js';
import RULES from '../../src/config/rules.js';

describe('Domain: floodProne.js', () => {
  const BASE_NOW = new Date('2026-11-08T16:00:00.000Z');

  it('1. Bắt buộc nhận tham số now, không gọi ngầm Date.now()', () => {
    expect(() => computeFloodProne([], undefined)).toThrow('Tham số now là bắt buộc');
  });

  it('2. normalizeVietnamese loại bỏ dấu, chuyển về chữ thường và gom khoảng trắng thừa', () => {
    expect(normalizeVietnamese('Xa Lộ Hà Nội')).toBe('xa lo ha noi');
    expect(normalizeVietnamese('  ĐỒNG   KHỞI  ')).toBe('dong khoi');
    expect(normalizeVietnamese('Nguyễn Ái Quốc')).toBe('nguyen ai quoc');
  });

  it('3. clusterKey gom cụm theo tên đường chuẩn hóa hoặc lưới ~100m nếu không có tên đường', () => {
    // Có tên đường: bất kể viết hoa hay có dấu đều cho cùng một key
    const pt1 = { street: 'Xa Lộ Hà Nội', lat: 10.944, lng: 106.824 };
    const pt2 = { street: 'xa lộ hà nội', lat: 10.950, lng: 106.830 };
    expect(clusterKey(pt1)).toBe('street:xa lo ha noi');
    expect(clusterKey(pt2)).toBe('street:xa lo ha noi');
    expect(clusterKey(pt1)).toBe(clusterKey(pt2));

    // Không có tên đường: phân bổ vào lưới ~100m (làm tròn 3 chữ số thập phân)
    const ptNoStreet = { lat: 10.94412, lng: 106.82435 };
    expect(clusterKey(ptNoStreet)).toBe('grid:10.944,106.824');
  });

  it('4. CA BIÊN QUAN TRỌNG: 20 lượt báo trong 1 đợt ngập CHỈ TÍNH 1 SỰ KIỆN', () => {
    // Giả lập một đợt ngập kéo dài 3 giờ với 20 báo cáo gộp vào cùng một sự kiện duy nhất
    const singleFloodEvent = {
      id: 'event_nov_08',
      floodPointId: 'fp_amata',
      startedAt: '2026-11-08T06:00:00.000Z',
      endedAt: '2026-11-08T09:00:00.000Z',
      reportCount: 20, // 20 báo cáo của nhiều người dùng
    };

    // Truyền danh sách sự kiện chứa 1 sự kiện duy nhất (dù có 20 lượt báo cáo)
    const result = computeFloodProne([singleFloodEvent], BASE_NOW);

    // Hệ thống chỉ tính đúng 1 sự kiện, chưa đủ ngưỡng hay ngập (>= 3)
    expect(result.eventCountInWindow).toBe(1);
    expect(result.isFloodProne).toBe(false);
  });

  it('5. Ca biên số sự kiện: 2 sự kiện chưa hay ngập, đúng 3 sự kiện trở thành hay ngập', () => {
    const event1 = { startedAt: '2026-08-01T08:00:00.000Z' };
    const event2 = { startedAt: '2026-09-01T08:00:00.000Z' };

    // 2 sự kiện trong vòng 365 ngày
    const res2 = computeFloodProne([event1, event2], BASE_NOW);
    expect(res2.eventCountInWindow).toBe(2);
    expect(res2.isFloodProne).toBe(false);

    // Thêm sự kiện thứ 3 -> đủ ngưỡng RULES.FLOOD_PRONE_MIN_EVENTS (3)
    const event3 = { startedAt: '2026-10-01T08:00:00.000Z' };
    const res3 = computeFloodProne([event1, event2, event3], BASE_NOW);
    expect(res3.eventCountInWindow).toBe(3);
    expect(res3.isFloodProne).toBe(true);
  });

  it('6. Loại trừ các sự kiện cũ hơn 365 ngày (ngoài cửa sổ FLOOD_PRONE_WINDOW_DAYS)', () => {
    // Sự kiện xảy ra cách đây 366 ngày
    const oldEvent = {
      startedAt: new Date(BASE_NOW.getTime() - 366 * 24 * 60 * 60 * 1000).toISOString(),
    };
    // 2 sự kiện trong năm
    const recent1 = { startedAt: new Date(BASE_NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString() };
    const recent2 = { startedAt: new Date(BASE_NOW.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString() };

    const result = computeFloodProne([oldEvent, recent1, recent2], BASE_NOW);
    // oldEvent bị loại, chỉ còn 2 sự kiện hợp lệ trong cửa sổ
    expect(result.eventCountInWindow).toBe(2);
    expect(result.isFloodProne).toBe(false);
  });

  it('7. Kết hợp historicalEventCount từ dữ liệu lịch sử của NV6', () => {
    // Có 1 sự kiện gần đây
    const eventRecent = { startedAt: new Date(BASE_NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString() };

    // 1 sự kiện hiện hành + 2 sự kiện lịch sử = 3 sự kiện -> hay ngập
    const result = computeFloodProne([eventRecent], BASE_NOW, { historicalEventCount: 2 });
    expect(result.eventCountInWindow).toBe(3);
    expect(result.isFloodProne).toBe(true);
  });
});
