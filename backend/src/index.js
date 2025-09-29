const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const projectRoutes = require('./routes/projects'); 
const scaffoldRoutes = require('./routes/scaffolds');
const userRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.send('Alltura Reports API is running...');
});

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/scaffolds', scaffoldRoutes); // Ruta actualizada
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Error handler middleware (debe ir después de todas las rutas)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
