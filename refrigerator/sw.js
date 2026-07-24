// 냉장고 프로젝트 서비스워커 — 설치 가능(PWA) + 앱 셸 캐시
const CACHE = 'fridge-v16';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // 저장/삭제/레시피 등은 항상 네트워크
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;      // API도 항상 네트워크
  e.respondWith(
    fetch(req).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return r;
    }).catch(() => caches.match(req))
  );
});
