// オフラインで使うための保存係（Service Worker）。
// アプリの部品を端末に保存しておき、通信できないときは保存してあるものを出す。
// 部品を足したら APP_FILES に加える。公開するたびに CACHE の番号を上げる
// （sw.js が変わると端末が新しい版に気づき、開いているアプリが読み直される）
const CACHE = 'eitango-v7';
const APP_FILES = [
  './',
  'index.html',
  'css/style.css',
  'js/ui.js',
  'js/store.js',
  'js/sound.js',
  'js/review.js',
  'js/importer.js',
  'js/filter.js',
  'js/list.js',
  'js/card.js',
  'js/quiz.js',
  'js/summary.js',
  'js/manage.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
  'sound/shu.mp3',
  'sound/maru.wav',
  'sound/batsu.wav',
  'sound/pon.mp3',
  'sound/kachi.wav',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
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

// 通信できれば最新を取りに行き、保存も新しくする。できなければ保存してあるものを出す。
// 同じサイトのファイルは、ブラウザの控え（GitHub Pages は10分ほど持たせる）を使わず、毎回変わっていないか問い合わせる
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const sameOrigin = new URL(e.request.url).origin === self.location.origin;
  // ページを開く読み込み（navigate）の Request には指定を足せないので、同じサイトは URL で取り直す
  e.respondWith(
    (sameOrigin ? fetch(e.request.url, { cache: 'no-cache' }) : fetch(e.request))
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
