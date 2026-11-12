import { getDb } from '../db/connection.js';

export class EventRepository {
  constructor(db = null) {
    this._db = db;
  }

  get db() {
    return this._db || getDb();
  }

  insert(event) {
    const stmt = this.db.prepare(`
      INSERT INTO flood_events (
        id, flood_point_id, started_at, ended_at, end_reason, is_demo
      ) VALUES (
        @id, @floodPointId, @startedAt, @endedAt, @endReason, @isDemo
      )
    `);

    const params = {
      id: event.id,
      floodPointId: event.floodPointId || event.flood_point_id,
      startedAt: event.startedAt || event.started_at || new Date().toISOString(),
      endedAt: event.endedAt || event.ended_at || null,
      endReason: event.endReason || event.end_reason || null,
      isDemo: event.isDemo ?? event.is_demo ?? 0,
    };

    stmt.run(params);
    return this.findById(event.id);
  }

  findById(id) {
    const stmt = this.db.prepare(`SELECT * FROM flood_events WHERE id = ?`);
    const row = stmt.get(id);
    return row ? this._mapRow(row) : null;
  }

  findOpenEvent(floodPointId) {
    const stmt = this.db.prepare(`
      SELECT * FROM flood_events
      WHERE flood_point_id = ? AND ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
    `);
    const row = stmt.get(floodPointId);
    return row ? this._mapRow(row) : null;
  }

  closeEvent(id, endedAt, endReason) {
    const stmt = this.db.prepare(`
      UPDATE flood_events
      SET ended_at = ?, end_reason = ?
      WHERE id = ?
    `);
    stmt.run(endedAt, endReason, id);
    return this.findById(id);
  }

  listByFloodPointId(floodPointId, limit = 10) {
    const stmt = this.db.prepare(`
      SELECT * FROM flood_events
      WHERE flood_point_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(floodPointId, limit);
    return rows.map(r => this._mapRow(r));
  }

  countEventsInWindow(floodPointId, sinceIso) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM flood_events
      WHERE flood_point_id = ? AND started_at >= ?
    `);
    const row = stmt.get(floodPointId, sinceIso);
    return row ? row.count : 0;
  }

  deleteDemo() {
    const stmt = this.db.prepare(`DELETE FROM flood_events WHERE is_demo = 1`);
    const res = stmt.run();
    return res.changes;
  }

  _mapRow(row) {
    return {
      id: row.id,
      floodPointId: row.flood_point_id,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      endReason: row.end_reason,
      isDemo: Boolean(row.is_demo),
    };
  }
}

export default new EventRepository();
