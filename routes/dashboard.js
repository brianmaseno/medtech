const express = require('express');
const router = express.Router();
const path = require('path');
const { User, HealthSession, Emergency, Analytics } = require('../services/database');

// Serve React dashboard
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard/index.html'));
});

// Dashboard API endpoints
router.get('/api/stats', async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const stats = {
      users: {
        total: await User.countDocuments(),
        new_today: await User.countDocuments({ createdAt: { $gte: today } }),
        active_today: await User.countDocuments({ lastActivity: { $gte: today } })
      },
      sessions: {
        total: await HealthSession.countDocuments(),
        today: await HealthSession.countDocuments({ createdAt: { $gte: today } }),
        this_week: await HealthSession.countDocuments({ createdAt: { $gte: thisWeek } })
      },
      emergencies: {
        total: await Emergency.countDocuments(),
        today: await Emergency.countDocuments({ reportedAt: { $gte: today } }),
        active: await Emergency.countDocuments({ status: { $in: ['reported', 'dispatched', 'in_progress'] } })
      }
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

router.get('/api/recent-activities', async (req, res) => {
  try {
    const recentSessions = await HealthSession.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    const recentEmergencies = await Emergency.find()
      .sort({ reportedAt: -1 })
      .limit(5)
      .lean();
    
    res.json({
      success: true,
      activities: {
        sessions: recentSessions,
        emergencies: recentEmergencies
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve recent activities' });
  }
});

router.get('/api/analytics', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const analytics = await Analytics.find({
      date: { $gte: startDate }
    }).sort({ date: 1 });
    
    res.json({ success: true, analytics });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve analytics' });
  }
});

module.exports = router;
