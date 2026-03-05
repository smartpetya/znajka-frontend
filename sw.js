// !! Обновляй CACHE_VERSION при каждом деплое !!
const CACHE_VERSION = 'znajka-v14-20250305';
const CACHE_NAME = CACHE_VERSION;

// Файлы для кэширования
const STATIC_FILES = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_FILES))
  );
  // Активируем новый SW сразу, не ждём закрытия всех вкладок
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME) // удаляем старые кэши
          .map(key => {
            console.log('[SW] Удаляю старый кэш:', key);
            return caches.delete(key);
          })
      )
    )
  );
  // Берём контроль над всеми открытыми вкладками немедленно
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API запросы — всегда сеть, никогда не кэшируем
  if (url.hostname.includes('railway.app') || url.hostname.includes('supabase')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // HTML файл — network-first (сначала сеть, потом кэш)
  // Это гарантирует что новый деплой подхватится сразу
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // CDN скрипты и статика — cache-first (быстро)
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
