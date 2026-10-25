const { chromium } = require('playwright');
const OUT = process.env.OUT + '/';
const URL = 'http://localhost:'+process.env.PORT+'/index.html';
const log = (...a) => console.log(...a);
(async () => {
  let browser;
  try { browser = await chromium.launch(); } catch (e) { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar-EG', colorScheme: 'light', hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => log('PAGEERR', e.message));
  await p.goto(URL, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(1500);
  const shot = async (n, full = false) => { await p.waitForTimeout(400); await p.screenshot({ path: OUT + n + '.png', fullPage: full }); log('shot', n); };
  const dlgOk = async () => { await p.waitForTimeout(300); const b = await p.$('#dlg.on [data-r="1"]'); if (b) { log('dialog:', await p.$eval('#dlg h3', e => e.textContent).catch(() => '')); await b.click(); await p.waitForTimeout(400); } };
  const nav = async t => { await p.click(`#nav [data-tab="${t}"]`); await p.waitForTimeout(400); };
  const sub = async (seg, k) => { await p.click(`[data-seg="${seg}"] [data-sub="${k}"]`); await p.waitForTimeout(400); };

  await shot('01-home-empty');
  await shot('01b-home-empty-full', true);

  // seed entities via settings
  await nav('set');
  await shot('02-settings-empty');
  const addEnt = async (t, name, place) => {
    await sub('set', t);
    await p.fill('form[data-form="entity"] input[name="name"]', name);
    if (place && await p.$('form[data-form="entity"] input[name="place"]')) await p.fill('form[data-form="entity"] input[name="place"]', place);
    await p.click('form[data-form="entity"] button[type="submit"]');
    await p.waitForTimeout(500); await dlgOk();
  };
  for (const [n, pl] of [['مزرعة الحاج سعيد', 'كفر الشيخ'], ['مزرعة أولاد عبده', 'بلطيم'], ['مزرعة الشرقاوي', 'الحامول']]) await addEnt('farm', n, pl);
  for (const [n, pl] of [['صالة أبو علي', 'العبور'], ['المعلم رضا', 'السلام'], ['صالة الأمانة', 'طنطا'], ['حسن الفيومي', 'المنصورة']]) await addEnt('merchant', n, pl);
  await addEnt('driver', 'عم محمود'); await addEnt('driver', 'سيد التوك');
  await addEnt('ice', 'مصنع النور', 'كفر الشيخ');
  await shot('03-settings-data', true);

  // invoice
  await nav('ops');
  await shot('04-ops-acct-invoice-blank', true);
  const pickChip = async (name, idx = 0, group) => {
    const box = `.pick[data-name="${name}"]`;
    if (group) { const g = await p.$(`${box} [data-g="${group}"]`); if (g) { await g.click(); await p.waitForTimeout(400); } }
    const chips = await p.$$(`.pick[data-name="${name}"] .pkrow .pchip[data-pv]:not([data-pv=""])`);
    if (chips[idx]) await chips[idx].click(); else log('no chip', name, idx);
    await p.waitForTimeout(250);
  };
  const doInvoice = async (fi, mi, boxes, amt, again, grp) => {
    await pickChip('farmId', fi, grp);
    await pickChip('merchantId', mi);
    await p.fill('form[data-form="invoice"] input[name="boxes"]', String(boxes));
    await pickChip('driverId', 0);
    if (amt) await p.fill('form[data-form="invoice"] input[name="amount"]', String(amt));
  };
  await doInvoice(0, 0, 84, 26500, true, 'new');
  await shot('05-invoice-filled', true);
  await p.click('[data-act="saveAgain"]'); await dlgOk(); await p.waitForTimeout(700);
  await shot('06-invoice-after-saveagain');
  await doInvoice(0, 1, 70, 21000);
  await p.click('form[data-form="invoice"] button[type="submit"]'); await dlgOk(); await p.waitForTimeout(600);
  await doInvoice(1, 2, 40, '', false, 'new');
  await p.click('form[data-form="invoice"] button[type="submit"]'); await dlgOk(); await p.waitForTimeout(600);
  // collection
  await sub('fin', 'collect');
  await pickChip('merchantId', 0);
  await p.fill('form[data-form="collection"] input[name="amount"]', '10000');
  await shot('07-collect-filled', true);
  await p.click('form[data-form="collection"] button[type="submit"]'); await dlgOk(); await p.waitForTimeout(600);
  // box
  await sub('ops', 'box');
  await pickChip('toId', 0);
  await p.fill('form[data-form="box"] input[name="count"]', '100');
  await shot('08-ops-box-issue', true);
  await p.click('form[data-form="box"] button[type="submit"]'); await dlgOk(); await p.waitForTimeout(600);
  await sub('box', 'adj');
  await p.click('[data-act="rare"]').catch(() => {});
  await shot('09-ops-box-adj-rare');
  // home with data
  await nav('home'); await shot('10-home-data');
  await p.click('[data-act="drill"][data-key="attn"]').catch(() => {});
  await p.click('[data-act="drill"][data-key="merch"]').catch(() => {});
  await p.click('[data-act="drill"][data-key="farms"]').catch(() => {});
  await shot('11-home-data-drilled-full', true);
  // fab
  await p.click('#fab'); await shot('12-fab-open'); await p.click('#fabbd').catch(() => {});
  // search
  await p.click('#hsearch'); await p.waitForTimeout(400); await p.keyboard.type('أبو'); await shot('13-search');
  await p.click('#dlg.on button:has-text("إغلاق")').catch(()=>{}); await p.waitForTimeout(300); await p.keyboard.press('Escape');
  // reports
  await nav('rep'); await shot('14-rep-gate', true);
  await p.click('[data-act="repSel"][data-r="bal"]').catch(e => log('rep', e.message));
  await p.waitForTimeout(600); await shot('15-rep-merchAll', true);
  await p.click('[data-act="repSel"][data-r="bal"]').catch(() => {});
  // settlement flow
  await nav('ops'); await sub('ops', 'acct');
  await p.click('[data-act="finGo"][data-s="settle"]'); await p.waitForTimeout(500);
  await shot('16-settle', true);
  // settings security / backup
  await nav('set'); await sub('setg', 'bk'); await shot('17-settings-backup', true);
  // dark mode
  await p.evaluate(() => { document.documentElement.dataset.mode = 'dark'; });
  await nav('home'); await shot('18-dark-home');
  await nav('ops'); await sub('ops', 'acct'); await p.click('[data-act="finGo"][data-s="draft"]').catch(()=>{}); await sub('fin','invoice'); await shot('19-dark-invoice');
  await nav('rep'); await shot('20-dark-rep');
  // contrast/size audit data
  const audit = await p.evaluate(() => {
    const small = []; document.querySelectorAll('button, a, input, select').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.height && (r.height < 44 || r.width < 44)) small.push((el.textContent || el.name || el.className).trim().slice(0, 30) + ` ${Math.round(r.width)}x${Math.round(r.height)}`); });
    const fonts = {}; document.querySelectorAll('#app *').forEach(el => { if (el.childNodes[0] && el.childNodes[0].nodeType === 3 && el.textContent.trim()) { const f = getComputedStyle(el).fontSize; fonts[f] = (fonts[f] || 0) + 1; } });
    return { small: small.slice(0, 40), fonts, ff: getComputedStyle(document.body).fontFamily, fontsOk: document.fonts.check('16px "IBM Plex Sans Arabic"') };
  });
  log(JSON.stringify(audit, null, 1));
  await p.evaluate(() => { document.documentElement.dataset.mode = 'light'; });
  const st = await p.evaluate(() => { const d = derive(S.entities, S.ledger); runTests(); const t = S.diag.rows; return { tests: t.filter(x=>!x.ok).map(x=>x.n), ntests: t.length, merchants: d.merchants.map(m=>[m.name,m.balance]), farms: d.farms.map(f=>[f.name,f.balance]), nledger: S.ledger.length }; });
  log('STATE', JSON.stringify(st));
  // desktop (same context, keeps data)
  await p.setViewportSize({width:1280,height:800});
  await nav('home'); await shot('21-desktop-home');
  await nav('rep'); await p.click('[data-act="repSel"][data-r="bal"]').catch(()=>{}); await shot('22-desktop-rep');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
