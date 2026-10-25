/* اختبار التقارير (5.0.0): يزرع بيانات أسبوعين مباشرة عبر append()/putEntity()
   (بنفس التحقّق اللي بيعدّي عليه الإدخال) ثم يفتح كل تقرير ويصوّره ويطبع أرقاماً
   للمقارنة. التشغيل: ./tests/run.sh reports <مجلد> */
const { chromium } = require('playwright');
const OUT=process.env.OUT+'/',URL='http://localhost:'+process.env.PORT+'/index.html';
(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
  const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,locale:'ar-EG'})).newPage();
  const errs=[];p.on('pageerror',e=>{errs.push(e.message);console.log('PAGEERR',e.message)});
  await p.goto(URL,{waitUntil:'networkidle'}).catch(()=>{});await p.waitForTimeout(1200);
  await p.evaluate(async()=>{
    const t=todayISO(),d=n=>addDays(t,-n);
    const E=[['f1','farm','مزرعة الحاج سعيد'],['f2','farm','مزرعة الشرقاوي'],['m1','merchant','المعلم رضا'],
      ['m2','merchant','صالة الأمانة'],['dr1','driver','عم محمود'],['dr2','driver','سيد التوك'],
      ['r1','route','كفر الشيخ ← العبور',450],['r2','route','بلطيم ← السلام',550],['i1','ice','مصنع النور']];
    for(const [id,type,name,fare] of E)await putEntity({id,type,name,place:'',phone:'',price:type==='ice'?20:0,fare:fare||0,createdAt:new Date().toISOString()});
    const bx=async(date,op,p,driverId)=>append({type:'box',op,date,legs:buildLegs(op,p),params:p,driverId:driverId||null});
    await bx(d(13),'opening_box',{locId:'WH',oIntact:500,oDamaged:0});
    await bx(d(12),'issue_farm',{toId:'f1',count:200,driverId:'dr1'},'dr1');
    await bx(d(10),'issue_farm',{toId:'f2',count:100,driverId:'dr2'},'dr2');
    for(const [n,f,m,bxs,amt,dr] of [[9,'f1','m1',84,26500,'dr1'],[8,'f1','m2',70,21000,'dr2'],[3,'f2','m1',40,12000,'dr1'],[1,'f1','m1',50,15000,'dr1'],[0,'f1','m2',30,9000,'dr2']]){
      const inv=await append({type:'invoice',date:d(n),farmId:f,merchantId:m,driverId:dr,boxes:bxs,amount:amt});
      await syncInvoiceBox(inv,null)}
    await bx(d(7),'return_in',{fromId:'m1',okCount:60,dmgCount:4,driverId:'dr1',dmgReason:'negligence'},'dr1');
    await bx(d(0),'return_in',{fromId:'m2',okCount:25,dmgCount:2,driverId:'dr2',dmgReason:'wear'},'dr2');
    await bx(d(0),'empty_back',{merchantId:'m1',farmId:'f1',count:10,driverId:'dr1'},'dr1');
    await append({type:'collection',date:d(5),merchantId:'m1',amount:20000});
    await append({type:'collection',date:d(0),merchantId:'m2',amount:5000});
    for(const [n,dr,r,f] of [[12,'dr1','r1',450],[10,'dr2','r2',550],[9,'dr1','r1',450],[8,'dr2','r1',450],[6,'dr1','r2',550],[5,'dr1','r1',450],[3,'dr2','r2',550],[1,'dr1','r1',450],[0,'dr2','r1',450]])
      await append({type:'trip',date:d(n),driverId:dr,routeId:r,fare:f});
    await append({type:'driver_advance',date:d(9),driverId:'dr1',amount:300});
    await append({type:'driver_advance',date:d(4),driverId:'dr1',amount:200});
    await append({type:'driver_advance',date:d(2),driverId:'dr2',amount:150});
    await append({type:'driver_payment',date:d(7),driverId:'dr1',amount:500});
    await append({type:'farm_cost',date:d(0),farmId:'f1',cat:'labor',amount:400,note:'عمال'});
    await append({type:'ice_op',date:d(0),factoryId:'i1',farmId:'f1',qty:20,unitPrice:20});
    /* تعديل النهارده على فاتورة قديمة (بنفس طريقة شاشة التعديل: نسخة تحمل replaces) */
    const old=S.ledger.find(e=>e.type==='invoice'&&e.date===d(8));
    const {id,seq,hash,prevHash,createdAt,opId,...rest}=old;
    await append({...rest,amount:22000,replaces:old.id});
  });
  await p.waitForTimeout(500);
  const nav=async t=>{await p.click(`#nav [data-tab="${t}"]`);await p.waitForTimeout(350)};
  const shot=async n=>{await p.waitForTimeout(350);await p.screenshot({path:OUT+n+'.png',fullPage:true})};
  const open=async(k,ent,range,sub)=>{await p.evaluate(([k,ent,range,sub])=>{
      S.tab='rep';S.F.ent=ent||'';if(sub)Object.assign(S.sub,sub);selectRep(k);if(range)setRange(range);else render()},[k,ent,range,sub]);
    await p.waitForTimeout(400)};
  await nav('rep');await shot('r00-gate');
  await open('farmEnt','f1','all',{farmEnt:'stmt'});await shot('r01-farm-box');
  await open('merchEnt','m1','all',{merchEnt:'stmt'});await shot('r02-merch-box');
  await open('daily','','today');await shot('r03-wh-today');
  await open('boxAll','','all');await shot('r04-boxall');
  await open('drv','','',{drvRep:'detail'});await shot('r05-drv-detail');
  await open('drv','','',{drvRep:'sum'});await shot('r06-drv-sum');
  console.log('DRV',JSON.stringify(await p.evaluate(()=>({range:[S.F.from,S.F.to],
    rows:S.D.drivers.map(d=>{const x=drvSpan(S.D.live,d.id,S.F.from,S.F.to);return[d.name,x.open,x.trips,x.trip,x.adv,x.pay,x.close]}),
    allTime:S.D.drivers.map(d=>[d.name,drvSpan(S.D.live,d.id,'','').close,d.balance])}))));
  /* أرقام للمقارنة مع الحساب الأصلي (derive) — لازم يتطابقوا */
  const chk=await p.evaluate(()=>{const ents=S.D.live.filter(e=>e.type==='box'||e.type.startsWith('box_'));
    const out={};for(const id of ['WH','f1','f2','m1','m2']){const B=boxLedger(ents,id,'','');const b=S.D.boxOf(id);
      out[id]={ledger:[B.close.i,B.close.d],derive:[b.intact,b.damaged]}}return out});
  console.log('BOXCHK',JSON.stringify(chk));
  console.log('ERRORS',errs.length);
  if(globalThis.__extra)await globalThis.__extra(p,{open,shot,nav});
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
