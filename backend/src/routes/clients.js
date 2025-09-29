const express = require('express');
const router = express.Router();
const Client = require('../models/client');
const auth = require('../middleware/auth');
const { isAdmin } = require('../middleware/roles');

// Apply auth and isAdmin middleware to all client routes
router.use(auth, isAdmin);

// GET all clients
router.get('/', async (req, res) => {
  try {
    const clients = await Client.getAll();
    res.json(clients);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET a single client by ID
router.get('/:id', async (req, res) => {
  try {
    const client = await Client.getById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST a new client
router.post('/', async (req, res) => {
  try {
    const { name, contact_info } = req.body;
    const newClient = await Client.create({ name, contact_info });
    res.status(201).json(newClient);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT to update a client
router.put('/:id', async (req, res) => {
  try {
    const { name, contact_info } = req.body;
    const updatedClient = await Client.update(req.params.id, { name, contact_info });
    if (!updatedClient) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(updatedClient);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE a client
router.delete('/:id', async (req, res) => {
  try {
    const deletedClient = await Client.delete(req.params.id);
    if (!deletedClient) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json({ message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
