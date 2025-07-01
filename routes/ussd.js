const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { User, HealthSession, Doctor, Appointment } = require('../services/database');
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
  DOCTOR_SELECTION: 'doctor_selection',
  DATE_SELECTION: 'date_selection',
  TIME_SELECTION: 'time_selection',
  APPOINTMENT_CONFIRMATION: 'appointment_confirmation',
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
      case STATES.DOCTOR_SELECTION:
        response = await handleDoctorSelection(session, lastInput, user);
        break;
      case STATES.DATE_SELECTION:
        response = await handleDateSelection(session, lastInput, user);
        break;
      case STATES.TIME_SELECTION:
        response = await handleTimeSelection(session, lastInput, user);
        break;
      case STATES.APPOINTMENT_CONFIRMATION:
        response = await handleAppointmentConfirmation(session, lastInput, user);
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
      // Book new appointment - show doctor list
      session.state = STATES.DOCTOR_SELECTION;
      return await showDoctorList(session, user);
      
    case '2':
      // View appointments
      try {
        const appointments = await Appointment.find({ 
          patientPhone: user.phoneNumber,
          appointmentDate: { $gte: new Date() }
        }).sort({ appointmentDate: 1 }).limit(5);
        
        if (appointments.length === 0) {
          return `END � No upcoming appointments found.

Use option 1 to book a new appointment.`;
        }
        
        let appointmentList = `END � UPCOMING APPOINTMENTS:\n\n`;
        appointments.forEach((apt, index) => {
          appointmentList += `${index + 1}. Dr. ${apt.doctorName}
   📅 ${apt.appointmentDate.toLocaleDateString()}
   ⏰ ${apt.timeSlot}
   🏥 ${apt.specialization}
   🆔 ${apt.appointmentId}\n\n`;
        });
        
        return appointmentList + `📱 Full details sent via SMS`;
        
      } catch (error) {
        logger.error('Error fetching appointments:', error);
        return `END ❌ Unable to fetch appointments. Please try again later.`;
      }
      
    case '3':
      return `END 📞 APPOINTMENT SUPPORT

For assistance with appointments:
• Call: +254700000000  
• WhatsApp: +254700000000
• Email: appointments@medconnect.ke
• SMS: "HELP" to this number

Operating Hours: 8AM - 8PM (Mon-Sat)`;
      
    case '0':
      session.state = STATES.MAIN_MENU;
      return await showMainMenu(session, user);
      
    default:
      return `CON 🗓️ APPOINTMENT SERVICES
Choose an option:

1. Book new appointment
2. View my appointments  
3. Appointment support

0. Back to main menu`;
  }
}

// Enhanced Appointment Booking Functions
async function showDoctorList(session, user) {
  try {
    const doctors = await Doctor.find({ isActive: true }).limit(5);
    
    let response = `CON 👨‍⚕️ SELECT DOCTOR
Choose a doctor:

`;
    
    doctors.forEach((doctor, index) => {
      response += `${index + 1}. Dr. ${doctor.name}
   ${doctor.specialization} - KSh ${doctor.consultationFee}
   ⭐ ${doctor.rating}/5.0

`;
    });
    
    response += `0. Back to appointments menu`;
    
    // Store doctors in session for later reference
    session.data.availableDoctors = doctors;
    
    return response;
  } catch (error) {
    logger.error('Error fetching doctors:', error);
    return `END ❌ Sorry, unable to load doctors list. Please try again later.`;
  }
}

async function handleDoctorSelection(session, input, user) {
  if (input === '0') {
    session.state = STATES.APPOINTMENT;
    return await handleAppointment(session, '', user);
  }
  
  const doctorIndex = parseInt(input) - 1;
  const doctors = session.data.availableDoctors || [];
  
  if (doctorIndex >= 0 && doctorIndex < doctors.length) {
    const selectedDoctor = doctors[doctorIndex];
    session.data.selectedDoctor = selectedDoctor;
    session.state = STATES.DATE_SELECTION;
    
    return `CON 📅 SELECT DATE
Doctor: ${selectedDoctor.name}
Specialization: ${selectedDoctor.specialization}
Fee: KSh ${selectedDoctor.consultationFee}

Choose date:
1. Today (${getDateString(0)})
2. Tomorrow (${getDateString(1)})
3. ${getDateString(2)}
4. ${getDateString(3)}
5. ${getDateString(4)}

0. Back to doctors list`;
  } else {
    return `CON ❌ Invalid selection. Please choose a valid doctor number.

0. Back to doctors list`;
  }
}

async function handleDateSelection(session, input, user) {
  if (input === '0') {
    session.state = STATES.DOCTOR_SELECTION;
    return await showDoctorList(session, user);
  }
  
  const dateOffset = parseInt(input) - 1;
  if (dateOffset >= 0 && dateOffset <= 4) {
    const selectedDate = new Date();
    selectedDate.setDate(selectedDate.getDate() + dateOffset);
    
    // Get day name in the format our doctors use (e.g., 'monday', 'tuesday', etc.)
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[selectedDate.getDay()];
    
    session.data.selectedDate = selectedDate;
    session.state = STATES.TIME_SELECTION;
    
    const doctor = session.data.selectedDoctor;
    const availableSlots = doctor.availability[dayName] || [];
    
    if (availableSlots.length === 0) {
      return `CON ❌ No slots available for ${getDateString(dateOffset)}
Doctor ${doctor.name} is not available on this day.

Please choose another date:
1. Today (${getDateString(0)})
2. Tomorrow (${getDateString(1)})
3. ${getDateString(2)}
4. ${getDateString(3)}
5. ${getDateString(4)}

0. Back to doctors list`;
    }
    
    let response = `CON ⏰ SELECT TIME
Date: ${getDateString(dateOffset)}
Doctor: ${doctor.name}

Available slots:
`;
    
    availableSlots.slice(0, 6).forEach((slot, index) => {
      response += `${index + 1}. ${slot}\n`;
    });
    
    response += `\n0. Back to date selection`;
    
    session.data.availableSlots = availableSlots;
    return response;
  } else {
    return `CON ❌ Invalid date selection.

Choose date:
1. Today (${getDateString(0)})
2. Tomorrow (${getDateString(1)})
3. ${getDateString(2)}
4. ${getDateString(3)}
5. ${getDateString(4)}

0. Back to doctors list`;
  }
}

async function handleTimeSelection(session, input, user) {
  if (input === '0') {
    session.state = STATES.DATE_SELECTION;
    return `CON 📅 SELECT DATE
Choose date:
1. Today (${getDateString(0)})
2. Tomorrow (${getDateString(1)})
3. ${getDateString(2)}
4. ${getDateString(3)}
5. ${getDateString(4)}

0. Back to doctors list`;
  }
  
  const slotIndex = parseInt(input) - 1;
  const availableSlots = session.data.availableSlots || [];
  
  if (slotIndex >= 0 && slotIndex < availableSlots.length) {
    const selectedTime = availableSlots[slotIndex];
    session.data.selectedTime = selectedTime;
    session.state = STATES.APPOINTMENT_CONFIRMATION;
    
    const doctor = session.data.selectedDoctor;
    const date = session.data.selectedDate;
    
    return `CON ✅ CONFIRM APPOINTMENT

👨‍⚕️ Doctor: ${doctor.name}
🏥 Hospital: ${doctor.hospital}
📅 Date: ${date.toLocaleDateString()}
⏰ Time: ${selectedTime}
💰 Fee: KSh ${doctor.consultationFee}

1. Confirm booking
2. Add symptoms/notes
0. Back to time selection`;
  } else {
    return `CON ❌ Invalid time selection. Please choose a valid time slot.

0. Back to time selection`;
  }
}

async function handleAppointmentConfirmation(session, input, user) {
  const doctor = session.data.selectedDoctor;
  const date = session.data.selectedDate;
  const time = session.data.selectedTime;
  
  switch (input) {
    case '1':
      // Confirm and create appointment
      try {
        const appointment = new Appointment({
          appointmentId: `APT_${Date.now()}`,
          patientPhone: user.phoneNumber,
          patientName: user.name,
          doctorId: doctor.doctorId,
          doctorName: doctor.name,
          specialization: doctor.specialization,
          appointmentDate: date,
          timeSlot: time,
          consultationFee: doctor.consultationFee,
          symptoms: session.data.symptoms || ''
        });
        
        await appointment.save();
        
        // Send confirmation SMS
        const smsMessage = `✅ APPOINTMENT CONFIRMED
Dr. ${doctor.name} (${doctor.specialization})
📅 ${date.toLocaleDateString()} at ${time}
🏥 ${doctor.hospital}
💰 Fee: KSh ${doctor.consultationFee}
📞 Doctor: ${doctor.phone}

Appointment ID: ${appointment.appointmentId}
Arrive 15 mins early. Take care!`;
        
        await atService.sendSMS(user.phoneNumber, smsMessage);
        
        return `END ✅ APPOINTMENT BOOKED!

Appointment ID: ${appointment.appointmentId}
📱 Confirmation sent via SMS

Thank you for choosing MedConnect AI!`;
        
      } catch (error) {
        logger.error('Error creating appointment:', error);
        return `END ❌ Sorry, unable to book appointment. Please try again later.`;
      }
      
    case '2':
      return `CON 📝 ADD SYMPTOMS/NOTES
Briefly describe your symptoms or reason for visit:

Type your message and press OK.
Max 100 characters.

0. Skip and confirm booking`;
      
    case '0':
      session.state = STATES.TIME_SELECTION;
      return `CON ⏰ SELECT TIME
Available slots:
${session.data.availableSlots.map((slot, i) => `${i+1}. ${slot}`).join('\n')}

0. Back to date selection`;
      
    default:
      // User entered symptoms/notes
      if (input.length > 100) {
        return `CON ❌ Message too long (max 100 chars)
Current: ${input.length} chars

Please shorten your message:`;
      }
      
      session.data.symptoms = input;
      return `CON ✅ CONFIRM APPOINTMENT

👨‍⚕️ Doctor: ${doctor.name}
📅 Date: ${date.toLocaleDateString()}
⏰ Time: ${time}
💰 Fee: KSh ${doctor.consultationFee}
📝 Notes: ${input}

1. Confirm booking
0. Back to time selection`;
  }
}

function getDateString(daysFromToday) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
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
