const express = require('express');
const router = express.Router();
const { User, HealthSession, Facility } = require('../services/database');
const atService = require('../services/africasTalking');
const aiService = require('../services/ai');

// Get health facilities
router.get('/facilities', async (req, res) => {
  try {
    const { type, location, limit = 10 } = req.query;
    
    const query = {};
    if (type) query.type = type;
    
    const facilities = await Facility.find(query).limit(parseInt(limit));
    
    res.json({ success: true, facilities });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve facilities' });
  }
});

// Book appointment
router.post('/appointment', async (req, res) => {
  try {
    const { phoneNumber, doctor, facility, date, type } = req.body;
    
    const user = await User.findOne({ phoneNumber: atService.formatPhoneNumber(phoneNumber) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.appointments.push({
      date: new Date(date),
      doctor,
      facility,
      type: type || 'consultation',
      status: 'scheduled'
    });
    
    await user.save();
    
    // Send confirmation SMS
    await atService.sendAppointmentReminder(user.phoneNumber, {
      doctor,
      facility,
      date: new Date(date).toLocaleDateString()
    });
    
    res.json({ success: true, message: 'Appointment booked successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// Get user health profile
router.get('/profile/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    const user = await User.findOne({ phoneNumber: atService.formatPhoneNumber(phoneNumber) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve user profile' });
  }
});

module.exports = router;
