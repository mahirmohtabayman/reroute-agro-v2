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
const INSP_ST = {requested:["অনুরোধ","p-gold"],time_proposed:["সময় প্রস্তাব","p-blue"],scheduled:["পরিদর্শন নির্ধারিত","p-blue"],buyer_done:["ক্রেতা দেখেছেন","p-gold"],completed:["পরিদর্শন সম্পন্ন","p-green"],disputed:["বিতর্কিত","p-red"],declined:["রাজি হননি","p-red"],cancelled:["বাতিল","p-grey"]};
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

/* ---------- icons: inline SVG line icons (24px grid). ic() also accepts the emoji
   the data arrays use (nav, to-do lists), so those arrays stay unchanged. ---------- */
const ICONS = {
  home:'<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  cart:'<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  package:'<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  handshake:'<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
  truck:'<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  book:'<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  sparkles:'<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.13a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.13 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0z"/><path d="M20 3v4M22 5h-4"/>',
  star:'<path d="M12 2.5l2.95 6 6.55.95-4.75 4.62 1.12 6.53L12 17.5l-5.87 3.1 1.12-6.53L2.5 9.45l6.55-.95z"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  store:'<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-2-1 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-2 1 2 2 0 0 1-2-2V7"/>',
  farmer:'<path d="M7 9a5 5 0 0 1 10 0"/><path d="M4 9h16"/><path d="M8 9.5a4 4 0 0 0 8 0"/><path d="M5 21a7 7 0 0 1 14 0"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  chart:'<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  box:'<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  pin:'<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  verified:'<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  back:'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  next:'<path d="m9 18 6-6-6-6"/>',
  arrow:'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  lock:'<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  wallet:'<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  card:'<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
  video:'<path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11"/><rect width="14" height="12" x="2" y="6" rx="2"/>',
  walk:'<circle cx="13" cy="4" r="2"/><path d="m9 20 3-6 3 2v4"/><path d="M6 12l3-4 4 1 3 4"/>',
  alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  checkc:'<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  xc:'<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  inbox:'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  swap:'<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  sprout:'<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
  zap:'<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  up:'<path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  down:'<path d="M22 17l-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
  receipt:'<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  edit:'<path d="M12 20h9"/><path d="M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.85.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.85z"/>',
  globe:'<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  tool:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  calendar:'<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  chat:'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  refresh:'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C9.5 3 12 8 12 8s2.5-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  scale:'<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  coins:'<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  flame:'<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  leaf:'<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  award:'<circle cx="12" cy="8" r="6"/><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11"/>',
  calc:'<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M8 6h8M16 14v4M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/>',
  volume:'<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.4 18.4a9 9 0 0 0 0-12.7"/>'
};
const EMOJI_ICON = {
  '🏠':'home','🛒':'cart','🧺':'package','🤝':'handshake','🚚':'truck','🚛':'truck','🛻':'truck','📒':'book','💡':'sparkles','🤖':'sparkles',
  '⭐':'star','👤':'user','📊':'chart','👥':'users','📦':'box','📩':'inbox','↔️':'swap','💳':'card','✅':'checkc','🔍':'search','📹':'video',
  '🚶':'walk','🚨':'zap','🥀':'alert','⚠️':'alert','🔒':'lock','💰':'wallet','🔔':'bell','🚪':'logout','🛠️':'tool','✍️':'edit','🧾':'receipt',
  '📈':'up','📉':'down','🌐':'globe','📍':'pin','⏳':'clock','🏪':'store','🧑‍🌾':'farmer','🎁':'gift','📅':'calendar','💬':'chat','⬇️':'download','🔄':'refresh',
  '✓':'check','✔':'verified','📞':'phone','❌':'xc','🔊':'volume','🏆':'award','🧮':'calc','👉':'arrow','🛣️':'truck','➡️':'arrow',
  '🔻':'down','↻':'refresh','🎉':'checkc','↔':'swap','✕':'x','←':'back'
};
function ic(name, cls=''){
  const k=EMOJI_ICON[name]||name, p=ICONS[k];
  return p?`<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`:name;
}
const SAMPLE_TXT = 'নমুনা ছবি';
function cropPhoto(crop, alt){
  return `<img src="/static/crops/${crop}.jpg" alt="${alt||''}" loading="lazy">`;
}

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
  return `<span class="av ${lg?'lg':''}">${u.has_photo?`<img src="/api/users/${u.id}/photo?v=${u.has_photo?1:0}" alt="">`:ic(u.role==='paikar'?'🏪':'🧑‍🌾')}</span>`;
}

function stars(u){
  return u.reviews
    ? `<span class="stars">★ ${nf(u.rating,1)}</span> <span class="muted xs">(${nf(u.reviews)})</span>`
    : `<span class="muted xs">${isEn()?'New':'নতুন'}</span>`;
}

function verBadge(u){
  return u.verified?`<span class="ver">${ic('verified')} ${isEn()?'Verified':'যাচাইকৃত'}</span>`:'';
}

function ulink(u){
  return `<a class="ulink" href="#/u/${u.id}">${esc(dispName(u))}</a>`;
}

function personRow(u, extra=''){
  return `<div class="row">${avatar(u)}<div class="grow"><div>${ulink(u)} ${verBadge(u)}</div>
  <div class="muted sm">${roleBn(u.role)} · ${u.area?esc(u.area)+', ':''}${PLACES[u.place].n} · ${stars(u)}</div>${extra}</div></div>`;
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
  $('#modal').innerHTML=`<button class="x" data-act="close" aria-label="বন্ধ">${ic('x')}</button>`+html;
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
    ${o.penalty?`<div class="danger" style="margin-top:12px">এই কাজ করলে আপনার ${nf(o.penalty)} পয়েন্ট কাটা যাবে।</div>`:''}
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
    modal(`<div class="body"><h2>${ic('card')} পেমেন্ট</h2><p class="muted" style="margin-top:4px">${P.title}</p>
      <div class="pay-total"><span>মোট</span><b>${tk(P.amount)}</b></div>
      <div class="choice">${[['bkash','বিকাশ','মোবাইল নম্বর ও পিন'],['nagad','নগদ','মোবাইল নম্বর ও পিন'],['card','ডেবিট/ক্রেডিট কার্ড','ভিসা, মাস্টারকার্ড'],['wallet',`Reroute ওয়ালেট`,`ব্যালান্স ${tk(w)}`]].map(([k,n,d])=>
        `<button class="opt" data-act="pay-method" data-v="${k}" ${k==='wallet'&&w<P.amount?'disabled':''}><strong>${n}</strong><span class="muted">${k==='wallet'&&w<P.amount?'ব্যালান্স যথেষ্ট নয়':d}</span></button>`).join('')}</div>
      <p class="note" style="margin-top:14px">টাকা Reroute-এ জমা থাকে, মাল বুঝে পেলে তবেই বিক্রেতা পান। পেমেন্ট সার্ভারে যাচাই হওয়ার পরই অবস্থা বদলায়।</p></div>`);
  }
  else if(P.step==='gateway'){
    const card=P.method==='card';

    modal(`<div class="body"><div class="gateway ${P.method}"><div class="sm">${{bkash:'বিকাশ',nagad:'নগদ',card:'কার্ড পেমেন্ট'}[P.method]} (ডেমো গেটওয়ে)</div>
      <div style="font-size:1.7rem;font-weight:700;margin:2px 0">${tk(P.amount)}</div><div class="sm">মার্চেন্ট: Reroute Agro</div></div>
      <label class="field"><span>${card?'কার্ড নম্বর (১৬ সংখ্যা)':'আপনার '+({bkash:'বিকাশ',nagad:'নগদ'}[P.method])+' নম্বর'}</span><input id="pay-acc" inputmode="numeric" placeholder="${card?'4242 4242 4242 4242':'01XXXXXXXXX'}" value="${card?'':(S.me.phone||'')}"></label>
      <label class="field"><span>${card?'CVV / OTP':'পিন'}</span><input id="pay-pin" type="password" inputmode="numeric" placeholder="•••••"></label>
      <p class="warn sm" style="margin-top:10px">ডেমো: পিন <b>১২৩৪৫</b> দিলে সফল হবে, অন্য পিন দিলে ব্যর্থ পেমেন্ট দেখাবে।</p>
      <div class="row" style="margin-top:18px"><button class="btn btn-soft grow" data-act="pay-back">পেছনে</button><button class="btn btn-green grow" data-act="pay-confirm">পেমেন্ট করুন</button></div></div>`);
  }
  else if(P.step==='done'){
    modal(`<div class="body" style="text-align:center"><div class="big-ic ok">${ic('check')}</div><h2 style="padding:0">পেমেন্ট সফল</h2><p class="muted" style="margin-top:6px">${tk(P.amount)} পরিশোধ হয়েছে। লেনদেন নম্বর ${esc(P.txn||'')}</p>
      <button class="btn btn-green btn-wide" style="margin-top:16px" data-act="pay-finish">ঠিক আছে</button></div>`);
  }
  else if(P.step==='failed'){
    modal(`<div class="body" style="text-align:center"><div class="big-ic bad">${ic('x')}</div><h2 style="padding:0">পেমেন্ট হয়নি</h2><p class="danger" style="margin-top:10px">${esc(P.msg)}</p>
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

const LOGO = `<a class="logo" href="#/" aria-label="Reroute Agro"><svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><rect width="34" height="34" rx="9" fill="#166A3B"/><path d="M9.5 24.5C9.5 15.5 15 10 25 9.5c-.5 10-6 15-15.5 15z" fill="#E3F1E7"/><path d="M9.5 24.5 19.5 14.5" stroke="#166A3B" stroke-width="1.8" stroke-linecap="round"/><circle cx="25.2" cy="24.6" r="2.6" fill="#D99A1E"/></svg><span>Reroute <span class="full">Agro</span></span></a>`;

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

  // transport negotiation todos: pending proposal where I am the recipient
  let tNegTodo=0;
  const tn=S.transport_negotiations||{};
  Object.values(tn).forEach(neg=>{
    if(neg.status!=='agreed'&&(neg.proposals||[]).some(p=>p.status==='pending'&&p.recipient===id)) tNegTodo++;
  });

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
    (i.status==='requested'&&i.seller===id)
    ||(i.status==='time_proposed'&&i.buyer===id)
    ||(i.status==='buyer_done'&&i.seller===id)
  ).length
  +
  tNegTodo;
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
        <a class="btn btn-line btn-sm hide-m" href="#/market">${ic('cart')} বাজার</a>
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
        ${ic('bell')}${unread?`<b>${nf(unread)}</b>`:''}
      </button>

      <button class="btn btn-line btn-sm hide-m" data-act="logout">
        ${ic('logout')} বের হন
      </button>

    </div>`;

  const nav = u.role==='admin'?NAV_ADMIN:NAV_TRADER;

  $('#tnav').innerHTML =
    `<div class="wrap">${
      nav.map(([h,i,t])=>
        `<a href="${h}" class="${r===h?'on':''}">
          ${ic(i)} ${t}
          ${h==='#/deals'&&todo?`<span class="cnt">${nf(todo)}</span>`:''}
        </a>`
      ).join('')
    }</div>`;

  const bn = u.role==='admin'?NAV_ADMIN.slice(0,4):BNAV_TRADER;

  $('#bnav').innerHTML =
    bn.map(([h,i,t])=>
      `<a href="${h}" class="${r===h?'on':''}">
        <b>${ic(i)}</b>
        ${t}
        ${h==='#/deals'&&todo?`<span class="cnt">${nf(todo)}</span>`:''}
      </a>`
    ).join('')
    +
    `<button data-act="sheet">
      <b>${ic('menu')}</b>
      আরও
    </button>`;

  $('#sheet').innerHTML =
    `<div class="between" style="padding:0 6px 6px">
      <b>মেনু</b>
      <button class="iconbtn" data-act="sheet" aria-label="মেনু বন্ধ">${ic('x')}</button>
    </div>`
    +
    nav.map(([h,i,t])=>
      `<a href="${h}" data-act="nav" data-to="${h}">
        <span>${ic(i)}</span>
        ${t}
      </a>`
    ).join('')
    +
    `<a href="#/" data-act="logout">
      <span>${ic('logout')}</span>
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
    `<div class="between" style="padding:12px 16px">
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
        ${ic('x')}
      </button>
    </div>`
  ).join('');
}
