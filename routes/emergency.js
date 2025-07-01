const express = require('express');
const router = express.Router();
const { Emergency, User, Facility } = require('../services/database');
const atService = require('../services/africasTalking');
const aiService = require('../services/ai');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Report emergency
router.post('/report', async (req, res) => {
  try {
    const { phoneNumber, emergencyType, location, description, severity } = req.body;
    
    const formattedPhone = atService.formatPhoneNumber(phoneNumber);
    const emergencyId = `EMG_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    // Create emergency record
    const emergency = new Emergency({
      emergencyId,
      phoneNumber: formattedPhone,
      location: location || 'Not specified',
      emergencyType,
      severity: severity || 'moderate',
      description: description || '',
      status: 'reported',
      reportedAt: new Date()
    });
    
    await emergency.save();
    
    // Get AI-generated emergency instructions
    const instructions = await aiService.generateEmergencyInstructions(emergencyType, location);
    
    // Send emergency alert to user
    await atService.sendEmergencyAlert(formattedPhone, {
      type: emergencyType,
      emergencyId,
      location: location || 'Location not specified',
      status: 'reported'
    });
    
    // Notify emergency responders (in a real system, this would integrate with actual emergency services)
    const responderNumbers = getEmergencyResponders(emergencyType);
    for (const responder of responderNumbers) {
      const alertMessage = `🚨 EMERGENCY REPORT:
ID: ${emergencyId}
Type: ${emergencyType}
Location: ${location || 'Not specified'}
Reporter: ${formattedPhone}
Severity: ${severity || 'moderate'}
Time: ${new Date().toLocaleString()}
Description: ${description || 'No additional details'}`;
      
      await atService.sendSMS(responder.phone, alertMessage);
      
      // Update emergency record with responder notification
      emergency.responders.push({
        type: responder.type,
        contact: responder.phone,
        notified: true,
        arrived: false
      });
    }
    
    await emergency.save();
    
    res.json({
      success: true,
      emergencyId,
      instructions: instructions.success ? instructions.instructions : null,
      message: 'Emergency reported successfully. Help is on the way!'
    });
    
  } catch (error) {
    logger.error('Emergency report error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to report emergency' 
    });
  }
});

// Update emergency status
router.put('/update/:emergencyId', async (req, res) => {
  try {
    const { emergencyId } = req.params;
    const { status, responderType, arrived } = req.body;
    
    const emergency = await Emergency.findOne({ emergencyId });
    if (!emergency) {
      return res.status(404).json({ error: 'Emergency not found' });
    }
    
    // Update status
    if (status) {
      emergency.status = status;
      if (status === 'resolved') {
        emergency.resolvedAt = new Date();
      }
    }
    
    // Update responder status
    if (responderType) {
      const responder = emergency.responders.find(r => r.type === responderType);
      if (responder && arrived !== undefined) {
        responder.arrived = arrived;
      }
    }
    
    await emergency.save();
    
    // Notify user of status update
    let statusMessage = '';
    switch (status) {
      case 'dispatched':
        statusMessage = 'Emergency services have been dispatched to your location.';
        break;
      case 'in_progress':
        statusMessage = 'Emergency responders are on scene and handling the situation.';
        break;
      case 'resolved':
        statusMessage = 'Emergency has been resolved. Thank you for using MedConnect AI.';
        break;
    }
    
    if (statusMessage) {
      await atService.sendSMS(emergency.phoneNumber, 
        `🚨 Emergency Update (${emergencyId}): ${statusMessage}`);
    }
    
    res.json({
      success: true,
      emergency,
      message: 'Emergency updated successfully'
    });
    
  } catch (error) {
    logger.error('Emergency update error:', error);
    res.status(500).json({ error: 'Failed to update emergency' });
  }
});

// Get emergency details
router.get('/:emergencyId', async (req, res) => {
  try {
    const { emergencyId } = req.params;
    
    const emergency = await Emergency.findOne({ emergencyId });
    if (!emergency) {
      return res.status(404).json({ error: 'Emergency not found' });
    }
    
    res.json({ success: true, emergency });
    
  } catch (error) {
    logger.error('Emergency retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve emergency' });
  }
});

// Get all emergencies (for dashboard/admin)
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    
    const emergencies = await Emergency.find(query)
      .sort({ reportedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Emergency.countDocuments(query);
    
    res.json({
      success: true,
      emergencies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    logger.error('Emergency list error:', error);
    res.status(500).json({ error: 'Failed to retrieve emergencies' });
  }
});

// Emergency statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const stats = {
      today: await Emergency.countDocuments({ reportedAt: { $gte: today } }),
      thisWeek: await Emergency.countDocuments({ reportedAt: { $gte: thisWeek } }),
      thisMonth: await Emergency.countDocuments({ reportedAt: { $gte: thisMonth } }),
      total: await Emergency.countDocuments(),
      byStatus: {
        reported: await Emergency.countDocuments({ status: 'reported' }),
        dispatched: await Emergency.countDocuments({ status: 'dispatched' }),
        in_progress: await Emergency.countDocuments({ status: 'in_progress' }),
        resolved: await Emergency.countDocuments({ status: 'resolved' })
      },
      byType: {}
    };
    
    // Get emergency types distribution
    const typeStats = await Emergency.aggregate([
      { $group: { _id: '$emergencyType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    typeStats.forEach(item => {
      stats.byType[item._id] = item.count;
    });
    
    res.json({ success: true, stats });
    
  } catch (error) {
    logger.error('Emergency stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve emergency statistics' });
  }
});

// Test emergency system
router.post('/test', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number required' });
    }
    
    const testMessage = `🧪 MedConnect AI Emergency System Test
This is a test of the emergency alert system.
In a real emergency:
📞 Call: 911 (Ambulance), 999 (Police), 998 (Fire)
📱 Use: *384*57000# option 2
Test completed successfully! ✅`;
    
    await atService.sendSMS(phoneNumber, testMessage);
    
    res.json({
      success: true,
      message: 'Emergency system test completed successfully'
    });
    
  } catch (error) {
    logger.error('Emergency test error:', error);
    res.status(500).json({ error: 'Emergency test failed' });
  }
});

function getEmergencyResponders(emergencyType) {
  // In a real system, this would be a comprehensive database of emergency responders
  const responders = {
    'medical': [
      { type: 'ambulance', phone: process.env.EMERGENCY_AMBULANCE || '+254911000000' },
      { type: 'hospital', phone: process.env.DEFAULT_HEALTH_CONTACT || '+254700000000' }
    ],
    'fire': [
      { type: 'fire_department', phone: process.env.EMERGENCY_FIRE || '+254998000000' }
    ],
    'police': [
      { type: 'police', phone: process.env.EMERGENCY_POLICE || '+254999000000' }
    ],
    'ambulance': [
      { type: 'ambulance', phone: process.env.EMERGENCY_AMBULANCE || '+254911000000' }
    ]
  };
  
  return responders[emergencyType.toLowerCase()] || responders.medical;
}

module.exports = router;
