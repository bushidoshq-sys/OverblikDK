const CACHE_NAME = 'overblikdk-cache-v2026-09-29-native-back-v24';

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./indstillinger.html",
  "./assets/styles.css?v=22",
  "./assets/address-provider.js?v=16",
  "./assets/address-settings.js?v=16",
  "./assets/location-tools.js?v=23",
  "./assets/regional-sort.js?v=23",
  "./assets/emergency.js?v=10",
  "./assets/favorites.js?v=14",
  "./assets/local-helper.js?v=7",
  "./assets/local-data.js?v=6",
  "./assets/nearby.js?v=17",
  "./assets/pwa-update.js?v=20",
  "./assets/native-navigation.js?v=24",
  "./manifest.json",
  "./icons/logo.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./favicon.png",
  "./offentlige.html",
  "./medier.html",
  "./hospitaler.html",
  "./biblioteker.html",
  "./transport.html",
  "./afgangstavler.html",
  "./noedsituation.html",
  "./uddannelse.html",
  "./banker.html",
  "./kommuner.html",
  "./kultur.html",
  "./sport.html",
  "./forretninger.html",
  "./reklamer.html",
  "./google2b71488ba44ee784.html"
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => {
      if (key !== CACHE_NAME) return caches.delete(key);
    })))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.pathname.endsWith('/assets/theme.js')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
