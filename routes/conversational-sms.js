require('dotenv').config();
const { User, HealthSession, Doctor, Appointment } = require('../services/database');
const atService = require('../services/africasTalking');
const aiService = require('../services/ai');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Store conversation state for each user
const conversationStates = new Map();

class ConversationManager {
  constructor() {
    this.states = {
      INITIAL: 'initial',
      CHATTING: 'chatting',
      BOOKING: 'booking',
      SELECTING_DOCTOR: 'selecting_doctor',
      SELECTING_DATE: 'selecting_date',
      SELECTING_TIME: 'selecting_time',
      CONFIRMING: 'confirming'
    };
  }

  getState(phoneNumber) {
    return conversationStates.get(phoneNumber) || { state: this.states.INITIAL };
  }

  setState(phoneNumber, state, data = {}) {
    conversationStates.set(phoneNumber, { state, data, timestamp: new Date() });
  }

  clearState(phoneNumber) {
    conversationStates.delete(phoneNumber);
  }
}

const conversationManager = new ConversationManager();

async function processConversationalSMS(text, user) {
  const phoneNumber = user.phoneNumber;
  const currentState = conversationManager.getState(phoneNumber);
  
  logger.info(`Conversational SMS from ${phoneNumber}: "${text}" (State: ${currentState.state})`);
  
  // Handle exit commands
  if (['exit', 'stop', 'quit', 'end', 'cancel'].includes(text.toLowerCase())) {
    conversationManager.clearState(phoneNumber);
    return `👋 Conversation ended. Send any message to start again or use these commands:

📋 HELP - Commands list
👨‍⚕️ DOCTORS - Available doctors
📅 BOOK - Start booking
💬 CHAT - AI health chat

Have a healthy day! 🏥`;
  }

  // Handle menu/help requests
  if (['help', 'menu', 'commands'].includes(text.toLowerCase())) {
    return `🏥 **MedConnect AI - Main Menu**

Choose what you'd like to do:
1️⃣ Chat with AI Doctor
2️⃣ Book Appointment  
3️⃣ View My Appointments
4️⃣ List Available Doctors
5️⃣ Health Tips

💬 **Quick Commands:**
• Type "CHAT" for AI consultation
• Type "BOOK" to book appointment
• Type "DOCTORS" to see doctors
• Type "EXIT" to end conversation

What would you like to do? Just reply with a number or command! 😊`;
  }

  // Process based on current state
  switch (currentState.state) {
    case conversationManager.states.INITIAL:
      return await handleInitialState(text, user);
    
    case conversationManager.states.CHATTING:
      return await handleChatState(text, user);
    
    case conversationManager.states.BOOKING:
      return await handleBookingState(text, user, currentState.data);
    
    case conversationManager.states.SELECTING_DOCTOR:
      return await handleDoctorSelection(text, user, currentState.data);
    
    case conversationManager.states.SELECTING_DATE:
      return await handleDateSelection(text, user, currentState.data);
    
    case conversationManager.states.SELECTING_TIME:
      return await handleTimeSelection(text, user, currentState.data);
    
    case conversationManager.states.CONFIRMING:
      return await handleConfirmation(text, user, currentState.data);
    
    default:
      return await handleInitialState(text, user);
  }
}

async function handleInitialState(text, user) {
  const lowerText = text.toLowerCase();
  
  // Check for specific commands
  if (lowerText.includes('chat') || lowerText.includes('doctor') || lowerText.includes('health') || lowerText.includes('sick') || lowerText.includes('pain')) {
    conversationManager.setState(user.phoneNumber, conversationManager.states.CHATTING);
    return await processHealthChat(text, user);
  }
  
  if (lowerText.includes('book') || lowerText.includes('appointment') || lowerText.includes('schedule')) {
    conversationManager.setState(user.phoneNumber, conversationManager.states.BOOKING);
    return await startBookingProcess(user);
  }
  
  if (lowerText.includes('doctor') && !lowerText.includes('chat')) {
    return await listDoctors();
  }
  
  // Handle menu numbers
  if (text === '1') {
    conversationManager.setState(user.phoneNumber, conversationManager.states.CHATTING);
    return `💬 **AI Doctor Chat Started**

Hi ${user.name}! I'm your AI health assistant. You can ask me about:
• Symptoms you're experiencing
• Health concerns or questions
• General medical advice
• When to see a doctor

What's on your mind today? Describe how you're feeling or ask any health question! 🩺`;
  }
  
  if (text === '2') {
    conversationManager.setState(user.phoneNumber, conversationManager.states.BOOKING);
    return await startBookingProcess(user);
  }
  
  if (text === '3') {
    return await showMyAppointments(user);
  }
  
  if (text === '4') {
    return await listDoctors();
  }
  
  if (text === '5') {
    return await getHealthTip();
  }
  
  // Default welcome message
  return `👋 **Welcome to MedConnect AI, ${user.name}!**

I'm here to help with your health needs. What would you like to do?

1️⃣ Chat with AI Doctor 💬
2️⃣ Book Appointment 📅
3️⃣ View My Appointments 📋
4️⃣ See Available Doctors 👨‍⚕️
5️⃣ Get Health Tip 💡

Just reply with a number, or tell me what you need help with! 😊

Examples:
• "I have a headache"
• "Book appointment with Dr. Sarah"
• "Show me doctors"`;
}

async function handleChatState(text, user) {
  if (text.toLowerCase() === 'back' || text.toLowerCase() === 'menu') {
    conversationManager.setState(user.phoneNumber, conversationManager.states.INITIAL);
    return await handleInitialState('help', user);
  }
  
  return await processHealthChat(text, user);
}

async function processHealthChat(text, user) {
  try {
    logger.info(`Processing health chat for ${user.phoneNumber}: ${text}`);
    
    // Get AI response
    const aiResponse = await aiService.generateHealthChatResponse({
      user: {
        name: user.name,
        age: user.age,
        gender: user.gender,
        location: user.location
      },
      question: text,
      isUSSD: false,
      maxLength: 300
    });
    
    let response = `🤖 **AI Doctor Response:**

${aiResponse.response}`;

    // Add urgency warning if needed
    if (aiResponse.urgency === 'high' || aiResponse.urgency === 'emergency') {
      response += `\n\n🚨 **URGENT:** This seems serious! Please seek immediate medical attention or call emergency services.`;
    } else if (aiResponse.should_see_doctor) {
      response += `\n\n💡 **Recommendation:** Consider booking an appointment with one of our doctors.`;
    }

    // Add follow-up options
    response += `\n\n**What's next?**
• Ask another question
• Type "BOOK" to schedule appointment
• Type "DOCTORS" to see specialists
• Type "MENU" for main menu`;

    // Keep in chat state for follow-up questions
    conversationManager.setState(user.phoneNumber, conversationManager.states.CHATTING);
    
    return response;
    
  } catch (error) {
    logger.error('Health chat error:', error);
    return `😔 Sorry, I'm having trouble right now. 

Try asking your question again, or type "MENU" to see other options.

For urgent concerns, please contact a healthcare provider directly! 🏥`;
  }
}

async function startBookingProcess(user) {
  try {
    const doctors = await Doctor.find({ isActive: true }).limit(5);
    
    let response = `📅 **Appointment Booking**

Great! Let's book you an appointment. Here are our available doctors:

`;
    
    doctors.forEach((doc, i) => {
      response += `${i + 1}️⃣ **Dr. ${doc.name}**
   ${doc.specialization}
   Fee: KSh ${doc.consultationFee}
   Rating: ⭐ ${doc.rating}/5

`;
    });
    
    response += `Which doctor would you like to see? Reply with:
• The number (1-5)
• Doctor's name (e.g., "Sarah")
• Type "BACK" for main menu`;
    
    conversationManager.setState(user.phoneNumber, conversationManager.states.SELECTING_DOCTOR, { doctors });
    
    return response;
    
  } catch (error) {
    logger.error('Booking process error:', error);
    return `❌ Sorry, couldn't load doctors. Please try again later or type "MENU" for other options.`;
  }
}

async function handleDoctorSelection(text, user, data) {
  const doctors = data.doctors || [];
  let selectedDoctor = null;
  
  // Check if it's a number
  const choice = parseInt(text);
  if (choice >= 1 && choice <= doctors.length) {
    selectedDoctor = doctors[choice - 1];
  } else {
    // Check if it's a doctor name
    selectedDoctor = doctors.find(doc => 
      doc.name.toLowerCase().includes(text.toLowerCase())
    );
  }
  
  if (!selectedDoctor) {
    return `❌ I didn't recognize that choice. Please reply with:
• A number (1-${doctors.length})
• Doctor's name
• "BACK" for main menu

Available doctors:
${doctors.map((doc, i) => `${i + 1}. Dr. ${doc.name}`).join('\n')}`;
  }
  
  // Show available dates
  const response = `✅ **Dr. ${selectedDoctor.name} selected!**

**Specialization:** ${selectedDoctor.specialization}
**Hospital:** ${selectedDoctor.hospital}
**Fee:** KSh ${selectedDoctor.consultationFee}

📅 **When would you like your appointment?**

1️⃣ Today
2️⃣ Tomorrow  
3️⃣ Day after tomorrow
4️⃣ This weekend
5️⃣ Next week

Reply with a number or tell me your preferred date! 📱`;
  
  conversationManager.setState(user.phoneNumber, conversationManager.states.SELECTING_DATE, { 
    selectedDoctor,
    doctors 
  });
  
  return response;
}

async function handleDateSelection(text, user, data) {
  const { selectedDoctor } = data;
  let selectedDate = new Date();
  let dateText = '';
  
  // Parse date selection
  const choice = parseInt(text);
  switch (choice) {
    case 1:
      dateText = 'Today';
      break;
    case 2:
      selectedDate.setDate(selectedDate.getDate() + 1);
      dateText = 'Tomorrow';
      break;
    case 3:
      selectedDate.setDate(selectedDate.getDate() + 2);
      dateText = 'Day after tomorrow';
      break;
    case 4:
      selectedDate.setDate(selectedDate.getDate() + 6);
      dateText = 'This weekend';
      break;
    case 5:
      selectedDate.setDate(selectedDate.getDate() + 7);
      dateText = 'Next week';
      break;
    default:
      // Try to parse as text
      if (text.toLowerCase().includes('today')) {
        dateText = 'Today';
      } else if (text.toLowerCase().includes('tomorrow')) {
        selectedDate.setDate(selectedDate.getDate() + 1);
        dateText = 'Tomorrow';
      } else {
        return `❌ I didn't understand that date. Please choose:

1️⃣ Today
2️⃣ Tomorrow  
3️⃣ Day after tomorrow
4️⃣ This weekend
5️⃣ Next week

Or type "BACK" to choose a different doctor.`;
      }
  }
  
  const response = `📅 **${dateText} selected!**

⏰ **What time works best for you?**

**Morning:**
1️⃣ 9:00 AM
2️⃣ 10:00 AM
3️⃣ 11:00 AM

**Afternoon:**
4️⃣ 2:00 PM
5️⃣ 3:00 PM
6️⃣ 4:00 PM

**Evening:**
7️⃣ 5:00 PM
8️⃣ 6:00 PM

Reply with a number or tell me your preferred time! ⏰`;
  
  conversationManager.setState(user.phoneNumber, conversationManager.states.SELECTING_TIME, {
    selectedDoctor,
    selectedDate,
    dateText
  });
  
  return response;
}

async function handleTimeSelection(text, user, data) {
  const { selectedDoctor, selectedDate, dateText } = data;
  const timeSlots = ['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'];
  
  let selectedTime = '';
  const choice = parseInt(text);
  
  if (choice >= 1 && choice <= 8) {
    selectedTime = timeSlots[choice - 1];
  } else {
    // Try to parse time from text
    if (text.toLowerCase().includes('am') || text.toLowerCase().includes('pm')) {
      selectedTime = text;
    } else {
      return `❌ Please select a valid time:

1️⃣ 9:00 AM  2️⃣ 10:00 AM  3️⃣ 11:00 AM
4️⃣ 2:00 PM  5️⃣ 3:00 PM   6️⃣ 4:00 PM
7️⃣ 5:00 PM  8️⃣ 6:00 PM

Or type the time directly (e.g., "2:30 PM")`;
    }
  }
  
  const response = `✅ **Appointment Summary**

👨‍⚕️ **Doctor:** Dr. ${selectedDoctor.name}
🏥 **Hospital:** ${selectedDoctor.hospital}
📅 **Date:** ${dateText} (${selectedDate.toLocaleDateString()})
⏰ **Time:** ${selectedTime}
💰 **Fee:** KSh ${selectedDoctor.consultationFee}

**Is this correct?**
1️⃣ YES - Confirm booking
2️⃣ NO - Change time
3️⃣ BACK - Choose different doctor

Reply with 1, 2, or 3! 📱`;
  
  conversationManager.setState(user.phoneNumber, conversationManager.states.CONFIRMING, {
    selectedDoctor,
    selectedDate,
    dateText,
    selectedTime
  });
  
  return response;
}

async function handleConfirmation(text, user, data) {
  const choice = parseInt(text);
  
  if (choice === 1 || text.toLowerCase().includes('yes') || text.toLowerCase().includes('confirm')) {
    return await confirmBooking(user, data);
  } else if (choice === 2 || text.toLowerCase().includes('change')) {
    // Go back to time selection
    conversationManager.setState(user.phoneNumber, conversationManager.states.SELECTING_TIME, data);
    return await handleTimeSelection('help', user, data);
  } else if (choice === 3 || text.toLowerCase().includes('back')) {
    // Go back to doctor selection
    conversationManager.setState(user.phoneNumber, conversationManager.states.SELECTING_DOCTOR, data);
    return await startBookingProcess(user);
  } else {
    return `Please reply with:
1️⃣ YES - to confirm
2️⃣ NO - to change time  
3️⃣ BACK - to choose different doctor`;
  }
}

async function confirmBooking(user, data) {
  try {
    const { selectedDoctor, selectedDate, selectedTime } = data;
    
    // Create appointment
    const appointmentId = `APT_${Date.now()}`;
    const appointment = new Appointment({
      appointmentId,
      patientPhone: user.phoneNumber,
      patientName: user.name,
      doctorId: selectedDoctor.doctorId,
      doctorName: selectedDoctor.name,
      specialization: selectedDoctor.specialization,
      appointmentDate: selectedDate,
      timeSlot: selectedTime,
      consultationFee: selectedDoctor.consultationFee,
      bookedVia: 'sms'
    });
    
    await appointment.save();
    
    // Clear conversation state
    conversationManager.clearState(user.phoneNumber);
    
    return `🎉 **APPOINTMENT CONFIRMED!**

✅ **Booking ID:** ${appointmentId}
👨‍⚕️ **Doctor:** Dr. ${selectedDoctor.name}
🏥 **Hospital:** ${selectedDoctor.hospital}
📅 **Date:** ${selectedDate.toLocaleDateString()}
⏰ **Time:** ${selectedTime}
💰 **Fee:** KSh ${selectedDoctor.consultationFee}
📞 **Doctor's Phone:** ${selectedDoctor.phone}

**Important:**
• Arrive 15 minutes early
• Bring valid ID
• Payment due at time of service

**Need help?**
• Type "APPOINTMENTS" to view bookings
• Type "MENU" for main options

Thank you for choosing MedConnect AI! 🏥💙`;
    
  } catch (error) {
    logger.error('Booking confirmation error:', error);
    conversationManager.clearState(user.phoneNumber);
    return `❌ Sorry, there was an error confirming your appointment. Please try again or contact support.

Type "MENU" to return to main options.`;
  }
}

async function showMyAppointments(user) {
  try {
    const appointments = await Appointment.find({
      patientPhone: user.phoneNumber,
      appointmentDate: { $gte: new Date() }
    }).sort({ appointmentDate: 1 }).limit(3);
    
    if (appointments.length === 0) {
      return `📅 **My Appointments**

You have no upcoming appointments.

Would you like to book one?
• Type "BOOK" to start booking
• Type "MENU" for main options 😊`;
    }
    
    let response = `📅 **My Upcoming Appointments**

`;
    
    appointments.forEach((apt, i) => {
      response += `${i + 1}️⃣ **Dr. ${apt.doctorName}**
   📅 ${apt.appointmentDate.toLocaleDateString()}
   ⏰ ${apt.timeSlot}
   🏥 ${apt.specialization}
   🆔 ${apt.appointmentId}
   💰 KSh ${apt.consultationFee}

`;
    });
    
    response += `**Options:**
• Type "BOOK" for new appointment
• Type "CANCEL [ID]" to cancel
• Type "MENU" for main options`;
    
    return response;
    
  } catch (error) {
    logger.error('Show appointments error:', error);
    return `❌ Sorry, couldn't load your appointments. Please try again later.`;
  }
}

async function listDoctors() {
  try {
    const doctors = await Doctor.find({ isActive: true }).limit(5);
    
    let response = `👨‍⚕️ **Available Doctors**

`;
    
    doctors.forEach((doc, i) => {
      response += `${i + 1}️⃣ **Dr. ${doc.name}**
   🩺 ${doc.specialization}
   🏥 ${doc.hospital}
   💰 KSh ${doc.consultationFee}
   ⭐ ${doc.rating}/5 stars

`;
    });
    
    response += `**To book:**
• Type "BOOK [Doctor Name]"
• Type "BOOK" to see booking menu
• Type "MENU" for main options`;
    
    return response;
    
  } catch (error) {
    logger.error('List doctors error:', error);
    return `❌ Sorry, couldn't load doctors. Please try again later.`;
  }
}

async function getHealthTip() {
  const tips = [
    "💧 Drink at least 8 glasses of water daily to stay hydrated and support your immune system.",
    "🚶‍♂️ Take a 30-minute walk daily to improve cardiovascular health and boost mood.",
    "🥗 Eat a variety of colorful fruits and vegetables to get essential vitamins and minerals.",
    "😴 Aim for 7-8 hours of quality sleep each night for optimal physical and mental health.",
    "🧼 Wash your hands frequently with soap for at least 20 seconds to prevent infections.",
    "🧘‍♀️ Practice deep breathing or meditation for 10 minutes daily to reduce stress.",
    "🍎 Choose whole grains over refined grains for better nutrition and sustained energy.",
    "🏃‍♀️ Include strength training exercises twice a week to maintain muscle mass and bone health."
  ];
  
  const randomTip = tips[Math.floor(Math.random() * tips.length)];
  
  return `💡 **Daily Health Tip**

${randomTip}

**Want more health advice?**
• Type "CHAT" to ask AI doctor
• Type "BOOK" to schedule appointment
• Type "MENU" for main options

Stay healthy! 🌟`;
}

module.exports = {
  processConversationalSMS,
  conversationManager
};
