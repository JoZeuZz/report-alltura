const express = require('express');
const router = express.Router();
const Project = require('../models/project');
const db = require('../db');
const auth = require('../middleware/auth');
const { generateScaffoldsPDF } = require('../lib/pdfGenerator');
const { generateReportExcel } = require('../lib/excelGenerator');

// Middleware to check for admin role
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden: Admins only' });
  }
};

// GET all projects (for admins) or assigned projects (for technicians)
router.get('/', auth, async (req, res) => {
  try {
    let projects;
    if (req.user.role === 'admin') {
      projects = await Project.getAll();
    } else if (req.user.role === 'technician') {
      projects = await Project.getForUser(req.user.id);
    }
    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET a single project by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Project.getById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Apply auth and isAdmin middleware to all routes below
router.use(auth, isAdmin);

// GET assigned users for a project
router.get('/:id/users', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT user_id FROM project_users WHERE project_id = $1', [req.params.id]);
    const userIds = rows.map(row => row.user_id);
    res.json(userIds); // Devuelve un array de IDs de usuario [1, 2, 3]
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST to assign users to a project
router.post('/:id/users', async (req, res) => {
  try {
    const projectId = req.params.id;
    const { userIds } = req.body; // Espera un array de IDs de usuario [1, 2, 3]

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      // Primero, eliminar todas las asignaciones existentes para este proyecto
      await client.query('DELETE FROM project_users WHERE project_id = $1', [projectId]);
      // Luego, insertar las nuevas asignaciones
      for (const userId of userIds) {
        await client.query('INSERT INTO project_users (project_id, user_id) VALUES ($1, $2)', [projectId, userId]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.status(200).json({ message: 'Users assigned successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST a new project
router.post('/', async (req, res) => {
  try {
    const { client_id, name, status } = req.body;
    const newProject = await Project.create({ client_id, name, status });
    res.status(201).json(newProject);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT to update a project
router.put('/:id', async (req, res) => {
  try {
    const { client_id, name, status } = req.body;
    const updatedProject = await Project.update(req.params.id, { client_id, name, status });
    if (!updatedProject) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json(updatedProject);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE a project
router.delete('/:id', async (req, res) => {
  try {
    const deletedProject = await Project.delete(req.params.id);
    if (!deletedProject) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET PDF export for a project
router.get('/:id/export/pdf', async (req, res) => {
  try {
    const project = await Project.getById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const { status, startDate, endDate } = req.query;

    // Obtener los andamios con el nombre del usuario
    let scaffoldsQuery = `
      SELECT s.*, u.name as user_name 
      FROM scaffolds s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.project_id = $1`;
    
    const queryParams = [req.params.id];
    let paramIndex = 2;

    if (status && status !== 'all') {
      scaffoldsQuery += ` AND s.status = $${paramIndex++}`;
      queryParams.push(status);
    }
    if (startDate) {
      scaffoldsQuery += ` AND s.assembly_created_at >= $${paramIndex++}`;
      queryParams.push(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      scaffoldsQuery += ` AND s.assembly_created_at < $${paramIndex++}`;
      queryParams.push(end.toISOString().split('T')[0]);
    }

    scaffoldsQuery += ` ORDER BY s.assembly_created_at DESC`;
    const { rows: scaffolds } = await db.query(scaffoldsQuery, queryParams);
    
    generateScaffoldsPDF(project, scaffolds, res, { status, startDate, endDate });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET Excel export for a project
router.get('/:id/export/excel', async (req, res) => {
  try {
    const project = await Project.getById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Obtener los andamios con el nombre del usuario
    const scaffoldsQuery = `
      SELECT s.*, u.name as user_name 
      FROM scaffolds s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.project_id = $1 ORDER BY s.assembly_created_at DESC`;
    const { rows: scaffolds } = await db.query(scaffoldsQuery, [req.params.id]);
    
    generateReportExcel(project, scaffolds, res);

  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
