import { getDb } from '../db/connection.js';

export class FloodPointRepository {
  constructor(db = null) {
    this._db = db;
  }

  get db() {
    return this._db || getDb();
  }

  insert(point) {
    const stmt = this.db.prepare(`
      INSERT INTO flood_points (
        id, lat, lng, address, street, ward_id, status, severity,
        estimated_depth_cm, trust_score, confirm_still, confirm_ended,
        report_count, is_flood_prone, flood_event_count, first_reported_at,
        last_updated_at, last_confirmed_at, historical_event_count, is_demo
      ) VALUES (
        @id, @lat, @lng, @address, @street, @wardId, @status, @severity,
        @estimatedDepthCm, @trustScore, @confirmStill, @confirmEnded,
        @reportCount, @isFloodProne, @floodEventCount, @firstReportedAt,
        @lastUpdatedAt, @lastConfirmedAt, @historicalEventCount, @isDemo
      )
    `);

    const params = {
      id: point.id,
      lat: point.lat,
      lng: point.lng,
      address: point.address || null,
      street: point.street || null,
      wardId: point.wardId || point.ward_id || null,
      status: point.status || 'pending',
      severity: point.severity || 'low',
      estimatedDepthCm: point.estimatedDepthCm ?? point.estimated_depth_cm ?? null,
      trustScore: point.trustScore ?? point.trust_score ?? 0,
      confirmStill: point.confirmStill ?? point.confirm_still ?? 0,
      confirmEnded: point.confirmEnded ?? point.confirm_ended ?? 0,
      reportCount: point.reportCount ?? point.report_count ?? 1,
      isFloodProne: point.isFloodProne ? 1 : 0,
      floodEventCount: point.floodEventCount ?? point.flood_event_count ?? 0,
      firstReportedAt: point.firstReportedAt || point.first_reported_at || new Date().toISOString(),
      lastUpdatedAt: point.lastUpdatedAt || point.last_updated_at || new Date().toISOString(),
      lastConfirmedAt: point.lastConfirmedAt || point.last_confirmed_at || null,
      historicalEventCount: point.historicalEventCount ?? point.historical_event_count ?? 0,
      isDemo: point.isDemo ?? point.is_demo ?? 0,
    };

    stmt.run(params);
    return this.findById(point.id);
  }

  findById(id) {
    const stmt = this.db.prepare(`SELECT * FROM flood_points WHERE id = ?`);
    const row = stmt.get(id);
    return row ? this._mapRow(row) : null;
  }

  update(id, fields) {
    const allowed = {
      address: 'address',
      street: 'street',
      wardId: 'ward_id',
      ward_id: 'ward_id',
      status: 'status',
      severity: 'severity',
      estimatedDepthCm: 'estimated_depth_cm',
      estimated_depth_cm: 'estimated_depth_cm',
      trustScore: 'trust_score',
      trust_score: 'trust_score',
      confirmStill: 'confirm_still',
      confirm_still: 'confirm_still',
      confirmEnded: 'confirm_ended',
      confirm_ended: 'confirm_ended',
      reportCount: 'report_count',
      report_count: 'report_count',
      isFloodProne: 'is_flood_prone',
      is_flood_prone: 'is_flood_prone',
      floodEventCount: 'flood_event_count',
      flood_event_count: 'flood_event_count',
      lastUpdatedAt: 'last_updated_at',
      last_updated_at: 'last_updated_at',
      lastConfirmedAt: 'last_confirmed_at',
      last_confirmed_at: 'last_confirmed_at',
      historicalEventCount: 'historical_event_count',
      historical_event_count: 'historical_event_count',
      isDemo: 'is_demo',
      is_demo: 'is_demo',
    };

    const updates = [];
    const values = {};

    for (const [key, val] of Object.entries(fields)) {
      if (allowed[key]) {
        const col = allowed[key];
        updates.push(`${col} = @${col}`);
        values[col] = (key === 'isFloodProne' || key === 'is_flood_prone') ? (val ? 1 : 0) : val;
      }
    }

    if (updates.length === 0) return this.findById(id);

    values.id = id;
    const sql = `UPDATE flood_points SET ${updates.join(', ')} WHERE id = @id`;
    this.db.prepare(sql).run(values);

    return this.findById(id);
  }

  list(filters = {}) {
    const conditions = [];
    const params = {};

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        const placeholders = filters.status.map((_, i) => `@status_${i}`);
        conditions.push(`status IN (${placeholders.join(', ')})`);
        filters.status.forEach((st, i) => {
          params[`status_${i}`] = st;
        });
      } else {
        conditions.push(`status = @status`);
        params.status = filters.status;
      }
    }

    if (filters.wardId) {
      conditions.push(`ward_id = @wardId`);
      params.wardId = filters.wardId;
    }

    if (filters.severity) {
      conditions.push(`severity = @severity`);
      params.severity = filters.severity;
    }

    if (filters.isFloodProne !== undefined) {
      conditions.push(`is_flood_prone = @isFloodProne`);
      params.isFloodProne = filters.isFloodProne ? 1 : 0;
    }

    if (filters.isDemo !== undefined) {
      conditions.push(`is_demo = @isDemo`);
      params.isDemo = filters.isDemo ? 1 : 0;
    }

    if (filters.bbox) {
      // bbox: [minLng, minLat, maxLng, maxLat]
      const [minLng, minLat, maxLng, maxLat] = filters.bbox;
      conditions.push(`lat >= @minLat AND lat <= @maxLat AND lng >= @minLng AND lng <= @maxLng`);
      params.minLat = minLat;
      params.maxLat = maxLat;
      params.minLng = minLng;
      params.maxLng = maxLng;
    }

    let sql = `SELECT * FROM flood_points`;
    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }
    sql += ` ORDER BY last_updated_at DESC`;

    if (filters.limit) {
      sql += ` LIMIT @limit`;
      params.limit = filters.limit;
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(params);
    return rows.map(r => this._mapRow(r));
  }

  findActiveAndPendingInBoundingBox(minLat, maxLat, minLng, maxLng) {
    const stmt = this.db.prepare(`
      SELECT * FROM flood_points
      WHERE status IN ('active', 'pending')
        AND lat >= ? AND lat <= ?
        AND lng >= ? AND lng <= ?
    `);
    const rows = stmt.all(minLat, maxLat, minLng, maxLng);
    return rows.map(r => this._mapRow(r));
  }

  countAll() {
    const row = this.db.prepare(`SELECT count(*) as count FROM flood_points`).get();
    return row ? row.count : 0;
  }

  deleteDemo() {
    const stmt = this.db.prepare(`DELETE FROM flood_points WHERE is_demo = 1`);
    const res = stmt.run();
    return res.changes;
  }

  _mapRow(row) {
    return {
      id: row.id,
      lat: row.lat,
      lng: row.lng,
      address: row.address,
      street: row.street,
      wardId: row.ward_id,
      status: row.status,
      severity: row.severity,
      estimatedDepthCm: row.estimated_depth_cm,
      trustScore: row.trust_score,
      confirmStill: row.confirm_still,
      confirmEnded: row.confirm_ended,
      reportCount: row.report_count,
      isFloodProne: Boolean(row.is_flood_prone),
      floodEventCount: row.flood_event_count,
      firstReportedAt: row.first_reported_at,
      lastUpdatedAt: row.last_updated_at,
      lastConfirmedAt: row.last_confirmed_at,
      historicalEventCount: row.historical_event_count,
      isDemo: Boolean(row.is_demo),
    };
  }
}

export default new FloodPointRepository();
