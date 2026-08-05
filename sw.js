/* ===========================================================
   دفتر السماكة — عامل الخدمة (Service Worker)

   الهدف: التطبيق يفتح ويشتغل كامل بدون إنترنت بعد أول زيارة.
   ملاحظة مهمة: بيانات المستخدم ليست هنا — هي في IndexedDB داخل
   المتصفح. هذا الملف يخزّن ملفات التطبيق فقط (HTML/أيقونات).
   تفريغ الكاش لا يمسح أي بيانات.

   عند تعديل أي ملف: غيّر رقم النسخة في VERSION حتى يأخذ
   المستخدمون التحديث بدل النسخة القديمة المخزَّنة.
   =========================================================== */
const VERSION = 'v4.5.2';
const CACHE   = 'fish-ledger-' + VERSION;
const FONTS   = 'fish-ledger-fonts';   // ثابت: الخطوط لا تتغيّر مع نسخ التطبيق

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './maskable-512.png'
];

/* التثبيت: نخزّن ملفات التطبيق */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* التفعيل: نمسح النسخ القديمة من الكاش فقط */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('fish-ledger-') && k !== CACHE && k !== FONTS)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* الجلب:
   - صفحات التصفّح: الشبكة أولاً (لالتقاط التحديث)، والكاش احتياطي عند انقطاع النت.
   - باقي الملفات: الكاش أولاً (أسرع وأضمن في السوق بشبكة ضعيفة). */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* خطوط Google: نخزّنها أول مرة فيعمل التطبيق بخطّه بدون إنترنت بعدها */
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONTS).then(c =>
        c.match(req).then(hit => hit || fetch(req).then(res => {
          if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
          return res;
        }).catch(() => hit))
      )
    );
    return;
  }

  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});

/* تحديث فوري عند طلب الصفحة */
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
