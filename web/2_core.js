/* =====================================================================
   Reroute Agro — web app. All data comes from the FastAPI server.
   ===================================================================== */
const MON = 40, DAY = 864e5;
const CROPS = {
  tomato:{n:'টমেটো',i:'🍅',c:'#FDE1DB'}, brinjal:{n:'বেগুন',i:'🍆',c:'#ECE1F6'}, chili:{n:'কাঁচা মরিচ',i:'🌶️',c:'#DFF1DA'},
  cucumber:{n:'শসা',i:'🥒',c:'#E3F3DF'}, carrot:{n:'গাজর',i:'🥕',c:'#FDE8D4'}, onion:{n:'পেঁয়াজ',i:'🧅',c:'#F6E0E8'}, potato:{n:'আলু',i:'🥔',c:'#F2E8D8'}
};
const PLACES = {
  rajshahi:{n:'রাজশাহী',lat:24.37,lon:88.60}, natore:{n:'নাটোর',lat:24.42,lon:89.00}, naogaon:{n:'নওগাঁ',lat:24.80,lon:88.94},
  chapai:{n:'চাঁপাইনবাবগঞ্জ',lat:24.60,lon:88.27}, bogura:{n:'বগুড়া',lat:24.85,lon:89.37}, dhaka:{n:'ঢাকা',lat:23.81,lon:90.41}
};
/* সবজির বাজারদর: ডেমো অনুমান (আসল ডেটা নয়)। পাইলটে কৃষি বিপণন অধিদপ্তরের দৈনিক দাম বসবে। */
const MARKET_DEMO = {
  rajshahi:{tomato:24,brinjal:17,chili:42,cucumber:16,carrot:20,onion:35,potato:13},
  natore:{tomato:26,brinjal:18,chili:44,cucumber:17,carrot:21,onion:35,potato:14},
  naogaon:{tomato:26,brinjal:18,chili:42,cucumber:16,carrot:21,onion:36,potato:14},
  chapai:{tomato:25,brinjal:17,chili:41,cucumber:16,carrot:20,onion:36,potato:13},
  bogura:{tomato:29,brinjal:20,chili:47,cucumber:19,carrot:23,onion:38,potato:15},
  dhaka:{tomato:34,brinjal:24,chili:53,cucumber:21,carrot:29,onion:44,potato:19}
};
const OFFER_ST = {pending:['উত্তরের অপেক্ষা','p-gold'],countered:['পাল্টা দাম এসেছে','p-blue'],accepted:['গৃহীত','p-green'],rejected:['প্রত্যাখ্যাত','p-red'],expired:['মেয়াদ শেষ','p-grey'],cancelled:['বাতিল','p-grey']};
const ORDER_ST = {awaiting_payment:['পেমেন্ট বাকি','p-gold'],confirmed:['অর্ডার নিশ্চিত','p-blue'],handed_over:['মাল হস্তান্তর হয়েছে','p-blue'],completed:['সম্পূর্ণ','p-green'],cancelled:['বাতিল','p-red']};
const BOOK_ST = {awaiting_payment:['পেমেন্ট বাকি','p-gold'],requested:['বুকিং অনুরোধ','p-gold'],confirmed:['বুকিং নিশ্চিত','p-blue'],pickup_scheduled:['মাল তোলার সময় ঠিক','p-blue'],in_transit:['পথে আছে','p-blue'],delivered:['পৌঁছে গেছে','p-green'],cancelled:['বাতিল','p-red']};
const INSP_ST = {requested:['অনুরোধ','p-gold'],scheduled:['সময় ঠিক','p-blue'],done:['দেখা হয়েছে','p-green'],declined:['রাজি হননি','p-red'],cancelled:['বাতিল','p-grey']};
const ORDER_STEPS = ['অফার','বিক্রেতা রাজি','পেমেন্ট ও অর্ডার নিশ্চিত','মাল হস্তান্তর','সম্পূর্ণ'];
const ORDER_IDX = {awaiting_payment:1,confirmed:2,handed_over:3,completed:4};
const BOOK_STEPS = ['বুকিং অনুরোধ','বুকিং নিশ্চিত','মাল তোলার সময়','পথে','পৌঁছেছে'];
const BOOK_IDX = {requested:0,confirmed:1,pickup_scheduled:2,in_transit:3,delivered:4};

/* ---------- formatting ---------- */
const $ = s => document.querySelector(s);
const nf = (n,d=0) => Number(n||0).toLocaleString(langLocale(),{maximumFractionDigits:d});
const tk = (n,d=0) => '৳' + nf(n,d);
const bd = x => isEn()?enDigits(x):String(x).replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[d]);
const monTxt = kg => isEn()?`${nf(kg/MON,1)} maund`:`${nf(kg/MON,1)} মণ`;
const kgMon = kg => isEn()?`${nf(kg/MON,1)} maund (${nf(kg)} kg)`:`${nf(kg/MON,1)} মণ (${nf(kg)} কেজি)`;
const MONTHS_BN = ['জানু','ফেব্রু','মার্চ','এপ্রি','মে','জুন','জুলা','আগ','সেপ্টে','অক্টো','নভে','ডিসে'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS = MONTHS_BN;
const dateBn = t => { const d=new Date(t), m=isEn()?MONTHS_EN:MONTHS_BN; return `${bd(d.getDate())} ${m[d.getMonth()]}`; };
function ago(t){ const m=Math.round((Date.now()-t)/6e4); if(m<60) return isEn()?`${nf(Math.max(1,m))} min ago`:`${nf(Math.max(1,m))} মিনিট আগে`; const h=Math.round(m/60); if(h<24) return isEn()?`${nf(h)} hr ago`:`${nf(h)} ঘণ্টা আগে`; const d=Math.round(h/24); return d<30?(isEn()?`${nf(d)} days ago`:`${nf(d)} দিন আগে`):(isEn()?`${nf(Math.round(d/30))} months ago`:`${nf(Math.round(d/30))} মাস আগে`); }
const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pill = ([t,c]) => `<span class="pill ${c}">${t}</span>`;

const ILL = {
  crate: '<ellipse class="e-sh" cx="36" cy="62" rx="25" ry="4"/><path class="e-fill" d="M13 31h46l-4 27H17z"/><path d="M13 31h46l-4 27H17z"/><path d="M16 40h40M17 49h38M26 31v27M36 31v27M46 31v27"/><path class="e-green" d="M37 31c0-9 6-15 15-15-1 9-6 14-15 15zM37 31c-1-6-5-10-11-11"/>',
  truck: '<ellipse class="e-sh" cx="36" cy="61" rx="29" ry="3.5"/><rect class="e-fill" x="8" y="22" width="35" height="27" rx="3"/><path d="M8 25a3 3 0 0 1 3-3h29a3 3 0 0 1 3 3v24H8zM43 31h10l8 9v9H43zM47 35h5l5 6H47z"/><circle class="e-hole" cx="20" cy="51" r="5.5"/><circle class="e-hole" cx="51" cy="51" r="5.5"/><path d="M1 30h4M2 37h4"/>',
  search: '<path class="e-green" d="M8 60h56M15 52h42M22 44h28"/><circle class="e-fill" cx="41" cy="24" r="12"/><circle cx="41" cy="24" r="12"/><path d="M49.5 32.5l9 9"/>',
  sprout: '<path d="M14 58h44"/><path class="e-sh" d="M22 58c3-5 9-7 14-7s11 2 14 7z"/><path d="M36 52V31"/><path class="e-fill" d="M36 41c-10 0-16-6-16-15 9 0 16 5 16 15zM36 35c0-10 6-17 16-17 0 10-6 17-16 17z"/><path d="M36 41c-10 0-16-6-16-15 9 0 16 5 16 15zM36 35c0-10 6-17 16-17 0 10-6 17-16 17z"/>',
  receipt: '<path class="e-fill" d="M20 11h32v47l-5-4-5 4-5-4-5 4-5-4-5 4-2-1.5z"/><path d="M20 11h32v47l-5-4-5 4-5-4-5 4-5-4-5 4-2-1.5zM27 23h18M27 31h18M27 39h10"/>'
};

function emptyState(ill, title, sub='', extra='', small=false){
  return `<div class="empty-st${small?' sm':''}"><svg viewBox="0 0 72 72" aria-hidden="true">${ILL[ill]}</svg><h3>${title}</h3>${sub?`<p>${sub}</p>`:''}${extra}</div>`;
}

function curTheme(){ return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'); }

function themeBtn(){
  const dark=curTheme()==='dark';
  const label=dark?(isEn()?'Light mode':'লাইট মোড'):(isEn()?'Dark mode':'ডার্ক মোড');
  return `<button class="iconbtn" data-act="theme" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" aria-hidden="true">${dark
    ?'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'
    :'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'}</svg></button>`;
}

function skeleton(kind){
  const head='<div class="sk sk-title"></div><div class="sk sk-line"></div>';
  const body=kind==='cards'?`<div class="lgrid">${'<div class="sk sk-card"></div>'.repeat(6)}</div>`:'<div class="sk sk-block"></div><div class="sk sk-block"></div>';
  return `<div class="sk-wrap" role="status" aria-busy="true"><span class="sr-only">${isEn()?'Loading...':'লোড হচ্ছে...'}</span>${head}${body}</div>`;
}

/* ---------- state from the server ---------- */
let S = {users:[],listings:[],trucks:[],me:null,notifs:[]}, TOKEN=null, lastJSON='', FD=null;
try{ TOKEN = localStorage.getItem('reroute-token'); }catch(e){}
function setToken(t){ TOKEN=t; try{ t?localStorage.setItem('reroute-token',t):localStorage.removeItem('reroute-token'); }catch(e){} }

async function api(path, method='GET', body){
  let r, data=null;
  try{
    r = await fetch('/api'+path,{method,headers:{'Content-Type':'application/json',...(TOKEN?{'X-Token':TOKEN}:{})},body:body?JSON.stringify(body):undefined});
    try{ data=await r.json(); }catch(e){}
  }
  catch(e){
    toast('সার্ভারের সাথে যোগাযোগ হচ্ছে না, একটু পরে চেষ্টা করুন');
    throw e;
  }

  if(r.status===401){ setToken(null); }

  if(!r.ok){
    const d=data&&data.detail;
    toast(typeof d==='string'?d:(Array.isArray(d)?'তথ্য ঠিকভাবে দিন':'কাজটি হয়নি, আবার চেষ্টা করুন'));
    throw new Error(d);
  }

  return data;
}

async function load(){
  const s = await api('/state');
  const j=JSON.stringify(s), changed=j!==lastJSON;
  lastJSON=j;

  if(!s.me && TOKEN) setToken(null);

  const before=new Set((S.notifs||[]).filter(n=>!n.read).map(n=>n.id));
  S = s;

  const fresh=(s.notifs||[]).filter(n=>!n.read && !before.has(n.id));

  return {changed, fresh};
}

const me = () => S.me;
const isTrader = () => S.me && S.me.role!=='admin';

const user = id =>
  (S.users||[]).find(u=>u.id===id)
  || ((S.admin&&S.admin.users)||[]).find(u=>u.id===id)
  || (S.me&&S.me.id===id?S.me:null)
  || {id,name:'অজানা',role:'farmer',place:'rajshahi'};

const listing = id => (S.listings||[]).find(l=>l.id===id);
const dispName = u => u.role==='paikar' ? u.biz : u.name;
const roleBn = r => (isEn()?{farmer:'Farmer',paikar:'Wholesaler',admin:'Operations Team'}:{farmer:'কৃষক',paikar:'পাইকার',admin:'অপারেশন টিম'})[r];

/* ---------- small UI pieces ---------- */

let tT;

function toast(m){
  const t=$('#toast');
  t.textContent=isEn()?translateBnText(m):m;
  t.classList.add('on');
  clearTimeout(tT);
  tT=setTimeout(()=>t.classList.remove('on'),3000);
}

function say(text){
  try{
    const spoken=isEn()?translateBnText(text):text;
    const code=isEn()?'en':'bn';
    const v=speechSynthesis.getVoices().find(v=>(v.lang||'').toLowerCase().startsWith(code));

    if(v){
      const u=new SpeechSynthesisUtterance(spoken);
      u.voice=v;
      u.lang=v.lang;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }
    else{
      toast('🔊 '+spoken.slice(0,90));
    }
  }
  catch(e){}
}

function avatar(u,lg){
  return `<span class="av ${lg?'lg':''}">${u.has_photo?`<img src="/api/users/${u.id}/photo?v=${u.has_photo?1:0}" alt="">`:(u.role==='paikar'?'🏪':'🧑‍🌾')}</span>`;
}

function stars(u){
  return u.reviews
    ? `<span class="stars">★ ${nf(u.rating,1)}</span> <span class="muted xs">(${nf(u.reviews)})</span>`
    : `<span class="muted xs">${isEn()?'New':'নতুন'}</span>`;
}

function verBadge(u){
  return u.verified?`<span class="ver">✔ ${isEn()?'Verified':'যাচাইকৃত'}</span>`:'';
}

function ulink(u){
  return `<a class="ulink" href="#/u/${u.id}">${esc(dispName(u))}</a>`;
}

function personRow(u, extra=''){
  return `<div class="row">${avatar(u)}<div class="grow"><div>${ulink(u)} ${verBadge(u)}</div>
  <div class="muted sm">${roleBn(u.role)}, ${u.area?esc(u.area)+', ':''}${PLACES[u.place].n} · ${stars(u)}</div>${extra}</div></div>`;
}

function cropIco(c,sm){
  return `<span class="ico ${sm?'sm':''}" style="--c:${CROPS[c].c}">${CROPS[c].i}</span>`;
}

function freshCls(d){
  return d<=1?'low':d<=2?'mid':'ok';
}

function freshTxt(d){
  return d<=0
    ? (isEn()?'Spoilage starting':'নষ্ট হওয়া শুরু')
    : (isEn()?`Fresh for ${nf(d)} days`:`${nf(d)} দিন তাজা থাকবে`);
}

function track(steps, idx, bad){
  return `<div class="track ${bad?'bad':''}">${steps.map((s,i)=>`<div class="st ${i<=idx?'done':''} ${i===idx?'now':''}"><i></i>${s}</div>`).join('')}</div>`;
}

function bill(rows){
  return `<div class="bill">${rows.filter(Boolean).map(([k,v,cls])=>`<div class="${cls||''}"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
}

/* ---------- pricing mirrors of the server ---------- */

function km(a,b){
  if(a===b) return 15;

  const A=PLACES[a],B=PLACES[b],R=6371,
        dl=(B.lat-A.lat)*Math.PI/180,
        dn=(B.lon-A.lon)*Math.PI/180;

  const h=Math.sin(dl/2)**2
    +Math.cos(A.lat*Math.PI/180)
    *Math.cos(B.lat*Math.PI/180)
    *Math.sin(dn/2)**2;

  return Math.round(2*R*Math.asin(Math.sqrt(h))*1.35);
}

function quote(src,dst,kg,plus,bulk){
  const C=S.config, V=C.vehicles, k=km(src,dst);

  let vid,n;

  if(kg>V.truck.cap){
    vid='truck';
    n=Math.ceil(kg/V.truck.cap);
  }
  else{
    vid=['pickup','mini','truck'].find(v=>V[v].cap>=kg);
    n=1;
  }

  const v=V[vid],
        trip=v.base+v.km*k,
        shared=n===1&&kg<C.full_load*v.cap;

  const fare = shared
    ? trip*Math.max(kg/v.cap,C.min_share)*C.pool
    : trip*C.return_load*n;

  const off = plus?C.plus_off:bulk?C.bulk_off:0,
        service=fare*C.service*(1-off),
        offline=trip*C.offline*n;

  return {
    vehicle:vid,
    vehicle_name:v.n,
    trucks:n,
    km:k,
    shared,
    fare:Math.round(fare),
    service:Math.round(service),
    service_off:off,
    total:Math.round(fare+service),
    offline:Math.round(offline),
    saving:Math.round(offline-fare-service),
    eta:Math.round((k/C.speed+(shared?5:2))*10)/10
  };
}

const myQuote = (src,dst,kg) => quote(src,dst,kg,S.me&&S.me.plus_active,S.me&&S.me.bulk);
const platformFee = goods => Math.round(Math.min(S.config.fee_max,Math.max(S.config.fee_min,goods*S.config.fee_rate)));
const daysLeft = l => l.days_left;

/* ---------- modal & confirmation ---------- */

let MODAL_RESOLVE=null;

function modal(html){
  $('#modal').innerHTML=`<button class="x" data-act="close" aria-label="বন্ধ">✕</button>`+html;
  $('#overlay').classList.add('on');
}

function closeModal(v){
  $('#overlay').classList.remove('on');

  if(MODAL_RESOLVE){
    const r=MODAL_RESOLVE;
    MODAL_RESOLVE=null;
    r(v===undefined?false:v);
  }
}

let CONF=null;

function confirmBox(o){
  return new Promise(res=>{
    CONF={...o,picked:''};
    MODAL_RESOLVE=res;
    drawConfirm();
  });
}

function drawConfirm(){
  const o=CONF;

  modal(`<div class="body"><h2>${o.title}</h2>${o.body?`<div style="margin-top:10px">${o.body}</div>`:''}
    ${o.penalty?`<div class="danger" style="margin-top:12px">⚠️ এই কাজ করলে আপনার ${nf(o.penalty)} পয়েন্ট কাটা যাবে।</div>`:''}
    ${o.reason?`<div class="field"><span>কারণ (না দিলেও চলবে)</span>
      <div class="chips" style="flex-wrap:wrap">${(o.chips||[]).map(c=>`<button class="chip ${o.picked===c?'on':''}" data-act="conf-chip" data-v="${esc(c)}">${c}</button>`).join('')}</div>
      <textarea id="conf-reason" maxlength="200" placeholder="নিজে লিখুন...">${esc(o.picked&&!(o.chips||[]).includes(o.picked)?o.picked:'')}</textarea></div>`:''}
    <div class="row" style="margin-top:16px"><button class="btn btn-soft grow" data-act="conf-no">${o.cancel||'ফিরে যান'}</button>
      ${o.reason?`<button class="btn btn-line grow" data-act="conf-skip">কারণ ছাড়া ${o.okShort||'নিশ্চিত'}</button>`:''}
      <button class="btn ${o.danger?'btn-red':'btn-green'} grow" data-act="conf-yes">${o.ok||'নিশ্চিত করুন'}</button></div></div>`);
}

/* ---------- online payment ---------- */

let PAY=null;

function payFlow(purpose, ref, amount, title, after){
  PAY={purpose,ref,amount,title,after,step:'method',method:null,pid:null,msg:null};
  drawPay();
}

function drawPay(){
  const P=PAY, w=(S.me&&S.me.wallet)||0;

  if(P.step==='method'){
    modal(`<div class="body"><h2>💳 পেমেন্ট</h2><p class="muted" style="margin-top:4px">${P.title}</p>
      <div class="between" style="margin:14px 0;font-size:1.3rem"><span>মোট</span><b>${tk(P.amount)}</b></div>
      <div class="choice">${[['bkash','বিকাশ','মোবাইল নম্বর ও পিন'],['nagad','নগদ','মোবাইল নম্বর ও পিন'],['card','ডেবিট/ক্রেডিট কার্ড','ভিসা, মাস্টারকার্ড'],['wallet',`Reroute ওয়ালেট`,`ব্যালান্স ${tk(w)}`]].map(([k,n,d])=>
        `<button class="opt" data-act="pay-method" data-v="${k}" ${k==='wallet'&&w<P.amount?'disabled':''}><strong>${n}</strong><span class="muted">${k==='wallet'&&w<P.amount?'ব্যালান্স যথেষ্ট নয়':d}</span></button>`).join('')}</div>
      <p class="note" style="margin-top:12px">🔒 টাকা Reroute-এ জমা থাকে, মাল বুঝে পেলে তবেই বিক্রেতা পান। পেমেন্ট সার্ভারে যাচাই হওয়ার পরই অবস্থা বদলায়।</p></div>`);
  }
  else if(P.step==='gateway'){
    const card=P.method==='card';

    modal(`<div class="body"><div class="gateway ${P.method}"><div class="sm">${{bkash:'বিকাশ',nagad:'নগদ',card:'কার্ড পেমেন্ট'}[P.method]} (ডেমো গেটওয়ে)</div>
      <div style="font-size:1.6rem;font-weight:700">${tk(P.amount)}</div><div class="sm">মার্চেন্ট: Reroute Agro</div></div>
      <label class="field"><span>${card?'কার্ড নম্বর (১৬ সংখ্যা)':'আপনার '+({bkash:'বিকাশ',nagad:'নগদ'}[P.method])+' নম্বর'}</span><input id="pay-acc" inputmode="numeric" placeholder="${card?'4242 4242 4242 4242':'01XXXXXXXXX'}" value="${card?'':(S.me.phone||'')}"></label>
      <label class="field"><span>${card?'CVV / OTP':'পিন'}</span><input id="pay-pin" type="password" inputmode="numeric" placeholder="•••••"></label>
      <p class="warn sm" style="margin-top:10px">ডেমো: পিন <b>১২৩৪৫</b> দিলে সফল হবে, অন্য পিন দিলে ব্যর্থ পেমেন্ট দেখাবে।</p>
      <div class="row" style="margin-top:14px"><button class="btn btn-soft grow" data-act="pay-back">পেছনে</button><button class="btn btn-green grow" data-act="pay-confirm">পেমেন্ট করুন</button></div></div>`);
  }
  else if(P.step==='done'){
    modal(`<div class="body" style="text-align:center"><div class="big-ic">✅</div><h2>পেমেন্ট সফল</h2><p class="muted" style="margin-top:6px">${tk(P.amount)} পরিশোধ হয়েছে। লেনদেন নম্বর ${esc(P.txn||'')}</p>
      <button class="btn btn-green btn-wide" style="margin-top:16px" data-act="pay-finish">ঠিক আছে</button></div>`);
  }
  else if(P.step==='failed'){
    modal(`<div class="body" style="text-align:center"><div class="big-ic">❌</div><h2>পেমেন্ট হয়নি</h2><p class="danger" style="margin-top:10px">${esc(P.msg)}</p>
      <div class="row" style="margin-top:16px"><button class="btn btn-soft grow" data-act="close">পরে করব</button><button class="btn btn-green grow" data-act="pay-retry">আবার চেষ্টা</button></div></div>`);
  }
}

/* ---------- photo helper ---------- */

function shrinkImage(file, max=900){
  return new Promise((res,rej)=>{
    const r=new FileReader();

    r.onload=()=>{
      const img=new Image();

      img.onload=()=>{
        const s=Math.min(1,max/Math.max(img.width,img.height)),
              c=document.createElement('canvas');

        c.width=Math.round(img.width*s);
        c.height=Math.round(img.height*s);

        c.getContext('2d').drawImage(img,0,0,c.width,c.height);

        res(c.toDataURL('image/jpeg',0.72));
      };

      img.onerror=rej;
      img.src=r.result;
    };

    r.onerror=rej;
    r.readAsDataURL(file);
  });
}

/* ---------- chrome ---------- */

const LOGO = `<a class="logo" href="#/"><svg width="32" height="32" viewBox="0 0 34 34" aria-hidden="true"><path d="M6 15v14M28 15v14" stroke="#8A5A2B" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M7 6h3.33L7.67 13H3z" fill="#D93D27"/><path d="M10.33 6h3.34L12.33 13H7.67z" fill="#F6C453"/><path d="M13.67 6H17v7h-4.67z" fill="#D93D27"/><path d="M17 6h3.33l1.34 7H17z" fill="#F6C453"/><path d="M20.33 6h3.34l2.66 7h-4.66z" fill="#D93D27"/><path d="M23.67 6H27l4 7h-4.67z" fill="#F6C453"/><path d="M3 13a2.33 2.33 0 0 0 4.67 0z" fill="#D93D27"/><path d="M7.67 13a2.33 2.33 0 0 0 4.66 0z" fill="#F6C453"/><path d="M12.33 13a2.33 2.33 0 0 0 4.67 0z" fill="#D93D27"/><path d="M17 13a2.33 2.33 0 0 0 4.67 0z" fill="#F6C453"/><path d="M21.67 13a2.33 2.33 0 0 0 4.66 0z" fill="#D93D27"/><path d="M26.33 13a2.33 2.33 0 0 0 4.67 0z" fill="#F6C453"/><circle cx="10" cy="21.5" r="2.4" fill="#F29A2E"/><circle cx="15" cy="21.5" r="2.4" fill="#1E8A4C"/><circle cx="20" cy="21.5" r="2.4" fill="#F6C453"/><circle cx="25" cy="21.5" r="2.4" fill="#D93D27"/><rect x="4" y="24" width="26" height="3" rx="1.2" fill="#8A5A2B"/><rect x="7" y="27" width="20" height="4" rx="1" fill="#B07A3E"/></svg><span>Reroute <span class="full">Agro</span></span></a>`;

const NAV_TRADER = [
  ['#/home','🏠','ড্যাশবোর্ড'],
  ['#/market','🛒','বাজার'],
  ['#/listings','🧺','আমার লিস্টিং'],
  ['#/deals','🤝','অফার ও অর্ডার'],
  ['#/transport','🚚','পরিবহন'],
  ['#/books','📒','মজুদ ও হিসাব'],
  ['#/prices','💡','দাম ও পরামর্শ'],
  ['#/rewards','⭐','পয়েন্ট ও ওয়ালেট'],
  ['#/account','👤','অ্যাকাউন্ট']
];

const BNAV_TRADER = [
  ['#/home','🏠','হোম'],
  ['#/market','🛒','বাজার'],
  ['#/deals','🤝','লেনদেন'],
  ['#/transport','🚚','পরিবহন']
];

const NAV_ADMIN = [
  ['#/admin','📊','সারাংশ'],
  ['#/admin/bookings','🚚','ট্রাক বুকিং'],
  ['#/admin/trucks','🛻','ট্রাক বহর'],
  ['#/admin/users','👥','ব্যবহারকারী'],
  ['#/admin/orders','📦','লেনদেন']
];

function todoCount(){
  if(!isTrader()) return 0;

  const id=S.me.id;

  return (S.offers||[]).filter(o=>
    ['pending','countered'].includes(o.status)
    &&
    (
      (o.waiting==='seller'&&o.seller===id)
      ||
      (o.waiting==='buyer'&&o.buyer===id)
    )
  ).length
  +
  (S.orders||[]).filter(o=>
    (o.status==='awaiting_payment'&&o.buyer===id)
    ||
    (o.status==='handed_over'&&o.buyer===id)
    ||
    (o.status==='confirmed'&&o.seller===id&&o.transport==='self')
  ).length
  +
  (S.inspections||[]).filter(i=>
    i.status==='requested'&&i.seller===id
  ).length;
}

function renderChrome(){
  const u=me(), r=routeBase();

  document.body.classList.toggle('authed',!!u);

  if(!u){
    $('#hrow').innerHTML =
      LOGO
      +
      `<div class="hright">
        ${themeBtn()}
        ${langBtn()}
        <a class="btn btn-soft btn-sm" href="#/market">বাজার</a>
        <a class="btn btn-green btn-sm" href="#/login">লগ ইন</a>
      </div>`;

    $('#tnav').innerHTML='';
    $('#bnav').innerHTML='';

    applyLanguage($('#hrow'));

    return;
  }

  const unread=(S.notifs||[]).filter(n=>!n.read).length,
        todo=todoCount();

  $('#hrow').innerHTML =
    LOGO
    +
    `<div class="hright">

      <a class="chip-user" href="${u.role==='admin'?'#/admin':'#/account'}">
        ${avatar(u)}
        <span class="nm">${esc(dispName(u))}</span>
        <span class="role ${u.role}">${roleBn(u.role)}</span>
      </a>

      ${themeBtn()}
      ${langBtn()}

      <button class="iconbtn" data-act="bell" aria-label="নোটিফিকেশন">
        🔔${unread?`<b>${nf(unread)}</b>`:''}
      </button>

      <button class="btn btn-line btn-sm hide-m" data-act="logout">
        বের হন
      </button>

    </div>`;

  const nav = u.role==='admin'?NAV_ADMIN:NAV_TRADER;

  $('#tnav').innerHTML =
    `<div class="wrap">${
      nav.map(([h,i,t])=>
        `<a href="${h}" class="${r===h?'on':''}">
          ${i} ${t}
          ${h==='#/deals'&&todo?`<span class="cnt">${nf(todo)}</span>`:''}
        </a>`
      ).join('')
    }</div>`;

  const bn = u.role==='admin'?NAV_ADMIN.slice(0,4):BNAV_TRADER;

  $('#bnav').innerHTML =
    bn.map(([h,i,t])=>
      `<a href="${h}" class="${r===h?'on':''}">
        <b>${i}</b>
        ${t}
        ${h==='#/deals'&&todo?`<span class="cnt">${nf(todo)}</span>`:''}
      </a>`
    ).join('')
    +
    `<button data-act="sheet">
      <b>☰</b>
      আরও
    </button>`;

  $('#sheet').innerHTML =
    `<div class="between" style="padding:0 6px 6px">
      <b>মেনু</b>
      <button class="iconbtn" data-act="sheet" aria-label="মেনু বন্ধ">✕</button>
    </div>`
    +
    nav.map(([h,i,t])=>
      `<a href="${h}" data-act="nav" data-to="${h}">
        <span>${i}</span>
        ${t}
      </a>`
    ).join('')
    +
    `<a href="#/" data-act="logout">
      <span>🚪</span>
      বের হন
    </a>`;

  applyLanguage($('#hrow'));
  applyLanguage($('#tnav'));
  applyLanguage($('#bnav'));
  applyLanguage($('#sheet'));
}

function renderBell(){
  const list=(S.notifs||[]).slice(0,25);

  $('#npanel').innerHTML =
    `<div class="between" style="padding:12px 14px">
      <b>নোটিফিকেশন</b>
      <button class="btn btn-soft btn-sm" data-act="read-all">
        সব পড়া হয়েছে
      </button>
    </div>`
    +
    (
      list.length
        ? list.map(n=>
            `<div class="n ${n.read?'':'unread'}"
              data-act="notif"
              data-id="${n.id}"
              data-link="${n.link||''}">
              ${esc(n.text)}
              <div class="muted xs">${ago(n.at)}</div>
            </div>`
          ).join('')
        : `<div class="n muted">কোনো নোটিফিকেশন নেই</div>`
    );

  applyLanguage($('#npanel'));
}

const KIND_BANNER = {
  offer:'',
  pay:'pay',
  cancel:'cancel',
  order:'',
  transport:'',
  done:'',
  inspection:'',
  spoil:'cancel',
  stock:'pay',
  urgent:'pay'
};

function banners(){
  const list=(S.notifs||[])
    .filter(n=>!n.read && n.kind in KIND_BANNER)
    .slice(0,2);

  return list.map(n=>
    `<div class="banner ${KIND_BANNER[n.kind]}">
      <div class="grow">${esc(n.text)}</div>

      ${
        n.link
          ? `<button class="btn btn-sm btn-ink"
              data-act="notif"
              data-id="${n.id}"
              data-link="${n.link}">
              দেখুন
            </button>`
          : ''
      }

      <button class="x2"
        data-act="notif-x"
        data-id="${n.id}"
        aria-label="সরান">
        ✕
      </button>
    </div>`
  ).join('');
}
