const db = require('../db');

const Report = {
  async create({ project_id, user_id, height, width, depth, progress_percentage, notes, image_url }) {
    const cubic_meters = parseFloat(height) * parseFloat(width) * parseFloat(depth);
    const { rows } = await db.query(
      'INSERT INTO reports (project_id, user_id, height, width, depth, cubic_meters, progress_percentage, notes, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [project_id, user_id, height, width, depth, cubic_meters, progress_percentage, notes, image_url]
    );
    return rows[0];
  },

  async getByProjectId(project_id) {
    const { rows } = await db.query("SELECT r.*, (u.first_name || ' ' || u.last_name) as user_name FROM reports r JOIN users u ON r.user_id = u.id WHERE r.project_id = $1 ORDER BY r.created_at DESC", [project_id]);
    return rows;
  },

  async getById(id) {
    const { rows } = await db.query("SELECT r.*, (u.first_name || ' ' || u.last_name) as user_name FROM reports r JOIN users u ON r.user_id = u.id WHERE r.id = $1", [id]);
    return rows[0];
  },

  async delete(id) {
    const { rows } = await db.query('DELETE FROM reports WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  },

  async sumCubicMeters() {
    const { rows } = await db.query('SELECT SUM(cubic_meters) as total FROM reports');
    return parseFloat(rows[0].total) || 0;
  },

  async countRecent() {
    const { rows } = await db.query("SELECT COUNT(*) FROM reports WHERE created_at >= NOW() - interval '24 hours'");
    return parseInt(rows[0].count, 10);
  },

  async getRecent(limit) {
    const { rows } = await db.query(`
      SELECT r.id, r.created_at, r.progress_percentage, p.name as project_name, p.id as project_id, (u.first_name || ' ' || u.last_name) as user_name
      FROM reports r
      JOIN projects p ON r.project_id = p.id
      JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
      LIMIT $1
    `, [limit]);
    return rows;
  }
};

module.exports = Report;
