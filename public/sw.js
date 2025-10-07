const CACHE_NAME = 'ride-hailing-static-v1';
const RUNTIME_CACHE = 'ride-hailing-runtime-v1';
const CORE_ASSETS = [ '/', '/index.html' ];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(CORE_ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => ![CACHE_NAME,RUNTIME_CACHE].includes(k)).map(k => caches.delete(k))))
  );
});

// Stale-while-revalidate for navigations + static; network-first for /api fallback to cache for last rides snapshot
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) {
    // Try network then (optionally) fallback to cached last rides
    e.respondWith(
      fetch(e.request).then(res => {
        if (url.pathname.includes('/api/v1/rides')) {
          const clone = res.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put('last_rides', clone));
        }
        return res;
      }).catch(() => caches.open(RUNTIME_CACHE).then(c => c.match('last_rides') || Promise.reject()))
    );
    return;
  }
  // Static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(networkRes => {
        if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return networkRes;
      }).catch(()=>cached);
      return cached || fetchPromise;
    })
  );
});
