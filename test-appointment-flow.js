require('dotenv').config();

const { processConversationalSMS, conversationManager } = require('./routes/conversational-sms');

// Test appointment booking flow
async function testAppointmentFlow() {
  console.log('🧪 Testing Appointment Booking Flow...\n');
  
  const testUser = {
    phoneNumber: '+254712345678',
    name: 'Test Patient',
    _id: 'test123'
  };
  
  try {
    // Step 1: Start booking
    console.log('📱 Step 1: "book"');
    const response1 = await processConversationalSMS('book', testUser);
    console.log('🤖 Response 1:', response1.substring(0, 200) + '...\n');
    
    // Step 2: Select doctor (assuming "1")
    console.log('📱 Step 2: "1" (select first doctor)');
    const response2 = await processConversationalSMS('1', testUser);
    console.log('🤖 Response 2:', response2.substring(0, 200) + '...\n');
    
    // Step 3: Select date (assuming "2")
    console.log('📱 Step 3: "2" (select date)');
    const response3 = await processConversationalSMS('2', testUser);
    console.log('🤖 Response 3:', response3.substring(0, 200) + '...\n');
    
    // Step 4: Select time (assuming "3")
    console.log('📱 Step 4: "3" (select time)');
    const response4 = await processConversationalSMS('3', testUser);
    console.log('🤖 Response 4:', response4.substring(0, 200) + '...\n');
    
    // Step 5: Confirm (assuming "1")
    console.log('📱 Step 5: "1" (confirm)');
    const response5 = await processConversationalSMS('1', testUser);
    console.log('🤖 Final Response:', response5);
    
    console.log('\n✅ Appointment booking flow test completed!');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testAppointmentFlow();
