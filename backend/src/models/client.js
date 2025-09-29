const db = require('../db');

const Client = {
  async create({ name, contact_info }) {
    const { rows } = await db.query(
      'INSERT INTO clients (name, contact_info) VALUES ($1, $2) RETURNING *',
      [name, contact_info]
    );
    return rows[0];
  },

  async getAll() {
    const { rows } = await db.query('SELECT * FROM clients ORDER BY name');
    return rows;
  },

  async getById(id) {
    const { rows } = await db.query('SELECT * FROM clients WHERE id = $1', [id]);
    return rows[0];
  },

  async update(id, { name, contact_info }) {
    const { rows } = await db.query(
      'UPDATE clients SET name = $1, contact_info = $2 WHERE id = $3 RETURNING *',
      [name, contact_info, id]
    );
    return rows[0];
  },

  async delete(id) {
    const { rows } = await db.query('DELETE FROM clients WHERE id = $1 RETURNING *', [id]);
    return rows[0];
  }
};

module.exports = Client;
