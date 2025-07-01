// Test SMS functionality
const express = require('express');
const axios = require('axios');

async function testSMSCallback() {
  try {
    console.log('🧪 Testing SMS Callback Functionality...\n');
    
    // Test 1: GET callback endpoint
    console.log('1. Testing GET /callback...');
    const getResponse = await axios.get('http://localhost:3000/callback');
    console.log('✅ GET /callback:', getResponse.data);
    
    // Test 2: SMS test endpoint
    console.log('\n2. Testing SMS test endpoint...');
    const smsTestResponse = await axios.get('http://localhost:3000/sms/test-callback');
    console.log('✅ SMS test endpoint:', smsTestResponse.data);
    
    // Test 3: Simulate SMS callback
    console.log('\n3. Testing POST /callback (simulate SMS)...');
    const smsPayload = {
      from: '+254712345678',
      text: 'HELP',
      to: '57000',
      id: 'test123',
      date: new Date().toISOString(),
      linkId: 'test',
      networkCode: '63902'
    };
    
    const postResponse = await axios.post('http://localhost:3000/callback', smsPayload);
    console.log('✅ POST /callback:', postResponse.data);
    
    // Test 4: Simulate booking SMS
    console.log('\n4. Testing booking via SMS...');
    const bookingPayload = {
      from: '+254712345678',
      text: 'BOOK Sarah Tomorrow 2PM',
      to: '57000',
      id: 'test124',
      date: new Date().toISOString()
    };
    
    const bookingResponse = await axios.post('http://localhost:3000/callback', bookingPayload);
    console.log('✅ Booking SMS:', bookingResponse.data);
    
    console.log('\n🎉 All SMS tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run tests
testSMSCallback();
