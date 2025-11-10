/* ===============================
   SERVICE WORKER (BIJGEWERKT)
   =============================== */

// STAP 1: DE NAAM IS VERANDERD (bv. v1 -> v2)
const CACHE_NAAM = 'checklist-app-cache-v2';

// STAP 2: DE LIJST IS BIJGEWERKT MET DE ADMIN-BESTANDEN
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
  
  // -- NIEUWE REGELS --
  'admin/admin.html',
  'admin/admin.css',
  'admin/admin.js'
];

// 1. Installatie
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAAM)
      .then(function(cache) {
        console.log('Cache geopend en bestanden worden toegevoegd');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Activering (Ruimt oude caches op met een ANDERE naam)
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          // Verwijder alle caches die beginnen met 'checklist-app-cache-'
          // maar NIET de allernieuwste zijn
          return cacheName.startsWith('checklist-app-cache-') && 
                 cacheName !== CACHE_NAAM;
        }).map(function(cacheName) {
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
    // Probeer het netwerk, en doe niets als het faalt (de 'catch' in de app vangt dit op)
    return event.respondWith(fetch(event.request));
  }
  
  // Voor alle andere bestanden (HTML, CSS, JS)
  event.respondWith(
    // Probeer eerst het netwerk (altijd de nieuwste versie)
    fetch(event.request)
      .then(function(response) {
        // Netwerk gelukt? Goed zo. Update de cache met de nieuwe versie.
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