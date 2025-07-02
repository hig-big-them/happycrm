#!/usr/bin/env node

/**
 * Test script for Twilio messaging integration
 * 
 * Bu script Twilio WhatsApp ve SMS entegrasyonunu test eder
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Since we're using ES modules in the project, we'll test via API calls instead
const fetch = require('node-fetch');

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
  console.log(`🌐 Webhook URL: ${getWebhookUrl()}\n`);
  
  return true;
}

async function testSMSMessage(phoneNumber) {
  console.log('📱 Testing SMS Message...');
  
  try {
    const result = await sendMessage(
      phoneNumber,
      'Test SMS from Happy CRM! 🎉',
      'sms'
    );
    
    if (result.success) {
      console.log('✅ SMS sent successfully');
      console.log(`   Message SID: ${result.messageSid}`);
      console.log(`   Status: ${result.status}\n`);
      return true;
    } else {
      console.error('❌ SMS failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ SMS error:', error.message);
    return false;
  }
}

async function testWhatsAppMessage(phoneNumber) {
  console.log('💬 Testing WhatsApp Message...');
  
  try {
    const result = await sendMessage(
      phoneNumber,
      'Test WhatsApp message from Happy CRM! 🚀',
      'whatsapp'
    );
    
    if (result.success) {
      console.log('✅ WhatsApp message sent successfully');
      console.log(`   Message SID: ${result.messageSid}`);
      console.log(`   Status: ${result.status}\n`);
      return true;
    } else {
      console.error('❌ WhatsApp message failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ WhatsApp error:', error.message);
    return false;
  }
}

async function testMediaMessage(phoneNumber) {
  console.log('🖼️ Testing Media Message...');
  
  // Test with a sample image URL
  const mediaUrl = 'https://picsum.photos/300/200';
  
  try {
    const result = await sendMessage(
      phoneNumber,
      'Here is a test image! 📸',
      'whatsapp',
      mediaUrl
    );
    
    if (result.success) {
      console.log('✅ Media message sent successfully');
      console.log(`   Message SID: ${result.messageSid}`);
      console.log(`   Status: ${result.status}\n`);
      return true;
    } else {
      console.error('❌ Media message failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Media message error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Happy CRM - Twilio Integration Test\n');
  
  // Get phone number from command line argument
  const phoneNumber = process.argv[2];
  
  if (!phoneNumber) {
    console.error('❌ Please provide a phone number as an argument');
    console.log('Usage: node scripts/test-twilio-messaging.js +905551234567');
    process.exit(1);
  }
  
  console.log(`📞 Testing with phone number: ${phoneNumber}\n`);
  
  let allTestsPassed = true;
  
  // Test configuration
  const configOk = await testTwilioConfiguration();
  if (!configOk) {
    process.exit(1);
  }
  
  // Test SMS
  const smsOk = await testSMSMessage(phoneNumber);
  allTestsPassed = allTestsPassed && smsOk;
  
  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test WhatsApp
  const whatsappOk = await testWhatsAppMessage(phoneNumber);
  allTestsPassed = allTestsPassed && whatsappOk;
  
  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test media message
  const mediaOk = await testMediaMessage(phoneNumber);
  allTestsPassed = allTestsPassed && mediaOk;
  
  // Summary
  console.log('📊 Test Summary:');
  console.log(`   Configuration: ${configOk ? '✅' : '❌'}`);
  console.log(`   SMS: ${smsOk ? '✅' : '❌'}`);
  console.log(`   WhatsApp: ${whatsappOk ? '✅' : '❌'}`);
  console.log(`   Media: ${mediaOk ? '✅' : '❌'}\n`);
  
  if (allTestsPassed) {
    console.log('🎉 All tests passed! Twilio integration is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Please check the errors above.');
  }
  
  console.log('\n💡 Tips:');
  console.log('   - Check webhook URL in Twilio Console');
  console.log('   - Verify phone number format (+905551234567)');
  console.log('   - For WhatsApp, ensure number is WhatsApp Business approved');
  console.log('   - Check Twilio Console logs for detailed error information');
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});