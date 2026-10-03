const CACHE_NAME = 'overblikdk-cache-v2026-10-03-settings-return-v184';

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./indstillinger",
  "./assets/styles.css?v=62",
  "./assets/theme.js?v=94",
  "./assets/address-provider.js?v=29",
  "./assets/manual-location.js?v=30",
  "./assets/home-address.js?v=1",
  "./assets/location-tools.js?v=51",
  "./assets/regional-sort.js?v=34",
  "./assets/emergency.js?v=55",
  "./assets/favorites.js?v=16",
  "./assets/local-helper.js?v=27",
  "./assets/local-data.js?v=6",
  "./assets/nearby.js?v=40",
  "./assets/pwa-update.js?v=99",
  "./assets/native-navigation.js?v=26",
  "./manifest.json",
  "./icons/logo.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./favicon.png",
  "./offentlige",
  "./medier",
  "./hospitaler",
  "./biblioteker",
  "./transport",
  "./afgangstavler",
  "./noedsituation",
  "./uddannelse",
  "./banker",
  "./kommuner",
  "./kultur",
  "./sport",
  "./forretninger",
  "./reklamer",
  "./omregner",
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
  if (
    url.pathname.endsWith('/assets/pwa-update.js') ||
    url.pathname.endsWith('/assets/emergency.js') ||
    url.pathname.endsWith('/assets/theme.js') ||
    url.pathname.endsWith('/assets/native-navigation.js') ||
    url.pathname.endsWith('/assets/location-tools.js') ||
    url.pathname.endsWith('/assets/regional-sort.js') ||
    url.pathname.endsWith('/assets/address-provider.js') ||
    url.pathname.endsWith('/assets/manual-location.js') ||
    url.pathname.endsWith('/assets/home-address.js') ||
    url.pathname.endsWith('/assets/nearby.js') ||
    url.pathname.endsWith('/assets/address-provider.js') ||
    url.pathname.endsWith('/assets/manual-location.js') ||
    url.pathname.endsWith('/assets/nearby.js')
  ) {
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
