// Adds the cross-origin isolation headers GitHub Pages cannot send, so the multi-threaded
// Stockfish build can use SharedArrayBuffer. Registered at the site root because the chess app's
// workers live in /assets/ and /chess-vendor/, but only pages under /chess/ are made isolated:
// the other apps on this site (which load cross-origin map tiles) are left exactly as they are.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('message', (e) => { if (e.data === 'unregister') self.registration.unregister(); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const scopePath = new URL(self.registration.scope).pathname;
  const isPage = req.mode === 'navigate' || req.destination === 'document';
  if (isPage && !url.pathname.startsWith(`${scopePath}chess/`)) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.status === 0 || res.type === 'opaque') return res;
    const h = new Headers(res.headers);
    h.set('Cross-Origin-Embedder-Policy', 'require-corp');
    if (isPage) h.set('Cross-Origin-Opener-Policy', 'same-origin');
    h.set('Cross-Origin-Resource-Policy', 'same-origin');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  }));
});
