// 오프라인에서도 열리도록 앱 파일 저장 (파일을 고치면 VERSION을 올리기)
const VERSION = 'v207';
const FILES = ['./', 'index.html', 'app.js', 'gait.js', 'video.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'privacy.html', 'location-terms.html',
  ...['side', 'front', 'back'].flatMap(v => ['pelvis', 'femur', 'shank', 'foot'].map(p => `assets/bones/${v}-${p}.webp`)),
  ...Array.from({ length: 50 }, (_, i) => `assets/muscle/m${String(i).padStart(2, '0')}.webp`)];   // 걸음 수업 근육 그림 50장(약 640KB)도 오프라인에서   // 걸음걸이 탭 뼈 그림 12장(약 39KB)도 오프라인에서 보이게
// 새 버전은 기다리지 않고 바로 적용 (앱을 완전히 끄지 않아도 옛 화면이 남지 않게)
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== 'ex3d').map(k => caches.delete(k))))   // ex3d = 열어 본 운동 그림·3D 파일 (app.js exCache)
  .then(() => self.clients.claim())));
// 항상 사이트에 최신인지 먼저 확인(no-cache), 인터넷이 없을 때만 저장본
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;   // 카카오 지도 등 다른 사이트 파일은 건드리지 않음
  // 페이지 열기(navigate) 요청은 옵션을 붙여 다시 만들 수 없어서 주소로 요청 (안 그러면 늘 실패 → 옛 저장본이 뜸)
  const req = e.request.mode === 'navigate' ? e.request.url : e.request;
  e.respondWith(fetch(req, { cache: 'no-cache' }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
