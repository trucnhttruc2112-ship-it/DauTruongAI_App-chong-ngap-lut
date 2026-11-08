import { ENV } from '../config/env.js';
import RULES from '../config/rules.js';
import floodPointRepo from '../repositories/floodPointRepo.js';
import reportRepo from '../repositories/reportRepo.js';
import eventRepo from '../repositories/eventRepo.js';
import { toGeoJsonPoint } from '../domain/geo.js';
import { clusterKey } from '../domain/floodProne.js';

const SEVERITY_SCORES = { low: 1, medium: 2, high: 3 };

export class FloodPointQueryService {
  /**
   * Danh sách điểm ngập với các bộ lọc linh hoạt.
   * Mặc định status = 'active', sắp xếp last_updated_at giảm dần.
   */
  listFloodPoints(filters = {}) {
    const query = { ...filters };

    // Xử lý status có thể là mảng hoặc chuỗi phân tách bởi dấu phẩy
    if (typeof query.status === 'string') {
      const parts = query.status.split(',').map((s) => s.trim()).filter(Boolean);
      query.status = parts.length > 1 ? parts : (parts[0] || 'active');
    } else if (!query.status) {
      query.status = 'active';
    }

    // Xử lý bbox dạng 'minLng,minLat,maxLng,maxLat'
    if (typeof query.bbox === 'string') {
      const bboxParts = query.bbox.split(',').map((v) => parseFloat(v.trim()));
      if (bboxParts.length === 4 && bboxParts.every((n) => !isNaN(n))) {
        query.bbox = bboxParts;
      } else {
        delete query.bbox;
      }
    }

    return floodPointRepo.list(query);
  }

  /**
   * Xuất danh sách điểm ngập theo chuẩn GeoJSON FeatureCollection phục vụ vẽ Leaflet (NV1).
   * LƯU Ý KỸ THUẬT: Tọa độ bắt buộc theo thứ tự [lng, lat].
   */
  getGeoJson(filters = {}) {
    const points = this.listFloodPoints(filters);

    const features = points.map((p) => {
      // 1. Xác định markerColor: low -> yellow, medium -> orange, high -> red, resolved/expired/rejected -> gray
      let markerColor = 'yellow';
      if (['resolved', 'expired', 'rejected'].includes(p.status)) {
        markerColor = 'gray';
      } else if (p.severity === 'high') {
        markerColor = 'red';
      } else if (p.severity === 'medium') {
        markerColor = 'orange';
      } else {
        markerColor = 'yellow';
      }

      // 2. Xác định cờ layer
      const isCurrent = ['active', 'pending'].includes(p.status);
      const isFloodProne = Boolean(p.isFloodProne);
      const layer = isFloodProne && !isCurrent ? 'prone' : 'current';

      // 3. Tính độ trễ thời gian ageMinutes
      let ageMinutes = 0;
      if (p.lastUpdatedAt) {
        const diffMs = Date.now() - new Date(p.lastUpdatedAt).getTime();
        ageMinutes = Math.max(0, Math.round(diffMs / (60 * 1000)));
      }

      // 4. Lấy URL ảnh đại diện thumbnailUrl nếu có
      let thumbnailUrl = null;
      const reports = reportRepo.listByFloodPointId(p.id);
      if (reports.length > 0 && reports[0].imagePath) {
        thumbnailUrl = `${ENV.PUBLIC_BASE_URL}${reports[0].imagePath}`;
      }

      return toGeoJsonPoint(p, {
        markerColor,
        layer,
        isCurrent,
        isFloodProne,
        ageMinutes,
        thumbnailUrl,
      });
    });

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  /**
   * Chi tiết 1 điểm ngập kèm lịch sử ảnh và sự kiện.
   */
  getFloodPointDetails(id) {
    const point = floodPointRepo.findById(id);
    if (!point) return null;

    // Lấy tối đa 5 ảnh gần nhất (URL tuyệt đối)
    const reports = reportRepo.listByFloodPointId(id);
    const images = reports
      .map((r) => (r.imagePath ? `${ENV.PUBLIC_BASE_URL}${r.imagePath}` : null))
      .filter(Boolean)
      .slice(0, 5);

    // Mô tả AI gần nhất
    const latestAiReport = reports.find((r) => r.aiJson && r.aiJson.description);
    const aiDescription = latestAiReport ? latestAiReport.aiJson.description : null;

    // Lịch sử tối đa 10 sự kiện gần nhất
    const events = eventRepo.listByFloodPointId(id, 10);
    const lastFloodAt = events[0]?.startedAt || point.lastUpdatedAt || point.firstReportedAt;

    return {
      ...point,
      images,
      aiDescription,
      events,
      floodEventCount: point.floodEventCount,
      lastFloodAt,
    };
  }

  /**
   * Danh sách khu vực/đường hay ngập phục vụ NV5 đối chiếu lượng mưa.
   * Gom cụm theo clusterKey (tên đường hoặc lưới ~100m) và tính tổng số sự kiện.
   */
  getFloodProneSummary({ minEvents = RULES.FLOOD_PRONE_MIN_EVENTS, wardId } = {}) {
    const allPoints = floodPointRepo.list();
    const clustersMap = new Map();

    for (const pt of allPoints) {
      if (wardId && pt.wardId !== wardId) {
        continue;
      }

      const key = clusterKey(pt);
      if (!clustersMap.has(key)) {
        clustersMap.set(key, {
          key,
          street: pt.street || null,
          wardId: pt.wardId || null,
          points: [],
          eventCount: 0,
          latestFloodMs: 0,
        });
      }

      const cluster = clustersMap.get(key);
      cluster.points.push(pt);
      cluster.eventCount += (pt.floodEventCount || 0) + (pt.historicalEventCount || 0);

      const ptTime = new Date(pt.lastUpdatedAt || pt.firstReportedAt || 0).getTime();
      if (ptTime > cluster.latestFloodMs) {
        cluster.latestFloodMs = ptTime;
      }
    }

    const results = [];
    for (const cluster of clustersMap.values()) {
      if (cluster.eventCount >= minEvents) {
        const count = cluster.points.length;
        const centerLat = cluster.points.reduce((sum, p) => sum + p.lat, 0) / count;
        const centerLng = cluster.points.reduce((sum, p) => sum + p.lng, 0) / count;

        // Tính mức độ nghiêm trọng trung bình
        let totalScore = 0;
        for (const p of cluster.points) {
          totalScore += SEVERITY_SCORES[p.severity] || 2;
        }
        const avgScore = totalScore / count;
        let avgSeverity = 'medium';
        if (avgScore >= 2.5) avgSeverity = 'high';
        else if (avgScore < 1.5) avgSeverity = 'low';

        results.push({
          key: cluster.key,
          street: cluster.street,
          wardId: cluster.wardId,
          centerLat: parseFloat(centerLat.toFixed(5)),
          centerLng: parseFloat(centerLng.toFixed(5)),
          eventCount: cluster.eventCount,
          lastFloodAt: cluster.latestFloodMs ? new Date(cluster.latestFloodMs).toISOString() : null,
          avgSeverity,
          pointIds: cluster.points.map((p) => p.id),
        });
      }
    }

    // Sắp xếp giảm dần theo eventCount
    results.sort((a, b) => b.eventCount - a.eventCount);
    return results;
  }

  /**
   * Danh sách điểm ngập theo phường kèm tóm tắt và gom nhóm theo đường.
   */
  getWardFloodPoints(wardId) {
    const points = floodPointRepo.list({ wardId });

    let activeCount = 0;
    let proneCount = 0;
    let totalEvents = 0;
    const streetsMap = new Map();

    for (const pt of points) {
      if (pt.status === 'active') activeCount += 1;
      if (pt.isFloodProne) proneCount += 1;
      totalEvents += (pt.floodEventCount || 0) + (pt.historicalEventCount || 0);

      const streetName = pt.street || 'Đường khác';
      if (!streetsMap.has(streetName)) {
        streetsMap.set(streetName, []);
      }
      streetsMap.get(streetName).push(pt);
    }

    const streets = [];
    for (const [street, pts] of streetsMap.entries()) {
      streets.push({
        street,
        count: pts.length,
        points: pts,
      });
    }

    streets.sort((a, b) => b.count - a.count);

    return {
      wardId,
      summary: {
        activeCount,
        proneCount,
        totalEvents,
      },
      streets,
      points,
    };
  }
}

export const floodPointQueryService = new FloodPointQueryService();
export default floodPointQueryService;
