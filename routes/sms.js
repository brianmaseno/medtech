const express = require('express');
const router = express.Router();
const { User, HealthSession } = require('../services/database');
const atService = require('../services/africasTalking');
const aiService = require('../services/ai');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Handle incoming SMS
router.post('/callback', async (req, res) => {
  try {
    const { from, text, to, id, date } = req.body;
    
    logger.info(`SMS received from ${from}: ${text}`);
    
    const phoneNumber = atService.formatPhoneNumber(from);
    let user = await User.findOne({ phoneNumber });
    
    if (!user) {
      user = new User({
        phoneNumber,
        name: `User_${from.slice(-4)}`,
        createdAt: new Date()
      });
      await user.save();
      
      // Send welcome message
      await atService.sendWelcomeMessage(phoneNumber, user.name);
    }
    
    // Update last activity
    user.lastActivity = new Date();
    await user.save();
    
    // Process SMS commands
    const response = await processSMSCommand(text.trim().toLowerCase(), user);
    
    if (response) {
      await atService.sendSMS(phoneNumber, response);
    }
    
    res.status(200).json({ status: 'success' });
    
  } catch (error) {
    logger.error('SMS handling error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function processSMSCommand(text, user) {
  const words = text.split(' ');
  const command = words[0];
  
  switch (command) {
    case 'help':
      return `🏥 MedConnect AI Commands:
SYMPTOMS [description] - Get health analysis
CHAT [question] - Ask AI anything about health
EMERGENCY [type] - Report emergency
BOOK [doctor] [date] - Book appointment
TIP - Get health tip
PROFILE - View your profile
UPDATE [field] [value] - Update profile
Use *384*57000# for full menu`;

    case 'chat':
      if (words.length < 2) {
        return `🤖 AI Chat: Ask me any health question!
Example: CHAT I have fever and headache
Or just describe your symptoms directly.`;
      }
      
      const question = words.slice(1).join(' ');
      return await processAIChatSMS(question, user);
      
    case 'symptoms':
      if (words.length < 2) {
        return 'Please describe your symptoms. Example: SYMPTOMS fever headache cough';
      }
      
      const symptoms = words.slice(1);
      const analysis = await aiService.analyzeSymptoms(symptoms, {
        age: user.age,
        gender: user.gender,
        medicalHistory: user.medicalHistory
      });
      
      if (analysis.success) {
        const { condition, urgency, recommendations } = analysis.analysis;
        
        // Save health session
        const healthSession = new HealthSession({
          sessionId: `SMS_${Date.now()}`,
          phoneNumber: user.phoneNumber,
          sessionType: 'sms',
          symptoms: symptoms,
          aiDiagnosis: analysis.analysis,
          status: 'completed'
        });
        await healthSession.save();
        
        return `🔬 MedConnect AI Analysis:
Condition: ${condition}
Urgency: ${urgency.toUpperCase()}
${recommendations[0]}
${urgency === 'high' || urgency === 'critical' ? 
  'SEEK IMMEDIATE MEDICAL ATTENTION!' : 
  'Consider consulting a healthcare provider'}`;
      }
      
      return 'Unable to analyze symptoms. Please use *384*57000# for detailed health check.';
      
    case 'emergency':
      return `🚨 EMERGENCY ASSISTANCE ACTIVATED!
📞 Emergency Contacts:
• Ambulance: 911
• Police: 999
• Fire: 998
Use *384*57000# for detailed emergency assistance`;
      
    case 'tip':
      const tipResponse = await aiService.generateHealthTip('general');
      return `💡 MedConnect AI Health Tip:
${tipResponse.tip}
Use *384*57000# for more health guidance`;
      
    case 'profile':
      return `👤 Your Profile:
Name: ${user.name}
Age: ${user.age || 'Not set'}
Gender: ${user.gender || 'Not set'}
Location: ${user.location || 'Not set'}
To update: UPDATE [field] [value]`;
      
    case 'update':
      return await handleProfileUpdate(words.slice(1), user);
      
    case 'book':
      return `🗓️ Appointment Booking:
To book an appointment, please use *384*57000# option 3 for detailed booking.
Or call your preferred facility directly.`;
      
    case 'taken':
      return `✅ Medication taken confirmed!
Keep up with your treatment schedule.
Your health matters! 💊`;
      
    case 'confirm':
      return `✅ Appointment confirmed!
We'll send you a reminder before your appointment.
See you there! 🏥`;
      
    case 'reschedule':
      return `📅 To reschedule your appointment:
Use *384*57000# option 3 or call your healthcare facility directly.`;
      
    default:
      // Try to analyze as symptoms or AI chat if not a command
      if (text.length > 10) {
        // Check if it looks like a health question
        const healthKeywords = ['pain', 'hurt', 'sick', 'fever', 'headache', 'cough', 'dizzy', 'nausea', 'tired', 'ache', 'sore', 'swollen', 'bleeding', 'rash', 'what', 'how', 'why', 'should', 'can', 'help', 'advice'];
        const hasHealthKeyword = healthKeywords.some(keyword => text.includes(keyword));
        
        if (hasHealthKeyword) {
          // Treat as AI chat question
          return await processAIChatSMS(text, user);
        } else {
          // Treat as symptoms
          const symptoms = text.split(' ').filter(word => word.length > 2);
          if (symptoms.length > 0) {
            return await processSMSCommand(`symptoms ${symptoms.join(' ')}`, user);
          }
        }
      }
      
      return `🏥 MedConnect AI - I didn't understand that.
Try: HELP for commands, CHAT [question] for AI assistance
Or dial *384*57000# for full service`;
  }
}

async function handleProfileUpdate(params, user) {
  if (params.length < 2) {
    return 'Usage: UPDATE [field] [value]. Fields: name, age, gender, location';
  }
  
  const field = params[0].toLowerCase();
  const value = params.slice(1).join(' ');
  
  switch (field) {
    case 'name':
      user.name = value;
      break;
    case 'age':
      const age = parseInt(value);
      if (age > 0 && age < 120) {
        user.age = age;
      } else {
        return 'Please provide a valid age (1-120)';
      }
      break;
    case 'gender':
      if (['male', 'female', 'other'].includes(value.toLowerCase())) {
        user.gender = value.toLowerCase();
      } else {
        return 'Gender must be: male, female, or other';
      }
      break;
    case 'location':
      user.location = value;
      break;
    default:
      return 'Available fields: name, age, gender, location';
  }
  
  await user.save();
  return `✅ Profile updated successfully!
${field}: ${value}`;
}

// Send SMS endpoint
router.post('/send', async (req, res) => {
  try {
    const { to, message, from } = req.body;
    
    const result = await atService.sendSMS(to, message, from);
    
    res.json(result);
  } catch (error) {
    logger.error('SMS send error:', error);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

// Send bulk SMS endpoint
router.post('/send-bulk', async (req, res) => {
  try {
    const { recipients, message } = req.body;
    
    const result = await atService.sendBulkSMS(recipients, message);
    
    res.json(result);
  } catch (error) {
    logger.error('Bulk SMS send error:', error);
    res.status(500).json({ error: 'Failed to send bulk SMS' });
  }
});

// AI Chat SMS processing function
async function processAIChatSMS(question, user) {
  try {
    logger.info(`AI Chat SMS from ${user.phoneNumber}: ${question}`);
    
    // Build context for the AI
    const context = {
      user: {
        name: user.name,
        age: user.age,
        gender: user.gender,
        location: user.location,
        medicalHistory: user.medicalHistory || [],
        currentMedications: user.medications || []
      },
      question: question,
      isUSSD: false,
      maxLength: 160 // SMS character limit
    };

    // Get AI response
    const aiResponse = await aiService.generateHealthChatResponse(context);
    
    // Log the interaction
    const healthSession = new HealthSession({
      sessionId: `SMS_CHAT_${Date.now()}`,
      userId: user._id,
      phoneNumber: user.phoneNumber,
      sessionType: 'sms',
      symptoms: [question],
      aiAnalysis: aiResponse,
      recommendations: aiResponse.recommendations || [],
      urgencyLevel: aiResponse.urgency || 'low',
      createdAt: new Date()
    });
    
    await healthSession.save();
    
    // Format response for SMS
    let response = `🤖 MedConnect AI: ${aiResponse.response}`;
    
    // Add urgency warning if needed
    if (aiResponse.urgency === 'high' || aiResponse.urgency === 'emergency') {
      response += `\n⚠️ URGENT: Seek medical attention immediately!`;
    } else if (aiResponse.should_see_doctor) {
      response += `\n💡 Consider visiting a healthcare facility.`;
    }
    
    // Add main recommendation
    if (aiResponse.recommendations && aiResponse.recommendations.length > 0) {
      response += `\n\n💊 Quick Tip: ${aiResponse.recommendations[0]}`;
    }
    
    response += `\n\nReply CHAT [question] for more help or dial *384*57000#`;
    
    // Ensure response fits SMS limit
    if (response.length > 160) {
      response = response.substring(0, 157) + '...';
    }
    
    return response;

  } catch (error) {
    logger.error('AI Chat SMS Error:', error);
    
    return `🤖 Sorry, I'm having trouble right now. For health concerns, please visit your nearest clinic or dial *384*57000# for our full service.`;
  }
}

module.exports = router;
