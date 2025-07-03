require('dotenv').config();
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

// Doctor Schema
const doctorSchema = new mongoose.Schema({
  doctorId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  specialization: { type: String, required: true },
  qualification: String,
  experience: Number, // years
  hospital: String,
  location: String,
  phone: String,
  email: String,
  availability: {
    monday: [String], // time slots like ["09:00", "10:00", "11:00"]
    tuesday: [String],
    wednesday: [String],
    thursday: [String],
    friday: [String],
    saturday: [String],
    sunday: [String]
  },
  consultationFee: Number,
  rating: { type: Number, default: 4.5 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Appointment Schema
const appointmentSchema = new mongoose.Schema({
  appointmentId: { type: String, required: true, unique: true },
  patientPhone: { type: String, required: true },
  patientName: String,
  doctorId: { type: String, required: true },
  doctorName: String,
  specialization: String,
  appointmentDate: { type: Date, required: true },
  timeSlot: { type: String, required: true }, // "09:00", "10:00", etc.
  symptoms: String,
  status: { 
    type: String, 
    enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled'], 
    default: 'scheduled' 
  },
  consultationFee: Number,
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'failed'], 
    default: 'pending' 
  },
  notes: String,
  reminderSent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// SMS Delivery Report Schema (for tracking delivery status)
const deliveryReportSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  status: { type: String, required: true }, // Success, Failed, Sent, etc.
  networkCode: { type: String },
  failureReason: { type: String },
  retryCount: { type: Number, default: 0 },
  cost: { type: String },
  timestamp: { type: Date, default: Date.now },
  relatedSession: { type: String }, // Link to health session if applicable
  messageType: { type: String, enum: ['appointment', 'health', 'general'], default: 'general' }
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

// Chat History Schema for conversation memory
const chatHistorySchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true },
  conversationId: { type: String, required: true },
  messages: [{
    sender: { type: String, enum: ['user', 'ai'], required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  context: { type: String }, // Current conversation context
  lastActivity: { type: Date, default: Date.now },
  conversationType: { type: String, enum: ['health', 'booking', 'general'], default: 'general' }
}, { timestamps: true });

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
const Doctor = mongoose.model('Doctor', doctorSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);
const DeliveryReport = mongoose.model('DeliveryReport', deliveryReportSchema);
const Facility = mongoose.model('Facility', facilitySchema);
const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);
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
    // Check if doctors exist, if not create sample ones
    const doctorCount = await Doctor.countDocuments();
    if (doctorCount === 0) {
      const sampleDoctors = [
        {
          doctorId: 'DOC001',
          name: 'Dr. Sarah Kimani',
          specialization: 'General Medicine',
          qualification: 'MBChB, University of Nairobi',
          experience: 8,
          hospital: 'Nairobi Hospital',
          location: 'Nairobi',
          phone: '+254701234567',
          email: 'sarah.kimani@nairobihosp.co.ke',
          availability: {
            monday: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
            tuesday: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
            wednesday: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
            thursday: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
            friday: ['09:00', '10:00', '11:00', '14:00', '15:00'],
            saturday: ['09:00', '10:00', '11:00'],
            sunday: []
          },
          consultationFee: 2500,
          rating: 4.8
        },
        {
          doctorId: 'DOC002',
          name: 'Dr. James Ochieng',
          specialization: 'Pediatrics',
          qualification: 'MBChB, MMed (Paediatrics)',
          experience: 12,
          hospital: 'Kenyatta National Hospital',
          location: 'Nairobi',
          phone: '+254701234568',
          email: 'james.ochieng@knh.or.ke',
          availability: {
            monday: ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00'],
            tuesday: ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00'],
            wednesday: ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00'],
            thursday: ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00'],
            friday: ['08:00', '09:00', '10:00', '11:00', '14:00'],
            saturday: ['08:00', '09:00', '10:00'],
            sunday: []
          },
          consultationFee: 3000,
          rating: 4.9
        },
        {
          doctorId: 'DOC003',
          name: 'Dr. Mary Wanjiku',
          specialization: 'Gynecology',
          qualification: 'MBChB, MMed (Obstetrics & Gynecology)',
          experience: 10,
          hospital: 'Aga Khan Hospital',
          location: 'Nairobi',
          phone: '+254701234569',
          email: 'mary.wanjiku@agakhan.org',
          availability: {
            monday: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
            tuesday: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
            wednesday: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
            thursday: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
            friday: ['09:00', '10:00', '11:00', '14:00', '15:00'],
            saturday: ['09:00', '10:00', '11:00'],
            sunday: []
          },
          consultationFee: 3500,
          rating: 4.7
        },
        {
          doctorId: 'DOC004',
          name: 'Dr. Peter Mutua',
          specialization: 'Cardiology',
          qualification: 'MBChB, MMed (Internal Medicine), Fellowship in Cardiology',
          experience: 15,
          hospital: 'Nairobi Hospital',
          location: 'Nairobi',
          phone: '+254701234570',
          email: 'peter.mutua@nairobihosp.co.ke',
          availability: {
            monday: ['08:00', '09:00', '10:00', '14:00', '15:00'],
            tuesday: ['08:00', '09:00', '10:00', '14:00', '15:00'],
            wednesday: ['08:00', '09:00', '10:00', '14:00', '15:00'],
            thursday: ['08:00', '09:00', '10:00', '14:00', '15:00'],
            friday: ['08:00', '09:00', '10:00', '14:00'],
            saturday: ['08:00', '09:00'],
            sunday: []
          },
          consultationFee: 4000,
          rating: 4.9
        },
        {
          doctorId: 'DOC005',
          name: 'Dr. Grace Akinyi',
          specialization: 'Dermatology',
          qualification: 'MBChB, MMed (Dermatology)',
          experience: 6,
          hospital: 'MP Shah Hospital',
          location: 'Nairobi',
          phone: '+254701234571',
          email: 'grace.akinyi@mpshah.org',
          availability: {
            monday: ['10:00', '11:00', '14:00', '15:00', '16:00'],
            tuesday: ['10:00', '11:00', '14:00', '15:00', '16:00'],
            wednesday: ['10:00', '11:00', '14:00', '15:00', '16:00'],
            thursday: ['10:00', '11:00', '14:00', '15:00', '16:00'],
            friday: ['10:00', '11:00', '14:00', '15:00'],
            saturday: ['10:00', '11:00'],
            sunday: []
          },
          consultationFee: 2800,
          rating: 4.6
        }
      ];

      await Doctor.insertMany(sampleDoctors);
      logger.info('Sample doctors created successfully');
    }

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
  Doctor,
  Appointment,
  DeliveryReport,
  Facility,
  ChatHistory,
  Analytics
};
