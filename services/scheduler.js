const cron = require('node-cron');
const moment = require('moment');
const winston = require('winston');
const { User, Analytics } = require('./database');
const atService = require('./africasTalking');
const aiService = require('./ai');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

class SchedulerService {
  constructor() {
    this.tasks = [];
  }

  startScheduledTasks() {
    // Daily health tips (9 AM every day)
    this.scheduleTask('0 9 * * *', this.sendDailyHealthTips.bind(this), 'Daily Health Tips');
    
    // Appointment reminders (Every hour from 8 AM to 6 PM)
    this.scheduleTask('0 8-18 * * *', this.sendAppointmentReminders.bind(this), 'Appointment Reminders');
    
    // Medication reminders (Every 4 hours from 8 AM to 8 PM)
    this.scheduleTask('0 8,12,16,20 * * *', this.sendMedicationReminders.bind(this), 'Medication Reminders');
    
    // Daily analytics collection (11:59 PM every day)
    this.scheduleTask('59 23 * * *', this.collectDailyAnalytics.bind(this), 'Daily Analytics');
    
    // Weekly feedback requests (Sunday 6 PM)
    this.scheduleTask('0 18 * * 0', this.sendFeedbackRequests.bind(this), 'Weekly Feedback');
    
    // Health checkup reminders (1st of every month at 10 AM)
    this.scheduleTask('0 10 1 * *', this.sendMonthlyCheckupReminders.bind(this), 'Monthly Checkup Reminders');

    logger.info('✅ All scheduled tasks started successfully');
  }

  scheduleTask(schedule, task, name) {
    const cronTask = cron.schedule(schedule, async () => {
      try {
        logger.info(`🕒 Running scheduled task: ${name}`);
        await task();
        logger.info(`✅ Completed scheduled task: ${name}`);
      } catch (error) {
        logger.error(`❌ Error in scheduled task ${name}:`, error);
      }
    }, {
      scheduled: false,
      timezone: "Africa/Nairobi"
    });

    cronTask.start();
    this.tasks.push({ name, schedule, task: cronTask });
    logger.info(`📅 Scheduled task: ${name} (${schedule})`);
  }

  async sendDailyHealthTips() {
    try {
      const users = await User.find({ 
        'preferences.notificationTime': { $exists: true } 
      }).limit(100); // Limit to avoid overwhelming the system

      const categories = ['nutrition', 'exercise', 'mental_health', 'prevention', 'hygiene'];
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      
      const tipResponse = await aiService.generateHealthTip(randomCategory);
      
      for (const user of users) {
        if (atService.isValidPhoneNumber(user.phoneNumber)) {
          await atService.sendHealthTip(user.phoneNumber, tipResponse.tip);
          await this.delay(1000); // 1 second delay between messages
        }
      }

      logger.info(`📱 Sent daily health tips to ${users.length} users`);
    } catch (error) {
      logger.error('Error sending daily health tips:', error);
    }
  }

  async sendAppointmentReminders() {
    try {
      const tomorrow = moment().add(1, 'day').startOf('day');
      const dayAfterTomorrow = moment().add(2, 'days').startOf('day');

      const users = await User.find({
        'appointments': {
          $elemMatch: {
            date: {
              $gte: tomorrow.toDate(),
              $lt: dayAfterTomorrow.toDate()
            },
            status: 'scheduled'
          }
        }
      });

      for (const user of users) {
        const upcomingAppointments = user.appointments.filter(apt => 
          moment(apt.date).isBetween(tomorrow, dayAfterTomorrow) && 
          apt.status === 'scheduled'
        );

        for (const appointment of upcomingAppointments) {
          await atService.sendAppointmentReminder(user.phoneNumber, {
            doctor: appointment.doctor,
            facility: appointment.facility,
            date: moment(appointment.date).format('MMM DD, YYYY at h:mm A')
          });
          await this.delay(2000); // 2 second delay
        }
      }

      logger.info(`🗓️  Sent appointment reminders to ${users.length} users`);
    } catch (error) {
      logger.error('Error sending appointment reminders:', error);
    }
  }

  async sendMedicationReminders() {
    try {
      const now = moment();
      const currentHour = now.hour();

      // Define medication times
      const medicationTimes = {
        8: 'morning',
        12: 'afternoon', 
        16: 'evening',
        20: 'night'
      };

      if (!medicationTimes[currentHour]) return;

      const timeOfDay = medicationTimes[currentHour];
      
      const users = await User.find({
        'medications': {
          $elemMatch: {
            frequency: { $regex: timeOfDay, $options: 'i' },
            endDate: { $gte: now.toDate() }
          }
        }
      });

      for (const user of users) {
        const relevantMedications = user.medications.filter(med => 
          med.frequency.toLowerCase().includes(timeOfDay) &&
          moment(med.endDate).isAfter(now)
        );

        for (const medication of relevantMedications) {
          await atService.sendMedicationReminder(user.phoneNumber, {
            name: medication.name,
            dosage: medication.dosage,
            instructions: medication.instructions || 'as prescribed'
          });
          await this.delay(2000);
        }
      }

      logger.info(`💊 Sent ${timeOfDay} medication reminders`);
    } catch (error) {
      logger.error('Error sending medication reminders:', error);
    }
  }

  async collectDailyAnalytics() {
    try {
      const today = moment().startOf('day');
      const tomorrow = moment().add(1, 'day').startOf('day');

      // Collect various metrics
      const totalUsers = await User.countDocuments();
      const newRegistrations = await User.countDocuments({
        createdAt: {
          $gte: today.toDate(),
          $lt: tomorrow.toDate()
        }
      });

      const activeUsers = await User.countDocuments({
        lastActivity: {
          $gte: today.toDate(),
          $lt: tomorrow.toDate()
        }
      });

      // Create analytics entry
      const analytics = new Analytics({
        date: today.toDate(),
        metrics: {
          totalUsers,
          activeUsers,
          newRegistrations,
          ussdSessions: 0, // Will be updated by USSD handler
          smsSent: 0, // Will be updated by SMS handler
          emergencyCalls: 0, // Will be updated by emergency handler
          aiDiagnoses: 0, // Will be updated by AI service
          appointmentsScheduled: 0 // Will be updated by appointment service
        },
        trends: {
          commonSymptoms: [],
          peakUsageHours: [],
          emergencyTypes: []
        }
      });

      await analytics.save();
      logger.info(`📊 Daily analytics collected: ${totalUsers} total users, ${newRegistrations} new registrations`);
    } catch (error) {
      logger.error('Error collecting daily analytics:', error);
    }
  }

  async sendFeedbackRequests() {
    try {
      const oneWeekAgo = moment().subtract(7, 'days').toDate();
      
      const activeUsers = await User.find({
        lastActivity: { $gte: oneWeekAgo }
      }).limit(50); // Limit feedback requests

      for (const user of activeUsers) {
        await atService.sendFeedbackRequest(user.phoneNumber, user.name);
        await this.delay(3000); // 3 second delay
      }

      logger.info(`💬 Sent feedback requests to ${activeUsers.length} active users`);
    } catch (error) {
      logger.error('Error sending feedback requests:', error);
    }
  }

  async sendMonthlyCheckupReminders() {
    try {
      const oneYearAgo = moment().subtract(1, 'year').toDate();
      
      const users = await User.find({
        $or: [
          { 'healthMetrics.lastCheckup': { $lt: oneYearAgo } },
          { 'healthMetrics.lastCheckup': { $exists: false } }
        ]
      }).limit(100);

      for (const user of users) {
        const message = `🏥 MedConnect AI Health Reminder: 
Hi ${user.name}! It's time for your annual health checkup. 
Regular checkups help prevent serious health issues.
Use *384*57000# to find nearby health facilities.
Stay healthy! 💚`;

        await atService.sendSMS(user.phoneNumber, message);
        await this.delay(2000);
      }

      logger.info(`🩺 Sent monthly checkup reminders to ${users.length} users`);
    } catch (error) {
      logger.error('Error sending monthly checkup reminders:', error);
    }
  }

  // Utility function to add delays between messages
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Stop all scheduled tasks
  stopAllTasks() {
    this.tasks.forEach(task => {
      task.task.stop();
    });
    this.tasks = [];
    logger.info('🛑 All scheduled tasks stopped');
  }

  // Get status of all tasks
  getTaskStatus() {
    return this.tasks.map(task => ({
      name: task.name,
      schedule: task.schedule,
      running: task.task.getStatus() === 'scheduled'
    }));
  }
}

module.exports = {
  startScheduledTasks: () => {
    const scheduler = new SchedulerService();
    scheduler.startScheduledTasks();
    return scheduler;
  },
  SchedulerService
};
