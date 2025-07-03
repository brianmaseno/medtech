// Test script to verify AI fixes
require('dotenv').config();
const aiService = require('./services/ai');

async function testAI() {
  console.log('🤖 Testing AI Service...\n');
  
  try {
    // Test AI Chat Response
    const context = {
      user: {
        name: 'Test User',
        age: 25,
        gender: 'male',
        location: 'Nairobi',
        medicalHistory: [],
        currentMedications: []
      },
      question: 'I have a headache',
      conversationHistory: '',
      isUSSD: false,
      maxLength: 500
    };
    
    console.log('📝 Test Question: "I have a headache"');
    console.log('⏳ Calling AI service...\n');
    
    const response = await aiService.generateHealthChatResponse(context);
    
    console.log('✅ AI Response Received:');
    console.log('📋 Response:', response.response);
    console.log('🚨 Urgency:', response.urgency);
    console.log('💡 Recommendations:', response.recommendations);
    console.log('👨‍⚕️ Should see doctor:', response.should_see_doctor);
    console.log('\n' + '='.repeat(50));
    
    // Test USSD format
    console.log('\n🤖 Testing USSD Format...\n');
    
    const ussdContext = {
      ...context,
      isUSSD: true,
      maxLength: 160
    };
    
    const ussdResponse = await aiService.generateHealthChatResponse(ussdContext);
    
    console.log('✅ USSD AI Response:');
    console.log('📋 Response:', ussdResponse.response);
    console.log('📏 Length:', ussdResponse.response.length);
    console.log('🚨 Urgency:', ussdResponse.urgency);
    
    console.log('\n🎉 AI Service Test Complete!');
    
  } catch (error) {
    console.error('❌ AI Test Failed:', error);
  }
}

testAI();
