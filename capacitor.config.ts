import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.happycrm.app',
  appName: 'Happy CRM',
  webDir: 'public', // Static assets için
  server: {
    // iOS uygulaması canlı web API'sini kullanacak
    url: 'https://your-domain.com', // Production domain'inizi buraya yazın
    cleartext: true,
    allowNavigation: ['https://your-domain.com', 'https://*.your-domain.com']
  },
  ios: {
    scheme: 'Happy CRM',
    contentInset: 'automatic',
    scrollEnabled: true,
    backgroundColor: '#ffffff'
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
