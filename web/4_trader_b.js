/* ---------- offer detail & negotiation ---------- */
const EV_BN = {offer:'অফার দিয়েছেন',counter:'পাল্টা দাম দিয়েছেন',accept:'রাজি হয়েছেন',reject:'রাজি হননি',cancel:'অফার তুলে নিয়েছেন',expire:'মেয়াদ শেষ'};
function sellerPayout(o, price){
  const u=me(), kg=o.qty, goods=price*kg, fee=platformFee(goods), feeDisc=Math.min(u.fee_credit||0,fee);
  let share=0, credit=0, q=null;
  if(o.transport==='reroute'){ q=quote(u.place,user(o.buyer).place,kg,false,false); share={buyer:0,half:q.total/2,seller:q.total}[o.split]; credit=Math.min(u.transport_credit||0,share*.5); }
  return {goods,fee,feeDisc,share,credit,payout:goods-fee+feeDisc-share+credit,q};
}
function buyerTotal(o, price){
  const u=me(), s=user(o.seller), kg=o.qty, goods=price*kg; let share=0, credit=0, q=null;
  if(o.transport==='reroute'){ q=myQuote(s.place,u.place,kg); share={buyer:q.total,half:q.total/2,seller:0}[o.split]; credit=Math.min(u.transport_credit||0,share*.5); }
  return {goods,share,credit,total:goods+share-credit,q};
}
V.offer = id => {
  const o=(S.offers||[]).find(x=>x.id===id); if(!o) return `<div class="empty">অফার পাওয়া যায়নি</div>`;
  const u=me(), sell=o.seller===u.id, other=user(sell?o.buyer:o.seller), l=listing(o.listing), ev=(S.offer_events||[]).filter(e=>e.offer===id);
  const myTurn=['pending','countered'].includes(o.status)&&((o.waiting==='seller'&&sell)||(o.waiting==='buyer'&&!sell));
  const left=Math.max(0,Math.round((o.expires-Date.now())/36e5));
  let acts='';
  if(myTurn&&sell) acts=`<div class="row wrap-it"><button class="btn btn-green grow" data-act="o-accept" data-id="${id}">✓ রাজি</button>
      ${o.price<o.listed_price?`<button class="btn btn-blue grow" data-act="o-counter" data-id="${id}">↔️ পাল্টা দাম দিন</button>`:''}<button class="btn btn-soft grow" data-act="o-reject" data-id="${id}">না</button></div>
      ${o.price<o.listed_price?'':`<p class="muted sm" style="margin-top:8px">ক্রেতা তালিকার পুরো দামেই কিনতে চান, তাই এখানে পাল্টা দাম দেওয়ার দরকার নেই।</p>`}`;
  if(myTurn&&!sell) acts=`<div class="row wrap-it"><button class="btn btn-green grow" data-act="o-accept" data-id="${id}">✓ রাজি, পেমেন্ট করব</button><button class="btn btn-soft grow" data-act="o-reject" data-id="${id}">না</button></div>`;
  if(!myTurn&&!sell&&['pending','countered'].includes(o.status)&&o.waiting==='seller') acts=`<button class="btn btn-line" data-act="o-cancel" data-id="${id}">অফার তুলে নিন</button>`;
  if(o.status==='accepted') acts=`<a class="btn btn-green btn-wide" href="#/order/${o.order_id}">অর্ডার দেখুন ›</a>`;
  const est = sell ? sellerPayout(o,o.price) : buyerTotal(o,o.price);
  return `<p><a href="#/deals">← অফার ও অর্ডার</a></p>
  <div class="grid2" style="margin-top:10px;align-items:start"><div class="panel">
    <div class="between"><h1>${CROPS[o.crop].i} ${monTxt(o.qty)} ${CROPS[o.crop].n}</h1>${pill(OFFER_ST[o.status])}</div>
    ${myTurn?`<div class="danger" style="margin-top:10px">আপনার উত্তর দরকার${left?` · ${nf(left)} ঘণ্টার মধ্যে, নইলে মেয়াদ শেষ`:''}</div>`:''}
    <dl class="kv" style="margin-top:12px"><dt>${o.status==='countered'?'পাল্টা দাম':'প্রস্তাবিত দাম'}</dt><dd>${tk(o.price,1)}/কেজি</dd><dt>তালিকার দাম</dt><dd>${tk(o.listed_price,1)}/কেজি</dd>
      <dt>পরিমাণ</dt><dd>${kgMon(o.qty)}</dd><dt>মোট মালের দাম</dt><dd>${tk(o.price*o.qty)}</dd>
      <dt>পরিবহন</dt><dd>${o.transport==='reroute'?'🚚 Reroute ট্রাক, ভাড়া '+{buyer:'ক্রেতা দেবেন',half:'অর্ধেক অর্ধেক',seller:'বিক্রেতা দেবেন'}[o.split]:'🚛 ক্রেতা নিজে আনবেন'}</dd>
      <dt>ডেলিভারি</dt><dd>${PLACES[user(o.seller).place].n} → ${PLACES[user(o.buyer).place].n}</dd></dl>
    ${o.note?`<p class="note" style="margin-top:10px" data-i18n-skip>💬 ${esc(o.note)}</p>`:''}
    <h3 style="margin-top:14px">${sell?'রাজি হলে আপনি পাবেন (আনুমানিক)':'রাজি হলে আপনি দেবেন'}</h3>
    ${sell?bill([['মালের দাম',tk(est.goods)],['প্ল্যাটফর্ম ফি ১%','−'+tk(est.fee),'minus'],est.feeDisc?['⭐ ফি ছাড়','+'+tk(est.feeDisc),'plus']:null,
        est.share?['ট্রাক ভাড়া, আপনার ভাগ','−'+tk(est.share),'minus']:null,est.credit?['⭐ পরিবহন ছাড়','+'+tk(est.credit),'plus']:null,['আপনার হাতে আসবে',tk(est.payout),'tot']])
      :bill([['মালের দাম',tk(est.goods)],est.share?['ট্রাক ভাড়া, আপনার ভাগ',tk(est.share)]:null,est.credit?['⭐ পরিবহন ছাড়','−'+tk(est.credit),'plus']:null,['মোট পেমেন্ট',tk(est.total),'tot']])}
    ${sell&&l?`<p class="muted sm" style="margin-top:8px">${PLACES[me().place].n}-এ আজকের বাজার দর আনুমানিক ${tk(MARKET_DEMO[me().place][o.crop])}/কেজি <span class="demo-tag">ডেমো</span>। হাটে বেচলে ${tk(MARKET_DEMO[me().place][o.crop]*o.qty)}।</p>`:''}
    <div style="margin-top:14px">${acts}</div></div>
    <div><div class="panel"><h3>${sell?'ক্রেতা':'বিক্রেতা'}</h3><div style="margin-top:8px">${personRow(other)}</div>
      <a class="btn btn-line btn-sm" style="margin-top:10px" href="#/u/${other.id}">পুরো প্রোফাইল ও রিভিউ</a></div>
      <div class="panel"><h3>দরদামের ইতিহাস</h3><div class="timeline">${ev.map(e=>`<div><b>${e.by==='system'?'সিস্টেম':esc(dispName(user(e.by)))}</b> ${EV_BN[e.action]||e.action}${e.price&&['offer','counter','accept'].includes(e.action)?`: ${tk(e.price,1)}/কেজি`:''}${e.note?` · "${esc(e.note)}"`:''}<div class="muted xs">${ago(e.at)}</div></div>`).join('')}</div></div>
      ${l?`<div class="panel"><a href="#/listing/${l.id}">লিস্টিং দেখুন ›</a></div>`:''}</div></div>`;
};

/* ---------- order detail ---------- */
V.order = id => {
  const o=(S.orders||[]).find(x=>x.id===id); if(!o) return `<div class="empty">অর্ডার পাওয়া যায়নি</div>`;
  const u=me(), sell=o.seller===u.id, other=user(sell?o.buyer:o.seller), b=(S.bookings||[]).find(x=>x.id===o.booking);
  const truck=b&&b.truck?(S.my_trucks||[]).find(t=>t.id===b.truck):null, phone=(S.contacts||{})[other.id];
  const idx=o.status==='cancelled'?(o.paid_at?2:1):ORDER_IDX[o.status];
  const tn=(S.transport_negotiations||{})[id];
  const tnPending=tn&&tn.status!=='agreed';
  const pendingProp=tn&&(tn.proposals||[]).find(p=>p.status==='pending');
  const iAmRecipient=pendingProp&&pendingProp.recipient===u.id;
  const iAmProposer=pendingProp&&pendingProp.proposer===u.id;
  let acts='';
  // Transport negotiation block (shown before payment)
  let tnBlock='';
  if(o.transport==='reroute'&&tn){
    if(tn.status==='agreed'){
      tnBlock=`<div class="panel" style="margin-top:10px"><div class="between"><h3>🚚 পরিবহন চুক্তি</h3><span class="pill p-green">নিশ্চিত</span></div>
        ${bill([['মোট ট্রাক ভাড়া',tk(tn.t_total)],['ক্রেতার ভাগ',tk(tn.agreed_buyer_amt)+'  ('+nf(tn.agreed_buyer_pct,1)+'%)'],['বিক্রেতার ভাগ',tk(tn.agreed_seller_amt)+'  ('+nf(tn.agreed_seller_pct,1)+'%)']])}</div>`;
    } else {
      // Show negotiation panel
      const latestProps=(tn.proposals||[]).slice().reverse();
      tnBlock=`<div class="panel" style="margin-top:10px"><div class="between"><h3>🚚 পরিবহন খরচ চুক্তি</h3><span class="pill p-gold">অপেক্ষমান</span></div>
        <p class="muted sm" style="margin-top:6px">মোট ট্রাক ভাড়া: <b>${tk(tn.t_total)}</b></p>
        ${pendingProp&&iAmRecipient?`<div class="warn" style="margin-top:10px">
          <b>নতুন প্রস্তাব এসেছে:</b> ক্রেতার ভাগ ${tk(pendingProp.buyer_amt)} (${nf(pendingProp.buyer_pct,1)}%), বিক্রেতার ভাগ ${tk(pendingProp.seller_amt)} (${nf(pendingProp.seller_pct,1)}%)
          <div class="row" style="margin-top:8px">
            <button class="btn btn-green grow" data-act="tn-accept" data-oid="${id}" data-pid="${pendingProp.id}">✓ গ্রহণ করুন</button>
            <button class="btn btn-soft grow" data-act="tn-reject" data-oid="${id}" data-pid="${pendingProp.id}">না</button>
            <button class="btn btn-blue grow" data-act="tn-counter" data-oid="${id}">পাল্টা দিন</button>
          </div></div>`
        :pendingProp&&iAmProposer?`<div class="note" style="margin-top:10px">প্রস্তাব পাঠানো হয়েছে: ক্রেতার ভাগ ${tk(pendingProp.buyer_amt)} (${nf(pendingProp.buyer_pct,1)}%), বিক্রেতার ভাগ ${tk(pendingProp.seller_amt)} (${nf(pendingProp.seller_pct,1)}%)। অপরজনের উত্তরের অপেক্ষা।
          <div style="margin-top:8px"><button class="btn btn-line btn-sm" data-act="tn-propose" data-oid="${id}">নতুন প্রস্তাব দিন</button></div></div>`
        :`<div style="margin-top:10px"><button class="btn btn-green btn-wide" data-act="tn-propose" data-oid="${id}">পরিবহন খরচের প্রস্তাব দিন</button></div>`}
        ${latestProps.length?`<div class="timeline" style="margin-top:10px">${latestProps.slice(0,5).map(p=>`<div><b>${esc(dispName(user(p.proposer)))}</b> প্রস্তাব: ক্রেতা ${nf(p.buyer_pct,1)}% (৳${nf(p.buyer_amt)}), বিক্রেতা ${nf(p.seller_pct,1)}% (৳${nf(p.seller_amt)}) <span class="pill ${p.status==='accepted'?'p-green':p.status==='rejected'?'p-red':p.status==='superseded'?'p-grey':'p-gold'}">${{pending:'অপেক্ষমান',accepted:'গৃহীত',rejected:'প্রত্যাখ্যাত',superseded:'পুরনো'}[p.status]||p.status}</span><div class="muted xs">${ago(p.created)}</div></div>`).join('')}</div>`:''}</div>`;
    }
  }
  if(o.status==='awaiting_payment'&&!sell){
    if(o.transport==='reroute'&&tnPending){
      acts=`<div class="warn">পরিবহন খরচের চুক্তি নিশ্চিত করুন, তারপর পেমেন্ট করুন।</div>`;
    } else {
      acts=`<button class="btn btn-green btn-wide" data-act="pay-order" data-id="${id}">💳 ${tk(o.buyer_total)} পেমেন্ট করুন</button>`;
    }
  }
  if(o.status==='awaiting_payment'&&sell) acts=`<div class="warn">ক্রেতার পেমেন্টের অপেক্ষা। ${nf(Math.max(0,Math.round((o.created+24*36e5-Date.now())/36e5)))} ঘণ্টার মধ্যে না দিলে অর্ডার নিজে থেকে বাতিল হবে।</div>`;
  if(o.status==='confirmed'&&sell){
    if(o.transport==='self') acts=`<button class="btn btn-green btn-wide" data-act="handover" data-id="${id}">📦 পাইকারকে মাল বুঝিয়ে দিয়েছি</button>`;
    else if(b&&['pickup_scheduled','in_transit'].includes(b.status)) acts=`<button class="btn btn-green btn-wide" data-act="handover" data-id="${id}">🚚 ট্রাকে মাল তুলে দিয়েছি</button>`;
    else acts=`<div class="note">🚚 Reroute ট্রাক ঠিক হলে চালকের নাম, নম্বর আর আসার সময় জানানো হবে। মাল তৈরি রাখুন।</div>`;
  }
  if(o.status==='confirmed'&&!sell) acts=`<div class="note">💰 আপনার টাকা Reroute-এ জমা আছে। ${o.transport==='reroute'?'ট্রাক মাল নিয়ে রওনা দিলে জানানো হবে।':'নিজের ট্রাকে মাল নিয়ে আসুন।'}</div>`;
  if(o.status==='handed_over'&&!sell) acts=`<button class="btn btn-green btn-wide" data-act="complete" data-id="${id}">✅ মাল বুঝে পেয়েছি</button><p class="muted sm" style="margin-top:6px">চাপলে বিক্রেতা টাকা পাবেন। মাল না পেলে বা সমস্যা থাকলে চাপবেন না।</p>`;
  if(o.status==='handed_over'&&sell) acts=`<div class="note">মাল পৌঁছালে ক্রেতা নিশ্চিত করবেন, তখন টাকা আপনার ওয়ালেটে যাবে।</div>`;
  if(o.status==='completed'&&!(S.rated||[]).includes(id)) acts=`<button class="btn btn-line btn-wide" data-act="rate-open" data-id="${id}">⭐ ${esc(dispName(other))}-কে রেটিং দিন</button>`;
  const canCancel=['awaiting_payment','confirmed'].includes(o.status);
  const P=o.pnl;
  return `<p><a href="#/deals">← অফার ও অর্ডার</a></p>
  <div class="grid2" style="margin-top:10px;align-items:start"><div>
    <div class="panel"><div class="between"><h1>${CROPS[o.crop].i} ${sell?'বিক্রি':'কেনা'}: ${monTxt(o.qty)} ${CROPS[o.crop].n}</h1>${pill(ORDER_ST[o.status])}</div>
      <p class="muted sm">অর্ডার ${o.id} · ${dateBn(o.created)}</p>
      <h3 style="margin-top:12px">অর্ডারের ধাপ</h3>${track(ORDER_STEPS, idx, o.status==='cancelled')}
      ${o.status==='cancelled'?`<div class="danger" style="margin-top:8px">❌ ${o.cancelled_by==='system'?'সিস্টেম':o.cancelled_by===u.id?'আপনি':esc(dispName(other))} বাতিল করেছেন${o.reason?`। কারণ: ${esc(o.reason)}`:''}${o.paid_at&&!sell?'। টাকা ওয়ালেটে ফেরত দেওয়া হয়েছে।':''}</div>`:''}
      <div style="margin-top:14px">${acts}</div>
      ${canCancel?`<button class="btn btn-soft btn-sm" style="margin-top:10px" data-act="order-cancel" data-id="${id}">অর্ডার বাতিল করুন</button>`:''}</div>
    ${tnBlock}
    ${o.transport==='reroute'&&b&&tn&&tn.status==='agreed'?`<div class="panel"><div class="between"><h3>🚚 পরিবহন</h3>${pill(BOOK_ST[b.status])}</div>
      ${b.status!=='cancelled'&&b.status!=='awaiting_payment'?track(BOOK_STEPS,BOOK_IDX[b.status]):''}
      ${truck?`<div class="note" style="margin-top:8px">${esc(truck.company)} · ${S.config.vehicles[truck.vehicle].n} · ${esc(truck.number)}<br>চালক ${esc(truck.driver)}, 📞 ${bd(truck.phone)}${b.pickup_time?`<br>মাল তোলা: ${esc(b.pickup_time)}`:''}</div>`:''}
      <a href="#/booking/${b.id}" class="sm">বুকিংয়ের বিস্তারিত ›</a></div>`:o.transport==='self'?`<div class="panel"><h3>🚛 পরিবহন</h3><p class="muted">ক্রেতা নিজের ট্রাকে মাল নেবেন।</p></div>`:''}</div>
  <div><div class="panel"><h3>${sell?'ক্রেতা':'বিক্রেতা'}</h3><div style="margin-top:8px">${personRow(other)}</div>
      ${phone?`<div class="good" style="margin-top:10px">📞 ${bd(phone)}</div>`:`<p class="muted sm" style="margin-top:8px">পেমেন্টের পর ফোন নম্বর দেখা যাবে</p>`}</div>
    <div class="panel"><h3>💰 টাকার হিসাব</h3>
      ${sell?bill([['মালের দাম',`${tk(o.goods)} (${tk(o.price,1)}/কেজি)`],o.price<o.listed_price?['তালিকার দাম ছিল',tk(o.listed_price,1)+'/কেজি']:null,['প্ল্যাটফর্ম ফি ১%','−'+tk(o.fee),'minus'],o.fee_disc?['⭐ ফি ছাড়','+'+tk(o.fee_disc),'plus']:null,
          o.t_seller?['ট্রাক ভাড়া, আপনার ভাগ','−'+tk(o.t_seller),'minus']:null,o.t_cs?['⭐ পরিবহন ছাড়','+'+tk(o.t_cs),'plus']:null,o.cashback?['🎁 ক্যাশব্যাক','+'+tk(o.cashback),'plus']:null,
          [o.status==='completed'?'ওয়ালেটে জমা হয়েছে':'মাল বুঝে দিলে পাবেন',tk(o.payout+(o.cashback||0)),'tot']])
        :bill([['মালের দাম',`${tk(o.goods)} (${tk(o.price,1)}/কেজি)`],o.t_buyer?['ট্রাক ভাড়া, আপনার ভাগ',tk(o.t_buyer)]:null,o.t_cb?['⭐ পরিবহন ছাড়','−'+tk(o.t_cb),'plus']:null,
          [o.paid_at?'পরিশোধ করেছেন':'পরিশোধ করতে হবে',tk(o.buyer_total),'tot']])}
      ${o.t_total&&tn&&tn.status==='agreed'?`<p class="muted sm" style="margin-top:8px">মোট ট্রাক ভাড়া ${tk(o.t_total)} (Reroute সেবা চার্জসহ)। চুক্তি: ক্রেতা ${nf(tn.agreed_buyer_pct,1)}%, বিক্রেতা ${nf(tn.agreed_seller_pct,1)}%।</p>`:''}
      ${o.paid_at?`<p class="muted sm">পেমেন্ট: ${dateBn(o.paid_at)}</p>`:''}</div>
    ${P?`<div class="panel"><h3>📊 এই অর্ডারের লাভ-ক্ষতি</h3>
      ${P.side==='seller'?bill([['বিক্রি',tk(P.revenue)],P.cost!=null?['মালের খরচ (উৎপাদন/কেনা)','−'+tk(P.cost),'minus']:null,['ট্রাক ভাড়া','−'+tk(P.transport),'minus'],['প্ল্যাটফর্ম ফি','−'+tk(P.fee),'minus'],P.cashback?['ক্যাশব্যাক','+'+tk(P.cashback),'plus']:null,
          P.profit!=null?['লাভ',tk(P.profit),'tot']:['খরচ বাদে হাতে এসেছে',tk(P.net_before_cost),'tot']])
        + (P.profit==null?'<p class="warn sm" style="margin-top:8px">মালের খরচ দেওয়া নেই, তাই সঠিক লাভ বলা যাচ্ছে না।</p>':'')
        :bill([['মালের দাম',tk(P.goods)],['ট্রাক ভাড়া',tk(P.transport)],['মোট কেনা খরচ',tk(P.landed),'tot'],['প্রতি কেজি খরচ',tk(P.per_kg,1)]])
          + `<p class="muted sm" style="margin-top:8px">আপনার বাজারে আজকের দর আনুমানিক ${tk(MARKET_DEMO[me().place][o.crop])}/কেজি <span class="demo-tag">ডেমো</span>। এই দামে বেচলে আনুমানিক লাভ ${tk((MARKET_DEMO[me().place][o.crop]-P.per_kg)*o.qty)}।</p>`}</div>`:''}</div></div>`;
};

/* ---------- inspection detail — full 6-step workflow ---------- */
V.inspection = id => {
  const i=(S.inspections||[]).find(x=>x.id===id);
  if(!i) return `<div class="empty">পাওয়া যায়নি</div>`;
  const u=me(), sell=i.seller===u.id, other=user(sell?i.buyer:i.seller), l=listing(i.listing);
  let acts='', info='';

  // Timeline / status steps
  const steps=['অনুরোধ','সময় প্রস্তাব','সময় নিশ্চিত','পরিদর্শন সম্পন্ন'];
  const stepIdx={requested:0,time_proposed:1,scheduled:2,buyer_done:2,completed:3,disputed:3};
  const si=stepIdx[i.status]??0;

  if(i.proposed_time) info+=`<dt>প্রস্তাবিত সময়</dt><dd data-i18n-skip>${esc(i.proposed_time)}</dd>`;
  if(i.confirmed_time) info+=`<dt>নিশ্চিত সময়</dt><dd data-i18n-skip>${esc(i.confirmed_time)}</dd>`;

  // --- SELLER ACTIONS ---
  if(sell){
    if(i.status==='requested'){
      acts=`<label class="field"><span>পরিদর্শনের তারিখ ও সময় প্রস্তাব করুন</span>
        <input id="insp-time" placeholder="যেমন: ২৫ জানুয়ারি বেলা ১১টায়" value="${i.kind==='video'?'আগামীকাল বিকেল ৪টায়':'কাল সকাল ১০টায়'}">
      </label>
      <label class="field"><span>অতিরিক্ত নোট (ঐচ্ছিক)</span>
        <input id="insp-reply" placeholder="যেমন: মূল রাস্তার পাশে আসবেন">
      </label>
      <div class="row" style="margin-top:10px">
        <button class="btn btn-green grow" data-act="insp-propose-time" data-id="${id}">📅 সময় প্রস্তাব করুন</button>
        <button class="btn btn-soft grow" data-act="insp-decline" data-id="${id}">রাজি নই</button>
      </div>`;
    }
    if(i.status==='buyer_done'){
      acts=`<div class="warn" style="margin-bottom:10px">ক্রেতা বলছেন মাল দেখেছেন। আপনি কি নিশ্চিত করবেন?</div>
      <div class="row">
        <button class="btn btn-green grow" data-act="insp-seller-verify" data-id="${id}" data-v="1">✅ হ্যাঁ, পরিদর্শন হয়েছে</button>
        <button class="btn btn-red grow" data-act="insp-seller-verify" data-id="${id}" data-v="0">❌ না, আসেননি</button>
      </div>`;
    }
  }

  // --- BUYER ACTIONS ---
  if(!sell){
    if(i.status==='time_proposed'){
      acts=`<div class="note" style="margin-bottom:10px">বিক্রেতা পরিদর্শনের সময় প্রস্তাব করেছেন: <b>${esc(i.proposed_time||'')}</b></div>
      <button class="btn btn-green btn-wide" data-act="insp-confirm-schedule" data-id="${id}">✅ এই সময়ে আসব — নিশ্চিত করুন</button>`;
    }
    if(i.status==='scheduled'){
      acts=`<div class="note" style="margin-bottom:10px">পরিদর্শনের সময়: <b>${esc(i.confirmed_time||i.proposed_time||'')}</b></div>
      <button class="btn btn-green btn-wide" data-act="insp-buyer-done" data-id="${id}">🔍 আমি মাল দেখেছি</button>
      <p class="muted sm" style="margin-top:6px">মাল পরিদর্শন করার পর এই বাটন চাপুন। বিক্রেতা নিশ্চিত করলে পরিদর্শন সম্পন্ন হবে।</p>`;
    }
    if(i.status==='completed'&&l&&l.status==='active'){
      acts=`<a class="btn btn-green btn-wide" data-act="offer-open" data-id="${l.id}">✅ পরিদর্শন সম্পন্ন — এখন অফার দিন</a>`;
    }
    if(['requested','time_proposed','scheduled'].includes(i.status)){
      acts+=(acts?'<div style="margin-top:8px">':'')
        +`<button class="btn btn-soft btn-sm" ${acts?'':'style="margin-top:8px"'} data-act="insp-cancel" data-id="${id}">অনুরোধ বাতিল করুন</button>`
        +(acts?'</div>':'');
    }
  }

  const statusColor={requested:'p-gold',time_proposed:'p-blue',scheduled:'p-blue',buyer_done:'p-gold',completed:'p-green',disputed:'p-red',declined:'p-red',cancelled:'p-grey'};
  return `<p><a href="#/deals" data-act="dt" data-v="insp">← পরিদর্শন</a></p>
  <div class="panel" style="max-width:680px;margin-top:10px">
    <div class="between">
      <h1>🔍 ${i.kind==='video'?'ভিডিও কলে':'সরাসরি'} মাল দেখা</h1>
      ${pill(INSP_ST[i.status]||[i.status,'p-grey'])}
    </div>
    ${l?`<p style="margin-top:6px"><a href="#/listing/${l.id}">${CROPS[l.crop].i} ${CROPS[l.crop].n}, ${monTxt(l.available)}</a></p>`:''}
    <div style="margin-top:10px">${personRow(other)}</div>
    ${!['cancelled','declined'].includes(i.status)?`<div class="track" style="margin-top:12px">${steps.map((s,idx)=>`<div class="st ${idx<=si?'done':''} ${idx===si?'now':''}"><i></i>${s}</div>`).join('')}</div>`:''}
    <dl class="kv" style="margin-top:12px">
      <dt>ক্রেতার পছন্দের সময়</dt><dd data-i18n-skip>${esc(i.pref)}</dd>
      ${i.note?`<dt>যা দেখতে চান</dt><dd data-i18n-skip>${esc(i.note)}</dd>`:''}
      ${info}
      ${i.reply?`<dt>নোট</dt><dd data-i18n-skip>${esc(i.reply)}</dd>`:''}
    </dl>
    ${i.status==='disputed'?`<div class="danger" style="margin-top:10px">⚠️ বিক্রেতা নিশ্চিত করেননি: ${esc(i.reply||'কোনো মন্তব্য নেই')}</div>`:''}
    <div style="margin-top:14px">${acts}</div>
  </div>`;
};

/* ---------- transport: our own truck service ---------- */
let BK=null;
function bkReset(){ const u=me(); BK={src:u?u.place:'rajshahi',srcAddr:u&&u.area||'',dst:u&&u.place==='dhaka'?'rajshahi':'dhaka',dstAddr:'',crop:'tomato',mon:25,date:'আগামীকাল'}; }
function bkQuote(){ const kg=BK.mon*MON, q=myQuote(BK.src,BK.dst,kg), credit=me()?Math.min(me().transport_credit||0,q.total*.5):0; return {kg,q,credit,pay:q.total-credit}; }
function bkBill(){
  const {kg,q,credit,pay}=bkQuote();
  return bill([[`${q.vehicle_name}${q.trucks>1?' × '+bd(q.trucks):''}${q.shared?' · শেয়ার্ড (অন্যের মালের সাথে)':' · পুরো ট্রাক'}`,''],[`দূরত্ব`,`${nf(q.km)} কিমি, পৌঁছাতে প্রায় ${nf(q.eta,1)} ঘণ্টা`],
    ['ট্রাক ভাড়া',tk(q.fare)],[`Reroute সেবা চার্জ ৮%${q.service_off?` (${nf(q.service_off*100)}% ছাড়)`:''}`,tk(q.service)],credit?['⭐ পরিবহন ছাড়','−'+tk(credit),'plus']:null,['মোট দিতে হবে',tk(pay),'tot']])
    + `<div class="grid2" style="gap:8px;margin-top:10px"><div class="panel" style="padding:10px;box-shadow:none;background:var(--surface2)"><span class="muted sm">বাজারে নিজে ট্রাক ভাড়া করলে</span><div class="b">${tk(q.offline)}</div></div>
      <div class="panel" style="padding:10px;box-shadow:none;background:var(--green-soft)"><span class="sm" style="color:var(--green)">Reroute-এ সাশ্রয়</span><div class="b" style="color:var(--green)">${tk(q.saving)} (${nf(Math.round(q.saving/q.offline*100))}%)</div></div></div>`;
}
V.transport = () => {
  if(!BK) bkReset();
  const u=me(), V2=S.config.vehicles, trucks=S.trucks||[];
  const mine=(S.bookings||[]);
  return `<div class="phead"><div><h1>🚚 Reroute ট্রাক সার্ভিস</h1><p class="muted">আমাদের নিজস্ব ট্রাক। কৃষক ও পাইকার দুজনেই বুক করতে পারেন, অর্ডারের সাথে বা আলাদা।</p></div></div>
  <div class="grid3">
    <div class="panel"><h3>কী কী পাবেন</h3><ul style="margin:8px 0 0;padding-left:18px"><li>ছাউনিওয়ালা ট্রাক, প্লাস্টিক ক্রেট</li><li>লোডিংয়ে সাহায্য</li><li>চালকের নাম-নম্বর আগেই জানবেন</li><li>প্রতিটি ধাপে নোটিফিকেশন</li><li>যাচাইকৃত কৃষক ও প্লাস সদস্যরা আগে ট্রাক পান</li></ul></div>
    <div class="panel"><h3>ভাড়া কীভাবে ঠিক হয়</h3><p class="sm" style="margin-top:8px">দূরত্ব, মালের ওজন আর গাড়ির ধরন দেখে। কম মাল হলে একই রুটের অন্যদের মালের সাথে <b>শেয়ার্ড ট্রাকে</b> যায়, তাই শুধু নিজের ভাগ দেন। পুরো ট্রাক হলেও ফেরার পথে মাল থাকায় ভাড়া কম। ভাড়ার উপর <b>৮% সেবা চার্জ</b>, এর বাইরে কিছু নেই।</p></div>
    <div class="panel"><h3>এলাকা ও বহর</h3><p class="sm" style="margin-top:8px">রাজশাহী বিভাগ ↔ ঢাকা</p>
      ${Object.entries(V2).map(([k,v])=>{ const n=trucks.filter(t=>t.vehicle===k), free=n.filter(t=>t.status!=='on_trip'&&t.status!=='maintenance').length;
        return `<div class="between sm" style="margin-top:6px"><span>${v.n}</span><span><b>${nf(free)}</b>/${nf(n.length)}টি খালি</span></div>`; }).join('')}</div></div>
  <div class="grid2" style="margin-top:14px;align-items:start">
    <div class="panel"><h2>ভাড়া দেখুন ও বুক করুন</h2>
      <div class="grid2" style="gap:10px"><label class="field"><span>কোথা থেকে (জেলা)</span><select data-bk="src">${Object.entries(PLACES).map(([k,p])=>`<option value="${k}" ${BK.src===k?'selected':''}>${p.n}</option>`).join('')}</select></label>
        <label class="field"><span>মাল তোলার ঠিকানা</span><input data-bk="srcAddr" value="${esc(BK.srcAddr)}" placeholder="গ্রাম/বাজার"></label>
        <label class="field"><span>কোথায় যাবে (জেলা)</span><select data-bk="dst">${Object.entries(PLACES).map(([k,p])=>`<option value="${k}" ${BK.dst===k?'selected':''}>${p.n}</option>`).join('')}</select></label>
        <label class="field"><span>পৌঁছানোর ঠিকানা</span><input data-bk="dstAddr" value="${esc(BK.dstAddr)}" placeholder="আড়ত/বাজার"></label>
        <label class="field"><span>ফসল</span><select data-bk="crop">${Object.entries(CROPS).map(([k,c])=>`<option value="${k}" ${BK.crop===k?'selected':''}>${c.n}</option>`).join('')}</select></label>
        <label class="field"><span>কত মণ</span><input data-bk="mon" type="number" min="3" value="${BK.mon}"></label>
        <label class="field"><span>কবে</span><select data-bk="date">${['আজ','আগামীকাল','পরশু'].map(d=>`<option ${BK.date===d?'selected':''}>${d}</option>`).join('')}</select></label></div>
      <div id="bk-bill" style="margin-top:12px">${bkBill()}</div>
      ${isTrader()?`<button class="btn btn-green btn-wide" style="margin-top:12px" data-act="bk-submit">ট্রাক বুক করুন ও পেমেন্ট</button>`:`<a class="btn btn-green btn-wide" style="margin-top:12px" href="#/login">বুক করতে লগ ইন করুন</a>`}
      <p class="muted sm" style="margin-top:6px">মাল কেনাবেচার সময় অফারেই Reroute ট্রাক বাছলে আলাদা বুক করতে হয় না।</p></div>
    <div class="panel"><h2>আমার বুকিং</h2>${isTrader()?(mine.length?mine.map(b=>`<a class="item" href="#/booking/${b.id}" style="text-decoration:none;color:inherit">${cropIco(b.crop,1)}<div class="grow">
        <div class="row wrap-it"><b>${PLACES[b.pickup_place].n} → ${PLACES[b.drop_place].n}</b>${pill(BOOK_ST[b.status])}${b.order_id?'<span class="pill p-grey">অর্ডারের</span>':''}</div>
        <div class="muted sm">${monTxt(b.qty)} ${CROPS[b.crop].n} · ${tk(b.total)} · ${dateBn(b.created)}</div></div><span>›</span></a>`).join(''):emptyState('truck','এখনো কোনো বুকিং নেই','পাশের ফর্মে ভাড়া দেখে ট্রাক বুক করুন। অফারে Reroute ট্রাক বাছলেও বুকিং এখানে আসবে।','',true)):'<p class="muted" style="margin-top:8px">লগ ইন করলে এখানে আপনার বুকিং দেখাবে</p>'}</div></div>`;
};
V.booking = id => {
  const b=(S.bookings||[]).find(x=>x.id===id); if(!b) return `<div class="empty">বুকিং পাওয়া যায়নি</div>`;
  const t=b.truck?(S.my_trucks||[]).find(x=>x.id===b.truck):null, ev=(S.booking_events||[]).filter(e=>e.booking===id), mine=b.uid===me().id&&!b.order_id;
  return `<p><a href="#/transport">← পরিবহন</a></p><div class="grid2" style="margin-top:10px;align-items:start"><div class="panel">
    <div class="between"><h1>🚚 ${PLACES[b.pickup_place].n} → ${PLACES[b.drop_place].n}</h1>${pill(BOOK_ST[b.status])}</div>
    <p class="muted sm">বুকিং ${b.id}${b.order_id?` · <a href="#/order/${b.order_id}">অর্ডারের সাথে যুক্ত</a>`:''}${b.priority?' · ⭐ অগ্রাধিকার':''}</p>
    ${!['cancelled','awaiting_payment'].includes(b.status)?track(BOOK_STEPS,BOOK_IDX[b.status]):''}
    <dl class="kv" style="margin-top:12px"><dt>মাল</dt><dd>${kgMon(b.qty)} ${CROPS[b.crop].n}</dd><dt>তোলা হবে</dt><dd>${esc(b.pickup_addr||'')}${b.pickup_addr?', ':''}${PLACES[b.pickup_place].n}</dd>
      <dt>পৌঁছাবে</dt><dd>${esc(b.drop_addr||'')}${b.drop_addr?', ':''}${PLACES[b.drop_place].n}</dd><dt>দিন</dt><dd>${esc(b.date||'')}</dd><dt>গাড়ি</dt><dd>${S.config.vehicles[b.vehicle].n}${b.trucks_n>1?' × '+bd(b.trucks_n):''}</dd>
      <dt>দূরত্ব / সময়</dt><dd>${nf(b.km)} কিমি, প্রায় ${nf(b.eta,1)} ঘণ্টা</dd>${b.pickup_time?`<dt>মাল তোলার সময়</dt><dd>${esc(b.pickup_time)}</dd>`:''}</dl>
    ${t?`<div class="note" style="margin-top:12px"><b>${esc(t.company)}</b> · ${esc(t.number)}<br>চালক ${esc(t.driver)}, 📞 ${bd(t.phone)}</div>`:''}
    ${mine&&b.status==='awaiting_payment'?`<button class="btn btn-green btn-wide" style="margin-top:12px" data-act="pay-booking" data-id="${b.id}">💳 ${tk(b.total-b.credit_used)} পেমেন্ট করুন</button>`:''}
    ${mine&&['awaiting_payment','requested','confirmed','pickup_scheduled'].includes(b.status)?`<button class="btn btn-soft btn-sm" style="margin-top:10px" data-act="bk-cancel" data-id="${b.id}">বুকিং বাতিল</button>`:''}</div>
  <div><div class="panel"><h3>💰 ভাড়ার হিসাব</h3>${bill([['ট্রাক ভাড়া',tk(b.fare)],['Reroute সেবা চার্জ',tk(b.service)],['মোট',tk(b.total),'tot'],b.credit_used?['⭐ পরিবহন ছাড়','−'+tk(b.credit_used),'plus']:null,b.order_id?['ভাগ','অর্ডারের শর্ত অনুযায়ী']:null,['বাজারে নিজে ভাড়া করলে',tk(b.offline)]])}
    ${b.status==='delivered'?`<p class="muted sm" style="margin-top:8px">ডেলিভারির পর হিসাব চূড়ান্ত: ট্রাক ভাড়া ${tk(b.actual_fare||b.fare)}</p>`:''}</div>
    <div class="panel"><h3>হালনাগাদ</h3><div class="timeline">${ev.map(e=>`<div><b>${(BOOK_ST[e.status]||[e.status])[0]}</b>${e.note?` · ${esc(e.note)}`:''}<div class="muted xs">${ago(e.at)}</div></div>`).join('')}</div></div></div></div>`;
};
