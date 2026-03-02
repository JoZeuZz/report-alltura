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
