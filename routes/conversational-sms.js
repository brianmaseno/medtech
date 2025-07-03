require('dotenv').config();
const { User, HealthSession, Doctor, Appointment, ChatHistory } = require('../services/database');
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
      CONFIRMING: 'confirming',
      VIEWING_APPOINTMENTS: 'viewing_appointments',
      CANCELLING: 'cancelling',
      RESCHEDULING: 'rescheduling'
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
  
  logger.info(`📱 SMS from ${phoneNumber}: "${text}" (State: ${currentState.state})`);
  
  // Save incoming message to chat history
  await saveChatMessage(user, text, 'user');
  
  // PRIORITY COMMANDS - These override any current state and work from anywhere
  const lowerText = text.toLowerCase().trim();
  
  // HOME command - Always goes to main menu regardless of current state
  if (lowerText === 'home' || lowerText === 'main' || lowerText === 'menu') {
    conversationManager.setState(phoneNumber, conversationManager.states.INITIAL);
    const response = `🏠 **Welcome Back to MedConnect AI Main Menu**

Hi ${user.name}! Here's what I can help you with:

1️⃣ **CHAT** - AI Health Consultation
2️⃣ **BOOK** - Schedule Doctor Appointment  
3️⃣ **VIEW** - See My Appointments
4️⃣ **DOCTORS** - List Available Doctors
5️⃣ **TIPS** - Get Health Tips

💬 **Quick Commands:**
• Type any number (1-5) or keyword
• Type "HOME" anytime to return here
• Type "EXIT" to end conversation
• Ask health questions directly

What can I help you with today? 😊`;
    await saveChatMessage(user, response, 'ai');
    return response;
  }
  
  // Exit commands - End conversation completely
  const exitCommands = ['exit', 'stop', 'quit', 'end', 'cancel', 'bye', 'goodbye'];
  if (exitCommands.includes(lowerText)) {
    conversationManager.clearState(phoneNumber);
    const response = `👋 **Goodbye ${user.name}!**

Thanks for using MedConnect AI! 

💡 **Remember:**
• Text "HOME" anytime to restart
• We're here 24/7 for your health needs
• For emergencies, call your local services

Take care and stay healthy! 🏥💚`;
    await saveChatMessage(user, response, 'ai');
    return response;
  }
  
  // Help commands - Show available commands and current menu
  if (['help', 'commands', '?', 'info'].includes(lowerText)) {
    const response = `ℹ️ **MedConnect AI - Help**

**Main Commands:**
1️⃣ CHAT - Ask health questions
2️⃣ BOOK - Schedule appointments
3️⃣ VIEW - See my appointments
4️⃣ DOCTORS - List available doctors
5️⃣ TIPS - Get health tips

**Navigation Commands:**
🏠 HOME - Return to main menu
❌ EXIT - End conversation
❓ HELP - Show this help

**Special Commands:**
📋 APPOINTMENTS - Quick view appointments
🩺 AI - Direct AI health chat
📞 EMERGENCY - Emergency contacts

**Current State:** ${currentState.state}

Type any command or just tell me what you need! 😊`;
    await saveChatMessage(user, response, 'ai');
    return response;
  }

  // Quick access commands that work from any state
  if (lowerText.includes('appointment') && (lowerText.includes('view') || lowerText.includes('show') || lowerText.includes('list'))) {
    conversationManager.setState(phoneNumber, conversationManager.states.VIEWING_APPOINTMENTS);
    const response = await showUpcomingAppointments(user);
    await saveChatMessage(user, response, 'ai');
    return response;
  }

  if (lowerText.includes('doctor') && (lowerText.includes('list') || lowerText.includes('show') || lowerText.includes('available'))) {
    const response = await listAvailableDoctors();
    await saveChatMessage(user, response, 'ai');
    return response;
  }

  // Emergency command
  if (lowerText.includes('emergency') || lowerText.includes('urgent') || lowerText.includes('911') || lowerText.includes('999')) {
    const response = `🚨 **EMERGENCY CONTACTS**

**Kenya Emergency Numbers:**
🚑 Ambulance: 999
🚔 Police: 999  
🔥 Fire: 999
🏥 Emergency Hotline: 911

**Health Emergency:**
If this is a medical emergency, call 999 immediately or visit the nearest hospital.

**MedConnect AI Emergency Features:**
• Type "CHAT" for urgent health questions
• Type "DOCTORS" to find nearest medical help
• Type "HOME" to return to main menu

Are you experiencing a medical emergency? If yes, please call 999 now! 🆘`;
    await saveChatMessage(user, response, 'ai');
    return response;
  }

  // Route based on current state
  let response;
  switch (currentState.state) {
    case conversationManager.states.INITIAL:
      response = await handleInitialState(text, user);
      break;
    case conversationManager.states.CHATTING:
      response = await handleChatting(text, user, currentState);
      break;
    case conversationManager.states.BOOKING:
      response = await handleBooking(text, user, currentState);
      break;
    case conversationManager.states.SELECTING_DOCTOR:
      response = await handleDoctorSelection(text, user, currentState);
      break;
    case conversationManager.states.SELECTING_DATE:
      response = await handleDateSelection(text, user, currentState);
      break;
    case conversationManager.states.SELECTING_TIME:
      response = await handleTimeSelection(text, user, currentState);
      break;
    case conversationManager.states.CONFIRMING:
      response = await handleBookingConfirmation(text, user, currentState);
      break;
    case conversationManager.states.VIEWING_APPOINTMENTS:
      response = await handleViewingAppointments(text, user, currentState);
      break;
    case conversationManager.states.CANCELLING:
      response = await handleCancelling(text, user, currentState);
      break;
    case conversationManager.states.RESCHEDULING:
      response = await handleRescheduling(text, user, currentState);
      break;
    default:
      response = await handleInitialState(text, user);
  }

  // Save AI response to chat history
  await saveChatMessage(user, response, 'ai');
  
  return response;
}

// Save chat messages to database for conversation memory
async function saveChatMessage(user, message, sender) {
  try {
    // Get or create chat history for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let chatHistory = await ChatHistory.findOne({
      phoneNumber: user.phoneNumber,
      date: { $gte: today }
    });
    
    if (!chatHistory) {
      chatHistory = new ChatHistory({
        phoneNumber: user.phoneNumber,
        userId: user._id,
        date: new Date(),
        messages: []
      });
    }
    
    chatHistory.messages.push({
      content: message,
      sender: sender, // 'user' or 'ai'
      timestamp: new Date()
    });
    
    await chatHistory.save();
    logger.info(`💾 Saved ${sender} message for ${user.phoneNumber}`);
  } catch (error) {
    logger.error('Error saving chat message:', error);
  }
}

// Get conversation context from recent chat history
async function getConversationContext(user, limit = 5) {
  try {
    const recentChats = await ChatHistory.find({
      phoneNumber: user.phoneNumber
    }).sort({ date: -1 }).limit(3);
    
    let context = [];
    recentChats.reverse().forEach(chat => {
      chat.messages.slice(-limit).forEach(msg => {
        context.push(`${msg.sender}: ${msg.content}`);
      });
    });
    
    return context.slice(-limit);
  } catch (error) {
    logger.error('Error getting conversation context:', error);
    return [];
  }
}

async function handleInitialState(text, user) {
  const input = text.toLowerCase().trim();
  
  // Handle numbered options first
  if (input === '1' || input.includes('chat') || input.includes('ask') || input.includes('health question')) {
    conversationManager.setState(user.phoneNumber, conversationManager.states.CHATTING);
    return `🤖 **MedConnect AI Chat Started**

Hi ${user.name}! I'm your personal health assistant. I can help with:
• Symptom analysis
• Health advice  
• Medicine questions
• Emergency guidance

What health question do you have today?

*Type your question or "HOME" to return to main menu*`;
  }
  
  if (input === '2' || input.includes('book') || input.includes('appointment')) {
    conversationManager.setState(user.phoneNumber, conversationManager.states.BOOKING);
    return await startBookingProcess(user);
  }
  
  if (input === '3' || input.includes('view') || input.includes('appointments') || input.includes('upcoming')) {
    conversationManager.setState(user.phoneNumber, conversationManager.states.VIEWING_APPOINTMENTS);
    return await showUpcomingAppointments(user);
  }
  
  if (input === '4' || input.includes('doctor') || input.includes('list')) {
    return await listAvailableDoctors();
  }
  
  if (input === '5' || input.includes('tip') || input.includes('health tip')) {
    return await getHealthTip();
  }
  
  if (input.includes('cancel') && input.includes('appointment')) {
    conversationManager.setState(user.phoneNumber, conversationManager.states.CANCELLING);
    return await startCancelProcess(user);
  }
  
  if (input.includes('reschedule')) {
    conversationManager.setState(user.phoneNumber, conversationManager.states.RESCHEDULING);
    return await startRescheduleProcess(user);
  }
  
  // If message looks like a health question, start chat
  if (isHealthQuestion(text)) {
    conversationManager.setState(user.phoneNumber, conversationManager.states.CHATTING);
    return await handleHealthChat(text, user);
  }
  
  // Welcome message with options
  return `🏥 **Welcome to MedConnect AI!**

Hi ${user.name}! I'm your AI health assistant. Here's what I can help with:

1️⃣ **CHAT** - Ask health questions  
2️⃣ **BOOK** - Schedule appointments  
3️⃣ **VIEW** - See my appointments  
4️⃣ **DOCTORS** - List available doctors
5️⃣ **TIPS** - Get health tips
❌ **CANCEL** - Cancel appointment  
🔄 **RESCHEDULE** - Change appointment time  
🏠 **HOME** - Main menu anytime

*Just type a number (1-5) or keyword! For example:*
• "1" or "I have a headache" 
• "2" or "Book appointment"
• "3" or "View my appointments"

How can I help you today? 😊`;
}

function isHealthQuestion(text) {
  const healthKeywords = [
    'pain', 'ache', 'hurt', 'fever', 'headache', 'cough', 'cold', 'sick', 'tired', 
    'dizzy', 'nausea', 'stomach', 'chest', 'breathing', 'swollen', 'rash', 'itch',
    'medicine', 'medication', 'drug', 'pill', 'treatment', 'symptom', 'disease',
    'diabetes', 'pressure', 'heart', 'blood', 'doctor', 'hospital', 'clinic'
  ];
  
  return healthKeywords.some(keyword => 
    text.toLowerCase().includes(keyword)
  );
}

async function handleChatting(text, user, currentState) {
  // Check if user wants to switch to booking during chat
  if (text.toLowerCase().includes('book') || text.toLowerCase().includes('appointment')) {
    return `🤔 I see you want to book an appointment during our chat. 

Would you like to:
1. **Continue our health chat** and book later
2. **Book appointment now** (our chat will be saved)

Type "1" to continue chatting or "book" to start booking.`;
  }
  
  return await handleHealthChat(text, user);
}

async function handleHealthChat(text, user) {
  try {
    logger.info(`🤖 Processing health chat for ${user.phoneNumber}: "${text}"`);
    
    // Get conversation context for continuity
    const context = await getConversationContext(user, 3);
    
    // Build AI context
    const aiContext = {
      user: {
        name: user.name,
        age: user.age,
        gender: user.gender,
        location: user.location,
        medicalHistory: user.medicalHistory || [],
        currentMedications: user.medications || []
      },
      question: text,
      conversationHistory: context.join('\n'),
      isUSSD: false,
      maxLength: 500 // SMS character limit
    };

    logger.info(`🤖 Sending to AI service with context: ${JSON.stringify(aiContext).substring(0, 200)}...`);
    
    const aiResponse = await aiService.generateHealthChatResponse(aiContext);
    
    logger.info(`🤖 AI Response received: ${JSON.stringify(aiResponse).substring(0, 200)}...`);
    
    // Save health session with unique ID
    const healthSession = new HealthSession({
      sessionId: `SMS_CHAT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user._id,
      phoneNumber: user.phoneNumber,
      sessionType: 'sms',
      symptoms: [text],
      aiAnalysis: aiResponse,
      recommendations: aiResponse.recommendations || [],
      urgencyLevel: aiResponse.urgency || 'low',
      createdAt: new Date()
    });
    
    await healthSession.save();
    
    let response = `🤖 **MedConnect AI Doctor:**

${aiResponse.response}`;
    
    // Add urgency warning if needed
    if (aiResponse.urgency === 'high' || aiResponse.urgency === 'emergency') {
      response += `

🚨 **URGENT WARNING:**
This seems serious! Please seek immediate medical attention or call emergency services (999).`;
    } else if (aiResponse.urgency === 'medium' && aiResponse.should_see_doctor) {
      response += `

💡 **Medical Advice:**
Consider consulting a healthcare provider for proper evaluation.`;
    }
    
    // Add top recommendations if available
    if (aiResponse.recommendations && aiResponse.recommendations.length > 0) {
      response += `

**Quick Tips:**
• ${aiResponse.recommendations[0]}`;
      if (aiResponse.recommendations[1]) {
        response += `
• ${aiResponse.recommendations[1]}`;
      }
    }
    
    response += `

**Continue our chat or:**
💬 Ask another question
📅 BOOK appointment
👨‍⚕️ DOCTORS list
🏠 HOME menu`;
    
    return response;

  } catch (error) {
    logger.error('Health Chat Error:', error);
    
    // Enhanced fallback with more helpful guidance
    return `🤖 **MedConnect AI Doctor:**

I'm having some technical difficulties right now, but I want to help you! 

**For your health concern:**
• If it's urgent, visit your nearest clinic or call 999
• For general health questions, try asking again
• You can also book an appointment with our doctors

**Immediate Help:**
📞 Emergency: 999
🏥 Find clinic: Type "DOCTORS"
📅 Book appointment: Type "BOOK"
🏠 Main menu: Type "HOME"

Please try your question again - I'm here to help! 💚`;
  }
}

// Process conversational SMS based on state
async function processConversationalSMS(text, user) {
  try {
    logger.info(`Processing conversational SMS for ${user.phoneNumber}: ${text}`);
    
    const currentState = conversationManager.getState(user.phoneNumber);
    
    // Handle exit command
    if (['exit', 'quit', 'stop', 'end'].includes(text.toLowerCase())) {
      conversationManager.endConversation(user.phoneNumber);
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
  } catch (error) {
    logger.error('Error in processConversationalSMS:', error);
    return `🤖 I'm having some trouble right now. Please try again or type "help" for assistance.`;
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
    
    // Log successful appointment creation
    logger.info(`✅ APPOINTMENT CREATED: ${appointmentId} for ${user.phoneNumber}`);
    logger.info(`📋 Details: Dr. ${selectedDoctor.name}, ${selectedDate.toLocaleDateString()}, ${selectedTime}`);
    
    // Clear conversation state
    conversationManager.clearState(user.phoneNumber);
    
    // Create a shorter, more reliable confirmation message
    return `🎉 APPOINTMENT CONFIRMED!

✅ ID: ${appointmentId}
👨‍⚕️ Dr. ${selectedDoctor.name}
📅 ${selectedDate.toLocaleDateString()}
⏰ ${selectedTime}
💰 KSh ${selectedDoctor.consultationFee}

� ${selectedDoctor.hospital}
📞 ${selectedDoctor.phone}

Arrive 15 mins early with ID.
Type APPOINTMENTS to view all.

MedConnect AI 🏥`;
    
  } catch (error) {
    logger.error('Booking confirmation error:', error);
    conversationManager.clearState(user.phoneNumber);
    return `❌ Sorry, there was an error confirming your appointment. Please try again or contact support.

Type "MENU" to return to main options.`;
  }
}

async function handleViewingAppointments(text, user, currentState) {
  const lowerText = text.toLowerCase().trim();
  
  // Allow navigation from appointment view
  if (lowerText === 'book' || lowerText === 'new') {
    conversationManager.setState(user.phoneNumber, conversationManager.states.BOOKING);
    return await startBookingProcess(user);
  }
  
  if (lowerText.includes('cancel') || lowerText === 'delete') {
    conversationManager.setState(user.phoneNumber, conversationManager.states.CANCELLING);
    return await startCancelProcess(user);
  }
  
  if (lowerText.includes('reschedule') || lowerText.includes('change') || lowerText === 'modify') {
    conversationManager.setState(user.phoneNumber, conversationManager.states.RESCHEDULING);
    return await startRescheduleProcess(user);
  }
  
  // If it's a number, show specific appointment details
  const choice = parseInt(text);
  if (choice >= 1 && choice <= 10) {
    try {
      const appointments = await Appointment.find({
        patientPhone: user.phoneNumber,
        appointmentDate: { $gte: new Date() }
      }).sort({ appointmentDate: 1 }).limit(10);
      
      if (choice <= appointments.length) {
        const apt = appointments[choice - 1];
        return `📋 **Appointment Details**

🆔 **ID:** ${apt.appointmentId}
👨‍⚕️ **Doctor:** Dr. ${apt.doctorName}
🏥 **Specialization:** ${apt.specialization}
📅 **Date:** ${apt.appointmentDate.toLocaleDateString()}
⏰ **Time:** ${apt.timeSlot}
💰 **Fee:** KSh ${apt.consultationFee}
📞 **Doctor Phone:** ${apt.doctorPhone || 'Contact hospital'}
🏥 **Hospital:** ${apt.hospital || 'MedConnect Partner'}

**Options:**
📝 RESCHEDULE - Change date/time
❌ CANCEL - Cancel this appointment
🏠 HOME - Main menu
📋 VIEW - Back to appointments list

What would you like to do?`;
      }
    } catch (error) {
      logger.error('Error fetching appointment details:', error);
    }
  }
  
  // Default behavior - show appointments list again
  conversationManager.setState(user.phoneNumber, conversationManager.states.INITIAL);
  return await showUpcomingAppointments(user);
}

async function showUpcomingAppointments(user) {
  try {
    const appointments = await Appointment.find({
      patientPhone: user.phoneNumber,
      appointmentDate: { $gte: new Date() },
      status: { $ne: 'cancelled' }
    }).sort({ appointmentDate: 1 }).limit(10);
    
    if (appointments.length === 0) {
      return `📅 **My Appointments**

You have no upcoming appointments scheduled.

**What would you like to do?**
📅 BOOK - Schedule new appointment
🩺 CHAT - Ask AI doctor
👨‍⚕️ DOCTORS - See available doctors
🏠 HOME - Main menu

Type any option to continue! 😊`;
    }
    
    let response = `📅 **My Upcoming Appointments**

`;
    
    appointments.forEach((apt, i) => {
      const date = new Date(apt.appointmentDate);
      const isToday = date.toDateString() === new Date().toDateString();
      const isTomorrow = date.toDateString() === new Date(Date.now() + 86400000).toDateString();
      
      let dateDisplay = date.toLocaleDateString();
      if (isToday) dateDisplay = 'Today';
      else if (isTomorrow) dateDisplay = 'Tomorrow';
      
      response += `${i + 1}️⃣ **Dr. ${apt.doctorName}**
   📅 ${dateDisplay} at ${apt.timeSlot}
   🏥 ${apt.specialization}
   🆔 ${apt.appointmentId}

`;
    });
    
    response += `**Options:**
🔢 **Type number** (1-${appointments.length}) for details
📅 **BOOK** - New appointment
❌ **CANCEL** - Cancel appointment
🔄 **RESCHEDULE** - Change appointment
🏠 **HOME** - Main menu

What would you like to do?`;
    
    return response;
    
  } catch (error) {
    logger.error('Show appointments error:', error);
    return `❌ **Error Loading Appointments**

Sorry, I couldn't load your appointments right now.

**Options:**
🔄 Try again - Type "VIEW"
📅 Book new - Type "BOOK"
🏠 Main menu - Type "HOME"

Please try again or contact support if this continues.`;
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

async function listAvailableDoctors() {
  try {
    const doctors = await Doctor.find({ isActive: true }).limit(5);
    
    if (doctors.length === 0) {
      return `👨‍⚕️ **Available Doctors**

No doctors currently available. Please try again later.

Type "HOME" to return to main menu or "BOOK" to try booking.`;
    }
    
    let response = `👨‍⚕️ **Available Doctors**

`;
    
    doctors.forEach((doctor, index) => {
      response += `${index + 1}. **Dr. ${doctor.name}**
   🏥 ${doctor.specialization}
   📍 ${doctor.location}
   💰 KSh ${doctor.fee}
   ⭐ Rating: ${doctor.rating}/5

`;
    });
    
    response += `💬 To book with any doctor, type "BOOK" or reply with the doctor number.

Type "HOME" for main menu.`;
    
    return response;
    
  } catch (error) {
    logger.error('List doctors error:', error);
    return `❌ Sorry, couldn't load doctors. Please try again later.

Type "HOME" for main menu.`;
  }
}

async function startCancelProcess(user) {
  try {
    const appointments = await Appointment.find({
      patientPhone: user.phoneNumber,
      appointmentDate: { $gte: new Date() },
      status: { $ne: 'cancelled' }
    }).sort({ appointmentDate: 1 }).limit(5);
    
    if (appointments.length === 0) {
      return `❌ **No Appointments to Cancel**

You don't have any upcoming appointments to cancel.

**Options:**
📅 BOOK - Schedule new appointment
📋 VIEW - Check appointment history
🏠 HOME - Main menu

What would you like to do?`;
    }
    
    let response = `❌ **Cancel Appointment**

Which appointment would you like to cancel?

`;
    
    appointments.forEach((apt, i) => {
      response += `${i + 1}️⃣ **Dr. ${apt.doctorName}**
   📅 ${apt.appointmentDate.toLocaleDateString()}
   ⏰ ${apt.timeSlot}
   🆔 ${apt.appointmentId}

`;
    });
    
    response += `**Instructions:**
🔢 Type number (1-${appointments.length}) to cancel
🏠 Type "HOME" for main menu
📋 Type "VIEW" to see all appointments

Which appointment do you want to cancel?`;
    
    conversationManager.setState(user.phoneNumber, conversationManager.states.CANCELLING, { appointments });
    return response;
    
  } catch (error) {
    logger.error('Cancel process error:', error);
    return `❌ **Error Loading Appointments**

Sorry, I couldn't load your appointments for cancellation.

**Options:**
🔄 Try again - Type "CANCEL"
🏠 Main menu - Type "HOME"

Please try again later.`;
  }
}

async function startRescheduleProcess(user) {
  try {
    const appointments = await Appointment.find({
      patientPhone: user.phoneNumber,
      appointmentDate: { $gte: new Date() },
      status: { $ne: 'cancelled' }
    }).sort({ appointmentDate: 1 }).limit(5);
    
    if (appointments.length === 0) {
      return `🔄 **No Appointments to Reschedule**

You don't have any upcoming appointments to reschedule.

**Options:**
📅 BOOK - Schedule new appointment
📋 VIEW - Check appointment history
🏠 HOME - Main menu

What would you like to do?`;
    }
    
    let response = `🔄 **Reschedule Appointment**

Which appointment would you like to reschedule?

`;
    
    appointments.forEach((apt, i) => {
      response += `${i + 1}️⃣ **Dr. ${apt.doctorName}**
   📅 ${apt.appointmentDate.toLocaleDateString()}
   ⏰ ${apt.timeSlot}
   🆔 ${apt.appointmentId}

`;
    });
    
    response += `**Instructions:**
🔢 Type number (1-${appointments.length}) to reschedule
🏠 Type "HOME" for main menu
📋 Type "VIEW" to see all appointments

Which appointment do you want to reschedule?`;
    
    conversationManager.setState(user.phoneNumber, conversationManager.states.RESCHEDULING, { appointments });
    return response;
    
  } catch (error) {
    logger.error('Reschedule process error:', error);
    return `❌ **Error Loading Appointments**

Sorry, I couldn't load your appointments for rescheduling.

**Options:**
🔄 Try again - Type "RESCHEDULE"
🏠 Main menu - Type "HOME"

Please try again later.`;
  }
}

async function handleCancelling(text, user, currentState) {
  const choice = parseInt(text);
  const appointments = currentState.data?.appointments || [];
  
  if (choice >= 1 && choice <= appointments.length) {
    const aptToCancel = appointments[choice - 1];
    
    try {
      // Cancel the appointment
      await Appointment.findByIdAndUpdate(aptToCancel._id, {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: 'Patient request via SMS'
      });
      
      conversationManager.setState(user.phoneNumber, conversationManager.states.INITIAL);
      
      return `✅ **Appointment Cancelled Successfully**

🆔 **Cancelled:** ${aptToCancel.appointmentId}
👨‍⚕️ **Doctor:** Dr. ${aptToCancel.doctorName}
📅 **Date:** ${aptToCancel.appointmentDate.toLocaleDateString()}
⏰ **Time:** ${aptToCancel.timeSlot}

**Your appointment has been cancelled and the doctor has been notified.**

**Options:**
📅 BOOK - Schedule new appointment
📋 VIEW - See remaining appointments
🏠 HOME - Main menu

Is there anything else I can help you with?`;
      
    } catch (error) {
      logger.error('Error cancelling appointment:', error);
      return `❌ **Cancellation Failed**

Sorry, I couldn't cancel your appointment right now. Please try again later or contact support.

**Options:**
🔄 Try again - Type "CANCEL"
🏠 Main menu - Type "HOME"`;
    }
  }
  
  return `❌ **Invalid Selection**

Please type a valid number (1-${appointments.length}) or:
🏠 HOME - Return to main menu
📋 VIEW - See all appointments

Which appointment number do you want to cancel?`;
}

async function handleRescheduling(text, user, currentState) {
  const choice = parseInt(text);
  const appointments = currentState.data?.appointments || [];
  
  if (choice >= 1 && choice <= appointments.length) {
    const aptToReschedule = appointments[choice - 1];
    
    conversationManager.setState(user.phoneNumber, conversationManager.states.SELECTING_DATE, {
      rescheduleAppointment: aptToReschedule,
      selectedDoctor: { doctorId: aptToReschedule.doctorId, name: aptToReschedule.doctorName }
    });
    
    return `🔄 **Reschedule Appointment**

**Current Appointment:**
👨‍⚕️ Dr. ${aptToReschedule.doctorName}
📅 ${aptToReschedule.appointmentDate.toLocaleDateString()}
⏰ ${aptToReschedule.timeSlot}

**Choose New Date:**
1️⃣ Tomorrow
2️⃣ Day after tomorrow
3️⃣ In 3 days
4️⃣ This weekend
5️⃣ Next week

🏠 Type "HOME" for main menu

When would you like to reschedule to?`;
  }
  
  return `❌ **Invalid Selection**

Please type a valid number (1-${appointments.length}) or:
🏠 HOME - Return to main menu
📋 VIEW - See all appointments

Which appointment number do you want to reschedule?`;
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
• Type "HOME" for main menu

Stay healthy! 🌟`;
}

module.exports = {
  processConversationalSMS,
  conversationManager
};
