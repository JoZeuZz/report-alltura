const db = require('../db');
const bcrypt = require('bcrypt');

const User = {
  async create({ first_name, last_name, email, password, role }) {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    
    const { rows } = await db.query(
      'INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, first_name, last_name, email, role, created_at',
      [first_name, last_name, email, password_hash, role]
    );
    return rows[0];
  },

  async findByEmail(email) {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0];
  },

  async findById(id) {
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0];
  },

  async getAll(filters = {}) {
    let query = 'SELECT id, first_name, last_name, email, role FROM users';
    const queryParams = [];
    
    if (filters.role) {
      query += ' WHERE role = $1';
      queryParams.push(filters.role);
    }
    
    query += ' ORDER BY last_name, first_name';
    
    const { rows } = await db.query(query, queryParams);
    return rows;
  },

  async update(id, { first_name, last_name, email, role, password, birth_date, rut, position, profile_picture_url }) {
    const fields = [];
    const values = [];
    let query = 'UPDATE users SET ';

    const addField = (name, value) => {
      if (value !== undefined) {
        values.push(value);
        fields.push(`${name} = $${values.length}`);
      }
    };

    addField('first_name', first_name);
    addField('last_name', last_name);
    addField('email', email);
    addField('role', role);
    addField('birth_date', birth_date);
    addField('rut', rut);
    addField('position', position);
    addField('profile_picture_url', profile_picture_url);

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      addField('password_hash', password_hash);
    }

    if (fields.length === 0) {
      // Nothing to update, just return the user
      return this.findById(id);
    }

    query += fields.join(', ');
    values.push(id);
    query += ` WHERE id = $${values.length} RETURNING *`;

    const { rows } = await db.query(query, values);
    return rows[0];
  },

  async delete(id) {
    const { rows } = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    return rows[0];
  },

  async comparePasswords(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
};

module.exports = User;