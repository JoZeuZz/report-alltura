
const express = require('express');
const router = express.Router();
const User = require('../models/user');
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { uploadFile } = require('../lib/googleCloud');

// Multer config for in-memory storage
const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage });

// Middleware to check for admin role
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden: Admins only' });
  }
};

// ===== Self-service routes for logged-in users =====

// A user can get their own data
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// A user can update their own data
router.put('/me', auth, async (req, res) => {
  try {
    const { ...updateData } = req.body;
    // Users cannot change their own role via this route
    delete updateData.role;
    
    const updatedUser = await User.update(req.user.id, updateData);

    // Issue a new token with updated info
    const payload = {
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        role: updatedUser.role
      }
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ user: updatedUser, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


// ===== Admin-only routes =====

router.use(auth, isAdmin);

// GET all users
router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.role) {
      filters.role = req.query.role;
    }
    const users = await User.getAll(filters); 
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET user by id
router.get('/:id', async (req, res) => {
    try {
      const user = await User.findById(req.params.id); 
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  });

// POST a new user
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const newUser = await User.create({ name, email, password, role });
    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT to update a user
router.put('/:id', async (req, res) => {
  try {
    const { ...updateData } = req.body;
    const updatedUser = await User.update(req.params.id, updateData);
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE a user
router.delete('/:id', async (req, res) => {
  try {
    await User.delete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
