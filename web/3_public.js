const V = {};

/* ---------- minimal home (before login) ---------- */
V.home = () => `<section class="hero"><div>
  <div class="logo-big">🍅</div>
  <h1>কৃষকের মাল, পাইকারের বাজার</h1>
  <p class="lead">সরাসরি কেনাবেচা ও দরদাম, নিরাপদ পেমেন্ট, আর নিজস্ব ট্রাকে কম খরচে পরিবহন।</p>
  <div class="cta"><button class="btn btn-green" data-act="pick-role" data-role="farmer">🧑‍🌾 আমি কৃষক</button>
    <button class="btn btn-blue" data-act="pick-role" data-role="paikar">🚚 আমি পাইকার</button></div>
  <p style="margin-top:16px"><a href="#/market">লগ ইন ছাড়াই বাজার দেখুন</a></p>
  <div class="feat"><span>🤝 সরাসরি দরদাম</span><span>🔒 নিরাপদ পেমেন্ট</span><span>🚚 নিজস্ব ট্রাক</span></div>
</div></section>`;

/* ---------- login & register ---------- */
let loginRole='farmer';
V.login = () => {
  const demo = {farmer:['f1','f2','f5'], paikar:['p1','p2','p4'], admin:['a1']}[loginRole];
  const names = {f1:['রহিম উদ্দিন','কৃষক, রাজশাহী: নতুন অফার ও পরিদর্শনের অনুরোধ আছে'],f2:['করিমা বেগম','কৃষক, নাটোর'],f5:['হালিমা খাতুন','কৃষক, রাজশাহী: জরুরি বিক্রি চলছে'],
    p1:['করিম ট্রেডার্স','পাইকার, ঢাকা: পাল্টা দামের উত্তর দিতে হবে'],p2:['ঢাকা ফ্রেশ হাব','পাইকার, ঢাকা: প্লাস সদস্য'],p4:['বগুড়া সবজি ঘর','পাইকার, বগুড়া: মাল পথে আছে'],a1:['Reroute অপারেশন টিম','ট্রাক বুকিং, বহর ও প্ল্যাটফর্মের হিসাব']};
  return `<div style="max-width:520px;margin:10px auto">
    <h1>লগ ইন</h1><p class="muted" style="margin:4px 0 14px">আপনি কে, বাছুন</p>
    <div class="choice c3">${[['farmer','🧑‍🌾 কৃষক'],['paikar','🚚 পাইকার'],['admin','🛠️ অপারেশন']].map(([k,t])=>`<button class="opt ${loginRole===k?'on':''}" data-act="pick-role" data-role="${k}" data-stay="1"><strong>${t}</strong></button>`).join('')}</div>
    ${loginRole!=='admin'?`<div class="panel" style="margin-top:14px"><label class="field" style="margin-top:0"><span>মোবাইল নম্বর</span><input id="lg-phone" inputmode="tel" placeholder="01XXXXXXXXX"></label>
      <button class="btn btn-green btn-wide" style="margin-top:10px" data-act="login-phone">ঢুকুন</button>
      <p class="muted sm" style="margin-top:8px">নতুন? <a href="#/register">অ্যাকাউন্ট খুলুন</a></p></div>`:''}
    <h3 style="margin:18px 0 6px">ডেমো অ্যাকাউন্ট, এক চাপে ঢুকুন</h3>
    ${demo.map(id=>`<button class="opt" style="width:100%;margin-top:8px" data-act="login" data-id="${id}"><strong>${names[id][0]}</strong><span class="muted">${names[id][1]}</span></button>`).join('')}
  </div>`;
};
V.register = () => `<div style="max-width:520px;margin:10px auto"><h1>নতুন অ্যাকাউন্ট</h1>
  <div class="choice c2" style="margin-top:12px">${[['farmer','🧑‍🌾 কৃষক'],['paikar','🚚 পাইকার']].map(([k,t])=>`<button class="opt ${loginRole===k?'on':''}" data-act="pick-role" data-role="${k}" data-stay="1"><strong>${t}</strong></button>`).join('')}</div>
  <div class="panel" style="margin-top:12px">
    <label class="field" style="margin-top:0"><span>নাম</span><input id="rg-name"></label>
    ${loginRole==='paikar'?`<label class="field"><span>আড়ত / ব্যবসার নাম</span><input id="rg-biz"></label>`:''}
    <label class="field"><span>মোবাইল নম্বর</span><input id="rg-phone" inputmode="tel" placeholder="01XXXXXXXXX"></label>
    <div class="grid2" style="gap:10px"><label class="field"><span>জেলা</span><select id="rg-place">${Object.entries(PLACES).map(([k,p])=>`<option value="${k}">${p.n}</option>`).join('')}</select></label>
    <label class="field"><span>উপজেলা / বাজার</span><input id="rg-area"></label></div>
    <button class="btn btn-green btn-wide" style="margin-top:14px" data-act="register">অ্যাকাউন্ট খুলুন</button>
    <p class="muted sm" style="margin-top:8px">শুধু কৃষক ও পাইকারদের জন্য পাইকারি প্ল্যাটফর্ম। সর্বনিম্ন অর্ডার ${monTxt(S.config.min_order)}।</p></div></div>`;

/* ---------- market: all public listings with search & filters ---------- */
const F = {q:'',crop:'all',place:'all',max:'',min:'',seller:'all',sold:false,sort:'new'};
function listingPic(l){
  const c=CROPS[l.crop];
  return `<div class="pic" style="--c:${c.c}">${l.photo_count?`<img src="/api/listings/${l.id}/photo/0" alt="${c.n}" loading="lazy">`:`<span class="emo">${c.i}</span><span class="nophoto">ছবি দেওয়া হয়নি</span>`}
    ${l.urgent?`<span class="rib">জরুরি −${nf(l.urgent*100)}%</span>`:''}${l.status==='sold_out'?'<span class="rib r2">বিক্রি শেষ</span>':''}
    <span class="fresh ${freshCls(l.days_left)}">⏳ ${freshTxt(l.days_left)}</span></div>`;
}
function transportHint(l){
  const u=me(); if(!u||u.role==='admin'||u.id===l.uid) return '';
  const s=user(l.uid), q=myQuote(s.place,u.place,Math.max(l.moq,Math.min(l.available,2000)));
  return `<div class="tline">🚚 ${PLACES[u.place].n} পর্যন্ত Reroute ট্রাকে আনুমানিক ${tk(q.total)} (${monTxt(Math.max(l.moq,Math.min(l.available,2000)))}), বাজারে ট্রাক ভাড়া ${tk(q.offline)}</div>`;
}
function lcard(l){
  const c=CROPS[l.crop], s=user(l.uid);
  return `<a class="lcard" href="#/listing/${l.id}">${listingPic(l)}<div class="info">
    <div class="between"><b>${c.n}</b><span class="pill p-grey">গ্রেড ${l.grade}</span></div>
    <div class="price">${tk(l.eff_price,1)}<small>/কেজি</small>${l.urgent?`<s>${tk(l.price,1)}</s>`:''}</div>
    <div class="muted sm">আছে ${monTxt(l.available)} · সর্বনিম্ন ${monTxt(l.moq)}</div>
    <div class="sm">${s.role==='paikar'?'🏪':'🧑‍🌾'} ${esc(dispName(s))} ${s.verified?'<span class="ver">✔</span>':''} ${stars(s)}</div>
    <div class="muted sm">📍 ${s.area?esc(s.area)+', ':''}${PLACES[s.place].n}</div>
    ${transportHint(l)}</div></a>`;
}
V.market = () => {
  let list=(S.listings||[]).filter(l=>l.status==='active'||(F.sold&&l.status==='sold_out'));
  list=list.filter(l=>{ const s=user(l.uid), c=CROPS[l.crop];
    if(F.crop!=='all'&&l.crop!==F.crop) return false;
    if(F.place!=='all'&&s.place!==F.place) return false;
    if(F.max&&l.eff_price>+F.max) return false;
    if(F.min&&l.available<+F.min*MON) return false;
    if(F.seller!=='all'&&s.role!==F.seller) return false;
    if(F.q&&!(c.n+dispName(s)+PLACES[s.place].n+(s.area||'')+(l.quality||'')).includes(F.q)) return false;
    return true; });
  const sorters={new:(a,b)=>b.created-a.created, cheap:(a,b)=>a.eff_price-b.eff_price, fresh:(a,b)=>b.days_left-a.days_left,
    near:(a,b)=>me()?km(user(a.uid).place,me().place)-km(user(b.uid).place,me().place):0, big:(a,b)=>b.available-a.available};
  list.sort(sorters[F.sort]);
  return `<div class="phead"><div><h1>🛒 বাজার</h1><p class="muted sm">কৃষক ও পাইকারদের তোলা সব মাল। শুধু পাইকারি: সর্বনিম্ন অর্ডার ${monTxt(S.config.min_order)}</p></div>
    ${isTrader()?`<a class="btn btn-green" href="#/listings/new">+ মাল বিক্রির জন্য দিন</a>`:(!me()?`<a class="btn btn-green" href="#/login">কিনতে বা বেচতে লগ ইন</a>`:'')}</div>
    <div class="filters">
      <label class="q"><span>খুঁজুন</span><input data-f="q" value="${esc(F.q)}" placeholder="ফসল, বিক্রেতা, এলাকা..."></label>
      <label><span>জেলা</span><select data-f="place"><option value="all">সব জেলা</option>${Object.entries(PLACES).map(([k,p])=>`<option value="${k}" ${F.place===k?'selected':''}>${p.n}</option>`).join('')}</select></label>
      <label><span>সর্বোচ্চ দাম (৳/কেজি)</span><input data-f="max" type="number" min="0" value="${F.max}"></label>
      <label><span>অন্তত কত মণ</span><input data-f="min" type="number" min="0" value="${F.min}"></label>
      <label><span>বিক্রেতা</span><select data-f="seller">${[['all','সবাই'],['farmer','কৃষক'],['paikar','পাইকার']].map(([k,t])=>`<option value="${k}" ${F.seller===k?'selected':''}>${t}</option>`).join('')}</select></label>
      <label><span>সাজান</span><select data-f="sort">${[['new','নতুন আগে'],['cheap','কম দাম আগে'],['fresh','বেশি তাজা আগে'],['near','কাছের আগে'],['big','বেশি পরিমাণ আগে']].map(([k,t])=>`<option value="${k}" ${F.sort===k?'selected':''}>${t}</option>`).join('')}</select></label>
    </div>
    <div class="chips">${[['all','সব ফসল'],...Object.entries(CROPS).map(([k,c])=>[k,c.i+' '+c.n])].map(([k,t])=>`<button class="chip ${F.crop===k?'on':''}" data-act="f-crop" data-v="${k}">${t}</button>`).join('')}
      <label class="chip"><input type="checkbox" data-f="sold" ${F.sold?'checked':''}> বিক্রি শেষ-ও দেখাও</label></div>
    <p class="muted sm" style="margin-bottom:8px">${nf(list.length)}টি লিস্টিং</p>
    <div class="lgrid">${list.map(lcard).join('')||'<div class="empty" style="grid-column:1/-1">এই খোঁজে কিছু পাওয়া যায়নি। ফিল্টার বদলান।</div>'}</div>`;
};

/* ---------- listing detail ---------- */
V.listing = id => {
  const l=listing(id); if(!l) return `<div class="empty">লিস্টিং পাওয়া যায়নি বা বন্ধ হয়ে গেছে। <a href="#/market">বাজারে ফিরুন</a></div>`;
  const c=CROPS[l.crop], s=user(l.uid), u=me(), mine=u&&u.id===l.uid, harvest=Date.now()-(S.config?0:0);
  const photos=Array.from({length:l.photo_count},(_,i)=>`<img src="/api/listings/${l.id}/photo/${i}" alt="${c.n} ছবি ${bd(i+1)}" style="border-radius:12px;max-height:360px;width:100%;object-fit:cover">`);
  const market=MARKET_DEMO[s.place][l.crop];
  let tq='';
  if(u&&!mine&&u.role!=='admin'){
    const kg=Math.max(l.moq,Math.min(l.available,2000)), q=myQuote(s.place,u.place,kg);
    tq=`<div class="panel"><h3>🚚 আপনার কাছে আনার খরচ (আনুমানিক)</h3><p class="muted sm">${PLACES[s.place].n} → ${PLACES[u.place].n}, ${nf(q.km)} কিমি, ${monTxt(kg)} ধরে</p>
      ${bill([[`${q.vehicle_name}${q.shared?' (শেয়ার্ড)':''}`,tk(q.fare)],['Reroute সেবা চার্জ',tk(q.service)],['মোট ট্রাক ভাড়া',tk(q.total),'tot'],['বাজারে নিজে ট্রাক ভাড়া করলে',tk(q.offline)]])}
      <div class="good" style="margin-top:8px">সাশ্রয় ${tk(q.saving)}, পৌঁছাতে প্রায় ${nf(q.eta,1)} ঘণ্টা। ভাড়া চাইলে বিক্রেতার সাথে অর্ধেক অর্ধেক ভাগ করা যায়।</div></div>`;
  }
  const insp=(S.inspections||[]).find(i=>i.listing===l.id&&u&&i.buyer===u.id&&['requested','scheduled','done'].includes(i.status));
  return `<p><a href="#/market">← বাজার</a></p>
  <div class="grid2" style="margin-top:10px;align-items:start">
    <div>${photos.length?`<div class="stack">${photos.join('')}</div>`:`<div class="pic" style="--c:${c.c};height:260px;border-radius:16px"><span class="emo" style="font-size:6rem">${c.i}</span><span class="nophoto">বিক্রেতা ছবি দেননি</span></div>`}
      <div class="panel" style="margin-top:14px"><h3>বিক্রেতা</h3><div style="margin-top:8px">${personRow(s)}</div></div></div>
    <div><div class="panel">
      <div class="between"><h1>${c.i} ${c.n}</h1><span>${pill(l.status==='active'?['চালু','p-green']:l.status==='sold_out'?['বিক্রি শেষ','p-red']:l.status==='paused'?['বন্ধ রাখা','p-grey']:['বন্ধ','p-grey'])}</span></div>
      <div class="price" style="font-size:1.8rem;margin-top:6px">${tk(l.eff_price,1)}<small>/কেজি</small>${l.urgent?`<s>${tk(l.price,1)}</s>`:''} <span class="muted sm">(${tk(l.eff_price*MON)}/মণ)</span></div>
      ${l.urgent?`<div class="danger" style="margin-top:8px">🚨 জরুরি বিক্রি: নষ্ট হওয়ার আগে ${nf(l.urgent*100)}% কম দামে</div>`:''}
      <dl class="kv" style="margin-top:12px">
        <dt>বিক্রির জন্য আছে</dt><dd>${kgMon(l.available)}</dd>
        ${l.reserved?`<dt>অর্ডারে আটকে আছে</dt><dd>${kgMon(l.reserved)}</dd>`:''}
        <dt>এ পর্যন্ত বিক্রি</dt><dd>${kgMon(l.sold)}</dd>
        <dt>সর্বনিম্ন অর্ডার</dt><dd>${kgMon(l.moq)}</dd>
        <dt>গ্রেড</dt><dd>${l.grade}</dd>
        <dt>তোলা হয়েছে</dt><dd>${dateBn(l.harvest)}</dd>
        <dt>তাজা থাকবে</dt><dd style="color:var(--${freshCls(l.days_left)==='ok'?'green':freshCls(l.days_left)==='mid'?'gold':'red'})">${freshTxt(l.days_left)}</dd>
        <dt>জায়গা</dt><dd>${s.area?esc(s.area)+', ':''}${PLACES[s.place].n}</dd>
        <dt>পরিবহন</dt><dd>Reroute ট্রাক বা নিজের ট্রাক</dd></dl>
      ${l.quality?`<div class="note" style="margin-top:12px"><b>মান:</b> ${esc(l.quality)}</div>`:''}
      <p class="muted sm" style="margin-top:8px">${PLACES[s.place].n}-এ আজকের বাজার দর আনুমানিক ${tk(market)}/কেজি <span class="demo-tag">ডেমো অনুমান</span></p>
      ${mine?`<div class="row wrap-it" style="margin-top:14px"><a class="btn btn-ink" href="#/listings">লিস্টিং পরিচালনা</a></div>`
        :!u?`<a class="btn btn-green btn-wide" style="margin-top:14px" href="#/login">অফার দিতে লগ ইন করুন</a>`
        :u.role==='admin'?'':l.status!=='active'?`<div class="warn" style="margin-top:14px">এই মাল এখন বিক্রি হচ্ছে না।</div>`
        :`<button class="btn btn-green btn-wide" style="margin-top:14px" data-act="offer-open" data-id="${l.id}">অফার / অর্ডার দিন</button>
          ${insp?`<a class="btn btn-line btn-wide" style="margin-top:8px" href="#/inspection/${insp.id}">পরিদর্শন: ${INSP_ST[insp.status][0]}</a>`
                :`<button class="btn btn-line btn-wide" style="margin-top:8px" data-act="inspect-open" data-id="${l.id}">🔍 আগে মাল দেখতে চাই (ভিডিও / সরাসরি)</button>`}
          <p class="muted sm" style="margin-top:8px">অফার দিলে বিক্রেতা রাজি না হওয়া পর্যন্ত কিছু নিশ্চিত হয় না, টাকাও কাটে না।</p>`}
    </div>${tq}</div></div>`;
};

/* ---------- public profile ---------- */
let PROFILE=null;
V.profile = id => {
  if(!PROFILE||PROFILE.user.id!==id){ api('/users/'+id).then(p=>{ PROFILE=p; render(); }).catch(()=>{}); return `<div class="empty">লোড হচ্ছে...</div>`; }
  const p=PROFILE, u=p.user, months=Math.max(1,Math.round((Date.now()-u.joined)/(30*DAY)));
  return `<div class="panel"><div class="row">${avatar(u,true)}<div class="grow"><h1>${esc(dispName(u))}</h1>
      <div class="muted">${roleBn(u.role)}${u.role==='paikar'?', মালিক '+esc(u.name):''} · ${u.area?esc(u.area)+', ':''}${PLACES[u.place].n}</div>
      <div style="margin-top:4px">${verBadge(u)||'<span class="pill p-grey">যাচাই হয়নি</span>'} ${stars(u)}</div></div></div>
    <div class="grid4" style="margin-top:14px">
      <div class="kpi"><span class="muted sm">সম্পূর্ণ লেনদেন</span><strong>${nf(p.completed)}টি</strong></div>
      <div class="kpi"><span class="muted sm">মোট পরিমাণ</span><strong>${monTxt(p.kg)}</strong></div>
      <div class="kpi"><span class="muted sm">বাতিল করেছেন</span><strong>${nf(p.cancelled)}টি</strong></div>
      <div class="kpi"><span class="muted sm">Reroute-এ</span><strong>${nf(months)} মাস</strong></div></div>
    <p class="muted sm" style="margin-top:10px">🔒 ফোন নম্বর ও লেনদেনের বিস্তারিত গোপন। অর্ডারের পেমেন্ট হলে দুজনে নম্বর পান।</p></div>
  <div class="grid2" style="margin-top:14px;align-items:start">
    <div class="panel"><h3>চালু লিস্টিং (${nf(p.listings.length)})</h3>${p.listings.map(l=>`<a class="item" href="#/listing/${l.id}" style="text-decoration:none;color:inherit">${cropIco(l.crop)}<div class="grow"><b>${CROPS[l.crop].n}</b><div class="muted sm">${monTxt(l.available)} · ${tk(l.eff_price,1)}/কেজি · ${freshTxt(l.days_left)}</div></div><span>›</span></a>`).join('')||'<p class="muted" style="margin-top:8px">এখন কোনো লিস্টিং নেই</p>'}</div>
    <div class="panel"><h3>রিভিউ (${nf(u.reviews)})</h3>${p.reviews.map(r=>`<div class="item" style="display:block"><span class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</span> <b>${esc(r.from_role==='paikar'?r.from_biz:r.from_name)}</b>${r.text?`<div>${esc(r.text)}</div>`:''}<div class="muted xs">${ago(r.at)}</div></div>`).join('')||'<p class="muted" style="margin-top:8px">এখনো রিভিউ নেই</p>'}</div></div>`;
};

/* ---------- AI model page (real data, for judges) ---------- */
const AIS={market:'rajshahi',product:'lentils'};
const PROD_BN={rice:'চাল',lentils:'মসুর ডাল',oil:'ভোজ্য তেল',wheat_flour:'আটা'};
V.ai = () => {
  if(!FD){ api('/ai/summary').then(d=>{FD=d;render();}).catch(()=>{}); return `<div class="empty">লোড হচ্ছে...</div>`; }
  const M=FD.metrics, s=FD.series[AIS.market][AIS.product], last=s.close[s.close.length-1], ch=(s.forecast.price/last-1)*100;
  const all=[...s.dates,s.forecast.month], vals=[...s.close,s.forecast.price,...Object.values(s.backtest)];
  const mn=Math.floor(Math.min(...vals)*.97), mx=Math.ceil(Math.max(...vals)*1.03), W=720,H=260,pl=44,pr=20,pt=12,pb=30;
  const x=i=>pl+i*(W-pl-pr)/(all.length-1), y=v=>pt+(mx-v)*(H-pt-pb)/(mx-mn);
  let g=`<svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:520px" role="img" aria-label="দামের চার্ট">`;
  for(let k=0;k<=4;k++){ const v=mn+(mx-mn)*k/4; g+=`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line)"/><text x="${pl-6}" y="${y(v)+4}" text-anchor="end" font-size="11" style="fill:var(--muted)">${nf(v)}</text>`; }
  all.forEach((d,i)=>{ if(i%4===0||i===all.length-1){ const [yy,mm]=d.split('-'); g+=`<text x="${x(i)}" y="${H-10}" text-anchor="middle" font-size="11" style="fill:var(--muted)">${MONTHS[+mm-1]} ${bd(yy.slice(2))}</text>`; } });
  g+=`<polyline fill="none" style="stroke:var(--ink)" stroke-width="2.5" points="${s.close.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}"/>`;
  const bt=s.dates.map((d,i)=>s.backtest[d]!=null?`${x(i)},${y(s.backtest[d])}`:null).filter(Boolean);
  if(bt.length) g+=`<polyline fill="none" style="stroke:var(--green)" stroke-width="2.5" stroke-dasharray="6 5" points="${bt.join(' ')}"/>`;
  g+=`<circle cx="${x(all.length-1)}" cy="${y(s.forecast.price)}" r="6" style="fill:var(--red)"/></svg>`;
  return `<div class="phead"><div><h1>🤖 AI দামের মডেল</h1><p class="muted">আসল ডেটায় প্রশিক্ষিত ও যাচাই করা: Food Commodity Price (OHLC) Dataset of Bangladesh</p></div></div>
    <div class="grid4"><div class="kpi"><span class="muted sm">প্রশিক্ষণ</span><strong>${nf(M.markets)}টি বাজার</strong><span class="muted sm">২০০৮–২০২২</span></div>
      <div class="kpi"><span class="muted sm">অদেখা সময়ে পরীক্ষা</span><strong>২০২৩–২০২৫</strong><span class="muted sm">${nf(M.test_rows)}টি পূর্বাভাস</span></div>
      <div class="kpi"><span class="muted sm">দাম বাড়বে না কমবে</span><strong>${nf(M.direction_accuracy_pct,1)}% সঠিক</strong></div>
      <div class="kpi"><span class="muted sm">গড় ভুল</span><strong>${nf(M.mape_model,2)}%</strong><span class="muted sm">সাধারণ অনুমানে ${nf(M.mape_naive,2)}%</span></div></div>
    <div class="panel" style="margin-top:14px"><div class="row wrap-it">
      <select data-ai="market">${Object.keys(FD.series).map(k=>`<option value="${k}" ${AIS.market===k?'selected':''}>${PLACES[k].n}</option>`).join('')}</select>
      <select data-ai="product">${Object.keys(PROD_BN).map(k=>`<option value="${k}" ${AIS.product===k?'selected':''}>${PROD_BN[k]}</option>`).join('')}</select></div>
      <p style="margin:10px 0"><b>${PLACES[AIS.market].n}-এ ${PROD_BN[AIS.product]}:</b> পরের মাসে ${tk(s.forecast.price,1)}/কেজি (এখন ${tk(last,1)}, ${ch>=0?'বাড়বে':'কমবে'} ${nf(Math.abs(ch),1)}%)</p>
      <div class="scroll">${g}</div><p class="muted sm">কালো: আসল দাম · সবুজ ডটেড: মডেলের পূর্বাভাস (যাচাই) · লাল: পরের মাস</p></div>
    <p class="warn" style="margin-top:14px">এই ডেটাসেটে সবজি নেই। তাই অ্যাপের সবজির বাজারদর এখন ডেমো অনুমান। পাইলটে কৃষি বিপণন অধিদপ্তরের সবজির দৈনিক দামে এই একই মডেল চলবে।</p>`;
};
