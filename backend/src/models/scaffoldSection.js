const db = require('../db');

const ScaffoldSection = {
  async getByScaffold(scaffoldId) {
    const { rows } = await db.query(
      `SELECT id, scaffold_id, section_order, width, length, height, cubic_meters, created_at
       FROM scaffold_sections
       WHERE scaffold_id = $1
       ORDER BY section_order ASC`,
      [scaffoldId]
    );
    return rows;
  },

  async getByScaffolds(scaffoldIds) {
    if (!scaffoldIds || scaffoldIds.length === 0) return new Map();
    const { rows } = await db.query(
      `SELECT id, scaffold_id, section_order, width, length, height, cubic_meters, created_at
       FROM scaffold_sections
       WHERE scaffold_id = ANY($1::int[])
       ORDER BY scaffold_id, section_order ASC`,
      [scaffoldIds]
    );
    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.scaffold_id)) map.set(row.scaffold_id, []);
      map.get(row.scaffold_id).push(row);
    }
    return map;
  },

  async replaceForScaffold(scaffoldId, sections, dbClient = db) {
    await dbClient.query('DELETE FROM scaffold_sections WHERE scaffold_id = $1', [scaffoldId]);

    if (!sections || sections.length === 0) {
      return [];
    }

    const inserted = [];
    for (let index = 0; index < sections.length; index += 1) {
      const section = sections[index];
      const order = index + 1;
      const cubicMeters = Number(section.height) * Number(section.width) * Number(section.length);

      const { rows } = await dbClient.query(
        `INSERT INTO scaffold_sections
          (scaffold_id, section_order, width, length, height, cubic_meters)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, scaffold_id, section_order, width, length, height, cubic_meters, created_at`,
        [
          scaffoldId,
          order,
          Number(section.width),
          Number(section.length),
          Number(section.height),
          cubicMeters,
        ]
      );

      inserted.push(rows[0]);
    }

    return inserted;
  },
};

module.exports = ScaffoldSection;
