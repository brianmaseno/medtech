const express = require('express');
const router = express.Router();
const aiService = require('../services/ai');

// Analyze symptoms
router.post('/analyze', async (req, res) => {
  try {
    const { symptoms, userProfile } = req.body;
    
    if (!symptoms || !Array.isArray(symptoms)) {
      return res.status(400).json({ error: 'Symptoms array is required' });
    }
    
    const result = await aiService.analyzeSymptoms(symptoms, userProfile);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze symptoms' });
  }
});

// Generate health tip
router.get('/tip/:category?', async (req, res) => {
  try {
    const { category = 'general' } = req.params;
    
    const result = await aiService.generateHealthTip(category);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate health tip' });
  }
});

// Generate emergency instructions
router.post('/emergency-instructions', async (req, res) => {
  try {
    const { emergencyType, location } = req.body;
    
    if (!emergencyType) {
      return res.status(400).json({ error: 'Emergency type is required' });
    }
    
    const result = await aiService.generateEmergencyInstructions(emergencyType, location);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate emergency instructions' });
  }
});

module.exports = router;
