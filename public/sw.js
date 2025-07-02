const CACHE_NAME = 'happy-crm-v2';
const STATIC_CACHE_NAME = 'happy-crm-static-v2';
const DYNAMIC_CACHE_NAME = 'happy-crm-dynamic-v2';

// Önbelleğe alınacak temel statik varlıklar
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon/favicon.ico',
  '/favicon/icon-192.png',
  '/favicon/icon-512.png',
  '/sounds/notification.mp3'
];

// Safari-safe install event
self.addEventListener('install', (event) => {
  console.log('SW: Yüklendi');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(cache => {
      console.log('SW: Statik varlıklar önbelleğe alınıyor');
      return cache.addAll(STATIC_ASSETS);
    }).catch(err => {
      console.error("SW: Statik önbelleğe alma başarısız oldu:", err);
    })
  );
  // Force activation for Safari
  self.skipWaiting();
});

// Safari-safe activate event
self.addEventListener('activate', (event) => {
  console.log('SW: Aktive edildi');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          // Eski versiyon cache'leri sil
          return (cacheName.startsWith('happy-crm-') && 
                  ![STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME].includes(cacheName));
        }).map(cacheName => {
          console.log('SW: Eski cache siliniyor:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
  // Take control immediately for Safari
  return self.clients.claim();
});

// Safari-safe fetch event
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Statik varlıklar için URL'yi kontrol et
  if (STATIC_ASSETS.some(asset => request.url.endsWith(asset))) {
    event.respondWith(caches.match(request));
    return;
  }
  
  // Gezinme istekleri (HTML sayfaları) için NetworkFirst stratejisi
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Yönlendirmeleri takip et ve cache'e koyma.
          if (response.redirected) {
            return response;
          }
          
          // Geçerli yanıtı dinamik cache'e ekle
          const responseToCache = response.clone();
          caches.open(DYNAMIC_CACHE_NAME)
            .then(cache => cache.put(request, responseToCache));
          
          return response;
        })
        .catch(() => {
          // Ağ hatası durumunda cache'den yanıt ver
          return caches.match(request).then(response => {
            return response || caches.match('/'); // Fallback olarak ana sayfa
          });
        })
    );
    return;
  }

  // Diğer tüm istekler için (API, JS, CSS vb.) Stale-While-Revalidate stratejisi
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        const fetchPromise = fetch(request).then(networkResponse => {
          // Sadece geçerli ve GET isteklerini dinamik cache'e at
          if (request.method === 'GET' && networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone()
            caches.open(DYNAMIC_CACHE_NAME)
              .then(cache => cache.put(request, responseToCache))
              .catch(err => console.error('SW: Dinamik cache yazma hatası:', err));
          }
          return networkResponse
        }).catch(() => {
          // Ağ hatası ve cache'de yoksa, API istekleri için hata döndür
          if (request.destination !== 'document') {
            return new Response(JSON.stringify({ error: 'Network error' }), {
              headers: { 'Content-Type': 'application/json' },
              status: 503
            })
          }
          // Diğer hatalar için boş bırak, tarayıcı halletsin
        })

        // Cache'de yanıt varsa onu hemen döndür, arka planda ağı kontrol et
        return cachedResponse || fetchPromise;
      })
  );
});

// Safari-safe push notification handler
self.addEventListener('push', (event) => {
  try {
    const options = {
      body: event.data ? event.data.text() : 'Yeni bildirim',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'happy-crm-notification',
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '1'
      }
    };

    event.waitUntil(
      self.registration.showNotification('Happy CRM', options)
    );
  } catch (error) {
    console.warn('SW: Push notification failed:', error);
  }
});

// Safari-safe notification click handler
self.addEventListener('notificationclick', (event) => {
  try {
    event.notification.close();

    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        // Check if app is already open
        for (let client of clients) {
          if (client.url.includes('/dashboard') && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window if app not open
        if (self.clients.openWindow) {
          return self.clients.openWindow('/dashboard');
        }
      })
    );
  } catch (error) {
    console.warn('SW: Notification click failed:', error);
  }
}); 