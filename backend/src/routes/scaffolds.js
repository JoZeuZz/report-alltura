const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const multer = require('multer');
const { uploadFile } = require('../lib/googleCloud');

// Multer config for in-memory storage
const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage });

router.use(auth); // Proteger todas las rutas de andamios

/**
 * @route   GET /api/scaffolds/project/:projectId
 * @desc    Obtener todos los andamios de un proyecto específico
 * @access  Private
 */
router.get('/project/:projectId', auth, async (req, res) => {
  const { projectId } = req.params;
  try {
    const query = `
      SELECT s.*, u.name as user_name 
      FROM scaffolds s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.project_id = $1 ORDER BY s.assembly_created_at DESC`;
    const { rows } = await db.query(query, [projectId]);
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   POST /api/scaffolds
 * @desc    Crear un nuevo reporte de andamio (montaje)
 * @access  Private (Technician/Admin)
 */
router.post('/', upload.single('assembly_image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'El archivo de imagen es requerido.' });
    }

    // Subir imagen a GCS
    const imageUrl = await uploadFile(req.file);

    const { project_id, height, width, depth, progress_percentage, assembly_notes } = req.body;
    const user_id = req.user.id;

    // Calcular metros cúbicos
    const cubic_meters = parseFloat(height) * parseFloat(width) * parseFloat(depth);

    const query = `
      INSERT INTO scaffolds 
        (project_id, user_id, height, width, depth, cubic_meters, progress_percentage, assembly_notes, assembly_image_url)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const values = [project_id, user_id, height, width, depth, cubic_meters, progress_percentage, assembly_notes, imageUrl];

    const { rows } = await db.query(query, values);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   PUT /api/scaffolds/:id/disassemble
 * @desc    Marcar un andamio como desarmado
 * @access  Private (Technician/Admin)
 */
router.put('/:id/disassemble', upload.single('disassembly_image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'La imagen de prueba del desmontaje es requerida.' });
    }

    // Subir imagen a GCS
    const imageUrl = await uploadFile(req.file);

    const { disassembly_notes } = req.body;
    const { id } = req.params;

    const query = `
      UPDATE scaffolds
      SET 
        status = 'disassembled',
        disassembly_notes = $1,
        disassembly_image_url = $2,
        disassembled_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const { rows } = await db.query(query, [disassembly_notes, imageUrl, id]);

    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   GET /api/scaffolds/my-history
 * @desc    Obtener el historial de andamios del técnico logueado
 * @access  Private (Technician)
 */
router.get('/my-history', async (req, res) => {
  const userId = req.user.id;
  try {
    const query = `
      SELECT 
        s.*, 
        p.name as project_name 
      FROM scaffolds s
      JOIN projects p ON s.project_id = p.id
      WHERE s.user_id = $1 
      ORDER BY s.assembly_created_at DESC
    `;
    const { rows } = await db.query(query, [userId]);
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;