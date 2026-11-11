import { getDb } from '../db/connection.js';

export class ReportRepository {
  constructor(db = null) {
    this._db = db;
  }

  get db() {
    return this._db || getDb();
  }

  insert(report) {
    const stmt = this.db.prepare(`
      INSERT INTO reports (
        id, flood_point_id, device_id, lat, lng, accuracy_m,
        captured_at, created_at, image_path, image_sha256, image_dhash,
        ai_json, trust_flags, is_demo, source, photo_source
      ) VALUES (
        @id, @floodPointId, @deviceId, @lat, @lng, @accuracyM,
        @capturedAt, @createdAt, @imagePath, @imageSha256, @imageDhash,
        @aiJson, @trustFlags, @isDemo, @source, @photoSource
      )
    `);

    const params = {
      id: report.id,
      floodPointId: report.floodPointId || report.flood_point_id || null,
      deviceId: report.deviceId || report.device_id,
      lat: report.lat,
      lng: report.lng,
      accuracyM: report.accuracyM ?? report.accuracy_m ?? null,
      capturedAt: report.capturedAt || report.captured_at,
      createdAt: report.createdAt || report.created_at || new Date().toISOString(),
      imagePath: report.imagePath || report.image_path || null,
      imageSha256: report.imageSha256 || report.image_sha256 || null,
      imageDhash: report.imageDhash || report.image_dhash || null,
      aiJson: typeof report.aiJson === 'object' ? JSON.stringify(report.aiJson) : (report.aiJson || null),
      trustFlags: Array.isArray(report.trustFlags) ? JSON.stringify(report.trustFlags) : (report.trustFlags || null),
      isDemo: report.isDemo ?? report.is_demo ?? 0,
      source: report.source || null,
      photoSource: report.photoSource || report.photo_source || null,
    };

    stmt.run(params);
    return this.findById(report.id);
  }

  findById(id) {
    const stmt = this.db.prepare(`SELECT * FROM reports WHERE id = ?`);
    const row = stmt.get(id);
    return row ? this._mapRow(row) : null;
  }

  findBySha256(sha256) {
    const stmt = this.db.prepare(`SELECT * FROM reports WHERE image_sha256 = ? LIMIT 1`);
    const row = stmt.get(sha256);
    return row ? this._mapRow(row) : null;
  }

  listByFloodPointId(floodPointId) {
    const stmt = this.db.prepare(`
      SELECT * FROM reports
      WHERE flood_point_id = ?
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(floodPointId);
    return rows.map(r => this._mapRow(r));
  }

  countRecentByDevice(deviceId, sinceIso) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM reports
      WHERE device_id = ? AND created_at >= ?
    `);
    const row = stmt.get(deviceId, sinceIso);
    return row ? row.count : 0;
  }

  listRecentReports(sinceIso) {
    const stmt = this.db.prepare(`
      SELECT * FROM reports
      WHERE created_at >= ? AND image_dhash IS NOT NULL
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(sinceIso);
    return rows.map((r) => this._mapRow(r));
  }

  getDemoImagePaths() {
    const stmt = this.db.prepare(`
      SELECT image_path FROM reports WHERE is_demo = 1 AND image_path IS NOT NULL
    `);
    const rows = stmt.all();
    return rows.map(r => r.image_path);
  }

  deleteDemo() {
    const stmt = this.db.prepare(`DELETE FROM reports WHERE is_demo = 1`);
    const res = stmt.run();
    return res.changes;
  }

  _mapRow(row) {
    let aiJson = null;
    let trustFlags = [];
    try {
      if (row.ai_json) aiJson = JSON.parse(row.ai_json);
    } catch {}
    try {
      if (row.trust_flags) trustFlags = JSON.parse(row.trust_flags);
    } catch {}

    return {
      id: row.id,
      floodPointId: row.flood_point_id,
      deviceId: row.device_id,
      lat: row.lat,
      lng: row.lng,
      accuracyM: row.accuracy_m,
      capturedAt: row.captured_at,
      createdAt: row.created_at,
      imagePath: row.image_path,
      imageSha256: row.image_sha256,
      imageDhash: row.image_dhash || null,
      aiJson,
      trustFlags,
      isDemo: Boolean(row.is_demo),
      source: row.source || null,
      photoSource: row.photo_source || null,
    };
  }
}

export default new ReportRepository();
