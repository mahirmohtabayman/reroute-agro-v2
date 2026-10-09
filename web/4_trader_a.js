/* ---------- dashboard ---------- */
function myTodos(){
  const id=me().id, T=[];
  (S.offers||[]).forEach(o=>{ const c=CROPS[o.crop].n;
    if(o.status==='pending'&&o.waiting==='seller'&&o.seller===id) T.push(['📩',`${dispName(user(o.buyer))} ${monTxt(o.qty)} ${c} কিনতে চান, ${tk(o.price,1)}/কেজি`,'রাজি, পাল্টা দাম বা না বলুন',`#/offer/${o.id}`]);
    if(o.status==='countered'&&o.waiting==='buyer'&&o.buyer===id) T.push(['↔️',`${dispName(user(o.seller))} পাল্টা দাম দিয়েছেন: ${tk(o.price,1)}/কেজি`,'রাজি হলে পেমেন্ট করুন',`#/offer/${o.id}`]); });
  (S.orders||[]).forEach(o=>{ const c=CROPS[o.crop].n, b=(S.bookings||[]).find(x=>x.id===o.booking);
    if(o.status==='awaiting_payment'&&o.buyer===id) T.push(['💳',`${monTxt(o.qty)} ${c}: ${tk(o.buyer_total)} পেমেন্ট করুন`,'পেমেন্ট হলে অর্ডার নিশ্চিত হবে',`#/order/${o.id}`]);
    if(o.status==='confirmed'&&o.seller===id&&o.transport==='self') T.push(['📦',`${monTxt(o.qty)} ${c} পাইকারকে বুঝিয়ে দিন`,'দিয়ে "হস্তান্তর করেছি" চাপুন',`#/order/${o.id}`]);
    if(o.status==='confirmed'&&o.seller===id&&b&&b.status==='pickup_scheduled') T.push(['🚚',`ট্রাক আসছে: ${b.pickup_time||''}`,`${monTxt(o.qty)} ${c} তৈরি রাখুন, তুলে দিয়ে নিশ্চিত করুন`,`#/order/${o.id}`]);
    if(o.status==='handed_over'&&o.buyer===id) T.push(['✅',`${monTxt(o.qty)} ${c} পৌঁছালে বুঝে নিন`,'"মাল বুঝে পেয়েছি" চাপলে বিক্রেতা টাকা পাবেন',`#/order/${o.id}`]);
    if(o.status==='completed'&&!(S.rated||[]).includes(o.id)&&o.completed_at>Date.now()-14*DAY) T.push(['⭐',`${dispName(user(o.buyer===id?o.seller:o.buyer))}-কে রেটিং দিন`,`${monTxt(o.qty)} ${c}`,`#/order/${o.id}`]); });
  (S.inspections||[]).forEach(i=>{ if(i.status==='requested'&&i.seller===id) T.push(['🔍',`${dispName(user(i.buyer))} মাল দেখতে চান (${i.kind==='video'?'ভিডিও':'সরাসরি'})`,esc(i.pref),`#/inspection/${i.id}`]); });
  return T;
}
function myAlerts(){
  const id=me().id, A=[];
  (S.listings||[]).filter(l=>l.uid===id&&l.status==='active'&&l.available>0).forEach(l=>{ const c=CROPS[l.crop].n;
    if(l.days_left<=1) A.push(['spoil',`🥀 ${c} ${l.days_left<=0?'নষ্ট হতে শুরু করেছে':'কাল থেকে নষ্ট হতে পারে'}। ${l.urgent?'জরুরি বিক্রি চালু আছে।':'দাম কমিয়ে জরুরি বিক্রি দিন।'}`,l]);
    else if(l.available<2*l.moq) A.push(['low',`⚠️ ${c}-এর লিস্টিংয়ে আর মাত্র ${monTxt(l.available)} বাকি`,l]); });
  (S.listings||[]).filter(l=>l.uid===id&&l.status==='sold_out').forEach(l=>A.push(['low',`📦 ${CROPS[l.crop].n} পুরো বিক্রি/বুক হয়ে গেছে। আরও থাকলে পরিমাণ যোগ করুন।`,l]));
  return A;
}
V.dash = () => {
  const u=me(), T=myTodos(), A=myAlerts(), P=S.pnl, active=(S.listings||[]).filter(l=>l.uid===u.id&&l.status==='active').length;
  const open=(S.orders||[]).filter(o=>['awaiting_payment','confirmed','handed_over'].includes(o.status)).length;
  return `<div class="phead"><div><p class="muted">আসসালামু আলাইকুম,</p><h1>${esc(u.name)} ${u.verified?'<span class="ver">✔ যাচাইকৃত</span>':''}</h1>
    <p class="muted sm">${roleBn(u.role)}${u.role==='paikar'?', '+esc(u.biz):''} · ${u.area?esc(u.area)+', ':''}${PLACES[u.place].n}${u.plus_active?' · ⭐ প্লাস':''}</p></div>
    <div class="row wrap-it"><a class="btn btn-green" href="#/listings/new">+ মাল বিক্রির জন্য দিন</a><a class="btn btn-blue" href="#/market">🛒 কিনুন</a></div></div>
    ${A.map(([k,t,l])=>`<div class="alert ${k}"><span class="grow">${t}</span>${k==='spoil'&&!l.urgent?`<button class="btn btn-red btn-sm" data-act="urgent" data-id="${l.id}">জরুরি বিক্রি</button>`:`<a class="btn btn-soft btn-sm" href="#/listings">দেখুন</a>`}</div>`).join('')}
    <h2 style="margin:6px 0 10px">এখন আপনার কাজ ${T.length?`<span class="cnt">${nf(T.length)}</span>`:''}</h2>
    ${T.length?T.map(([i,t,d,h])=>`<a class="todo" href="${h}"><span class="ic">${i}</span><div class="grow"><b>${t}</b><div class="muted sm">${d}</div></div><span>›</span></a>`).join('')
      :`<div class="empty">এখন কোনো কাজ বাকি নেই। নতুন অফার বা অর্ডার এলে এখানে দেখাবে।</div>`}
    <div class="grid4" style="margin-top:16px">
      <a class="kpi" href="#/rewards"><span class="muted sm">ওয়ালেট</span><strong>${tk(u.wallet)}</strong></a>
      <a class="kpi" href="#/rewards"><span class="muted sm">পয়েন্ট</span><strong style="color:var(--gold)">⭐ ${nf(u.pts)}</strong></a>
      <a class="kpi" href="#/listings"><span class="muted sm">চালু লিস্টিং</span><strong>${nf(active)}টি</strong></a>
      <a class="kpi" href="#/deals"><span class="muted sm">চলমান অর্ডার</span><strong>${nf(open)}টি</strong></a></div>
    <div class="panel" style="margin-top:14px"><div class="between"><h3>📒 এ পর্যন্ত লাভ-ক্ষতি</h3><a href="#/books" data-act="books-tab" data-v="pnl">বিস্তারিত</a></div>
      <div class="grid3" style="margin-top:10px"><div><span class="muted sm">মোট বিক্রি</span><div class="b" style="font-size:1.3rem">${tk(P.revenue)}</div></div>
      <div><span class="muted sm">মোট খরচ</span><div class="b" style="font-size:1.3rem">${tk(P.expense)}</div></div>
      <div><span class="muted sm">${P.exact?'লাভ':'আনুমানিক লাভ'}</span><div class="b" style="font-size:1.3rem;color:var(--${P.profit>=0?'green':'red'})">${tk(P.profit+0)}</div></div></div>
      ${!P.exact?`<p class="warn sm" style="margin-top:8px">${monTxt(P.unknown_cost_qty)} মালের উৎপাদন/কেনা খরচ দেওয়া নেই, তাই লাভ সম্পূর্ণ নয়।</p>`:''}</div>
    <div class="grid3" style="margin-top:14px">
      <a class="kpi" href="#/prices"><span class="muted sm">💡 দাম ও পরামর্শ</span><strong style="font-size:1rem">কোথায় বেচলে/কিনলে লাভ</strong></a>
      <a class="kpi" href="#/transport"><span class="muted sm">🚚 পরিবহন</span><strong style="font-size:1rem">কম খরচে ট্রাক বুক করুন</strong></a>
      <a class="kpi" href="#/books"><span class="muted sm">📦 মজুদ</span><strong style="font-size:1rem">আমার কাছে কী মাল আছে</strong></a></div>`;
};

/* ---------- my listings ---------- */
V.listings = () => {
  const u=me(), mine=(S.listings||[]).filter(l=>l.uid===u.id).sort((a,b)=>({active:0,sold_out:1,paused:2,closed:3}[a.status]-{active:0,sold_out:1,paused:2,closed:3}[b.status])||b.created-a.created);
  return `<div class="phead"><div><h1>🧺 আমার লিস্টিং</h1><p class="muted sm">বাজারে আপনার মাল। অর্ডার এলে পরিমাণ নিজে থেকেই কমে যায়।</p></div><a class="btn btn-green" href="#/listings/new">+ নতুন লিস্টিং</a></div>
  ${mine.length?mine.map(l=>{ const c=CROPS[l.crop], pend=(S.offers||[]).filter(o=>o.listing===l.id&&['pending','countered'].includes(o.status)).length;
    const st={active:['চালু','p-green'],sold_out:['বিক্রি শেষ','p-red'],paused:['সাময়িক বন্ধ','p-grey'],closed:['বন্ধ','p-grey']}[l.status];
    return `<div class="panel"><div class="row">${cropIco(l.crop)}<div class="grow"><div class="row wrap-it"><b>${c.n}</b>${pill(st)}${l.urgent?'<span class="pill p-red">জরুরি</span>':''}${pend?`<a class="pill p-blue" href="#/deals">${nf(pend)}টি অফার</a>`:''}</div>
      <div class="muted sm">${tk(l.eff_price,1)}/কেজি · সর্বনিম্ন ${monTxt(l.moq)} · গ্রেড ${l.grade} · ${l.status==='closed'?'':freshTxt(l.days_left)}</div></div>
      <a class="btn btn-soft btn-sm" href="#/listing/${l.id}">দেখুন</a></div>
      <div class="grid4" style="margin-top:10px;gap:8px"><div><span class="muted xs">বিক্রির জন্য আছে</span><div class="b">${monTxt(l.available)}</div></div>
        <div><span class="muted xs">অর্ডারে আটকে</span><div class="b">${monTxt(l.reserved)}</div></div><div><span class="muted xs">বিক্রি হয়েছে</span><div class="b">${monTxt(l.sold)}</div></div>
        <div><span class="muted xs">ছবি</span><div class="b">${nf(l.photo_count)}টি</div></div></div>
      ${l.status!=='closed'?`<div class="row wrap-it" style="margin-top:12px">
        <button class="btn btn-line btn-sm" data-act="l-price" data-id="${l.id}">দাম বদলান</button>
        <button class="btn btn-line btn-sm" data-act="l-qty" data-id="${l.id}">পরিমাণ বাড়ান/কমান</button>
        ${l.status==='active'?`<button class="btn btn-line btn-sm" data-act="l-status" data-id="${l.id}" data-v="paused">সাময়িক বন্ধ</button>`:l.status==='paused'?`<button class="btn btn-line btn-sm" data-act="l-status" data-id="${l.id}" data-v="active">আবার চালু</button>`:''}
        ${l.status==='active'&&!l.urgent?`<button class="btn btn-red btn-sm" data-act="urgent" data-id="${l.id}">🚨 জরুরি বিক্রি</button>`:''}
        <button class="btn btn-soft btn-sm" data-act="l-status" data-id="${l.id}" data-v="closed">লিস্টিং বন্ধ করুন</button></div>`:''}</div>`; }).join('')
  :`<div class="empty">এখনো কোনো লিস্টিং নেই। <a href="#/listings/new">মাল বিক্রির জন্য দিন</a></div>`}`;
};

/* ---------- new listing ---------- */
let NL=null;
function nlReset(){ NL={crop:'tomato',mon:25,price:null,moq:5,grade:'A',quality:'',harvest:0,cost:'',photos:[]}; }
V.newListing = () => {
  if(!NL) nlReset();
  const u=me(), isP=u.role==='paikar', inv=(S.inventory||[]).filter(r=>r.unlisted>0);
  const crops = isP ? inv.map(r=>r.crop) : Object.keys(CROPS);
  if(isP&&!crops.length) return `<h1>নতুন লিস্টিং</h1><div class="empty" style="margin-top:12px">পাইকার হিসেবে আপনার মজুদে থাকা মালই বিক্রির জন্য দিতে পারবেন। এখন তালিকার বাইরে কোনো মজুদ নেই।<br><a href="#/books">মজুদ দেখুন</a> বা <a href="#/market">মাল কিনুন</a></div>`;
  if(!crops.includes(NL.crop)) NL.crop=crops[0];
  const mk=MARKET_DEMO[u.place][NL.crop]; if(NL.price===null) NL.price=mk;
  const invRow=(S.inventory||[]).find(r=>r.crop===NL.crop), maxMon=isP?Math.floor(invRow.unlisted/MON):null;
  return `<div style="max-width:640px;margin:0 auto"><p><a href="#/listings">← আমার লিস্টিং</a></p><h1 style="margin-top:6px">নতুন লিস্টিং</h1>
  <div class="panel" style="margin-top:12px">
    <div class="field" style="margin-top:0"><span>কোন ফসল?</span><div class="choice c4">${crops.map(k=>`<button class="opt cropbtn ${NL.crop===k?'on':''}" data-act="nl-crop" data-v="${k}"><b>${CROPS[k].i}</b>${CROPS[k].n}</button>`).join('')}</div></div>
    <div class="grid2" style="gap:12px">
      <label class="field"><span>কত মণ বিক্রি করবেন?${isP?` (মজুদে আছে ${nf(maxMon)} মণ)`:''}</span><input data-nl="mon" type="number" min="5" ${isP?`max="${maxMon}"`:''} value="${NL.mon}"></label>
      <label class="field"><span>দাম (৳ প্রতি কেজি)</span><input data-nl="price" type="number" min="1" step="0.5" value="${NL.price}"></label>
      <label class="field"><span>সর্বনিম্ন অর্ডার (মণ, অন্তত ৫)</span><input data-nl="moq" type="number" min="5" value="${NL.moq}"></label>
      <label class="field"><span>গ্রেড</span><select data-nl="grade">${['A','B','C'].map(g=>`<option ${NL.grade===g?'selected':''}>${g}</option>`).join('')}</select></label>
      <label class="field"><span>${isP?'কত দিন আগে তোলা মাল':'কবে তোলা হয়েছে'}</span><select data-nl="harvest">${[0,1,2,3,5,7].map(d=>`<option value="${d}" ${+NL.harvest===d?'selected':''}>${d===0?'আজ':d===1?'গতকাল':bd(d)+' দিন আগে'}</option>`).join('')}</select></label>
      ${isP?'':`<label class="field"><span>উৎপাদন খরচ (৳/কেজি, ঐচ্ছিক)</span><input data-nl="cost" type="number" min="0" step="0.5" value="${NL.cost}" placeholder="লাভ-ক্ষতির হিসাবের জন্য"></label>`}</div>
    <label class="field"><span>মানের বিবরণ (রং, সাইজ, কীভাবে রাখা)</span><textarea data-nl="quality" maxlength="300" placeholder="যেমন: লাল-পাকা, মাঝারি সাইজ, ক্রেটে রাখা">${esc(NL.quality)}</textarea></label>
    <div class="field"><span>মালের আসল ছবি (৩টি পর্যন্ত)</span><input type="file" accept="image/*" multiple data-act-change="nl-photo">
      <div class="thumbs">${NL.photos.map((p,i)=>`<div><img src="${p}" alt=""><button data-act="nl-photo-x" data-v="${i}" aria-label="ছবি সরান">✕</button></div>`).join('')}</div></div>
    <div id="nl-sum" style="margin-top:14px">${nlSummary()}</div>
    <button class="btn btn-green btn-wide" style="margin-top:14px" data-act="nl-submit">লিস্টিং প্রকাশ করুন</button></div></div>`;
};
function nlSummary(){
  const u=me(), mk=MARKET_DEMO[u.place][NL.crop], kg=NL.mon*MON, goods=NL.price*kg, fee=platformFee(goods);
  return `<div class="note">💡 ${PLACES[u.place].n}-এ আজ ${CROPS[NL.crop].n}ের বাজার দর আনুমানিক ${tk(mk)}/কেজি <span class="demo-tag">ডেমো অনুমান</span>। ${NL.price>mk*1.1?'আপনার দাম একটু বেশি, বিক্রি দেরি হতে পারে।':NL.price<mk*0.9?'আপনার দাম বাজারের চেয়ে কম।':'আপনার দাম বাজারের কাছাকাছি।'}</div>
    ${bill([['মোট মালের দাম',tk(goods)],['প্ল্যাটফর্ম ফি (১%, বিক্রি হলে কাটা হবে)','−'+tk(fee),'minus'],['ভাড়া',u.role==='farmer'?'অর্ডার অনুযায়ী (ক্রেতার সাথে ভাগ করা যায়)':'অর্ডার অনুযায়ী'],
      ['সব বিক্রি হলে আনুমানিক হাতে পাবেন',tk(goods-fee),'tot']])}`;
}

/* ---------- offer form (buyer) ---------- */
let OF=null;
function openOffer(lid){
  const l=listing(lid); if(!l) return;
  OF={lid, mon:Math.min(l.available, Math.max(l.moq, 25*MON))/MON, price:l.eff_price, transport:'reroute', split:'half', note:''};
  drawOffer();
}
function offerCalc(){
  const l=listing(OF.lid), s=user(l.uid), u=me(), kg=OF.mon*MON, goods=OF.price*kg;
  const q=OF.transport==='reroute'?myQuote(s.place,u.place,kg):null;
  const share = q ? {buyer:q.total,half:q.total/2,seller:0}[OF.split] : 0;
  const credit = q ? Math.min(u.transport_credit||0, share*0.5) : 0;
  return {l,s,kg,goods,q,share,credit,total:goods+share-credit};
}
function drawOffer(){
  const c=offerCalc(), l=c.l;
  modal(`<div class="body"><h2>${CROPS[l.crop].i} ${CROPS[l.crop].n} কিনতে অফার</h2><div style="margin:8px 0">${personRow(c.s)}</div>
    <div class="grid2" style="gap:10px"><label class="field"><span>কত মণ? (${monTxt(l.moq)} থেকে ${monTxt(l.available)})</span><input data-of="mon" type="number" min="${l.moq/MON}" max="${l.available/MON}" value="${OF.mon}"></label>
    <label class="field"><span>দাম ৳/কেজি (তালিকায় ${nf(l.eff_price,1)})</span><input data-of="price" type="number" min="1" max="${l.eff_price}" step="0.5" value="${OF.price}"></label></div>
    <p class="muted sm">তালিকার দামে দিলে বিক্রেতা দ্রুত রাজি হন। কম দাম দিলে তিনি রাজি, পাল্টা দাম বা না বলতে পারেন।</p>
    <div class="field"><span>পরিবহন</span><div class="choice c2">
      <button class="opt ${OF.transport==='reroute'?'on':''}" data-act="of-set" data-k="transport" data-v="reroute"><strong>🚚 Reroute ট্রাক</strong><span class="muted">বাজারের চেয়ে কম ভাড়া, ট্রাক আমরা পাঠাব</span></button>
      <button class="opt ${OF.transport==='self'?'on':''}" data-act="of-set" data-k="transport" data-v="self"><strong>🚛 নিজে ট্রাক আনব</strong><span class="muted">ভাড়া ও ব্যবস্থা আপনার</span></button></div></div>
    ${OF.transport==='reroute'?`<div class="field"><span>ট্রাক ভাড়া কে দেবেন?</span><div class="choice c3">${[['buyer','আমি পুরো'],['half','অর্ধেক অর্ধেক'],['seller','বিক্রেতা পুরো']].map(([k,t])=>`<button class="opt ${OF.split===k?'on':''}" data-act="of-set" data-k="split" data-v="${k}"><strong>${t}</strong></button>`).join('')}</div></div>`:''}
    <label class="field"><span>বিক্রেতাকে বার্তা (ঐচ্ছিক)</span><input data-of="note" maxlength="200" value="${esc(OF.note)}" placeholder="যেমন: গ্রেড A হলে নিয়মিত নেব"></label>
    <div id="of-bill" style="margin-top:12px">${offerBill(c)}</div>
    <button class="btn btn-green btn-wide" style="margin-top:12px" data-act="of-submit">অফার পাঠান</button>
    <p class="muted sm" style="margin-top:6px;text-align:center">বিক্রেতা রাজি হলে তবেই পেমেন্ট করতে হবে।</p></div>`);
}
function offerBill(c){
  return bill([['মালের দাম',`${tk(c.goods)} (${monTxt(c.kg)} × ${tk(OF.price,1)})`],
    c.q?[`ট্রাক ভাড়া মোট ${tk(c.q.total)}, আপনার ভাগ`,tk(c.share)]:['পরিবহন','নিজে আনবেন'],
    c.credit?['⭐ পরিবহন ছাড়','−'+tk(c.credit),'plus']:null,
    ['আপনি পরিশোধ করবেন',tk(c.total),'tot']])
    + (c.q?`<p class="good sm" style="margin-top:8px">🚚 ${c.q.vehicle_name}${c.q.shared?', শেয়ার্ড':''}, ${nf(c.q.km)} কিমি। বাজারে ট্রাক ভাড়া করলে ${tk(c.q.offline)} লাগত, সাশ্রয় ${tk(c.q.saving)}।</p>`:'');
}

/* ---------- inspection request ---------- */
let IN=null;
function openInspect(lid){ IN={lid,kind:'video',pref:'আজ বিকেল ৪টা',note:''}; drawInspect(); }
function drawInspect(){
  const l=listing(IN.lid);
  modal(`<div class="body"><h2>🔍 কেনার আগে মাল দেখুন</h2><p class="muted" style="margin-top:4px">${CROPS[l.crop].n}, ${esc(dispName(user(l.uid)))}। বিক্রেতা রাজি হলে সময় জানাবেন।</p>
    <div class="field"><span>কীভাবে দেখবেন?</span><div class="choice c2"><button class="opt ${IN.kind==='video'?'on':''}" data-act="in-kind" data-v="video"><strong>📹 ভিডিও কল</strong><span class="muted">মোবাইলে মাল দেখাবেন</span></button>
      <button class="opt ${IN.kind==='visit'?'on':''}" data-act="in-kind" data-v="visit"><strong>🚶 সরাসরি গিয়ে</strong><span class="muted">খেত বা গুদামে গিয়ে</span></button></div></div>
    <label class="field"><span>কখন সুবিধা?</span><input id="in-pref" maxlength="80" value="${esc(IN.pref)}"></label>
    <label class="field"><span>কী দেখতে চান (ঐচ্ছিক)</span><input id="in-note" maxlength="200" value="${esc(IN.note)}" placeholder="যেমন: সাইজ, রং, কতটা নরম"></label>
    <button class="btn btn-green btn-wide" style="margin-top:14px" data-act="in-submit">অনুরোধ পাঠান</button></div>`);
}

/* ---------- deals: offers, orders, inspections ---------- */
let DT='offers', DF='all';
function offerRow(o){
  const id=me().id, sell=o.seller===id, other=user(sell?o.buyer:o.seller), mine=['pending','countered'].includes(o.status)&&((o.waiting==='seller'&&sell)||(o.waiting==='buyer'&&!sell));
  return `<a class="item" href="#/offer/${o.id}" style="text-decoration:none;color:inherit">${cropIco(o.crop)}<div class="grow">
    <div class="row wrap-it"><b>${monTxt(o.qty)} ${CROPS[o.crop].n}</b>${pill(OFFER_ST[o.status])}${mine?'<span class="pill p-red">আপনার উত্তর দরকার</span>':''}</div>
    <div class="muted sm">${sell?'ক্রেতা':'বিক্রেতা'}: ${esc(dispName(other))} · ${tk(o.price,1)}/কেজি ${o.price<o.listed_price?`(তালিকায় ${tk(o.listed_price,1)})`:''} · ${ago(o.updated)}</div></div><span>›</span></a>`;
}
function orderRow(o){
  const id=me().id, sell=o.seller===id, other=user(sell?o.buyer:o.seller);
  return `<a class="item" href="#/order/${o.id}" style="text-decoration:none;color:inherit">${cropIco(o.crop)}<div class="grow">
    <div class="row wrap-it"><b>${sell?'বিক্রি':'কেনা'}: ${monTxt(o.qty)} ${CROPS[o.crop].n}</b>${pill(ORDER_ST[o.status])}</div>
    <div class="muted sm">${sell?'ক্রেতা':'বিক্রেতা'}: ${esc(dispName(other))} · ${tk(o.goods)} · ${dateBn(o.created)}</div></div><span>›</span></a>`;
}
V.deals = () => {
  const id=me().id, offers=(S.offers||[]).filter(o=>DF==='all'||(DF==='in'?o.seller===id:o.buyer===id));
  const orders=S.orders||[], insp=S.inspections||[];
  const groups=[['আপনার কাজ আছে',orders.filter(o=>(o.status==='awaiting_payment'&&o.buyer===id)||(o.status==='handed_over'&&o.buyer===id)||(o.status==='confirmed'&&o.seller===id))],
    ['চলছে',orders.filter(o=>['awaiting_payment','confirmed','handed_over'].includes(o.status)&&!((o.status==='awaiting_payment'&&o.buyer===id)||(o.status==='handed_over'&&o.buyer===id)||(o.status==='confirmed'&&o.seller===id)))],
    ['সম্পূর্ণ',orders.filter(o=>o.status==='completed')],['বাতিল',orders.filter(o=>o.status==='cancelled')]];
  return `<div class="phead"><h1>🤝 অফার ও অর্ডার</h1></div>
    <div class="note" style="margin-bottom:12px">ধাপ: <b>অফার → বিক্রেতা রাজি → পেমেন্ট (অর্ডার নিশ্চিত) → মাল হস্তান্তর → সম্পূর্ণ</b>। টাকা Reroute-এ জমা থাকে, মাল বুঝে পেলে বিক্রেতা পান।</div>
    <div class="tabs">${[['offers',`অফার (${nf(S.offers.length)})`],['orders',`অর্ডার (${nf(orders.length)})`],['insp',`পরিদর্শন (${nf(insp.length)})`]].map(([k,t])=>`<button class="${DT===k?'on':''}" data-act="dt" data-v="${k}">${t}</button>`).join('')}</div>
    ${DT==='offers'?`<div class="tabs">${[['all','সব'],['in','আমার মালে এসেছে'],['out','আমি দিয়েছি']].map(([k,t])=>`<button class="${DF===k?'on':''}" data-act="df" data-v="${k}">${t}</button>`).join('')}</div>
      <div class="panel">${offers.map(offerRow).join('')||'<p class="muted">কোনো অফার নেই</p>'}</div>`:''}
    ${DT==='orders'?groups.filter(g=>g[1].length).map(([t,l])=>`<h3 style="margin:14px 0 6px">${t} (${nf(l.length)})</h3><div class="panel">${l.map(orderRow).join('')}</div>`).join('')||'<div class="empty">কোনো অর্ডার নেই</div>':''}
    ${DT==='insp'?`<div class="panel">${insp.map(i=>{ const l=listing(i.listing)||{crop:'tomato'}, other=user(i.seller===id?i.buyer:i.seller);
      return `<a class="item" href="#/inspection/${i.id}" style="text-decoration:none;color:inherit">${cropIco(l.crop)}<div class="grow"><div class="row"><b>${i.kind==='video'?'📹 ভিডিও':'🚶 সরাসরি'} পরিদর্শন</b>${pill(INSP_ST[i.status])}</div>
        <div class="muted sm">${i.seller===id?'ক্রেতা':'বিক্রেতা'}: ${esc(dispName(other))} · ${esc(i.pref)}</div></div><span>›</span></a>`; }).join('')||'<p class="muted">কোনো পরিদর্শন নেই</p>'}</div>`:''}`;
};
