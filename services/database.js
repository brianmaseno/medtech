const mongoose = require('mongoose');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// User Schema for storing user health profiles
const userSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  age: { type: Number },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  location: { type: String },
  emergencyContact: { type: String },
  medicalHistory: [{ 
    condition: String, 
    date: Date, 
    severity: String 
  }],
  medications: [{ 
    name: String, 
    dosage: String, 
    frequency: String,
    startDate: Date,
    endDate: Date 
  }],
  appointments: [{ 
    date: Date, 
    doctor: String, 
    facility: String, 
    type: String,
    status: { type: String, default: 'scheduled' }
  }],
  healthMetrics: {
    bloodPressure: String,
    heartRate: Number,
    weight: Number,
    height: Number,
    lastCheckup: Date
  },
  preferences: {
    language: { type: String, default: 'en' },
    notificationTime: { type: String, default: '09:00' },
    reminderFrequency: { type: String, default: 'daily' }
  },
  createdAt: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now }
});

// Health Session Schema for tracking USSD/SMS interactions
const healthSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  sessionType: { type: String, enum: ['ussd', 'sms', 'emergency'], required: true },
  symptoms: [String],
  aiDiagnosis: {
    condition: String,
    confidence: Number,
    recommendations: [String],
    urgency: { type: String, enum: ['low', 'medium', 'high', 'critical'] }
  },
  actions: [{
    action: String,
    timestamp: Date,
    result: String
  }],
  status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  completedAt: Date
});

// Emergency Response Schema
const emergencySchema = new mongoose.Schema({
  emergencyId: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  location: { type: String },
  emergencyType: { type: String, required: true },
  severity: { type: String, enum: ['minor', 'moderate', 'severe', 'critical'], default: 'moderate' },
  description: String,
  responders: [{
    type: String, // ambulance, police, fire, hospital
    contact: String,
    notified: { type: Boolean, default: false },
    arrived: { type: Boolean, default: false }
  }],
  status: { type: String, enum: ['reported', 'dispatched', 'in_progress', 'resolved'], default: 'reported' },
  reportedAt: { type: Date, default: Date.now },
  resolvedAt: Date
});

// Health Facility Schema
const facilitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true }, // hospital, clinic, pharmacy, lab
  location: {
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  contact: {
    phone: String,
    email: String
  },
  services: [String],
  operatingHours: {
    weekdays: String,
    weekends: String,
    emergency: Boolean
  },
  rating: { type: Number, min: 1, max: 5 },
  availability: { type: String, enum: ['available', 'busy', 'closed'], default: 'available' }
});

// Health Analytics Schema
const analyticsSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  metrics: {
    totalUsers: Number,
    activeUsers: Number,
    newRegistrations: Number,
    ussdSessions: Number,
    smsSent: Number,
    emergencyCalls: Number,
    aiDiagnoses: Number,
    appointmentsScheduled: Number
  },
  trends: {
    commonSymptoms: [{ symptom: String, count: Number }],
    peakUsageHours: [Number],
    emergencyTypes: [{ type: String, count: Number }]
  }
});

// Create models
const User = mongoose.model('User', userSchema);
const HealthSession = mongoose.model('HealthSession', healthSessionSchema);
const Emergency = mongoose.model('Emergency', emergencySchema);
const Facility = mongoose.model('Facility', facilitySchema);
const Analytics = mongoose.model('Analytics', analyticsSchema);

async function initializeDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    logger.info('🗄️  MongoDB Connected Successfully');
    
    // Initialize sample data
    await initializeSampleData();
    
    return true;
  } catch (error) {
    logger.error('Database connection error:', error);
    throw error;
  }
}

async function initializeSampleData() {
  try {
    // Check if facilities exist, if not create sample ones
    const facilityCount = await Facility.countDocuments();
    if (facilityCount === 0) {
      const sampleFacilities = [
        {
          name: "Nairobi Hospital",
          type: "hospital",
          location: {
            address: "Argwings Kodhek Road, Nairobi",
            coordinates: { lat: -1.2921, lng: 36.8219 }
          },
          contact: {
            phone: "+254202722000",
            email: "info@nairobihosp.org"
          },
          services: ["Emergency", "Surgery", "Maternity", "Pediatrics", "Cardiology"],
          operatingHours: {
            weekdays: "24/7",
            weekends: "24/7",
            emergency: true
          },
          rating: 4.5
        },
        {
          name: "Kenyatta National Hospital",
          type: "hospital",
          location: {
            address: "Hospital Road, Nairobi",
            coordinates: { lat: -1.3018, lng: 36.8073 }
          },
          contact: {
            phone: "+254202726300",
            email: "info@knh.or.ke"
          },
          services: ["Emergency", "Surgery", "Oncology", "Neurology", "Orthopedics"],
          operatingHours: {
            weekdays: "24/7",
            weekends: "24/7",
            emergency: true
          },
          rating: 4.2
        },
        {
          name: "City Health Clinic",
          type: "clinic",
          location: {
            address: "CBD, Nairobi",
            coordinates: { lat: -1.2864, lng: 36.8172 }
          },
          contact: {
            phone: "+254701234567",
            email: "info@cityhealthclinic.ke"
          },
          services: ["General Practice", "Vaccination", "Health Checkups"],
          operatingHours: {
            weekdays: "8:00 AM - 6:00 PM",
            weekends: "9:00 AM - 3:00 PM",
            emergency: false
          },
          rating: 4.0
        }
      ];
      
      await Facility.insertMany(sampleFacilities);
      logger.info('✅ Sample health facilities created');
    }
  } catch (error) {
    logger.error('Error initializing sample data:', error);
  }
}

module.exports = {
  initializeDatabase,
  User,
  HealthSession,
  Emergency,
  Facility,
  Analytics
};
