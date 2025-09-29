const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadFile } = require('../lib/googleCloud');
const Report = require('../models/report');
const auth = require('../middleware/auth');

// Multer config for in-memory storage
const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage });

// All routes are protected
router.use(auth);

// GET all reports for a specific project
router.get('/project/:projectId', async (req, res) => {
  try {
    const reports = await Report.getByProjectId(req.params.projectId);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET a single report by ID
router.get('/:id', async (req, res) => {
  try {
    const report = await Report.getById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST a new report with an image upload
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required.' });
    }

    const imageUrl = await uploadFile(req.file);
    
    const { project_id, height, width, depth, progress_percentage, notes } = req.body;
    const user_id = req.user.id;

    const newReport = await Report.create({
      project_id,
      user_id,
      height,
      width,
      depth,
      progress_percentage,
      notes,
      image_url: imageUrl
    });

    res.status(201).json(newReport);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE a report
router.delete('/:id', async (req, res) => {
  try {
    // Optional: Add logic here to delete the image from GCS if needed
    const deletedReport = await Report.delete(req.params.id);
    if (!deletedReport) {
      return res.status(404).json({ message: 'Report not found' });
    }
    res.json({ message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
