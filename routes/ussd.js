const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { User, HealthSession } = require('../services/database');
const aiService = require('../services/ai');
const atService = require('../services/africasTalking');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Store active USSD sessions in memory (in production, use Redis)
const activeSessions = new Map();

// USSD Session states
const STATES = {
  MAIN_MENU: 'main_menu',
  HEALTH_CHECK: 'health_check',
  SYMPTOMS_INPUT: 'symptoms_input',
  EMERGENCY: 'emergency',
  APPOINTMENT: 'appointment',
  PROFILE: 'profile',
  HEALTH_TIPS: 'health_tips',
  FIND_FACILITY: 'find_facility',
  AI_CHAT: 'ai_chat',
  AI_CHAT_INPUT: 'ai_chat_input'
};

router.post('/', async (req, res) => {
  try {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;
    
    logger.info(`USSD Request: ${phoneNumber} - ${text || 'New session'}`);
    
    let response = '';
    const userInput = text || '';
    const inputArray = userInput.split('*');
    const lastInput = inputArray[inputArray.length - 1];
    
    // Get or create user session
    let session = activeSessions.get(sessionId) || {
      sessionId,
      phoneNumber: atService.formatPhoneNumber(phoneNumber),
      state: STATES.MAIN_MENU,
      data: {}
    };
    
    // Get or create user profile
    let user = await User.findOne({ phoneNumber: session.phoneNumber });
    if (!user) {
      user = new User({
        phoneNumber: session.phoneNumber,
        name: `User_${phoneNumber.slice(-4)}`,
        createdAt: new Date()
      });
      await user.save();
    }
    
    // Update last activity
    user.lastActivity = new Date();
    await user.save();
    
    // Route based on current state and input
    switch (session.state) {
      case STATES.MAIN_MENU:
        response = await handleMainMenu(session, lastInput, user);
        break;
      case STATES.HEALTH_CHECK:
        response = await handleHealthCheck(session, lastInput, user);
        break;
      case STATES.SYMPTOMS_INPUT:
        response = await handleSymptomsInput(session, userInput, user);
        break;
      case STATES.EMERGENCY:
        response = await handleEmergency(session, lastInput, user);
        break;
      case STATES.APPOINTMENT:
        response = await handleAppointment(session, lastInput, user);
        break;
      case STATES.PROFILE:
        response = await handleProfile(session, lastInput, user);
        break;
      case STATES.HEALTH_TIPS:
        response = await handleHealthTips(session, lastInput, user);
        break;
      case STATES.FIND_FACILITY:
        response = await handleFindFacility(session, lastInput, user);
        break;
      case STATES.AI_CHAT:
        response = await handleAIChat(session, lastInput, user);
        break;
      case STATES.AI_CHAT_INPUT:
        response = await handleAIChatInput(session, userInput, user);
        break;
      default:
        response = await showMainMenu(session, user);
    }
    
    // Save session
    activeSessions.set(sessionId, session);
    
    // Clean up old sessions (older than 30 minutes)
    cleanupOldSessions();
    
    res.set('Content-Type', 'text/plain');
    res.send(response);
    
  } catch (error) {
    logger.error('USSD Error:', error);
    res.set('Content-Type', 'text/plain');
    res.send('END Sorry, we encountered an error. Please try again later.');
  }
});

async function handleMainMenu(session, input, user) {
  if (!input) {
    return await showMainMenu(session, user);
  }
  
  switch (input) {
    case '1':
      session.state = STATES.HEALTH_CHECK;
      return `CON 🔬 MedConnect AI Health Check
Please describe your symptoms:

1. Fever and headache
2. Cough and cold
3. Stomach pain
4. Chest pain
5. Describe your own symptoms
0. Back to main menu`;
      
    case '2':
      session.state = STATES.EMERGENCY;
      return `CON 🚨 EMERGENCY ASSISTANCE
What type of emergency?

1. Medical Emergency
2. Fire Emergency  
3. Police Emergency
4. Ambulance Request
5. Report Location
0. Back to main menu`;
      
    case '3':
      session.state = STATES.APPOINTMENT;
      return `CON 🗓️ APPOINTMENT BOOKING
Choose an option:

1. Book new appointment
2. View my appointments
3. Cancel appointment
4. Reschedule appointment
0. Back to main menu`;
      
    case '4':
      session.state = STATES.FIND_FACILITY;
      return `CON 🏥 FIND HEALTH FACILITY
What are you looking for?

1. Nearest hospital
2. Pharmacy
3. Clinic
4. Laboratory
5. Emergency services
0. Back to main menu`;
      
    case '5':
      session.state = STATES.HEALTH_TIPS;
      return await handleHealthTips(session, '', user);
      
    case '6':
      session.state = STATES.AI_CHAT;
      return await handleAIChat(session, '', user);
      
    case '7':
      session.state = STATES.PROFILE;
      return await showProfile(user);
      
    default:
      return await showMainMenu(session, user);
  }
}

async function showMainMenu(session, user) {
  const greeting = getGreeting();
  return `CON ${greeting} ${user.name}! 
🏥 MedConnect AI - Your Health Assistant

1. 🔬 Health Check & Symptoms
2. 🚨 Emergency Assistance
3. 🗓️ Appointments
4. 🏥 Find Health Facility
5. 💡 Health Tips
6. 🤖 AI Chat Assistant
7. 👤 My Profile

Choose an option:`;
}

async function handleHealthCheck(session, input, user) {
  switch (input) {
    case '1':
      session.data.symptoms = ['fever', 'headache'];
      return await processSymptomsWithAI(session, user);
      
    case '2':
      session.data.symptoms = ['cough', 'cold'];
      return await processSymptomsWithAI(session, user);
      
    case '3':
      session.data.symptoms = ['stomach pain'];
      return await processSymptomsWithAI(session, user);
      
    case '4':
      session.data.symptoms = ['chest pain'];
      return await processSymptomsWithAI(session, user);
      
    case '5':
      session.state = STATES.SYMPTOMS_INPUT;
      return `CON Please describe your symptoms in detail:
(Type your symptoms and press OK)`;
      
    case '0':
      session.state = STATES.MAIN_MENU;
      return await showMainMenu(session, user);
      
    default:
      return `CON Invalid choice. Please select 1-5 or 0 to go back.`;
  }
}

async function handleSymptomsInput(session, input, user) {
  if (input.length < 5) {
    return `CON Please provide more details about your symptoms:
(Minimum 5 characters required)`;
  }
  
  // Extract symptoms from user input
  session.data.symptoms = input.toLowerCase().split(/[,\s]+/).filter(s => s.length > 2);
  
  return await processSymptomsWithAI(session, user);
}

async function processSymptomsWithAI(session, user) {
  try {
    // Use AI to analyze symptoms
    const analysis = await aiService.analyzeSymptoms(session.data.symptoms, {
      age: user.age,
      gender: user.gender,
      medicalHistory: user.medicalHistory
    });
    
    if (analysis.success) {
      const { condition, urgency, recommendations } = analysis.analysis;
      
      // Save health session
      const healthSession = new HealthSession({
        sessionId: session.sessionId,
        phoneNumber: session.phoneNumber,
        sessionType: 'ussd',
        symptoms: session.data.symptoms,
        aiDiagnosis: analysis.analysis,
        status: 'completed'
      });
      await healthSession.save();
      
      // Send detailed results via SMS
      await atService.sendDiagnosisResult(session.phoneNumber, analysis.analysis, user.name);
      
      let urgencyIcon = '💚';
      if (urgency === 'high' || urgency === 'critical') urgencyIcon = '🔴';
      else if (urgency === 'medium') urgencyIcon = '🟡';
      
      return `END 🔬 MedConnect AI Analysis:

${urgencyIcon} Condition: ${condition}
📊 Urgency: ${urgency.toUpperCase()}

${recommendations[0]}

${urgency === 'high' || urgency === 'critical' ? 
  '⚠️ SEEK IMMEDIATE MEDICAL ATTENTION!' : 
  '💡 Consider consulting a healthcare provider'}

📱 Detailed results sent via SMS
🏥 Use option 4 to find nearby facilities`;
    }
  } catch (error) {
    logger.error('AI Analysis Error:', error);
  }
  
  return `END 🔬 Basic Health Assessment:
Your symptoms have been noted.

💡 Recommendations:
• Monitor your symptoms
• Stay hydrated
• Get adequate rest
• Consult a healthcare provider if symptoms persist

📱 Use *384*57000# anytime for health assistance`;
}

async function handleEmergency(session, input, user) {
  switch (input) {
    case '1':
      return await processEmergency(session, user, 'medical', 'Medical Emergency');
    case '2':
      return await processEmergency(session, user, 'fire', 'Fire Emergency');
    case '3':
      return await processEmergency(session, user, 'police', 'Police Emergency');
    case '4':
      return await processEmergency(session, user, 'ambulance', 'Ambulance Request');
    case '5':
      return `CON 📍 LOCATION REPORTING
Please share your location or nearest landmark:
(This helps emergency responders find you)`;
    case '0':
      session.state = STATES.MAIN_MENU;
      return await showMainMenu(session, user);
    default:
      return `CON Invalid choice. Please select 1-5 or 0 to go back.`;
  }
}

async function processEmergency(session, user, type, description) {
  try {
    const emergencyId = `EMG_${Date.now()}`;
    
    // Get AI-generated emergency instructions
    const instructions = await aiService.generateEmergencyInstructions(type, user.location);
    
    // Send emergency alert SMS
    await atService.sendEmergencyAlert(session.phoneNumber, {
      type: description,
      emergencyId,
      location: user.location || 'Location not specified',
      status: 'reported'
    });
    
    return `END 🚨 EMERGENCY ACTIVATED!
Emergency ID: ${emergencyId}

🆘 Immediate Actions:
${instructions.success ? instructions.instructions.immediate_actions[0] : 'Call emergency services immediately'}

📞 Emergency Contacts:
• Police: 999
• Ambulance: 911
• Fire: 998

📱 Emergency details sent via SMS
⏰ Help is being dispatched!`;
    
  } catch (error) {
    logger.error('Emergency Processing Error:', error);
    return `END 🚨 EMERGENCY ACTIVATED!
📞 Call immediately:
• Police: 999
• Ambulance: 911  
• Fire: 998

Stay safe and help is on the way!`;
  }
}

async function handleAppointment(session, input, user) {
  switch (input) {
    case '1':
      return `END 🗓️ APPOINTMENT BOOKING
To book an appointment, please:

1. Call your preferred facility directly
2. Visit our web portal
3. Send SMS "BOOK [Doctor] [Date]" 

📱 We'll send you facility contacts via SMS`;
      
    case '2':
      const upcomingAppointments = user.appointments?.filter(apt => 
        new Date(apt.date) > new Date() && apt.status === 'scheduled'
      ) || [];
      
      if (upcomingAppointments.length === 0) {
        return `END 🗓️ MY APPOINTMENTS
You have no upcoming appointments.

📞 Book new appointment:
Use option 1 from appointments menu`;
      }
      
      const nextAppointment = upcomingAppointments[0];
      return `END 🗓️ MY APPOINTMENTS
Next Appointment:
👨‍⚕️ ${nextAppointment.doctor || 'Doctor TBD'}
🏥 ${nextAppointment.facility || 'Facility TBD'}
📅 ${new Date(nextAppointment.date).toLocaleDateString()}

Total upcoming: ${upcomingAppointments.length}`;
      
    case '0':
      session.state = STATES.MAIN_MENU;
      return await showMainMenu(session, user);
      
    default:
      return `CON Invalid choice. Please try again.`;
  }
}

async function handleHealthTips(session, input, user) {
  try {
    const tipResponse = await aiService.generateHealthTip('general');
    return `END 💡 MedConnect AI Health Tip:

${tipResponse.tip}

🌟 More tips available daily!
📱 Follow us for regular health updates
🏥 Use *384*57000# anytime for health assistance`;
  } catch (error) {
    return `END 💡 MedConnect AI Health Tip:

🥗 Eat a balanced diet with plenty of fruits and vegetables
💧 Drink at least 8 glasses of water daily  
🏃‍♂️ Get 30 minutes of physical activity
😴 Aim for 7-8 hours of quality sleep

Stay healthy! 🌟`;
  }
}

async function handleFindFacility(session, input, user) {
  const facilities = {
    '1': 'Nearest Hospitals',
    '2': 'Pharmacies', 
    '3': 'Clinics',
    '4': 'Laboratories',
    '5': 'Emergency Services'
  };
  
  if (facilities[input]) {
    return `END 🏥 ${facilities[input]}:

📍 Nairobi Hospital
📞 +254202722000
📍 Argwings Kodhek Road

📍 Kenyatta National Hospital  
📞 +254202726300
📍 Hospital Road

📍 City Health Clinic
📞 +254701234567
📍 CBD, Nairobi

📱 More details sent via SMS`;
  }
  
  if (input === '0') {
    session.state = STATES.MAIN_MENU;
    return await showMainMenu(session, user);
  }
  
  return `CON Invalid choice. Please select 1-5 or 0 to go back.`;
}

async function showProfile(user) {
  return `END 👤 MY PROFILE:
📱 Phone: ${user.phoneNumber}
👤 Name: ${user.name}
🎂 Age: ${user.age || 'Not set'}
⚧ Gender: ${user.gender || 'Not set'}
📍 Location: ${user.location || 'Not set'}

📝 Medical History: ${user.medicalHistory?.length || 0} records
💊 Medications: ${user.medications?.length || 0} active

To update profile, send SMS "UPDATE [field] [value]"`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function cleanupOldSessions() {
  const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
  for (const [sessionId, session] of activeSessions) {
    if (session.createdAt && session.createdAt < thirtyMinutesAgo) {
      activeSessions.delete(sessionId);
    }
  }
}

// AI Chat Handler Functions
async function handleAIChat(session, input, user) {
  if (!input) {
    return `CON 🤖 AI CHAT ASSISTANT
Welcome to MedConnect AI Chat!

You can ask me anything about health:
• Symptoms and conditions
• Medication questions  
• Health tips and advice
• Emergency guidance
• General health info

Examples:
"I have a headache"
"How to prevent malaria?"
"Is my fever serious?"

Type your health question or:
0. Back to main menu
1. See sample questions`;
  }

  switch (input) {
    case '0':
      session.state = STATES.MAIN_MENU;
      return await showMainMenu(session, user);
      
    case '1':
      return `CON 🤖 SAMPLE HEALTH QUESTIONS

Try asking about:
• "I have fever and body aches"
• "What foods help with diabetes?"  
• "How to treat a wound?"
• "Signs of high blood pressure?"
• "When should I see a doctor?"
• "How to prevent common cold?"

Type any health question or:
0. Back to main menu
9. Start fresh conversation`;
      
    default:
      // User entered a health question
      session.state = STATES.AI_CHAT_INPUT;
      session.data.aiQuestion = input;
      return await processAIHealthQuestion(session, input, user);
  }
}

async function handleAIChatInput(session, input, user) {
  if (input === '0') {
    session.state = STATES.MAIN_MENU;
    return await showMainMenu(session, user);
  }
  
  if (input === '9') {
    session.state = STATES.AI_CHAT;
    session.data.aiQuestion = '';
    return await handleAIChat(session, '', user);
  }

  // Handle menu options after AI response
  switch (input) {
    case '1':
      // Ask another question
      return `CON 🤖 Ask Another Question

What else would you like to know about your health?

Examples:
• "How to prevent this condition?"
• "What foods should I avoid?"  
• "When should I see a doctor?"
• "Are there home remedies?"

Type your question or:
0. Main menu
9. Back to chat menu`;
      
    case '2':
      // Find nearby clinics
      session.state = STATES.FIND_FACILITY;
      return `CON 🏥 FIND HEALTH FACILITY
Based on our chat, here are options:

1. Nearest hospital
2. Pharmacy for medications
3. Clinic for consultation
4. Laboratory for tests
5. Emergency services
0. Back to AI chat`;
      
    case '3':
      // Get more health tips
      session.state = STATES.HEALTH_TIPS;
      return await handleHealthTips(session, '', user);
      
    default:
      // User entered a new health question
      return await processAIHealthQuestion(session, input, user);
  }
}

async function processAIHealthQuestion(session, question, user) {
  try {
    logger.info(`AI Chat Request from ${user.phoneNumber}: ${question}`);
    
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
      isUSSD: true,
      maxLength: 160 // USSD character limit
    };

    // Get AI response
    const aiResponse = await aiService.generateHealthChatResponse(context);
    
    // Log the interaction
    const healthSession = new HealthSession({
      sessionId: session.sessionId,
      userId: user._id,
      phoneNumber: user.phoneNumber,
      sessionType: 'ussd',
      symptoms: [question],
      aiAnalysis: aiResponse,
      recommendations: aiResponse.recommendations || [],
      urgencyLevel: aiResponse.urgency || 'low',
      createdAt: new Date()
    });
    
    await healthSession.save();
    
    // Format response for USSD
    let response = `CON 🤖 MedConnect AI:

${aiResponse.response || aiResponse.analysis || 'I understand your concern. Let me help you.'}

`;

    // Add recommendations if available
    if (aiResponse.recommendations && aiResponse.recommendations.length > 0) {
      response += `💡 Quick Tips:
`;
      aiResponse.recommendations.slice(0, 2).forEach((rec, index) => {
        response += `${index + 1}. ${rec}
`;
      });
    }

    // Add urgency warning if needed
    if (aiResponse.urgency === 'high' || aiResponse.urgency === 'emergency') {
      response += `
⚠️ IMPORTANT: Consider seeking immediate medical attention!`;
    }

    response += `

Options:
1. Ask another question
2. Find nearby clinics
3. Get more health tips
0. Main menu`;

    return response;

  } catch (error) {
    logger.error('AI Chat Error:', error);
    
    return `CON 🤖 Sorry, I'm having trouble right now.

Let me give you some general advice:
• For fever: Rest, drink fluids, take paracetamol
• For pain: Apply cold/warm compress
• For serious symptoms: Visit nearest clinic

📱 You can also send SMS with your question!

Options:
1. Try again
2. Emergency contacts
0. Main menu`;
  }
}

module.exports = router;
