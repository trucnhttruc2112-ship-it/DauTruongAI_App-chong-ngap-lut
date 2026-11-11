import { getDb } from '../db/connection.js';

export class ConfirmationRepository {
  constructor(db = null) {
    this._db = db;
  }

  get db() {
    return this._db || getDb();
  }

  insert(conf) {
    const stmt = this.db.prepare(`
      INSERT INTO confirmations (
        id, flood_point_id, device_id, type, lat, lng, created_at, is_demo
      ) VALUES (
        @id, @floodPointId, @deviceId, @type, @lat, @lng, @createdAt, @isDemo
      )
    `);

    const params = {
      id: conf.id,
      floodPointId: conf.floodPointId || conf.flood_point_id,
      deviceId: conf.deviceId || conf.device_id,
      type: conf.type,
      lat: conf.lat ?? null,
      lng: conf.lng ?? null,
      createdAt: conf.createdAt || conf.created_at || new Date().toISOString(),
      isDemo: conf.isDemo ?? conf.is_demo ?? 0,
    };

    stmt.run(params);
    return this.findById(conf.id);
  }

  findById(id) {
    const stmt = this.db.prepare(`SELECT * FROM confirmations WHERE id = ?`);
    const row = stmt.get(id);
    return row ? this._mapRow(row) : null;
  }

  findByPointAndDevice(floodPointId, deviceId, type) {
    const stmt = this.db.prepare(`
      SELECT * FROM confirmations
      WHERE flood_point_id = ? AND device_id = ? AND type = ?
      LIMIT 1
    `);
    const row = stmt.get(floodPointId, deviceId, type);
    return row ? this._mapRow(row) : null;
  }

  listByFloodPointId(floodPointId) {
    const stmt = this.db.prepare(`
      SELECT * FROM confirmations
      WHERE flood_point_id = ?
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(floodPointId);
    return rows.map(r => this._mapRow(r));
  }

  countUniqueDevicesByType(floodPointId, type) {
    const stmt = this.db.prepare(`
      SELECT COUNT(DISTINCT device_id) as count
      FROM confirmations
      WHERE flood_point_id = ? AND type = ?
    `);
    const row = stmt.get(floodPointId, type);
    return row ? row.count : 0;
  }

  deleteDemo() {
    const stmt = this.db.prepare(`DELETE FROM confirmations WHERE is_demo = 1`);
    const res = stmt.run();
    return res.changes;
  }

  _mapRow(row) {
    return {
      id: row.id,
      floodPointId: row.flood_point_id,
      deviceId: row.device_id,
      type: row.type,
      lat: row.lat,
      lng: row.lng,
      createdAt: row.created_at,
      isDemo: Boolean(row.is_demo),
    };
  }
}

export default new ConfirmationRepository();
