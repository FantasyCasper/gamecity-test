/* ===============================
   SERVICE WORKER (BIJGEWERKT MET KART-MAP)
   =============================== */

// De naam is veranderd om de cache te forceren
const CACHE_NAAM = 'checklist-app-cache-v0.100.1';

// De lijst is bijgewerkt met de nieuwe map
const urlsToCache = [
  '.',
  'index.html',
  'style.css',
  'script.js',
  'manifest.json',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'login/',
  'login/index.html',
  'login/login.css',
  'login/login.js',
  'admin/admin.html',
  'admin/admin.css',
  'admin/admin.js',
  'kart-dashboard/',
  'kart-dashboard/index.html',
  'kart-dashboard/style.css',
  'kart-dashboard/script.js'
];

// 1. Installatie
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAAM)
      .then(function (cache) {
        //console.log('Cache v0.18 geopend en bestanden worden toegevoegd');
        const updateCache = urlsToCache.map(url => {
          return cache.add(new Request(url, { cache: 'reload' }));
        });
        return Promise.all(updateCache);
      })
  );
});

// 2. Activering (Ruimt oude caches op)
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.filter(function (cacheName) {
          return cacheName.startsWith('checklist-app-cache-') &&
            cacheName !== CACHE_NAAM;
        }).map(function (cacheName) {
          console.log('Oude cache verwijderen:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// 3. Ophalen (Fetch) - Netwerk eerst, dan cache
self.addEventListener('fetch', function (event) {
  if (event.request.url.includes('script.google.com')) {
    return event.respondWith(fetch(event.request));
  }

  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        return caches.open(CACHE_NAAM).then(function (cache) {
          cache.put(event.request, response.clone());
          return response;
        });
      })
      .catch(function () {
        return caches.match(event.request);
      })
  );
});