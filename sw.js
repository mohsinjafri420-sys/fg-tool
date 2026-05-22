// Service worker for the Flight Sim Generator PWA.
// Strategy: cache-first for static assets and CDN libraries (Globe.gl, Tabler Icons),
// network-only for API calls (Gemini, Planespotters), so research data is never stale.

const CACHE_VERSION = 'fg-v1';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Files we precache at install time. Paths are relative to where sw.js is served,
// which on GitHub Pages will be the repo root (https://username.github.io/repo/).
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// Hostnames whose responses should NEVER be cached — they're real-time API data.
const NEVER_CACHE_HOSTS = [
  'generativelanguage.googleapis.com',  // Gemini
  'api.planespotters.net',              // Planespotters photos (if you re-add them)
  'aviationweather.gov'                 // Reserved for future METAR support
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      // Catch errors so a single missing file doesn't block install
      cache.addAll(STATIC_ASSETS).catch(err => console.warn('Pre-cache partial fail:', err))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET (POSTs to Gemini etc.)
  if (event.request.method !== 'GET') return;

  // Skip API hosts — always go to network
  if (NEVER_CACHE_HOSTS.some(h => url.hostname.includes(h))) return;

  // Stale-while-revalidate for everything else:
  // 1. Return cached version immediately if we have one
  // 2. Always also fetch in background to refresh the cache
  // 3. If we have nothing cached and we're offline, fall back to index.html
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(resp => {
        if (resp && resp.status === 200 && resp.type !== 'opaqueredirect') {
          const clone = resp.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(event.request, clone)).catch(() => {});
        }
        return resp;
      }).catch(() => null);

      return cached || networkFetch || caches.match('./index.html');
    })
  );
});
