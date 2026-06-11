// Service worker for the Flight Sim Generator PWA.
// Strategy: cache-first for static assets and CDN libraries (Globe.gl, Tabler Icons),
// network-only for API calls (Gemini, etc.), so research data is never stale.

const CACHE_VERSION = 'fg-v6';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Files precached at install time. Paths are relative to where sw.js is served,
// which on GitHub Pages will be https://username.github.io/repo/.
const STATIC_ASSETS = [
  './app.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// Hostnames whose responses should NEVER be cached — real-time API data.
const NEVER_CACHE_HOSTS = [
  'generativelanguage.googleapis.com',  // Gemini
  'api.planespotters.net',              // Planespotters (reserved for future)
  'aviationweather.gov'                 // Reserved for future METAR support
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
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
  if (event.request.method !== 'GET') return;
  if (NEVER_CACHE_HOSTS.some(h => url.hostname.includes(h))) return;

  // Stale-while-revalidate: return cached if available, also refresh in background.
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(resp => {
        if (resp && resp.status === 200 && resp.type !== 'opaqueredirect') {
          const clone = resp.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(event.request, clone)).catch(() => {});
        }
        return resp;
      }).catch(() => null);

      return cached || networkFetch || caches.match('./app.html');
    })
  );
});
