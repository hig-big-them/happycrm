#!/usr/bin/env node

/**
 * Simple Twilio Test Script
 * 
 * Direct Twilio API test without module dependencies
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const twilio = require('twilio');

async function testTwilioConfiguration() {
  console.log('🔧 Testing Twilio Configuration...\n');
  
  const requiredEnvVars = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN', 
    'TWILIO_PHONE_NUMBER'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing environment variables:', missingVars.join(', '));
    return false;
  }
  
  console.log('✅ All required environment variables are set');
  console.log(`📱 Twilio Phone Number: ${process.env.TWILIO_PHONE_NUMBER}`);
  console.log(`🆔 Account SID: ${process.env.TWILIO_ACCOUNT_SID.substring(0, 10)}...`);
  
  try {
    // Test Twilio client connection
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    console.log(`✅ Twilio connection successful - Account: ${account.friendlyName}\n`);
    return true;
  } catch (error) {
    console.error('❌ Twilio connection failed:', error.message);
    return false;
  }
}

async function testSMSMessage(phoneNumber) {
  console.log('📱 Testing SMS Message...');
  
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    const message = await client.messages.create({
      body: 'Test SMS from Happy CRM! 🎉 ' + new Date().toLocaleTimeString(),
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    
    console.log('✅ SMS sent successfully');
    console.log(`   Message SID: ${message.sid}`);
    console.log(`   Status: ${message.status}`);
    console.log(`   Direction: ${message.direction}\n`);
    return true;
  } catch (error) {
    console.error('❌ SMS failed:', error.message);
    if (error.code) {
      console.error(`   Error Code: ${error.code}`);
    }
    return false;
  }
}

async function testWhatsAppMessage(phoneNumber) {
  console.log('💬 Testing WhatsApp Message...');
  
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    const message = await client.messages.create({
      body: 'Test WhatsApp from Happy CRM! 🚀 ' + new Date().toLocaleTimeString(),
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      to: `whatsapp:${phoneNumber}`
    });
    
    console.log('✅ WhatsApp message sent successfully');
    console.log(`   Message SID: ${message.sid}`);
    console.log(`   Status: ${message.status}`);
    console.log(`   Direction: ${message.direction}\n`);
    return true;
  } catch (error) {
    console.error('❌ WhatsApp failed:', error.message);
    if (error.code) {
      console.error(`   Error Code: ${error.code}`);
    }
    if (error.code === 63016) {
      console.error('   💡 This error means the 24-hour messaging window has expired.');
      console.error('   💡 Use an approved template message or wait for the user to send a message first.');
    }
    return false;
  }
}

async function listRecentMessages() {
  console.log('📋 Fetching Recent Messages...');
  
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    const messages = await client.messages.list({
      limit: 5
    });
    
    console.log(`✅ Found ${messages.length} recent messages:`);
    messages.forEach((message, index) => {
      console.log(`   ${index + 1}. ${message.sid} - ${message.status} - ${message.direction}`);
      console.log(`      From: ${message.from} To: ${message.to}`);
      console.log(`      Body: ${message.body ? message.body.substring(0, 50) + '...' : 'No body'}`);
      console.log(`      Date: ${message.dateCreated}\n`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Failed to fetch messages:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Happy CRM - Twilio Direct API Test\n');
  
  // Get phone number from command line argument
  const phoneNumber = process.argv[2];
  
  if (!phoneNumber) {
    console.error('❌ Please provide a phone number as an argument');
    console.log('Usage: node scripts/test-twilio-simple.js +905551234567');
    process.exit(1);
  }
  
  console.log(`📞 Testing with phone number: ${phoneNumber}\n`);
  
  let allTestsPassed = true;
  
  // Test configuration
  const configOk = await testTwilioConfiguration();
  if (!configOk) {
    process.exit(1);
  }
  
  // List recent messages first
  await listRecentMessages();
  
  // Wait before sending test messages
  console.log('⏳ Waiting 3 seconds before sending test messages...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test SMS
  const smsOk = await testSMSMessage(phoneNumber);
  allTestsPassed = allTestsPassed && smsOk;
  
  // Wait between tests
  console.log('⏳ Waiting 5 seconds before WhatsApp test...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Test WhatsApp
  const whatsappOk = await testWhatsAppMessage(phoneNumber);
  allTestsPassed = allTestsPassed && whatsappOk;
  
  // Summary
  console.log('📊 Test Summary:');
  console.log(`   Configuration: ${configOk ? '✅' : '❌'}`);
  console.log(`   SMS: ${smsOk ? '✅' : '❌'}`);
  console.log(`   WhatsApp: ${whatsappOk ? '✅' : '❌'}\n`);
  
  if (allTestsPassed) {
    console.log('🎉 All tests passed! Twilio integration is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Please check the errors above.');
  }
  
  console.log('\n💡 Tips:');
  console.log('   - Check Twilio Console for message logs: https://console.twilio.com/');
  console.log('   - Verify phone number format (+905551234567)');
  console.log('   - For WhatsApp, ensure the number is added to your sandbox or approved');
  console.log('   - Check webhook URL: https://yourdomain.com/api/twilio/webhook');
  console.log('   - For production, ensure WhatsApp Business Account is approved');
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});