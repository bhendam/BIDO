/* سويت docver — تفحص أن الوثيقة تطابق الكود فعلاً، لا أن الكود يعمل.
   تكمّل `ver` (التي تفحص أرقام النسخة وحدها). */
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const doc=fs.readFileSync('HANDOVER.md','utf8');
const R=[];const ok=(n,c,extra)=>R.push({n,ok:!!c,extra});

/* ١) أرقام النسخة الثلاثة */
const appver=(html.match(/APPVER\s*=\s*"([^"]+)"/)||[])[1];
const swver=(sw.match(/VERSION\s*=\s*'v?([^']+)'/)||[])[1];
const docver=(doc.match(/APPVER = ([0-9.]+)/)||[])[1];
ok('APPVER = sw VERSION', appver===swver, appver+' / '+swver);
ok('APPVER = نسخة الوثيقة', appver===docver, appver+' / '+docver);

/* ٢) كل نوع حركة في SCHEMA موثّق في §٣.٣ وفي §٣.٤ */
const schemaBlock=html.slice(html.indexOf('const SCHEMA='),html.indexOf('/* الفاتورة غير مذكورة'));
const types=[...schemaBlock.matchAll(/(\w+):\s*\[/g)].map(m=>m[1]);
const docSchema=doc.slice(doc.indexOf('const SCHEMA = {'),doc.indexOf('`validate()` تعمل'));
types.forEach(t=>ok('§٣.٣ يوثّق النوع '+t, docSchema.includes(t+':')));
['farm_cost','farm_day_close'].forEach(t=>ok('§٣.٤ يوثّق حقول '+t, doc.includes('| `'+t+'` |')));

/* ٣) POSF */
const posf=html.slice(html.indexOf('const POSF='),html.indexOf('function validate'));
[...posf.matchAll(/(\w+):\[/g)].map(m=>m[1])
  .forEach(t=>ok('§٣.٣ يوثّق POSF لـ'+t, docSchema.includes(t+':[')||docSchema.includes(t+':[\'amount\'')||docSchema.includes(t)));

/* ٤) عدد اختبارات derive */
const rt=html.slice(html.indexOf('function runTests()'),html.indexOf('اختبار ناجح'));
const nTests=(rt.match(/\bok\(/g)||[]).length;
/* لا نثبّت الرقم — تثبيته يعني أن حساباً جديداً يدخل بلا اختبار. نقرأه من
   الكود، ونتحقّق أن §٩ وحدها تذكره وأن باقي المواضع تحيل إليها. */
const AR=n=>String(n).replace(/[0-9]/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);
ok('عدد اختبارات derive لا ينقص', nTests>=71, nTests);
ok('§٩ تذكر العدد الصحيح', doc.includes('**'+AR(nTests)+' اختباراً** داخل التطبيق'), nTests);
ok('§٢.٤ تحيل ولا تعدّ', doc.includes('عددها في §٩ وحدها')
   && !/عليها \*\*[٠-٩]+ اختبار/.test(doc));
ok('§٥.٧ تحيل ولا تعدّ', doc.includes('لدالة `derive` (العدد في §٩)'));
ok('§٦ تحيل ولا تعدّ', doc.includes('اختباراتها تعمل بلا متصفح'));
/* «٦٢» مسموحة في جدول دروس §٨.٤ وحده (ذكر تاريخي للخطأ نفسه) */
const stale=doc.split('\n').filter(l=>l.includes('٦٢ اختبار')&&!l.includes('رقم منسوخ'));
ok('لا «٦٢ اختباراً» خارج جدول الدروس', stale.length===0, stale.join(' | '));

/* ٥) الأيقونات */
const icons=[...html.matchAll(/symbol id="i-([a-z0-9]+)"/g)].map(m=>m[1]);
ok('عدد الأيقونات = ٣١', icons.length===31, icons.length);
ok('الوثيقة تذكر العدد', doc.includes('**'+AR(icons.length)+' أيقونة**'));
ok('كل أيقونة مذكورة في القائمة', icons.every(i=>doc.includes(i)),
   icons.filter(i=>!doc.includes(i)).join(','));

/* ٦) عدد الأسطر وحجم الملف */
/* الرقم المتغيّر في موضع واحد: الترويسة وحدها تحمل عدد الأسطر، و§٧ تحيل إليها.
   فنفحص وجوده في الترويسة و**غيابه** في §٧ — لا نكرّر الرقم في مكانين. */
const lines=html.split('\n').length-1;
ok('عدد الأسطر في الترويسة صحيح', doc.includes(String(lines)+' سطر في `index.html`'), lines);
ok('§٧ تحيل ولا تكرّر الرقم', doc.includes('ملف واحد (عدد الأسطر في ترويسة الوثيقة)')
   && !/[٠-٩]+ سطر في ملف واحد/.test(doc), lines);

/* ٧) costIds موثّق */
ok('costIds في حقول settlement', /settlement`.*costIds\[\]/.test(doc));
ok('قاعدة ٤.١٠ موجودة', doc.includes("### ٤.١٠ مصاريف المزرعة"));

/* ٨) سجل الدفعات محدَّث */
ok('سجل الدفعات فيه سطر التصحيح', doc.includes('4.24.0-doc'));

const bad=R.filter(x=>!x.ok);
R.forEach(x=>{if(!x.ok)console.log('✗ '+x.n+(x.extra!==undefined?'  ['+x.extra+']':''))});
console.log(`docver: ${R.length-bad.length}/${R.length}`);
process.exit(bad.length?1:0);
