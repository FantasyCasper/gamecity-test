/* ===============================
   SERVICE WORKER (GOOGLE SCRIPT VERSIE)
   =============================== */

const CACHE_NAAM = 'checklist-app-cache-v1-googlesheet'; // Nieuwe naam om update te forceren

// Alle paden zijn nu relatief
const urlsToCache = [
  '.', // De 'root' van waar de app start
  'index.html',
  'style.css',
  'script.js',
  'manifest.json',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'login/', 
  'login/index.html',
  'login/login.css',
  'login/login.js'
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

// 2. Activering (Ruimt oude caches op)
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          return cacheName.startsWith('checklist-app-cache-') && cacheName !== CACHE_NAAM;
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
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Netwerk gelukt? Goed zo.
        return response;
      })
      .catch(function() {
        // Netwerk faalt? (Offline?) Pak het bestand uit de cache.
        return caches.match(event.request);
      })
  );
});