/* ===========================================================
   دفتر السماكة — عامل الخدمة (Service Worker)

   الهدف: التطبيق يفتح ويشتغل كامل بدون إنترنت بعد أول زيارة.
   ملاحظة مهمة: بيانات المستخدم ليست هنا — هي في IndexedDB داخل
   المتصفح. هذا الملف يخزّن ملفات التطبيق فقط (HTML/أيقونات).
   تفريغ الكاش لا يمسح أي بيانات.

   عند تعديل أي ملف: غيّر رقم النسخة في VERSION حتى يأخذ
   المستخدمون التحديث بدل النسخة القديمة المخزَّنة.
   =========================================================== */
const VERSION = 'v4.12.0';
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

/* التثبيت: نخزّن ملفات التطبيق.

   cache:'reload' مهمة: GitHub Pages بيبعت Cache-Control بمدة صلاحية، فكاش
   المتصفح (غير كاش عامل الخدمة ده) ممكن يرجّع index.html القديم لـaddAll —
   فالنسخة الجديدة تخزّن الملف القديم وتفضل تعرضه رغم إن السيرفر عليه الجديد.
   دي كانت أشهر حالة «التطبيق مش بيقبل التحديث».

   وكمان بنخزّن كل ملف لوحده بدل addAll: لو ملف واحد فشل (أيقونة ناقصة مثلاً)
   addAll بتفشل التثبيت كله فيفضل عامل الخدمة القديم شغّالاً ولا يحصل تحديث أبداً. */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.all(ASSETS.map(u =>
      fetch(new Request(u, { cache: 'reload' }))
        .then(r => (r && r.ok) ? c.put(u, r) : null)
        .catch(() => null)
    ))).then(() => self.skipWaiting())
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
    /* باج مهم: قبل كده كنا نخزّن ردّ **أي** تصفّح مكان './index.html'. يعني لو فتحت
       ملفاً تانياً في تبويب (زي sw.js وأنت بتفحص النسخة) بيتكتب كوده مكان الصفحة
       المخزَّنة — فالتطبيق يفتح أوفلاين على كود بدل الشاشة. دلوقتي بنخزّن الصفحة
       الرئيسية وحدها، وأي تصفّح تاني يعدّي للمتصفح عادي بلا اعتراض. */
    const isApp = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
    if (!isApp) return;
    /* نطلبه بالرابط نصّاً مع cache:'reload' علشان نتخطّى كاش المتصفح كمان،
       مش كاش عامل الخدمة بس — الشبكة أولاً تبقى شبكة فعلاً. */
    e.respondWith(
      fetch(req.url, { cache: 'reload' })
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  /* طلبات فيها ?query = طلبات فحص متعمَّدة (فحص السيرفر / إعادة تحميل ببصمة وقت)
     — تعدّي للشبكة مباشرة ولا تتخزّن، وإلا امتلأ الكاش بنسخ بتواريخ لا تُستعمل. */
  if (url.search) return;

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

/* تحديث فوري عند طلب الصفحة · والردّ برقم النسخة لفحص «إيه النسخة الشغّالة فعلاً» */
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  if (e.data === 'version' && e.ports && e.ports[0]) e.ports[0].postMessage(VERSION);
});
