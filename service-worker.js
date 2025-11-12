/* ===============================
   SERVICE WORKER (CACHE BUSTER V9)
   =============================== */

// De naam is veranderd naar v9
const CACHE_NAAM = 'checklist-app-cache-v0.15';

// De lijst met AL je bestanden
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
  
  // -- Admin bestanden --
  'admin/admin.html',
  'admin/admin.css',
  'admin/admin.js'
];

// 1. Installatie
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAAM)
      .then(function(cache) {
        console.log('Cache v0.15 geopend en bestanden worden toegevoegd');
        // forceer de browser om de nieuwste versie te pakken
        const updateCache = urlsToCache.map(url => {
            return cache.add(new Request(url, { cache: 'reload' }));
        });
        return Promise.all(updateCache);
      })
  );
});

// 2. Activering (Ruimt oude caches op)
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          // Verwijder alle caches die NIET v9 zijn
          return cacheName.startsWith('checklist-app-cache-') && 
                 cacheName !== CACHE_NAAM;
        }).map(function(cacheName) {
          console.log('Oude cache verwijderen:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// 3. Ophalen (Fetch) - Netwerk eerst, dan cache
self.addEventListener('fetch', function(event) {
  // We willen NOOIT de Google Script API call cachen
  if (event.request.url.includes('script.google.com')) {
    return event.respondWith(fetch(event.request));
  }
  
  // Voor alle andere bestanden (HTML, CSS, JS)
  event.respondWith(
    // Probeer eerst het netwerk (altijd de nieuwste versie)
    fetch(event.request)
      .then(function(response) {
        // Netwerk gelukt? Update de cache met de nieuwe versie.
        return caches.open(CACHE_NAAM).then(function(cache) {
          cache.put(event.request, response.clone());
          return response;
        });
      })
      .catch(function() {
        // Netwerk faalt? (Offline?) Pak het bestand uit de cache.
        return caches.match(event.request);
      })
  );
});