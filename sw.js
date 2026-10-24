// 오프라인에서도 열리도록 앱 파일 저장 (파일을 고치면 VERSION을 올리기)
const VERSION = 'v11';
const FILES = ['./', 'index.html', 'app.js', 'gait.js', 'manifest.webmanifest', 'icon.svg', 'privacy.html'];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))));
self.addEventListener('fetch', e => e.respondWith(fetch(e.request).catch(() => caches.match(e.request))));
