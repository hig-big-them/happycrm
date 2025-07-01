const CACHE_NAME = 'happy-crm-v1';
const urlsToCache = [
  '/',
  '/dashboard',
  '/leads',
  '/pipelines',
  '/messaging',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Safari-safe install event
self.addEventListener('install', (event) => {
  console.log('SW: Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW: Cache opened');
        // Add URLs one by one for better Safari compatibility
        return urlsToCache.reduce((promise, url) => {
          return promise.then(() => {
            return cache.add(url).catch((error) => {
              console.warn(`SW: Failed to cache ${url}:`, error);
              // Continue with other URLs even if one fails
            });
          });
        }, Promise.resolve());
      })
      .catch((error) => {
        console.warn('SW: Cache setup failed:', error);
      })
  );
  // Force activation for Safari
  self.skipWaiting();
});

// Safari-safe activate event
self.addEventListener('activate', (event) => {
  console.log('SW: Activate event');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).catch((error) => {
      console.warn('SW: Cache cleanup failed:', error);
    })
  );
  // Take control immediately for Safari
  return self.clients.claim();
});

// Safari-safe fetch event
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and problematic URLs
  if (event.request.method !== 'GET' || 
      event.request.url.startsWith('chrome-extension://') ||
      event.request.url.startsWith('moz-extension://') ||
      event.request.url.includes('_next/webpack-hmr') ||
      event.request.url.includes('_next/static/chunks/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        
        // Safari-safe network fetch with timeout
        return Promise.race([
          fetch(event.request),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Fetch timeout')), 5000)
          )
        ]).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Only cache successful GET responses for navigation and static resources
          if (event.request.method === 'GET' && 
              (event.request.mode === 'navigate' || event.request.destination === 'document')) {
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              })
              .catch((error) => {
                console.warn('SW: Cache put failed:', error);
              });
          }

          return response;
        });
      })
      .catch((error) => {
        console.warn('SW: Fetch failed for:', event.request.url, error);
        
        // Return cached homepage for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/').then((response) => {
            return response || new Response(
              '<html><body><h1>Offline</h1><p>Please check your connection.</p></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          });
        }
        
        // For other requests, just fail gracefully
        throw error;
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