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
const nf = (n,d=0) => Number(n||0).toLocaleString('bn-BD',{maximumFractionDigits:d});
const tk = (n,d=0) => '৳' + nf(n,d);
const bd = x => String(x).replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[d]);
const monTxt = kg => `${nf(kg/MON,1)} মণ`;
const kgMon = kg => `${nf(kg/MON,1)} মণ (${nf(kg)} কেজি)`;
const MONTHS = ['জানু','ফেব্রু','মার্চ','এপ্রি','মে','জুন','জুলা','আগ','সেপ্টে','অক্টো','নভে','ডিসে'];
const dateBn = t => { const d=new Date(t); return `${bd(d.getDate())} ${MONTHS[d.getMonth()]}`; };
function ago(t){ const m=Math.round((Date.now()-t)/6e4); if(m<60) return `${nf(Math.max(1,m))} মিনিট আগে`; const h=Math.round(m/60); if(h<24) return `${nf(h)} ঘণ্টা আগে`; const d=Math.round(h/24); return d<30?`${nf(d)} দিন আগে`:`${nf(Math.round(d/30))} মাস আগে`; }
const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pill = ([t,c]) => `<span class="pill ${c}">${t}</span>`;

/* ---------- state from the server ---------- */
let S = {users:[],listings:[],trucks:[],me:null,notifs:[]}, TOKEN=null, lastJSON='', FD=null;
try{ TOKEN = localStorage.getItem('reroute-token'); }catch(e){}
function setToken(t){ TOKEN=t; try{ t?localStorage.setItem('reroute-token',t):localStorage.removeItem('reroute-token'); }catch(e){} }
async function api(path, method='GET', body){
  let r, data=null;
  try{ r = await fetch('/api'+path,{method,headers:{'Content-Type':'application/json',...(TOKEN?{'X-Token':TOKEN}:{})},body:body?JSON.stringify(body):undefined}); try{ data=await r.json(); }catch(e){} }
  catch(e){ toast('সার্ভারের সাথে যোগাযোগ হচ্ছে না, একটু পরে চেষ্টা করুন'); throw e; }
  if(r.status===401){ setToken(null); }
  if(!r.ok){ const d=data&&data.detail; toast(typeof d==='string'?d:(Array.isArray(d)?'তথ্য ঠিকভাবে দিন':'কাজটি হয়নি, আবার চেষ্টা করুন')); throw new Error(d); }
  return data;
}
async function load(){
  const s = await api('/state'); const j=JSON.stringify(s), changed=j!==lastJSON; lastJSON=j;
  if(!s.me && TOKEN) setToken(null);
  const before=new Set((S.notifs||[]).filter(n=>!n.read).map(n=>n.id));
  S = s; const fresh=(s.notifs||[]).filter(n=>!n.read && !before.has(n.id));
  return {changed, fresh};
}
const me = () => S.me;
const isTrader = () => S.me && S.me.role!=='admin';
const user = id => (S.users||[]).find(u=>u.id===id) || ((S.admin&&S.admin.users)||[]).find(u=>u.id===id) || (S.me&&S.me.id===id?S.me:null) || {id,name:'অজানা',role:'farmer',place:'rajshahi'};
const listing = id => (S.listings||[]).find(l=>l.id===id);
const dispName = u => u.role==='paikar' ? u.biz : u.name;
const roleBn = r => ({farmer:'কৃষক',paikar:'পাইকার',admin:'অপারেশন টিম'}[r]);

/* ---------- small UI pieces ---------- */
let tT;
function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('on'); clearTimeout(tT); tT=setTimeout(()=>t.classList.remove('on'),3000); }
function say(text){ try{ const v=speechSynthesis.getVoices().find(v=>(v.lang||'').toLowerCase().startsWith('bn')); if(v){ const u=new SpeechSynthesisUtterance(text); u.voice=v; u.lang=v.lang; speechSynthesis.cancel(); speechSynthesis.speak(u); } else toast('🔊 '+text.slice(0,90)); }catch(e){} }
function avatar(u,lg){ return `<span class="av ${lg?'lg':''}">${u.has_photo?`<img src="/api/users/${u.id}/photo?v=${u.has_photo?1:0}" alt="">`:(u.role==='paikar'?'🏪':'🧑‍🌾')}</span>`; }
function stars(u){ return u.reviews?`<span class="stars">★ ${nf(u.rating,1)}</span> <span class="muted xs">(${nf(u.reviews)})</span>`:`<span class="muted xs">নতুন</span>`; }
function verBadge(u){ return u.verified?`<span class="ver">✔ যাচাইকৃত</span>`:''; }
function ulink(u){ return `<a class="ulink" href="#/u/${u.id}">${esc(dispName(u))}</a>`; }
function personRow(u, extra=''){ return `<div class="row">${avatar(u)}<div class="grow"><div>${ulink(u)} ${verBadge(u)}</div>
  <div class="muted sm">${roleBn(u.role)}, ${u.area?esc(u.area)+', ':''}${PLACES[u.place].n} · ${stars(u)}</div>${extra}</div></div>`; }
function cropIco(c,sm){ return `<span class="ico ${sm?'sm':''}" style="--c:${CROPS[c].c}">${CROPS[c].i}</span>`; }
function freshCls(d){ return d<=1?'low':d<=2?'mid':'ok'; }
function freshTxt(d){ return d<=0?'নষ্ট হওয়া শুরু':`${nf(d)} দিন তাজা থাকবে`; }
function track(steps, idx, bad){ return `<div class="track ${bad?'bad':''}">${steps.map((s,i)=>`<div class="st ${i<=idx?'done':''} ${i===idx?'now':''}"><i></i>${s}</div>`).join('')}</div>`; }
function bill(rows){ return `<div class="bill">${rows.filter(Boolean).map(([k,v,cls])=>`<div class="${cls||''}"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`; }

/* ---------- pricing mirrors of the server (same formulas) ---------- */
function km(a,b){ if(a===b) return 15; const A=PLACES[a],B=PLACES[b],R=6371,dl=(B.lat-A.lat)*Math.PI/180,dn=(B.lon-A.lon)*Math.PI/180;
  const h=Math.sin(dl/2)**2+Math.cos(A.lat*Math.PI/180)*Math.cos(B.lat*Math.PI/180)*Math.sin(dn/2)**2; return Math.round(2*R*Math.asin(Math.sqrt(h))*1.35); }
function quote(src,dst,kg,plus,bulk){
  const C=S.config, V=C.vehicles, k=km(src,dst); let vid,n;
  if(kg>V.truck.cap){ vid='truck'; n=Math.ceil(kg/V.truck.cap); } else { vid=['pickup','mini','truck'].find(v=>V[v].cap>=kg); n=1; }
  const v=V[vid], trip=v.base+v.km*k, shared=n===1&&kg<C.full_load*v.cap;
  const fare = shared ? trip*Math.max(kg/v.cap,C.min_share)*C.pool : trip*C.return_load*n;
  const off = plus?C.plus_off:bulk?C.bulk_off:0, service=fare*C.service*(1-off), offline=trip*C.offline*n;
  return {vehicle:vid,vehicle_name:v.n,trucks:n,km:k,shared,fare:Math.round(fare),service:Math.round(service),service_off:off,
          total:Math.round(fare+service),offline:Math.round(offline),saving:Math.round(offline-fare-service),eta:Math.round((k/C.speed+(shared?5:2))*10)/10};
}
const myQuote = (src,dst,kg) => quote(src,dst,kg, S.me&&S.me.plus_active, S.me&&S.me.bulk);
const platformFee = goods => Math.round(Math.min(S.config.fee_max, Math.max(S.config.fee_min, goods*S.config.fee_rate)));
const daysLeft = l => l.days_left;

/* ---------- modal & confirmation ---------- */
let MODAL_RESOLVE=null;
function modal(html){ $('#modal').innerHTML=`<button class="x" data-act="close" aria-label="বন্ধ">✕</button>`+html; $('#overlay').classList.add('on'); }
function closeModal(v){ $('#overlay').classList.remove('on'); if(MODAL_RESOLVE){ const r=MODAL_RESOLVE; MODAL_RESOLVE=null; r(v===undefined?false:v); } }
/* confirmBox: every important action asks first. With reason:true it adds an optional reason box and a Skip button. */
let CONF=null;
function confirmBox(o){
  return new Promise(res=>{ CONF={...o,picked:''}; MODAL_RESOLVE=res; drawConfirm(); });
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

/* ---------- online payment (demo gateway) ---------- */
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
  } else if(P.step==='gateway'){
    const card=P.method==='card';
    modal(`<div class="body"><div class="gateway ${P.method}"><div class="sm">${{bkash:'বিকাশ',nagad:'নগদ',card:'কার্ড পেমেন্ট'}[P.method]} (ডেমো গেটওয়ে)</div>
      <div style="font-size:1.6rem;font-weight:700">${tk(P.amount)}</div><div class="sm">মার্চেন্ট: Reroute Agro</div></div>
      <label class="field"><span>${card?'কার্ড নম্বর (১৬ সংখ্যা)':'আপনার '+({bkash:'বিকাশ',nagad:'নগদ'}[P.method])+' নম্বর'}</span><input id="pay-acc" inputmode="numeric" placeholder="${card?'4242 4242 4242 4242':'01XXXXXXXXX'}" value="${card?'':(S.me.phone||'')}"></label>
      <label class="field"><span>${card?'CVV / OTP':'পিন'}</span><input id="pay-pin" type="password" inputmode="numeric" placeholder="•••••"></label>
      <p class="warn sm" style="margin-top:10px">ডেমো: পিন <b>১২৩৪৫</b> দিলে সফল হবে, অন্য পিন দিলে ব্যর্থ পেমেন্ট দেখাবে।</p>
      <div class="row" style="margin-top:14px"><button class="btn btn-soft grow" data-act="pay-back">পেছনে</button><button class="btn btn-green grow" data-act="pay-confirm">পেমেন্ট করুন</button></div></div>`);
  } else if(P.step==='done'){
    modal(`<div class="body" style="text-align:center"><div class="big-ic">✅</div><h2>পেমেন্ট সফল</h2><p class="muted" style="margin-top:6px">${tk(P.amount)} পরিশোধ হয়েছে। লেনদেন নম্বর ${esc(P.txn||'')}</p>
      <button class="btn btn-green btn-wide" style="margin-top:16px" data-act="pay-finish">ঠিক আছে</button></div>`);
  } else if(P.step==='failed'){
    modal(`<div class="body" style="text-align:center"><div class="big-ic">❌</div><h2>পেমেন্ট হয়নি</h2><p class="danger" style="margin-top:10px">${esc(P.msg)}</p>
      <div class="row" style="margin-top:16px"><button class="btn btn-soft grow" data-act="close">পরে করব</button><button class="btn btn-green grow" data-act="pay-retry">আবার চেষ্টা</button></div></div>`);
  }
}

/* ---------- photo helper: shrink before upload ---------- */
function shrinkImage(file, max=900){
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>{ const img=new Image(); img.onload=()=>{
    const s=Math.min(1,max/Math.max(img.width,img.height)), c=document.createElement('canvas'); c.width=Math.round(img.width*s); c.height=Math.round(img.height*s);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height); res(c.toDataURL('image/jpeg',0.72)); }; img.onerror=rej; img.src=r.result; }; r.onerror=rej; r.readAsDataURL(file); });
}

/* ---------- chrome: header, navigation ---------- */
const LOGO = `<a class="logo" href="#/"><svg width="30" height="30" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="19" r="12" fill="#D93D27"/><path d="M17 7c-2-3-5-3-7-2 3 0 5 1 7 3 2-2 4-3 7-3-2-1-5-1-7 2z" fill="#1E8A4C"/><path d="M10 21c2 4 9 5 13 0" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M21 18l2.4 3-3.6.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Reroute <span class="full">Agro</span></span></a>`;
const NAV_TRADER = [['#/home','🏠','ড্যাশবোর্ড'],['#/market','🛒','বাজার'],['#/listings','🧺','আমার লিস্টিং'],['#/deals','🤝','অফার ও অর্ডার'],['#/transport','🚚','পরিবহন'],['#/books','📒','মজুদ ও হিসাব'],['#/prices','💡','দাম ও পরামর্শ'],['#/rewards','⭐','পয়েন্ট ও ওয়ালেট'],['#/account','👤','অ্যাকাউন্ট']];
const BNAV_TRADER = [['#/home','🏠','হোম'],['#/market','🛒','বাজার'],['#/deals','🤝','লেনদেন'],['#/transport','🚚','পরিবহন']];
const NAV_ADMIN = [['#/admin','📊','সারাংশ'],['#/admin/bookings','🚚','ট্রাক বুকিং'],['#/admin/trucks','🛻','ট্রাক বহর'],['#/admin/users','👥','ব্যবহারকারী'],['#/admin/orders','📦','লেনদেন']];
function todoCount(){
  if(!isTrader()) return 0; const id=S.me.id;
  return (S.offers||[]).filter(o=>['pending','countered'].includes(o.status)&&((o.waiting==='seller'&&o.seller===id)||(o.waiting==='buyer'&&o.buyer===id))).length
    + (S.orders||[]).filter(o=>(o.status==='awaiting_payment'&&o.buyer===id)||(o.status==='handed_over'&&o.buyer===id)||(o.status==='confirmed'&&o.seller===id&&o.transport==='self')).length
    + (S.inspections||[]).filter(i=>i.status==='requested'&&i.seller===id).length;
}
function renderChrome(){
  const u=me(), r=routeBase();
  document.body.classList.toggle('authed',!!u);
  if(!u){
    $('#hrow').innerHTML = LOGO+`<div class="hright"><a class="btn btn-soft btn-sm" href="#/market">বাজার</a><a class="btn btn-green btn-sm" href="#/login">লগ ইন</a></div>`;
    $('#tnav').innerHTML=''; $('#bnav').innerHTML=''; return;
  }
  const unread=(S.notifs||[]).filter(n=>!n.read).length, todo=todoCount();
  $('#hrow').innerHTML = LOGO+`<div class="hright">
    <a class="chip-user" href="${u.role==='admin'?'#/admin':'#/account'}">${avatar(u)}<span class="nm">${esc(dispName(u))}</span><span class="role ${u.role}">${roleBn(u.role)}</span></a>
    <button class="iconbtn" data-act="bell" aria-label="নোটিফিকেশন">🔔${unread?`<b>${nf(unread)}</b>`:''}</button>
    <button class="btn btn-line btn-sm hide-m" data-act="logout">বের হন</button></div>`;
  const nav = u.role==='admin'?NAV_ADMIN:NAV_TRADER;
  $('#tnav').innerHTML = `<div class="wrap">${nav.map(([h,i,t])=>`<a href="${h}" class="${r===h?'on':''}">${i} ${t}${h==='#/deals'&&todo?`<span class="cnt">${nf(todo)}</span>`:''}</a>`).join('')}</div>`;
  const bn = u.role==='admin'?NAV_ADMIN.slice(0,4):BNAV_TRADER;
  $('#bnav').innerHTML = bn.map(([h,i,t])=>`<a href="${h}" class="${r===h?'on':''}"><b>${i}</b>${t}${h==='#/deals'&&todo?`<span class="cnt">${nf(todo)}</span>`:''}</a>`).join('')
    + `<button data-act="sheet"><b>☰</b>আরও</button>`;
  $('#sheet').innerHTML = `<div class="between" style="padding:0 6px 6px"><b>মেনু</b><button class="iconbtn" data-act="sheet" aria-label="মেনু বন্ধ">✕</button></div>` + nav.map(([h,i,t])=>`<a href="${h}" data-act="nav" data-to="${h}"><span>${i}</span>${t}</a>`).join('')+`<a href="#/" data-act="logout"><span>🚪</span>বের হন</a>`;
}
function renderBell(){
  const list=(S.notifs||[]).slice(0,25);
  $('#npanel').innerHTML = `<div class="between" style="padding:12px 14px"><b>নোটিফিকেশন</b><button class="btn btn-soft btn-sm" data-act="read-all">সব পড়া হয়েছে</button></div>`
    + (list.length?list.map(n=>`<div class="n ${n.read?'':'unread'}" data-act="notif" data-id="${n.id}" data-link="${n.link||''}">${esc(n.text)}<div class="muted xs">${ago(n.at)}</div></div>`).join(''):`<div class="n muted">কোনো নোটিফিকেশন নেই</div>`);
}
const KIND_BANNER = {offer:'',pay:'pay',cancel:'cancel',order:'',transport:'',done:'',inspection:'',spoil:'cancel',stock:'pay',urgent:'pay'};
function banners(){
  const list=(S.notifs||[]).filter(n=>!n.read && n.kind in KIND_BANNER).slice(0,2);
  return list.map(n=>`<div class="banner ${KIND_BANNER[n.kind]}"><div class="grow">${esc(n.text)}</div>
    ${n.link?`<button class="btn btn-sm btn-ink" data-act="notif" data-id="${n.id}" data-link="${n.link}">দেখুন</button>`:''}
    <button class="x2" data-act="notif-x" data-id="${n.id}" aria-label="সরান">✕</button></div>`).join('');
}
