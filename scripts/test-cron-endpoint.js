#!/usr/bin/env node

// Test script for cron endpoint
const API_URL = 'https://happy-transfer.vercel.app'; // Production URL sabit
const CRON_TOKEN = 'eLyhkLlOgWYNZNlycl5ipIPVGJ2OxRic'; // Production token sabit

async function testCronEndpoint() {
  console.log('🔄 Testing cron endpoint...');
  console.log('URL:', `${API_URL}/api/cron/check-transfer-deadlines`);
  console.log('Token:', CRON_TOKEN ? `${CRON_TOKEN.substring(0, 8)}...` : 'NOT SET');
  
  try {
    const response = await fetch(`${API_URL}/api/cron/check-transfer-deadlines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_TOKEN}`,
        'x-external-cron': 'test-local',
        'x-cron-server': 'test-machine',
        'User-Agent': 'test-cron-script/1.0'
      }
    });

    const result = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📄 Response Body:');
    console.log(JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('✅ Test BAŞARILI');
      console.log(`Processed: ${result.stats?.processed || 0}`);
      console.log(`Successful: ${result.stats?.successful || 0}`);
      console.log(`Failed: ${result.stats?.failed || 0}`);
      console.log(`Cron Log ID: ${result.cron_log_id || 'null'}`);
    } else {
      console.log('❌ Test BAŞARISIZ');
      console.log('Error:', result.error || result.message);
      
      if (response.status === 401) {
        console.log('\n🚨 YETKİLENDİRME SORUNU:');
        console.log('1. Vercel production environment variables kontrol edin');
        console.log('2. CRON_API_TOKEN, CRON_SECRET, API_TOKEN değişkenlerinin tanımlı olduğundan emin olun');
        console.log('3. Token değeri: eLyhkLlOgWYNZNlycl5ipIPVGJ2OxRic');
      }
    }

  } catch (error) {
    console.error('💥 Test hatası:', error.message);
  }
}

// Test notification monitor API
async function testNotificationMonitor() {
  console.log('\n🔍 Testing notification monitor API...');
  
  try {
    const response = await fetch(`${API_URL}/api/admin/notification-monitor?view=cron_jobs&limit=5`, {
      headers: {
        'Authorization': `Bearer ${CRON_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    console.log('📊 Monitor Response Status:', response.status);
    
    if (response.ok && result.success) {
      console.log('✅ Notification monitor ÇALIŞIYOR');
      console.log(`Cron jobs count: ${result.data?.length || 0}`);
      if (result.data && result.data.length > 0) {
        console.log('Son cron job:', result.data[0]);
      }
    } else {
      console.log('❌ Notification monitor SORUNU VAR');
      console.log('Response:', JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('💥 Monitor test hatası:', error.message);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Happy Transfer Cron Endpoint Test');
  console.log('=====================================\n');
  
  await testCronEndpoint();
  await testNotificationMonitor();
  
  console.log('\n🎯 Test tamamlandı!');
  console.log('\n📝 SONRAKI ADIMLAR:');
  console.log('1. Vercel Dashboard > Settings > Environment Variables');
  console.log('2. Şu değişkenleri ekleyin:');
  console.log('   - CRON_API_TOKEN = eLyhkLlOgWYNZNlycl5ipIPVGJ2OxRic');
  console.log('   - CRON_SECRET = eLyhkLlOgWYNZNlycl5ipIPVGJ2OxRic'); 
  console.log('   - API_TOKEN = eLyhkLlOgWYNZNlycl5ipIPVGJ2OxRic');
  console.log('3. Production deployment yapın');
  console.log('4. Bu testi tekrar çalıştırın');
}

runTests().catch(console.error); 