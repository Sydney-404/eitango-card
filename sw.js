// オフラインで使うための保存係（Service Worker）。
// アプリの部品を端末に保存しておき、通信できないときは保存してあるものを出す。
// 部品を足したら APP_FILES に加え、CACHE の番号を上げる
const CACHE = 'eitango-v1';
const APP_FILES = [
  './',
  'index.html',
  'css/style.css',
  'js/ui.js',
  'js/store.js',
  'js/importer.js',
  'js/filter.js',
  'js/list.js',
  'js/card.js',
  'js/quiz.js',
  'js/manage.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

// 古い番号の保存を消す
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 通信できれば最新を取りに行き、保存も新しくする。できなければ保存してあるものを出す
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then(hit => hit || Promise.reject(new Error('offline')))),
  );
});
