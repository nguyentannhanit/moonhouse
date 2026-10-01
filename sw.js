/* =====================================================================
   Service worker: giữ vỏ app trong máy để mở được khi mất mạng,
   và cache ảnh thumbnail từ Drive để không tải lại. Không bao giờ cache lời gọi Apps Script.
   Đổi số phiên bản CACHE mỗi lần sửa file app để điện thoại tải bản mới.
   ===================================================================== */
const CACHE = 'moonhouse-v10';
const SHELL = ['./', './index.html', './app.css', './app.js', './store.js', './api.js', './sync.js', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

// Cài: tải sẵn vỏ app, luôn lấy thẳng từ máy chủ. GitHub cho trình duyệt giữ file 10 phút; lấy qua chỗ giữ đó
// thì bản cài mới có thể cất nhầm file cũ và kẹt luôn ở bản cũ (đã gặp ở bản 1.5)
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
// Kích hoạt: xóa cache phiên bản cũ
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Lấy: vỏ app → cache trước, mạng sau; ảnh Drive → cache trước; API → luôn mạng
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com')) return;
  const isThumb = url.hostname === 'drive.google.com' && url.pathname.startsWith('/thumbnail');
  const isShell = url.origin === self.location.origin;
  if (!isThumb && !isShell) return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok || res.type === 'opaque') caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() => hit))
  );
});
