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

// Main callback endpoint for Africa's Talking SMS
app.post('/callback', async (req, res) => {
  logger.info('🔔 SMS Callback Received');
  logger.info('📱 SMS Payload:', JSON.stringify(req.body, null, 2));
  
  try {
    const { from, text, to, id, date, linkId, networkCode } = req.body;
    
    if (!from || !text) {
      logger.error('❌ Invalid SMS payload - missing required fields');
      return res.status(400).json({ 
        error: 'Invalid payload',
        message: 'Missing required fields: from, text',
        received: { from, text, to, id }
      });
    }
    
    // Import SMS processing function
    const { processSMSCommand } = require('./routes/sms-handler');
    const { User } = require('./services/database');
    const atService = require('./services/africasTalking');
    
    const phoneNumber = atService.formatPhoneNumber(from);
    let user = await User.findOne({ phoneNumber });
    
    if (!user) {
      user = new User({
        phoneNumber,
        name: `${from.slice(-4)}`, // Use last 4 digits as name initially
        createdAt: new Date()
      });
      await user.save();
      logger.info(`👤 New user created: ${phoneNumber}`);
    }
    
    // Update last activity
    user.lastActivity = new Date();
    await user.save();
    
    logger.info(`📝 Processing SMS from ${phoneNumber}: "${text}"`);
    
    // Process SMS command and get response
    const response = await processSMSCommand(text.trim(), user);
    
    if (response) {
      logger.info(`📤 Sending response to ${phoneNumber}...`);
      
      // Send SMS response with enhanced error handling for confirmations
      const smsResult = await atService.sendSMS(phoneNumber, response);
      
      if (smsResult.success) {
        logger.info(`✅ SMS response sent successfully to ${phoneNumber}`);
      } else {
        logger.error(`❌ Failed to send SMS response: ${smsResult.error}`);
        
        // For appointment confirmations, log the details even if SMS failed
        if (response.includes('APPOINTMENT CONFIRMED')) {
          logger.info(`🏥 IMPORTANT: Appointment was created successfully, but confirmation SMS failed to send`);
          logger.info(`📋 Appointment details were: ${response.substring(0, 200)}...`);
        }
      }
    }
    
    logger.info(`✅ SMS callback processed successfully for ${phoneNumber}`);
    
    // Return success response to Africa's Talking
    res.status(200).json({ 
      status: 'success',
      message: 'SMS received and processed',
      from: phoneNumber,
      text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      responseLength: response ? response.length : 0,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('🚨 SMS Callback processing error:', error);
    res.status(500).json({ 
      error: 'Processing failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET callback for verification
app.get('/callback', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'MedConnect AI SMS Callback is ready',
    timestamp: new Date().toISOString()
  });
});

// SMS Delivery Report Callback
app.post('/delivery-report', async (req, res) => {
  logger.info('Root delivery report called');
  logger.info('Delivery Report Payload:', JSON.stringify(req.body, null, 2));
  
  try {
    const { id, status, phoneNumber, networkCode, failureReason, retryCount, cost } = req.body;
    
    // Log delivery status with detailed information
    if (status === 'Success') {
      logger.info(`✅ SMS ${id} delivered successfully to ${phoneNumber} (Cost: ${cost || 'N/A'})`);
    } else if (status === 'Failed') {
      logger.error(`❌ SMS ${id} delivery failed to ${phoneNumber}: ${failureReason || 'Unknown reason'}`);
    } else {
      logger.info(`📤 SMS ${id} status for ${phoneNumber}: ${status}`);
    }
    
    res.status(200).json({ 
      status: 'success',
      message: 'Delivery report processed',
      messageId: id,
      phoneNumber: phoneNumber,
      deliveryStatus: status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Delivery report processing error:', error);
    res.status(500).json({ 
      error: 'Processing failed',
      message: error.message 
    });
  }
});

// GET delivery report for verification
app.get('/delivery-report', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'MedConnect AI SMS Delivery Report endpoint is ready',
    timestamp: new Date().toISOString(),
    info: 'This endpoint receives SMS delivery reports from Africa\'s Talking'
  });
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
