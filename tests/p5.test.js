import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { getDb, closeDb } from '../src/db/connection.js';
import { runMigrations } from '../scripts/migrate.js';
import { runSeed } from '../scripts/seed.js';

describe('Prompt 5: API Đọc Dữ liệu (cho NV1, NV2, NV5)', () => {
  let db;

  beforeAll(() => {
    db = getDb();
    runMigrations(db);
    runSeed(db); // Nạp 20 điểm ngập mẫu
  });

  afterAll(() => {
    closeDb();
  });

  describe('1. GET /api/flood-points', () => {
    it('Trả danh sách điểm ngập mặc định status=active, sắp xếp last_updated_at giảm dần', async () => {
      const res = await request(app).get('/api/flood-points');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Mặc định mọi điểm đều là active
      for (const pt of res.body.data) {
        expect(pt.status).toBe('active');
        expect(pt).toHaveProperty('lat');
        expect(pt).toHaveProperty('lng');
        expect(pt).toHaveProperty('trustScore');
      }

      // Kiểm tra sắp xếp giảm dần theo last_updated_at
      for (let i = 0; i < res.body.data.length - 1; i++) {
        const t1 = new Date(res.body.data[i].lastUpdatedAt).getTime();
        const t2 = new Date(res.body.data[i + 1].lastUpdatedAt).getTime();
        expect(t1).toBeGreaterThanOrEqual(t2);
      }
    });

    it('Lọc theo status kết hợp (status=active,pending)', async () => {
      const res = await request(app).get('/api/flood-points?status=active,pending');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      for (const pt of res.body.data) {
        expect(['active', 'pending']).toContain(pt.status);
      }
    });

    it('Lọc theo wardId, severity, isFloodProne và limit', async () => {
      const res = await request(app).get(
        '/api/flood-points?status=active&wardId=long-binh&severity=medium&isFloodProne=true&limit=5'
      );

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(5);

      for (const pt of res.body.data) {
        expect(pt.wardId).toBe('long-binh');
        expect(pt.severity).toBe('medium');
        expect(pt.isFloodProne).toBe(true);
      }
    });

    it('Lọc theo Bounding Box (bbox=minLng,minLat,maxLng,maxLat)', async () => {
      // Bounding box quanh trung tâm Biên Hòa: lng 106.80-106.85, lat 10.94-10.96
      const res = await request(app).get(
        '/api/flood-points?status=active&bbox=106.80,10.94,106.85,10.96'
      );

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      for (const pt of res.body.data) {
        expect(pt.lng).toBeGreaterThanOrEqual(106.80);
        expect(pt.lng).toBeLessThanOrEqual(106.85);
        expect(pt.lat).toBeGreaterThanOrEqual(10.94);
        expect(pt.lat).toBeLessThanOrEqual(10.96);
      }
    });

    it('Xác thực query param qua Zod: trả 400 INVALID_QUERY khi param sai', async () => {
      const res = await request(app).get('/api/flood-points?severity=sieu-nang');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('INVALID_QUERY');
      expect(res.body.error.message).toContain('Tham số truy vấn không hợp lệ');
    });
  });

  describe('2. GET /api/flood-points.geojson', () => {
    it('Xuất chuẩn GeoJSON FeatureCollection với thứ tự [lng, lat], markerColor, layer, ageMinutes', async () => {
      const startTime = Date.now();
      const res = await request(app).get('/api/flood-points.geojson?status=active');
      const durationMs = Date.now() - startTime;

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('public, max-age=10');
      // Đảm bảo thời gian phản hồi nhanh (< 200ms)
      expect(durationMs).toBeLessThan(200);

      const geoJson = res.body;
      expect(geoJson.type).toBe('FeatureCollection');
      expect(Array.isArray(geoJson.features)).toBe(true);
      expect(geoJson.features.length).toBeGreaterThan(0);

      const feature = geoJson.features[0];
      expect(feature.type).toBe('Feature');
      expect(feature.geometry.type).toBe('Point');

      // BẮT BUỘC: thứ tự [lng, lat]
      const [lng, lat] = feature.geometry.coordinates;
      expect(lng).toBeGreaterThan(106.0); // lng Đồng Nai ~106.8
      expect(lat).toBeLessThan(12.0);      // lat Đồng Nai ~10.9

      // Properties bổ sung cho Leaflet
      expect(feature.properties).toHaveProperty('markerColor');
      expect(['yellow', 'orange', 'red', 'gray']).toContain(feature.properties.markerColor);
      expect(feature.properties).toHaveProperty('layer');
      expect(feature.properties).toHaveProperty('isCurrent');
      expect(feature.properties).toHaveProperty('isFloodProne');
      expect(feature.properties).toHaveProperty('ageMinutes');
    });

    it('Quy tắc markerColor: low→yellow, medium→orange, high→red', async () => {
      const res = await request(app).get('/api/flood-points.geojson?status=active,pending,resolved');
      expect(res.status).toBe(200);

      for (const f of res.body.features) {
        const { status, severity, markerColor } = f.properties;
        if (['resolved', 'expired', 'rejected'].includes(status)) {
          expect(markerColor).toBe('gray');
        } else if (severity === 'high') {
          expect(markerColor).toBe('red');
        } else if (severity === 'medium') {
          expect(markerColor).toBe('orange');
        } else if (severity === 'low') {
          expect(markerColor).toBe('yellow');
        }
      }
    });

    it('Xác thực query param sai của GeoJSON trả 400 INVALID_QUERY', async () => {
      const res = await request(app).get('/api/flood-points.geojson?bbox=invalid_bbox_string');
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('INVALID_QUERY');
    });
  });

  describe('3. GET /api/flood-points/:id', () => {
    it('Trả chi tiết điểm ngập kèm ảnh, mô tả AI và lịch sử sự kiện', async () => {
      const res = await request(app).get('/api/flood-points/fp_demo_01');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const pt = res.body.data;
      expect(pt.id).toBe('fp_demo_01');
      expect(pt.street).toBe('Xa lộ Hà Nội');
      expect(pt.wardId).toBe('long-binh');
      expect(pt).toHaveProperty('images');
      expect(Array.isArray(pt.images)).toBe(true);
      expect(pt).toHaveProperty('events');
      expect(Array.isArray(pt.events)).toBe(true);
      expect(pt).toHaveProperty('floodEventCount');
      expect(pt).toHaveProperty('lastFloodAt');
    });

    it('Trả 404 NOT_FOUND khi id không tồn tại', async () => {
      const res = await request(app).get('/api/flood-points/fp_non_existent_999');

      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toContain('Không tìm thấy điểm ngập');
    });
  });

  describe('4. GET /api/flood-prone', () => {
    it('Trả danh sách tuyến đường/khu vực hay ngập gom cụm, sắp theo eventCount giảm dần', async () => {
      const res = await request(app).get('/api/flood-prone');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const item = res.body.data[0];
      expect(item).toHaveProperty('key');
      expect(item).toHaveProperty('street');
      expect(item).toHaveProperty('centerLat');
      expect(item).toHaveProperty('centerLng');
      expect(item).toHaveProperty('eventCount');
      expect(item).toHaveProperty('avgSeverity');
      expect(item).toHaveProperty('pointIds');
      expect(item.eventCount).toBeGreaterThanOrEqual(3); // Mặc định minEvents = 3

      // Kiểm tra sắp xếp giảm dần theo eventCount
      for (let i = 0; i < res.body.data.length - 1; i++) {
        expect(res.body.data[i].eventCount).toBeGreaterThanOrEqual(res.body.data[i + 1].eventCount);
      }
    });

    it('Lọc theo ?minEvents=5', async () => {
      const res = await request(app).get('/api/flood-prone?minEvents=5');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      for (const item of res.body.data) {
        expect(item.eventCount).toBeGreaterThanOrEqual(5);
      }
    });

    it('Xác thực query minEvents sai trả 400 INVALID_QUERY', async () => {
      const res = await request(app).get('/api/flood-prone?minEvents=-2');
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('INVALID_QUERY');
    });
  });

  describe('5. GET /api/wards/:wardId/flood-points', () => {
    it('Trả danh sách điểm ngập của phường kèm tóm tắt và nhóm theo đường', async () => {
      const res = await request(app).get('/api/wards/long-binh/flood-points');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.wardId).toBe('long-binh');

      // Tóm tắt
      const { summary, streets, points } = res.body.data;
      expect(summary).toHaveProperty('activeCount');
      expect(summary).toHaveProperty('proneCount');
      expect(summary).toHaveProperty('totalEvents');

      // Danh sách theo đường
      expect(Array.isArray(streets)).toBe(true);
      if (streets.length > 0) {
        expect(streets[0]).toHaveProperty('street');
        expect(streets[0]).toHaveProperty('count');
        expect(streets[0]).toHaveProperty('points');
      }

      // Danh sách điểm
      expect(Array.isArray(points)).toBe(true);
    });

    it('Phường không có điểm ngập nào trả về mảng rỗng và summary bằng 0', async () => {
      const res = await request(app).get('/api/wards/phuong-khong-ton-tai/flood-points');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.summary.activeCount).toBe(0);
      expect(res.body.data.summary.proneCount).toBe(0);
      expect(res.body.data.streets).toHaveLength(0);
      expect(res.body.data.points).toHaveLength(0);
    });
  });
});
