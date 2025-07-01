const { processConversationalSMS, conversationManager } = require('./routes/conversational-sms');
const { User } = require('./services/database');

// Test the conversational SMS system
async function testConversationalSMS() {
  console.log('🧪 Testing Conversational SMS System...\n');
  
  // Create a test user
  const testUser = {
    phoneNumber: '+254712345678',
    name: 'Test User',
    _id: 'test123'
  };
  
  try {
    // Test 1: Initial greeting
    console.log('📱 Test 1: Sending "hello"');
    const response1 = await processConversationalSMS('hello', testUser);
    console.log('🤖 Response:', response1);
    console.log('\n---\n');
    
    // Test 2: Chat request
    console.log('📱 Test 2: Sending "I have a headache"');
    const response2 = await processConversationalSMS('I have a headache', testUser);
    console.log('🤖 Response:', response2);
    console.log('\n---\n');
    
    // Test 3: Booking request
    console.log('📱 Test 3: Sending "book"');
    const response3 = await processConversationalSMS('book', testUser);
    console.log('🤖 Response:', response3);
    console.log('\n---\n');
    
    console.log('✅ Conversational SMS tests completed!');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testConversationalSMS();
