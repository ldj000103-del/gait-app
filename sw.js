// 오프라인에서도 열리도록 앱 파일 저장 (파일을 고치면 VERSION을 올리기)
const VERSION = 'v27';
const FILES = ['./', 'index.html', 'app.js', 'gait.js', 'video.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'privacy.html'];
// 새 버전은 기다리지 않고 바로 적용 (앱을 완전히 끄지 않아도 옛 화면이 남지 않게)
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
  .then(() => self.clients.claim())));
// 항상 사이트에 최신인지 먼저 확인(no-cache), 인터넷이 없을 때만 저장본
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).catch(() => caches.match(e.request)));
});
