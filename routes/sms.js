const express = require('express');
const router = express.Router();
const { User, HealthSession, Doctor, Appointment } = require('../services/database');
const atService = require('../services/africasTalking');
const aiService = require('../services/ai');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Handle incoming SMS callback from Africa's Talking
router.post('/callback', async (req, res) => {
  try {
    const { from, text, to, id, date, linkId, networkCode } = req.body;
    
    logger.info(`SMS received from ${from}: ${text}`);
    logger.info('Full SMS payload:', req.body);
    
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
    
    // Return success response for Africa's Talking
    res.status(200).json({ 
      status: 'success',
      message: 'SMS processed successfully' 
    });
    
  } catch (error) {
    logger.error('SMS handling error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Alternative callback endpoint (sometimes Africa's Talking uses this)
router.post('/incoming', async (req, res) => {
  return router.post('/callback')(req, res);
});

// Test endpoint to verify callback is working
router.get('/test-callback', (req, res) => {
  res.json({
    status: 'success',
    message: 'SMS callback endpoint is working',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /sms/callback - Main SMS callback',
      'POST /sms/incoming - Alternative callback',
      'GET /sms/test-callback - This test endpoint'
    ]
  });
});

// Webhook verification for Africa's Talking
router.get('/callback', (req, res) => {
  res.status(200).send('SMS Callback endpoint is ready');
});

async function processSMSCommand(text, user) {
  const words = text.split(' ');
  const command = words[0];
  
  switch (command) {
    case 'help':
      return `🏥 MedConnect AI Commands:

💬 CHAT [question] - Ask AI about health
🩺 SYMPTOMS [description] - Get health analysis  
🆘 EMERGENCY [type] - Report emergency

📅 APPOINTMENTS:
BOOK [doctor] [date] [time] - Book appointment
APPOINTMENTS - View your bookings
DOCTORS - See available doctors
CANCEL [ID] - Cancel appointment
CONFIRM [ID] - Confirm appointment

👤 PROFILE - View your info
TIP - Get health tip
📞 Use *384*57000# for full menu`;

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
      return await handleSMSBooking(words.slice(1), user);
      
    case 'appointments':
    case 'apt':
      return await handleViewAppointments(user);
      
    case 'cancel':
      return await handleCancelAppointment(words.slice(1), user);
      
    case 'reschedule':
      return await handleRescheduleAppointment(words.slice(1), user);
      
    case 'doctors':
      return await handleListDoctors();
      
    case 'confirm':
      return await handleConfirmAppointment(words.slice(1), user);
      
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

// Enhanced SMS Appointment Booking Functions
async function handleSMSBooking(params, user) {
  try {
    if (params.length === 0) {
      const doctors = await Doctor.find({ isActive: true }).limit(3);
      let response = `📋 BOOK APPOINTMENT via SMS

Available Doctors:
`;
      doctors.forEach((doc, i) => {
        response += `${i+1}. Dr. ${doc.name} (${doc.specialization}) - KSh ${doc.consultationFee}\n`;
      });
      
      response += `\nTo book:
BOOK [Doctor Name] [Date] [Time]
Example: BOOK Sarah Tomorrow 10AM

Or use *384*57000# for interactive booking`;
      return response;
    }
    
    const doctorName = params[0];
    const dateStr = params[1] || 'tomorrow';
    const timeStr = params[2] || '10:00 AM';
    
    // Find doctor by name (case insensitive partial match)
    const doctor = await Doctor.findOne({
      name: { $regex: doctorName, $options: 'i' },
      isActive: true
    });
    
    if (!doctor) {
      return `❌ Doctor "${doctorName}" not found.
Send "DOCTORS" to see available doctors
Or use *384*57000# for full booking menu`;
    }
    
    // Parse date (simple parsing for common terms)
    let appointmentDate = new Date();
    if (dateStr.toLowerCase().includes('tomorrow')) {
      appointmentDate.setDate(appointmentDate.getDate() + 1);
    } else if (dateStr.toLowerCase().includes('today')) {
      // Today
    } else if (dateStr.match(/\d+/)) {
      const dayOffset = parseInt(dateStr.match(/\d+/)[0]);
      appointmentDate.setDate(appointmentDate.getDate() + dayOffset);
    } else {
      appointmentDate.setDate(appointmentDate.getDate() + 1); // Default tomorrow
    }
    
    // Create appointment
    const appointmentId = `APT_${Date.now()}`;
    const appointment = new Appointment({
      appointmentId,
      patientPhone: user.phoneNumber,
      patientName: user.name,
      doctorId: doctor.doctorId,
      doctorName: doctor.name,
      specialization: doctor.specialization,
      appointmentDate,
      timeSlot: timeStr,
      consultationFee: doctor.consultationFee,
      bookedVia: 'sms'
    });
    
    await appointment.save();
    
    return `✅ APPOINTMENT BOOKED!

👨‍⚕️ Dr. ${doctor.name}
🏥 ${doctor.hospital}
📅 ${appointmentDate.toLocaleDateString()}
⏰ ${timeStr}
💰 Fee: KSh ${doctor.consultationFee}
📞 Doctor: ${doctor.phone}

ID: ${appointmentId}
Arrive 15 mins early!`;
    
  } catch (error) {
    logger.error('SMS Booking Error:', error);
    return `❌ Booking failed. Use *384*57000# for assistance.`;
  }
}

async function handleViewAppointments(user) {
  try {
    const appointments = await Appointment.find({
      patientPhone: user.phoneNumber,
      appointmentDate: { $gte: new Date() }
    }).sort({ appointmentDate: 1 }).limit(3);
    
    if (appointments.length === 0) {
      return `📅 No upcoming appointments.
Send "BOOK" to schedule one.`;
    }
    
    let response = `📅 YOUR APPOINTMENTS:\n\n`;
    appointments.forEach((apt, i) => {
      response += `${i+1}. Dr. ${apt.doctorName}
📅 ${apt.appointmentDate.toLocaleDateString()}
⏰ ${apt.timeSlot}
🆔 ${apt.appointmentId}\n\n`;
    });
    
    response += `Send "CANCEL [ID]" to cancel
Send "RESCHEDULE [ID]" to reschedule`;
    
    return response;
    
  } catch (error) {
    logger.error('View Appointments Error:', error);
    return `❌ Unable to fetch appointments. Try *384*57000#`;
  }
}

async function handleListDoctors() {
  try {
    const doctors = await Doctor.find({ isActive: true }).limit(5);
    
    let response = `👨‍⚕️ AVAILABLE DOCTORS:\n\n`;
    doctors.forEach((doc, i) => {
      response += `${i+1}. Dr. ${doc.name}
   ${doc.specialization}
   KSh ${doc.consultationFee}
   ⭐ ${doc.rating}/5\n\n`;
    });
    
    response += `To book: BOOK [Doctor Name] [Date] [Time]
Example: BOOK Sarah Tomorrow 2PM`;
    
    return response;
    
  } catch (error) {
    logger.error('List Doctors Error:', error);
    return `❌ Unable to load doctors. Use *384*57000#`;
  }
}

async function handleCancelAppointment(params, user) {
  try {
    if (params.length === 0) {
      return `To cancel appointment:
CANCEL [Appointment ID]
Send "APPOINTMENTS" to see your IDs`;
    }
    
    const appointmentId = params[0];
    const appointment = await Appointment.findOne({
      appointmentId,
      patientPhone: user.phoneNumber
    });
    
    if (!appointment) {
      return `❌ Appointment ${appointmentId} not found.
Send "APPOINTMENTS" to see your bookings`;
    }
    
    appointment.status = 'cancelled';
    appointment.cancelledAt = new Date();
    await appointment.save();
    
    return `✅ APPOINTMENT CANCELLED

Dr. ${appointment.doctorName}
📅 ${appointment.appointmentDate.toLocaleDateString()}
🆔 ${appointmentId}

Cancellation confirmed.`;
    
  } catch (error) {
    logger.error('Cancel Appointment Error:', error);
    return `❌ Cancellation failed. Call support for help.`;
  }
}

async function handleRescheduleAppointment(params, user) {
  if (params.length === 0) {
    return `To reschedule:
RESCHEDULE [Appointment ID] [New Date] [New Time]
Example: RESCHEDULE APT_123 Tomorrow 3PM

Or use *384*57000# for full options`;
  }
  
  return `📅 Rescheduling feature coming soon!
For now, please:
1. Cancel current appointment: CANCEL ${params[0]}
2. Book new appointment: BOOK [Doctor] [Date] [Time]

Or use *384*57000# for full booking options`;
}

async function handleConfirmAppointment(params, user) {
  try {
    if (params.length === 0) {
      return `To confirm appointment:
CONFIRM [Appointment ID]
Send "APPOINTMENTS" to see your IDs`;
    }
    
    const appointmentId = params[0];
    const appointment = await Appointment.findOne({
      appointmentId,
      patientPhone: user.phoneNumber
    });
    
    if (!appointment) {
      return `❌ Appointment ${appointmentId} not found.`;
    }
    
    appointment.status = 'confirmed';
    appointment.confirmedAt = new Date();
    await appointment.save();
    
    return `✅ APPOINTMENT CONFIRMED!

Dr. ${appointment.doctorName}
📅 ${appointment.appointmentDate.toLocaleDateString()}
⏰ ${appointment.timeSlot}
🏥 ${appointment.specialization}

See you there!`;
    
  } catch (error) {
    logger.error('Confirm Appointment Error:', error);
    return `❌ Confirmation failed. Try again later.`;
  }
}

module.exports = router;
