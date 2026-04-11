/**
 * Mumo Syntax & Capital POS - Service Worker
 * Provides offline capability for menu, auth, and static assets.
 */

const CACHE_NAME = 'mumo-pos-v1';
const STATIC_CACHE = 'mumo-static-v1';
const API_CACHE = 'mumo-api-v1';

// Static assets to pre-cache at install time
const PRECACHE_URLS = [
  '/',
  '/index.html',
];

// ── Install: pre-cache shell ────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![CACHE_NAME, STATIC_CACHE, API_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for API, cache-first for static assets ────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API routes: NetworkFirst with 5s timeout fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      networkFirstWithTimeout(request, API_CACHE, 5000)
    );
    return;
  }

  // Static assets (JS, CSS, images): CacheFirst
  if (/\.(js|css|png|jpg|svg|woff2|ico)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML navigation: NetworkFirst, fall back to /index.html (SPA shell)
  event.respondWith(
    fetch(request).catch(() =>
      caches.match('/index.html')
    )
  );
});

// ── Helpers ────────────────────────────────────────────────────────────────
async function networkFirstWithTimeout(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeout);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    clearTimeout(timeout);
    const cached = await cache.match(request);
    return cached || new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}
