// Basic service worker with manual caching strategies.
// Build step should copy/compile this to /sw.js.
const STATIC_CACHE = 'static-v1';
const RIDE_CACHE = 'rides-v1';
// STATIC_ASSETS may be augmented at build time by a manifest injection step
// e.g. during CI: generate a list of hashed JS/CSS chunks and replace __PRECACHE_MANIFEST__ token.
const PRECACHE_MANIFEST: string[] = (self as any).__PRECACHE_MANIFEST__ || [];
const STATIC_ASSETS = [ '/', '/index.html', ...PRECACHE_MANIFEST ]; // build step may add hashed chunks

self.addEventListener('install', (event: any) => {
  event.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(STATIC_ASSETS))); 
  (self as any).skipWaiting();
  // Notify clients a new SW installed
  (async () => {
    try {
      const clientsList = await (self as any).clients.matchAll({ includeUncontrolled: true, type:'window' });
      for (const c of clientsList) c.postMessage({ type:'SW_INSTALLED' });
    } catch {}
  })();
});

self.addEventListener('activate', (event: any) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => ![STATIC_CACHE,RIDE_CACHE].includes(k)).map(k => caches.delete(k)));
    (self as any).clients.claim();
    // Inform clients activation complete (potential update from previous version)
    try {
      const clientsList = await (self as any).clients.matchAll({ includeUncontrolled: true, type:'window' });
      for (const c of clientsList) c.postMessage({ type:'SW_ACTIVATED' });
    } catch {}
  })());
});

function isAuthMutation(req: Request) {
  return req.url.includes('/auth/') || (req.method !== 'GET' && /\/users\//.test(req.url));
}
function isRidesGet(req: Request) { return req.method === 'GET' && /\/rides(\?|$)/.test(req.url); }

self.addEventListener('fetch', (event: any) => {
  const req: Request = event.request;
  // Bypass SW for cross-origin requests; let the network handle CORS and errors directly.
  try {
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) {
      return; // do not intercept
    }
  } catch {}
  if (isAuthMutation(req)) { // network only
    return; // default network path
  }
  if (isRidesGet(req)) {
    // stale-while-revalidate
    event.respondWith((async () => {
      const cache = await caches.open(RIDE_CACHE);
      const cached = await cache.match(req);
      try {
        const res = await fetch(req);
        if (res && res.ok) { try { cache.put(req, res.clone()); } catch {} }
        return res;
      } catch (e) {
        if (cached) return cached;
        return new Response('Offline', { status: 503 });
      }
    })());
    return;
  }
  if (req.method === 'GET') {
    // cache-first for static
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok && res.headers.get('Content-Type')?.includes('text')) cache.put(req, res.clone());
        return res;
      } catch (e) { return cached || new Response('Offline', { status: 503 }); }
    })());
  }
});

// Version check + update prompt via postMessage
self.addEventListener('message', (event: any) => {
  if (event.data?.type === 'CHECK_VERSION') {
    (async () => {
      const clientsList = await (self as any).clients.matchAll({ includeUncontrolled: true, type:'window' });
      for (const c of clientsList) c.postMessage({ type:'SW_VERSION', staticCache: STATIC_CACHE, rideCache: RIDE_CACHE });
    })();
  }
  if (event.data?.type === 'SKIP_WAITING') (self as any).skipWaiting();
  if (event.data?.type === 'LOGOUT_PURGE') {
    event.waitUntil((async () => {
      try {
        // Purge ride cache and any auth-sensitive caches
        await caches.delete(RIDE_CACHE);
        // Optionally clear static to force revalidation (kept for faster reload)
        // await caches.delete(STATIC_CACHE);
      } catch {}
      // Notify all clients purge is done
      try {
        const clientsList = await (self as any).clients.matchAll({ includeUncontrolled: true, type:'window' });
        for (const c of clientsList) c.postMessage({ type:'PURGE_COMPLETE' });
      } catch {}
    })());
  }
});
