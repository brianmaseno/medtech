const { User, HealthSession, Doctor, Appointment } = require('../services/database');
const atService = require('../services/africasTalking');
const aiService = require('../services/ai');
const { processConversationalSMS } = require('./conversational-sms');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

async function processSMSCommand(text, user) {
  // Use the new conversational SMS system for all messages
  return await processConversationalSMS(text, user);
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

module.exports = {
  processSMSCommand,
  handleProfileUpdate,
  processAIChatSMS,
  handleSMSBooking,
  handleViewAppointments,
  handleListDoctors,
  handleCancelAppointment,
  handleRescheduleAppointment,
  handleConfirmAppointment
};
