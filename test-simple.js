require('dotenv').config();

console.log('🧪 Testing Conversational SMS System...\n');
console.log('Environment variables loaded:');
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'Present' : 'Missing');
console.log('- GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');
console.log('- AFRICASTALKING_API_KEY:', process.env.AFRICASTALKING_API_KEY ? 'Present' : 'Missing');

try {
  // Test requiring our conversational SMS module
  const { processConversationalSMS } = require('./routes/conversational-sms');
  console.log('✅ Conversational SMS module loaded successfully');
  
  // Test requiring database
  const { User } = require('./services/database');
  console.log('✅ Database module loaded successfully');
  
  console.log('\n🎉 All modules loaded successfully! The conversational SMS system is ready.');
  
} catch (error) {
  console.error('❌ Error loading modules:', error.message);
  console.error('Full error:', error);
}
