const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const winston = require('winston');
require('dotenv').config();

// Import routes
const ussdRoutes = require('./routes/ussd');
const smsRoutes = require('./routes/sms');
const emergencyRoutes = require('./routes/emergency');
const healthRoutes = require('./routes/health');
const aiRoutes = require('./routes/ai');
const dashboardRoutes = require('./routes/dashboard');

// Import services
const { initializeDatabase } = require('./services/database');
const { startScheduledTasks } = require('./services/scheduler');

const app = express();

// Configure Winston Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
});

// Security middleware
app.use(helmet());
app.use(cors());

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/ussd', ussdRoutes);
app.use('/sms', smsRoutes);
app.use('/emergency', emergencyRoutes);
app.use('/health', healthRoutes);
app.use('/ai', aiRoutes);
app.use('/dashboard', dashboardRoutes);

// Health check endpoint
app.get('/health-check', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'MedConnect AI',
    version: '1.0.0'
  });
});

// Welcome endpoint - serve main website
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Application Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist'
  });
});

// Initialize database and start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database connected successfully');

    // Start scheduled tasks
    startScheduledTasks();
    logger.info('Scheduled tasks started');

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 MedConnect AI Server running on port ${PORT}`);
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    MedConnect AI Server                      ║
║                Revolutionary Health-tech Solution            ║
╠══════════════════════════════════════════════════════════════╣
║  🏥 AI-Powered Health Diagnostics                           ║
║  📱 USSD Health Assistant (*384*57000#)                     ║
║  🚨 Emergency Response System                               ║
║  💬 SMS Health Notifications                                ║
║  📊 Real-time Health Analytics                              ║
╠══════════════════════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}                          ║
║  Health Check: http://localhost:${PORT}/health-check       ║
║  Dashboard: http://localhost:${PORT}/dashboard             ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
