const AfricasTalking = require('africastalking');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

class ATService {
  constructor() {
    this.africasTalking = AfricasTalking({
      apiKey: process.env.AFRICASTALKING_API_KEY,
      username: process.env.AFRICASTALKING_USERNAME,
    });
    
    this.sms = this.africasTalking.SMS;
    this.voice = this.africasTalking.VOICE;
    this.airtime = this.africasTalking.AIRTIME;
  }

  async sendSMS(to, message, from = null) {
    try {
      const options = {
        to: Array.isArray(to) ? to : [to],
        message: message,
      };
      
      if (from) {
        options.from = from;
      }

      const result = await this.sms.send(options);
      
      logger.info(`SMS sent to ${to}: ${message.substring(0, 50)}...`);
      
      return {
        success: true,
        result: result,
        messageId: result.SMSMessageData?.Recipients?.[0]?.messageId
      };
    } catch (error) {
      logger.error('Error sending SMS:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendBulkSMS(recipients, message) {
    try {
      const phoneNumbers = recipients.map(recipient => 
        typeof recipient === 'string' ? recipient : recipient.phoneNumber
      );

      const result = await this.sms.send({
        to: phoneNumbers,
        message: message
      });

      logger.info(`Bulk SMS sent to ${phoneNumbers.length} recipients`);
      
      return {
        success: true,
        result: result,
        recipientCount: phoneNumbers.length
      };
    } catch (error) {
      logger.error('Error sending bulk SMS:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async makeVoiceCall(to, from = null) {
    try {
      const options = {
        to: to,
        from: from || process.env.AFRICASTALKING_SHORTCODE
      };

      const result = await this.voice.call(options);
      
      logger.info(`Voice call initiated to ${to}`);
      
      return {
        success: true,
        result: result
      };
    } catch (error) {
      logger.error('Error making voice call:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendAirtime(phoneNumber, amount, currencyCode = 'KES') {
    try {
      const options = {
        recipients: [{
          phoneNumber: phoneNumber,
          amount: amount,
          currencyCode: currencyCode
        }]
      };

      const result = await this.airtime.send(options);
      
      logger.info(`Airtime sent: ${amount} ${currencyCode} to ${phoneNumber}`);
      
      return {
        success: true,
        result: result
      };
    } catch (error) {
      logger.error('Error sending airtime:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Health-specific SMS templates
  async sendAppointmentReminder(phoneNumber, appointment) {
    const message = `🏥 MedConnect AI Reminder: 
Your appointment with ${appointment.doctor} at ${appointment.facility} is scheduled for ${appointment.date}. 
Please arrive 15 minutes early. Reply CONFIRM to confirm or RESCHEDULE to change.`;

    return await this.sendSMS(phoneNumber, message);
  }

  async sendMedicationReminder(phoneNumber, medication) {
    const message = `💊 MedConnect AI: Time for your ${medication.name} medication. 
Dosage: ${medication.dosage}
Take with ${medication.instructions || 'water'}
Reply TAKEN when you've taken your medication.`;

    return await this.sendSMS(phoneNumber, message);
  }

  async sendHealthTip(phoneNumber, tip) {
    const message = `🌟 MedConnect AI Health Tip: ${tip}
Stay healthy! Use *384*57000# for health assistance anytime.`;

    return await this.sendSMS(phoneNumber, message);
  }

  async sendEmergencyAlert(phoneNumber, emergency) {
    const message = `🚨 EMERGENCY ALERT: ${emergency.type} reported at ${emergency.location}. 
Emergency ID: ${emergency.emergencyId}
Status: ${emergency.status}
Help is on the way!`;

    return await this.sendSMS(phoneNumber, message);
  }

  async sendDiagnosisResult(phoneNumber, diagnosis, userName) {
    const message = `🔬 MedConnect AI Results for ${userName}:
Condition: ${diagnosis.condition}
Urgency: ${diagnosis.urgency.toUpperCase()}
${diagnosis.recommendations[0]}
${diagnosis.urgency === 'high' || diagnosis.urgency === 'critical' ? 
  'SEEK IMMEDIATE MEDICAL ATTENTION!' : 'Consult a healthcare provider.'}
Use *384*57000# for more help.`;

    return await this.sendSMS(phoneNumber, message);
  }

  async sendWelcomeMessage(phoneNumber, userName) {
    const message = `Welcome to MedConnect AI, ${userName}! 🏥
Your intelligent health assistant is ready.
• Dial *384*57000# for health guidance
• Get appointment reminders
• Emergency assistance
• Health tips & more
Reply HELP for commands.`;

    return await this.sendSMS(phoneNumber, message);
  }

  async sendFeedbackRequest(phoneNumber, userName) {
    const message = `Hi ${userName}! How was your MedConnect AI experience? 
Rate us: Reply 1-5 (5=Excellent)
Your feedback helps us improve healthcare for everyone. 
You can earn airtime rewards for detailed feedback!`;

    return await this.sendSMS(phoneNumber, message);
  }

  // Utility function to format phone numbers for Kenya
  formatPhoneNumber(phoneNumber) {
    // Remove any spaces, dashes, or parentheses
    let formatted = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    // Handle different formats
    if (formatted.startsWith('0')) {
      // Convert 07XXXXXXXX to +2547XXXXXXXX
      formatted = '+254' + formatted.substring(1);
    } else if (formatted.startsWith('7') || formatted.startsWith('1')) {
      // Convert 7XXXXXXXX to +2547XXXXXXXX
      formatted = '+254' + formatted;
    } else if (!formatted.startsWith('+')) {
      // Add + if missing
      formatted = '+' + formatted;
    }
    
    return formatted;
  }

  // Validate phone number format
  isValidPhoneNumber(phoneNumber) {
    const formatted = this.formatPhoneNumber(phoneNumber);
    // Basic validation for Kenyan numbers
    return /^\+254[17]\d{8}$/.test(formatted);
  }
}

module.exports = new ATService();
