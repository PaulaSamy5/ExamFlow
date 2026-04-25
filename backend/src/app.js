const express = require('express');
const cors = require('cors');
require('dotenv').config();

console.log('📦 Core Modules Engaged. Booting System...');


const authRoutes = require('./modules/auth/auth.routes');
const examRoutes = require('./modules/exams/exam.routes');
const submissionRoutes = require('./modules/submissions/submission.routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/submissions', submissionRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK' }));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;
