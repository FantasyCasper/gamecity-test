/* ===============================
   SERVICE WORKER (Offline Brein)
   =============================== */

const CACHE_NAAM = 'checklist-app-cache-v1';

// Alle bestanden die we in het geheugen willen opslaan
const urlsToCache = [
  '/', // De 'root'
  'index.html',
  'style.css',
  'script.js',
  'manifest.json',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'login/', // De login-map
  'login/index.html',
  'login/login.css',
  'login/login.js'
];

// 1. Installatie: Open de cache en voeg alle bestanden toe
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAAM)
      .then(function(cache) {
        console.log('Cache geopend en bestanden worden toegevoegd');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Activering: Ruim oude caches op (als die er zijn)
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

// 3. Ophalen (Fetch): Probeer eerst het netwerk, als dat faalt, pak uit de cache
self.addEventListener('fetch', function(event) {
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