/* =====================================================================
   Reroute Agro — একটিমাত্র "AI পরামর্শ"
   * কৃষক: আজকের দর ও ৩ দিনের পূর্বাভাস · প্রস্তাবিত বিক্রয়মূল্য · কোথায় বেচলে লাভ · সম্ভাব্য লাভ/লোকসান
   * পাইকার: আজকের দর ও ৩ দিনের পূর্বাভাস · প্রস্তাবিত ক্রয়মূল্য · কোথা থেকে কিনবেন/কোথায় বেচবেন · লাভ/লোকসান
   * Smart Trade Alert: অফার / রাজি / পাল্টা দাম / লিস্টিং পাঠানোর আগে ওই লেনদেনের লাভ-ক্ষতি
   * Admin: সম্পন্ন লেনদেনের ডেটাসেট, CSV / Excel export, মডেল মূল্যায়ন
   আগের আলাদা "দাম ও পরামর্শ" (#/prices) এখন এই পাতায় মিশে গেছে; পুরনো লিংক এখানেই আসে।
   ===================================================================== */

/* ---------- menu: one AI option instead of two ---------- */
(function advNav(){
  const item = ['#/advisor', '🤖', 'AI পরামর্শ'];
  const old = NAV_TRADER.findIndex(n => n[0] === '#/prices');
  const has = NAV_TRADER.findIndex(n => n[0] === '#/advisor');
  if (old >= 0 && has >= 0) NAV_TRADER.splice(old, 1);
  else if (old >= 0) NAV_TRADER.splice(old, 1, item);
  else if (has < 0) NAV_TRADER.push(item);
  if (!NAV_ADMIN.some(n => n[0] === '#/admin/ai')) NAV_ADMIN.push(['#/admin/ai', '🤖', 'AI ডেটা']);
})();

/* ---------- English for the new texts (longer phrases first) ---------- */
I18N_PHRASES.unshift(
  ['আজকের বাজারদর ও ৩ দিনের পূর্বাভাস', "Today's price & 3-day forecast"],
  ['প্রস্তাবিত বিক্রয়মূল্য', 'Suggested selling price'],
  ['প্রস্তাবিত ক্রয়মূল্য', 'Suggested buying price'],
  ['কোথায় বিক্রি করলে বেশি লাভ', 'Where to sell for more profit'],
  ['কোথা থেকে কিনবেন, কোথায় বেচবেন', 'Where to buy, where to sell'],
  ['সম্ভাব্য লাভ বা লোকসান', 'Expected profit or loss'],
  ['লোকসানের ঝুঁকি', 'Risk of loss'],
  ['ঝুঁকি বুঝে এগিয়ে যান', 'Proceed at my own risk'],
  ['দাম বদলান', 'Change price'],
  ['মূল পরামর্শ', 'Main advice'],
  ['পূর্বাভাস নিশ্চিত নয়', 'Forecasts are not certain'],
  ['সিমুলেটেড ডেমো ডেটা', 'simulated demo data'],
  ['লাভ-ক্ষতি হিসাব হচ্ছে', 'Calculating profit and loss'],
  ['আনুমানিক লাভজনক', 'Likely profitable'],
  ['লেনদেনের ডেটা ও AI মূল্যায়ন', 'Transaction data & AI evaluation'],
  ['মডেল মূল্যায়ন', 'Model evaluation'],
  ['নতুন করে প্রশিক্ষণ', 'Retraining'],
  ['AI ডেটা', 'AI data']
);

/* ---------- state & data ---------- */
const ADV = {view: null, crop: null, place: null, mon: 25, days: '', cost: '', costTouched: false, cache: {}, busy: {}};
const ADV_SEND = ['আজই পাঠান', 'কাল পাঠান', 'পরশু পাঠান', '৩ দিন পরে পাঠান'];

function advOnPage(){
  const p = parts();
  return p[0] === 'advisor' || (p[0] === 'admin' && p[1] === 'ai');
}

async function advFetch(path){
  const r = await fetch('/api' + path, {headers: TOKEN ? {'X-Token': TOKEN} : {}});
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

/* cached GET: returns data, or null while loading (re-renders the page when the data arrives) */
function advGet(path, ttl = 600000){
  const c = ADV.cache[path];
  if (c && !c.error && Date.now() - c.at < ttl) return c.d;
  if (!ADV.busy[path]) {
    ADV.busy[path] = 1;
    advFetch(path)
      .then(d => { ADV.cache[path] = {d, at: Date.now()}; })
      .catch(() => {
        ADV.cache[path] = {error: true, at: Date.now()};
        setTimeout(() => { if (advOnPage()) render(); }, 6000);
      })
      .finally(() => { delete ADV.busy[path]; if (advOnPage()) render(); });
  }
  return c && !c.error ? c.d : null;
}

function advRole(){
  const u = me();
  if (u && u.role === 'paikar') return 'buyer';
  if (u && u.role === 'farmer') return 'farmer';
  return ADV.view || 'farmer';
}

function advPrefillCost(){
  if (ADV.costTouched) return;
  const inv = (S.inventory || []).find(r => r.crop === ADV.crop);
  ADV.cost = inv && inv.cost != null ? String(Math.round(inv.cost * 10) / 10) : '';
}

function advDefaults(){
  const u = me();
  if (!ADV.place) ADV.place = u && PLACES[u.place] ? u.place : 'rajshahi';
  if (!ADV.crop) {
    const l = u && (S.listings || []).find(x => x.uid === u.id && x.status === 'active');
    ADV.crop = l ? l.crop : 'tomato';
    if (l) { ADV.mon = Math.max(1, Math.round(l.available / MON)); ADV.days = String(Math.max(1, l.days_left)); }
    advPrefillCost();
  }
}

const advLoading = t => `<div class="sk-wrap" role="status" aria-busy="true" style="margin-top:6px"><span class="sr-only">${t || 'AI হিসাব করছে...'}</span><div class="sk sk-block" style="margin-top:0"></div><div class="sk sk-block"></div></div>
  <p class="muted sm" style="text-align:center;margin-top:8px">${ic('🤖')} ${t || 'AI হিসাব করছে...'} প্রথমবার কয়েক সেকেন্ড লাগতে পারে।</p>`;
const advPct = v => `${v > 0 ? '+' : ''}${nf(v, 1)}%`;
const advMoney = v => `<b style="color:var(--${v >= 0 ? 'green' : 'red'})">${v < 0 ? '−' : ''}${tk(Math.abs(v))}</b>`;
const advArrow = v => v >= 2 ? `<span style="color:var(--green)">▲ ${advPct(v)}</span>`
  : v <= -2 ? `<span style="color:var(--red)">▼ ${advPct(v)}</span>` : `<span class="muted">→ ${advPct(v)}</span>`;

/* ---------- controls ---------- */
function advControls(buyer){
  const u = me(), guest = !u || u.role === 'admin';
  return `${guest ? `<div class="chips">${[['farmer', 'কৃষক হিসেবে দেখুন'], ['buyer', 'পাইকার হিসেবে দেখুন']]
      .map(([k, t]) => `<button class="chip ${advRole() === k ? 'on' : ''}" data-adv="view" data-v="${k}">${t}</button>`).join('')}</div>` : ''}
  <div class="chips">${Object.entries(CROPS).map(([k, c]) => `<button class="chip ${ADV.crop === k ? 'on' : ''}" data-adv="crop" data-v="${k}">${c.i} ${c.n}</button>`).join('')}</div>
  <div class="filters" style="grid-template-columns:repeat(${buyer ? 2 : 4},minmax(0,1fr))">
    <label><span>${buyer ? 'আপনার বাজার (যেখানে বেচবেন)' : 'মাল কোথায় আছে'}</span><select data-advf="place">${Object.entries(PLACES).map(([k, p]) => `<option value="${k}" ${ADV.place === k ? 'selected' : ''}>${p.n}</option>`).join('')}</select></label>
    <label><span>কত মণ</span><input data-advf="mon" type="number" min="1" max="2500" value="${ADV.mon}"></label>
    ${buyer ? '' : `<label><span>আর কত দিন তাজা থাকবে</span><select data-advf="days"><option value="">ফসল অনুযায়ী</option>${[1, 2, 3, 4, 5, 6, 7, 10].map(d => `<option value="${d}" ${ADV.days === String(d) ? 'selected' : ''}>${nf(d)} দিন</option>`).join('')}</select></label>
    <label><span>উৎপাদন খরচ ৳/কেজি</span><input data-advf="cost" type="number" min="0" step="0.5" value="${ADV.cost}" placeholder="লাভ-লোকসান দেখতে দিন"></label>`}</div>`;
}

/* ---------- section 1: today's price & 3-day forecast (same for both roles) ---------- */
function advForecast(m, home){
  const r0 = m.markets[0], spread = r0 ? Math.round((r0.fc_hi[2] / r0.fc[2] - 1) * 100) : 15;
  return `<div class="panel"><h3>১. আজকের বাজারদর ও ৩ দিনের পূর্বাভাস</h3>
    <div class="scroll"><table class="tbl" style="margin-top:6px">
      <tr><th>বাজার</th><th class="num">আজ</th><th class="num">কাল</th><th class="num">পরশু</th><th class="num">৩ দিন পরে</th><th class="num">দিক</th></tr>
      ${m.markets.map(r => `<tr style="${r.market === home ? 'background:var(--green-soft)' : r.glut ? 'background:var(--red-soft)' : ''}">
        <td><b>${esc(r.name)}</b>${r.market === home ? ' <span class="pill p-green">আপনার</span>' : ''}${r.glut ? ' <span class="pill p-red">মাল বেশি</span>' : ''}</td>
        <td class="num b">${tk(r.today, 1)}</td>${r.fc.map(v => `<td class="num">${tk(v, 1)}</td>`).join('')}
        <td class="num">${advArrow(r.change_3)}</td></tr>`).join('')}
    </table></div>
    <p class="muted xs" style="margin-top:6px">দাম ৳/কেজি। ${m.reroute_listings ? `Reroute-এ এখন ${nf(m.reroute_listings)}টি লিস্টিং, গড় দাম ${tk(m.reroute_avg, 1)}/কেজি (আসল)।` : 'Reroute-এ এখন এই ফসলের লিস্টিং নেই।'}</p>
    <p class="warn sm" style="margin-top:6px">${ic('⚠️')} পূর্বাভাস নিশ্চিত নয়। ৩ দিন পরের দাম সাধারণত পূর্বাভাসের ±${nf(spread)}% এর মধ্যে থাকে। এখনকার বাজারদর <span class="demo-tag">সিমুলেটেড ডেমো ডেটা</span>, আসল পাইলটে সরকারি দৈনিক দর বসবে।</p></div>`;
}

/* ---------- farmer ---------- */
function advFarmer(){
  const q = `/ai/advisor/farmer?src=${ADV.place}&crop=${ADV.crop}&qty=${ADV.mon * MON}${ADV.days ? `&days_left=${ADV.days}` : ''}${ADV.cost !== '' ? `&cost=${ADV.cost}` : ''}`;
  const d = advGet(q), m = advGet(`/ai/advisor/market?crop=${ADV.crop}`);
  let html = advControls(false);
  if (!d || !m) return html + advLoading();
  const b = d.best, loc = d.local_today, sg = d.suggest, c = CROPS[ADV.crop].n, hasCost = d.cost != null;
  const allLoss = hasCost && d.markets.every(o => o.profit < 0);
  const u = me(), canList = u && u.role !== 'admin';

  html += d.warnings.map(w => `<div class="alert spoil">${ic('⚠️')} ${esc(w)}</div>`).join('');

  html += `<div class="panel" style="border:2px solid var(--${allLoss ? 'red' : 'green'});margin-bottom:14px">
    <h2 style="color:var(--${allLoss ? 'red' : 'green'})">${ic('🤖')} মূল পরামর্শ</h2>
    ${allLoss
      ? `<p style="margin-top:8px;font-size:1.05rem">${ic('❌')} এই খরচে কোনো বাজারেই লাভ হচ্ছে না। সবচেয়ে কম লোকসান <b>${esc(b.name)}</b>-এ (${advMoney(b.profit)})।</p>
         <p class="muted" style="margin-top:4px">মাল তাজা থাকলে কিছুদিন অপেক্ষা করুন, অথবা Reroute-এ অন্তত ${tk(sg.floor, 1)}/কেজি দাম চান।</p>`
      : `<p style="margin-top:8px;font-size:1.05rem"><b>${ADV_SEND[b.send_in_days]}</b>, <b>${esc(b.name)}</b> বাজারে পাঠান — হাতে থাকবে আনুমানিক <b>${tk(b.net)}</b>${b.vs_local > 0 ? `, স্থানীয় হাটের চেয়ে ${tk(b.vs_local)} বেশি` : ''}।</p>
         <p class="muted" style="margin-top:4px">Reroute-এ পাইকারকে বেচলে <b>${tk(sg.price, 1)}/কেজি</b> দাম চাওয়া যুক্তিযুক্ত।</p>`}</div>`;

  html += advForecast(m, d.src);

  const trend = sg.trend === 'up' ? `আগামী ৩ দিনে ${PLACES[d.src].n}-এ দাম প্রায় ${advPct(sg.trend_pct)} বাড়তে পারে, তাড়াহুড়ো করে কম দামে বেচবেন না।`
    : sg.trend === 'down' ? `আগামী ৩ দিনে ${PLACES[d.src].n}-এ দাম প্রায় ${advPct(sg.trend_pct)} কমতে পারে, দেরি না করে বেচা ভালো।`
    : `আগামী ৩ দিনে ${PLACES[d.src].n}-এ দাম প্রায় একই থাকতে পারে।`;
  html += `<div class="panel"><h3>২. প্রস্তাবিত বিক্রয়মূল্য</h3>
    <div class="grid3" style="margin-top:10px;gap:8px">
      <div><span class="muted xs">চাইতে পারেন</span><div class="b" style="font-size:1.4rem;color:var(--green)">${tk(sg.price, 1)}/কেজি</div></div>
      <div><span class="muted xs">এর কমে না বেচাই ভালো</span><div class="b">${tk(sg.floor, 1)}/কেজি</div></div>
      <div><span class="muted xs">পাইকার সর্বোচ্চ দিতে পারেন</span><div class="b">${tk(sg.ceiling, 1)}/কেজি</div></div></div>
    <ul class="sm" style="margin:10px 0 0;padding-left:18px">
      <li>স্থানীয় হাটে আজ ${tk(sg.local, 1)}/কেজি, খরচ বাদে হাতে থাকে প্রায় ${tk(sg.local_hand, 1)}/কেজি।</li>
      ${sg.ceiling_name ? `<li>পাইকার ${esc(sg.ceiling_name)}-এ বেচে ৮% লাভ রাখতে সর্বোচ্চ প্রায় ${tk(sg.ceiling, 1)}/কেজি দিতে পারেন (ট্রাক ভাড়া অর্ধেক ধরে)।</li>` : ''}
      ${sg.cost_floor != null ? `<li>আপনার উৎপাদন খরচ ও ১% ফি উঠাতে অন্তত ${tk(sg.cost_floor, 1)}/কেজি লাগবে।</li>` : '<li>উৎপাদন খরচ দিলে কত দামের নিচে লোকসান হবে তা-ও দেখাবে।</li>'}
      <li>${trend}</li></ul>
    ${canList ? `<button class="btn btn-green btn-sm" style="margin-top:10px" data-adv="list" data-v="${sg.price}">এই দামে লিস্টিং দিন</button>` : ''}</div>`;

  html += `<div class="panel"><h3>৩. কোথায় বিক্রি করলে বেশি লাভ</h3>
    <div class="scroll"><table class="tbl" style="margin-top:8px">
      <tr><th>বাজার</th><th>কখন</th><th class="num">দাম/কেজি</th><th class="num">হাতে থাকবে</th>${hasCost ? '<th class="num">লাভ</th>' : ''}<th class="num">স্থানীয়ের চেয়ে</th></tr>
      ${d.markets.map((o, i) => `<tr style="${i === 0 ? 'background:var(--green-soft)' : ''}">
        <td>${i === 0 ? ic('🏆') + ' ' : ''}<b>${esc(o.name)}</b>${o.market === d.src ? ' <span class="pill p-grey">স্থানীয়</span>' : ''}${o.reasons.length ? `<div class="muted xs">${o.reasons.map(esc).join(' · ')}</div>` : ''}</td>
        <td>${ADV_SEND[o.send_in_days]}</td><td class="num">${tk(o.price, 1)}</td><td class="num b">${tk(o.net)}</td>
        ${hasCost ? `<td class="num">${advMoney(o.profit)}</td>` : ''}
        <td class="num sm">${o.vs_local >= 0 ? '+' : '−'}${tk(Math.abs(o.vs_local))}</td></tr>`).join('')}
    </table></div>
    <p class="muted xs" style="margin-top:4px">হাতে থাকবে = বিক্রি − পচন − বাজার কমিশন ও ১% ফি − ট্রাক ভাড়া।</p></div>`;

  html += `<div class="panel"><h3>৪. সম্ভাব্য লাভ বা লোকসান <span class="muted sm">(${esc(b.name)}, ${monTxt(d.kg)} ${c})</span></h3>
    ${bill([
      ['সম্ভাব্য বিক্রি', `${tk(b.gross)} (${tk(b.price, 1)}/কেজি)`],
      [`পচন ও ওজন কমা (${nf(b.spoil_pct, 1)}%)`, '−' + tk(b.spoil_tk), 'minus'],
      ['বাজার কমিশন ও Reroute ফি', '−' + tk(b.fees_tk), 'minus'],
      [`পরিবহন (${esc(b.vehicle)})`, '−' + tk(b.truck), 'minus'],
      hasCost ? ['উৎপাদন খরচ', '−' + tk(b.cost_tk), 'minus'] : null,
      [hasCost ? (b.profit >= 0 ? 'আনুমানিক লাভ' : 'আনুমানিক লোকসান') : 'আনুমানিক হাতে থাকবে', hasCost ? (b.profit < 0 ? '−' : '') + tk(Math.abs(b.profit)) : tk(b.net), 'tot']])}
    <p class="muted sm" style="margin-top:8px">দাম ওঠানামা ধরলে ${hasCost ? `লাভ ${tk(b.profit_lo)} থেকে ${tk(b.profit_hi)}` : `হাতে ${tk(b.net_lo)} থেকে ${tk(b.net_hi)}`} হতে পারে। আজই স্থানীয় হাটে বেচলে হাতে থাকবে ${tk(loc.net)}${hasCost ? `, লাভ ${tk(loc.profit)}` : ''}।</p>
    ${hasCost ? '' : '<p class="warn sm" style="margin-top:6px">উৎপাদন খরচ দেওয়া নেই, তাই আসল লাভ-লোকসান বলা যাচ্ছে না। ওপরে খরচ দিন।</p>'}</div>`;
  return html;
}

/* ---------- paikar ---------- */
function advBuyer(){
  const d = advGet(`/ai/advisor/buyer?place=${ADV.place}&crop=${ADV.crop}&qty=${ADV.mon * MON}`);
  const m = advGet(`/ai/advisor/market?crop=${ADV.crop}`);
  let html = advControls(true);
  if (!d || !m) return html + advLoading();
  const c = CROPS[ADV.crop].n, top = d.sources[0], sg = d.suggest;
  const homeName = PLACES[d.buyer_place].n;

  if (top) {
    const nm = top.kind === 'listing' ? top.seller_name : top.name, rs = d.resale_markets[0];
    const homeNet = top.calc.net, better = rs && !rs.is_home && rs.net > homeNet;
    html += `<div class="panel" style="border:2px solid var(--${homeNet >= 0 ? 'blue' : 'red'});margin-bottom:14px">
      <h2 style="color:var(--${homeNet >= 0 ? 'blue' : 'red'})">${ic('🤖')} মূল পরামর্শ</h2>
      <p style="margin-top:8px;font-size:1.05rem"><b>${esc(nm)}</b> (${PLACES[top.place].n}) থেকে ${tk(top.price, 1)}/কেজিতে কিনুন।</p>
      <p class="muted" style="margin-top:4px">${homeName}-এ বেচলে আনুমানিক ${homeNet >= 0 ? 'লাভ' : 'লোকসান'} ${advMoney(homeNet)}${better ? `; ${esc(rs.resale_name)}-এ বেচলে আরও বেশি, প্রায় ${advMoney(rs.net)}` : ''}।</p>
      ${top.kind === 'listing' ? `<a class="btn btn-blue btn-sm" style="margin-top:10px" href="#/listing/${top.listing}">লিস্টিং দেখুন ও অফার দিন</a>` : ''}</div>`;
  } else {
    html += `<div class="panel"><p class="muted">এই মুহূর্তে ${c} কেনার মতো উৎস পাওয়া যায়নি।</p></div>`;
  }
  html += d.warnings.map(w => `<div class="alert low">ℹ️ ${esc(w)}</div>`).join('');

  html += advForecast(m, d.buyer_place);

  if (sg) html += `<div class="panel"><h3>২. প্রস্তাবিত ক্রয়মূল্য</h3>
    <div class="grid3" style="margin-top:10px;gap:8px">
      <div><span class="muted xs">৮% লাভ রাখতে সর্বোচ্চ</span><div class="b" style="font-size:1.4rem;color:var(--blue)">${tk(sg.max_8pct, 1)}/কেজি</div></div>
      <div><span class="muted xs">এর বেশি দিলে লোকসান</span><div class="b" style="color:var(--red)">${tk(sg.breakeven, 1)}/কেজি</div></div>
      <div><span class="muted xs">সেরা উৎসের চাওয়া দাম</span><div class="b">${tk(sg.asked, 1)}/কেজি</div></div></div>
    <p class="${sg.ok ? 'good' : 'warn'} sm" style="margin-top:10px">${sg.ok ? 'চাওয়া দাম যুক্তিযুক্ত, এই দামে কিনলে লাভ থাকার সম্ভাবনা আছে।' : 'চাওয়া দাম একটু বেশি, দরদাম করে কমানোর চেষ্টা করুন।'}</p>
    <p class="muted xs" style="margin-top:4px">হিসাব: কাল ${homeName}-এর সম্ভাব্য দর − পচন − বাজার কমিশন − ট্রাক ভাড়ার আপনার ভাগ।</p></div>`;

  html += `<div class="panel"><h3>৩. কোথা থেকে কিনবেন, কোথায় বেচবেন</h3>
    <h4 style="margin-top:8px">কোথায় কম দামে ভালো ${c}</h4>
    <div class="scroll"><table class="tbl" style="margin-top:6px">
      <tr><th>উৎস</th><th class="num">দাম</th><th class="num">পৌঁছে খরচ</th><th class="num">লাভ/কেজি</th><th class="num">মোট লাভ</th><th></th></tr>
      ${d.sources.map((s, i) => `<tr ${i === 0 ? 'style="background:var(--blue-soft)"' : ''}>
        <td>${i === 0 ? ic('🏆') + ' ' : ''}<b>${esc(s.kind === 'listing' ? s.seller_name : s.name)}</b>${s.kind === 'listing' && s.verified ? ` <span class="ver">${ic('✔')}</span>` : ''}
          <div class="muted xs">${PLACES[s.place].n}${s.kind === 'listing' ? ` · গ্রেড ${esc(s.grade)} · ${freshTxt(s.days_left)} · ${monTxt(s.available)} আছে` : ' · জেলার বাজার'}${s.glut ? ' · বেশি মাল' : ''}</div></td>
        <td class="num">${tk(s.price, 1)}</td><td class="num">${tk(s.landed, 1)}</td>
        <td class="num b" style="color:var(--${s.margin_kg >= 0 ? 'green' : 'red'})">${tk(s.margin_kg, 1)}</td>
        <td class="num">${advMoney(s.margin_total)}</td>
        <td>${s.kind === 'listing' ? `<a class="btn btn-soft btn-sm" href="#/listing/${s.listing}">দেখুন</a>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">এখন উৎস পাওয়া যায়নি</td></tr>'}
    </table></div>
    <p class="muted xs" style="margin-top:4px">লিস্টিংয়ে ট্রাক ভাড়া অর্ধেক ধরা (Reroute-এর স্বাভাবিক ভাগ); জেলার বাজার থেকে কিনলে পুরো ভাড়া আপনার।</p>
    ${d.resale_markets.length ? `<h4 style="margin-top:12px">কেনার পর কোথায় বেচলে বেশি নেট লাভ</h4>
    <div class="scroll"><table class="tbl" style="margin-top:6px">
      <tr><th>বাজার</th><th class="num">সম্ভাব্য দর</th><th class="num">ট্রাক</th><th class="num">পচন</th><th class="num">নেট লাভ</th></tr>
      ${d.resale_markets.map((r, i) => `<tr ${i === 0 ? 'style="background:var(--green-soft)"' : ''}><td>${i === 0 ? ic('🏆') + ' ' : ''}<b>${esc(r.resale_name)}</b>${r.is_home ? ' <span class="pill p-blue">আপনার</span>' : ''}</td>
        <td class="num">${tk(r.resale_price, 1)}</td><td class="num">${tk(r.transport)}</td><td class="num">${nf(r.spoil_pct, 1)}%</td><td class="num">${advMoney(r.net)}</td></tr>`).join('')}
    </table></div>` : ''}
    ${d.cheaper_soon.length ? `<p class="note sm" style="margin-top:10px">${ic('⏳')} শিগগির দাম কমতে পারে: ${d.cheaper_soon.map(t => `${esc(t.name)} (${advPct(t.change_pct)})`).join(', ')}। জরুরি না হলে কিছুদিন অপেক্ষা করুন।</p>` : ''}</div>`;

  if (top) {
    const r = top.calc;
    html += `<div class="panel"><h3>৪. সম্ভাব্য লাভ বা লোকসান <span class="muted sm">(${monTxt(r.kg)} ${c}, ${homeName}-এ বেচলে)</span></h3>
      ${bill([
        ['কেনা দাম', `${tk(r.purchase)} (${tk(r.price, 1)}/কেজি)`],
        [top.kind === 'listing' ? 'ট্রাক ভাড়া, আপনার ভাগ' : 'ট্রাক ভাড়া', '−' + tk(r.transport), 'minus'],
        [`সম্ভাব্য বিক্রি (${tk(r.resale_price, 1)}/কেজি)`, tk(r.gross)],
        [`পচন ও ওজন কমা (${nf(r.spoil_pct, 1)}%)`, '−' + tk(r.spoil_tk), 'minus'],
        [`বাজার কমিশন (${nf(r.commission_pct)}%)`, '−' + tk(r.commission), 'minus'],
        [r.net >= 0 ? 'আনুমানিক নেট লাভ' : 'আনুমানিক লোকসান', (r.net < 0 ? '−' : '') + tk(Math.abs(r.net)), 'tot']])}
      <p class="muted sm" style="margin-top:8px">দাম ওঠানামা ধরলে ফল ${tk(r.net_lo)} থেকে ${tk(r.net_hi)} হতে পারে। প্ল্যাটফর্ম ফি বিক্রেতা দেন, তাই এখানে ধরা হয়নি।</p></div>`;
  }
  return html;
}

V.advisor = () => {
  advDefaults();
  const buyer = advRole() === 'buyer';
  return `<div class="phead"><div><h1>${ic('🤖')} AI পরামর্শ</h1>
      <p class="muted">${buyer ? 'বাজারদর · ৩ দিনের পূর্বাভাস · কত দামে কিনবেন · কোথা থেকে কিনে কোথায় বেচবেন · লাভ-লোকসান' : 'বাজারদর · ৩ দিনের পূর্বাভাস · কত দামে বেচবেন · কোথায় বেচবেন · লাভ-লোকসান'}</p></div></div>
    ${buyer ? advBuyer() : advFarmer()}
    <p class="muted xs" style="margin-top:10px">অফার বা অর্ডার দেওয়ার সময়ও AI নিজে থেকে ওই লেনদেনের লাভ-ক্ষতি দেখে নেয়, লোকসানের ঝুঁকি থাকলে জানায়।</p>`;
};

/* =====================================================================
   Smart Trade Alert — runs before an offer / acceptance / counter / listing
   ===================================================================== */
const TA = {busy: false, pending: null};
const TA_ACTS = ['of-submit', 'o-accept', 'counter-send', 'nl-submit'];

function taPlan(act, d){
  const u = me();
  if (!u || u.role === 'admin') return null;
  const base = '/ai/advisor/trade-check?';
  if (act === 'of-submit') {
    if (typeof OF === 'undefined' || !OF) return null;
    const l = listing(OF.lid), kg = OF.mon * MON, price = +OF.price;
    if (!l || kg < l.moq || kg > l.available || !(price > 0 && price <= l.eff_price)) return null;  // the normal check shows the error
    return {path: `${base}mode=offer&listing=${l.id}&qty=${kg}&price=${price}&transport=${OF.transport}&split=${OF.split}`,
      verb: 'buy', run: () => A['of-submit'](), edit: () => drawOffer()};
  }
  if (act === 'o-accept') {
    const o = (S.offers || []).find(x => x.id === d.id);
    if (!o) return null;
    const sell = o.seller === u.id;
    return {path: `${base}mode=deal&offer=${o.id}`, verb: sell ? 'sell' : 'buy', run: () => A['o-accept']({id: o.id}),
      edit: sell && o.price < o.listed_price ? () => A['o-counter']({id: o.id}) : null};
  }
  if (act === 'counter-send') {
    const o = (S.offers || []).find(x => x.id === d.id), inp = $('#ct-price'), v = inp ? +inp.value : NaN;
    if (!o || !(v > o.price && v <= o.listed_price)) return null;
    const reopen = () => { A['o-counter']({id: o.id}); const i = $('#ct-price'); if (i) i.value = v; };
    return {path: `${base}mode=deal&offer=${o.id}&price=${v}`, verb: 'sell',
      run: () => { reopen(); return A['counter-send']({id: o.id}); }, edit: reopen};
  }
  if (act === 'nl-submit') {
    if (typeof NL === 'undefined' || !NL) return null;
    if (!(NL.mon >= 5 && NL.moq >= 5 && NL.moq <= NL.mon && NL.price > 0)) return null;
    const cost = NL.cost === '' || NL.cost == null ? null : +NL.cost;
    return {path: `${base}mode=listing&crop=${NL.crop}&qty=${NL.mon * MON}&price=${NL.price}${cost != null ? `&cost=${cost}` : ''}`,
      verb: 'list', run: () => A['nl-submit'](), edit: () => closeModal()};
  }
  return null;
}

function taRun(p){
  Promise.resolve().then(() => p.run()).catch(() => {});
}

function taDecide(p, r){
  if (!r) { taRun(p); return; }                                   // AI unavailable: never block the trade
  if (r.status === 'loss') { taModal(p, r); return; }
  if (r.status === 'unknown') {
    toast('নির্ভরযোগ্য লাভ-ক্ষতির হিসাবের জন্য উৎপাদন/কেনা খরচ দরকার। এখন হাতে থাকবে আনুমানিক ' + tk(r.in_hand));
  } else if (r.side === 'buyer') {
    toast(r.risk_range ? `আনুমানিক লাভ ${tk(r.net)}, তবে দাম কমলে লোকসানের ঝুঁকি আছে` : `আনুমানিক লাভজনক: প্রায় ${tk(r.net)} লাভ`);
  } else {
    toast(`আনুমানিক লাভজনক: খরচ বাদে প্রায় ${tk(r.profit)} লাভ`);
  }
  taRun(p);
}

function taModal(p, r){
  TA.pending = p;
  const buy = r.side === 'buyer', loss = Math.abs(buy ? r.net : r.profit);
  const verb = {buy: 'এই দামে কিনলে', sell: 'এই দামে বিক্রি করলে', list: 'এই দামে সব বিক্রি হলে'}[p.verb];
  let rows;
  const reasons = [], tips = [];
  if (buy) {
    rows = [['কেনা দাম', `${tk(r.purchase)} (${monTxt(r.kg)} × ${tk(r.price, 1)})`],
      [`ট্রাক ভাড়া${r.transport_mode === 'reroute' ? ', আপনার ভাগ' : ' (নিজের ট্রাক, আনুমানিক)'}`, '−' + tk(r.transport), 'minus'],
      [`${esc(r.resale_name)}-এ সম্ভাব্য বিক্রি (${tk(r.resale_price, 1)}/কেজি)`, tk(r.gross)],
      [`পচন ও ওজন কমা (${nf(r.spoil_pct, 1)}%)`, '−' + tk(r.spoil_tk), 'minus'],
      [`বাজার কমিশন (${nf(r.commission_pct)}%)`, '−' + tk(r.commission), 'minus'],
      ['আনুমানিক ফল', '−' + tk(loss), 'tot']];
    if (r.price > r.breakeven) reasons.push(`কেনার দাম ${tk(r.price, 1)}/কেজি, লাভের সীমা ${tk(r.breakeven, 1)}/কেজির বেশি`);
    if (r.transport > r.gross * 0.1) reasons.push('ট্রাক ভাড়া বিক্রির তুলনায় বেশি');
    if (r.spoil_pct >= 5) reasons.push('পথে পচনের ঝুঁকি বেশি');
    tips.push(`${tk(r.breakeven, 1)}/কেজি বা কম দামে কিনলে লোকসান হবে না (৮% লাভ রাখতে ${tk(r.target, 1)}/কেজি)।`);
    if (r.alt_market) tips.push(`${esc(r.alt_market.name)}-এ বেচলে ফল আনুমানিক ${tk(r.alt_market.net)}।`);
    tips.push('অন্য সরবরাহকারীর অফার দেখুন — AI পরামর্শ পাতায় কম দামের উৎস আছে।');
  } else {
    rows = [['বিক্রি', `${tk(r.revenue)} (${monTxt(r.kg)} × ${tk(r.price, 1)})`],
      ['প্ল্যাটফর্ম ফি', '−' + tk(r.fee), 'minus'],
      r.transport_known ? ['ট্রাক ভাড়া, আপনার ভাগ', '−' + tk(r.transport), 'minus'] : ['ট্রাক ভাড়া', 'অর্ডার অনুযায়ী (এখানে ধরা হয়নি)'],
      ['উৎপাদন/কেনা খরচ', `−${tk(r.cost_total)} (${tk(r.cost_per_kg, 1)}/কেজি)`, 'minus'],
      ['আনুমানিক ফল', '−' + tk(loss), 'tot']];
    if (r.price < r.cost_per_kg) reasons.push(`দাম আপনার খরচের (${tk(r.cost_per_kg, 1)}/কেজি) চেয়ে কম`);
    if (r.transport > 0) reasons.push(`ট্রাক ভাড়ার ভাগ ${tk(r.transport)} আপনার`);
    if (!reasons.length) reasons.push('ফি ও খরচ বাদ দিলে কিছু থাকে না');
    tips.push(`অন্তত ${tk(r.breakeven, 1)}/কেজি দাম চাইলে লোকসান হবে না।`);
    if (r.vs_local < 0) tips.push(`আজ স্থানীয় হাটে বেচলে খরচ বাদে আনুমানিক ${tk(r.local_hand)} থাকত।`);
    if (r.transport > 0) tips.push('ট্রাক ভাড়ার ভাগ কমানোর জন্য পরিবহন খরচের পাল্টা প্রস্তাব দিতে পারেন।');
  }
  modal(`<div class="body"><h2>${ic('⚠️')} লোকসানের ঝুঁকি</h2>
    <p style="margin-top:8px">${verb} আনুমানিক <b style="color:var(--red)">${tk(loss)}</b> লোকসান হতে পারে।</p>
    <div style="margin-top:10px">${bill(rows)}</div>
    ${reasons.length ? `<p class="sm" style="margin-top:10px"><b>কারণ:</b> ${reasons.join('; ')}।</p>` : ''}
    <div class="note sm" style="margin-top:10px">${ic('💡')} ${tips.join('<br>')}</div>
    <p class="muted xs" style="margin-top:8px">হিসাবটি আনুমানিক; বিক্রির দাম ${buy ? 'AI পূর্বাভাস (সিমুলেটেড ডেমো ডেটা) থেকে' : 'আপনার দেওয়া দাম ও খরচ থেকে'}। সিদ্ধান্ত আপনার।</p>
    <div class="row wrap-it" style="margin-top:14px">
      <button class="btn btn-soft grow" data-ta="cancel">বাতিল</button>
      ${p.edit ? '<button class="btn btn-blue grow" data-ta="edit">দাম বদলান</button>' : ''}
      <button class="btn btn-red grow" data-ta="go">ঝুঁকি বুঝে এগিয়ে যান</button></div></div>`);
  applyLanguage($('#modal'));
}

/* capture phase: runs before the normal action handler, which only continues after the check */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || !TA_ACTS.includes(el.dataset.act)) return;
  const p = taPlan(el.dataset.act, {...el.dataset});
  if (!p) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  if (TA.busy) return;
  TA.busy = true;
  toast('লাভ-ক্ষতি হিসাব হচ্ছে...');
  advFetch(p.path).catch(() => null).then(r => { TA.busy = false; taDecide(p, r); });
}, true);

document.addEventListener('click', e => {
  const el = e.target.closest('[data-ta]');
  if (!el || !TA.pending) return;
  e.preventDefault();
  const p = TA.pending, k = el.dataset.ta;
  TA.pending = null;
  if (k === 'cancel') closeModal();
  else if (k === 'edit') p.edit();
  else if (k === 'go') taRun(p);
});

/* =====================================================================
   Admin: completed-transaction dataset, CSV / Excel export, model evaluation
   ===================================================================== */
async function advDownload(fmt, source){
  try {
    const r = await fetch(`/api/ai/advisor/admin/export?fmt=${fmt}&source=${source}`, {headers: TOKEN ? {'X-Token': TOKEN} : {}});
    if (!r.ok) { toast('Export হয়নি, আবার চেষ্টা করুন'); return; }
    const blob = await r.blob(), cd = r.headers.get('Content-Disposition') || '', m = cd.match(/filename="([^"]+)"/);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = m ? m[1] : `reroute-transactions.${fmt}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast('ডাউনলোড শুরু হয়েছে');
  } catch (e) {
    toast('Export হয়নি, আবার চেষ্টা করুন');
  }
}

V.adminAI = () => {
  const ev = advGet('/ai/advisor/admin/evaluation', 30000), tx = advGet('/ai/advisor/admin/transactions?limit=15', 30000);
  let html = `<div class="phead"><div><h1>${ic('🤖')} লেনদেনের ডেটা ও AI মূল্যায়ন</h1>
      <p class="muted">শুধু সম্পন্ন লেনদেন। নাম, ফোন বা ব্যক্তিগত তথ্য export হয় না।</p></div>
    <div class="row wrap-it"><button class="btn btn-green btn-sm" data-adv="dl" data-v="xlsx" data-src="all">${ic('⬇️')} Excel</button>
      <button class="btn btn-line btn-sm" data-adv="dl" data-v="csv" data-src="all">${ic('⬇️')} CSV</button>
      <button class="btn btn-soft btn-sm" data-adv="dl" data-v="xlsx" data-src="platform">${ic('⬇️')} শুধু আসল লেনদেন</button>
      <button class="btn btn-soft btn-sm" data-adv="refresh">${ic('↻')} হালনাগাদ</button></div></div>`;
  if (!ev || !tx) return html + advLoading('ডেটা আসছে...');
  const D = ev.dataset, M = ev.model, R = ev.retrain;
  html += `<div class="grid3">
    <div class="kpi"><span class="muted sm">সম্পন্ন লেনদেন</span><strong>${nf(D.completed_total)}</strong></div>
    <div class="kpi"><span class="muted sm">আসল (প্ল্যাটফর্ম)</span><strong>${nf(D.platform)}</strong></div>
    <div class="kpi"><span class="muted sm">ডেমো</span><strong>${nf(D.demo)}</strong></div></div>
  <div class="grid2" style="margin-top:14px;align-items:start">
    <div class="panel"><h3>ফসল অনুযায়ী</h3><div class="scroll"><table class="tbl" style="margin-top:6px">
      <tr><th>ফসল</th><th class="num">লেনদেন</th><th class="num">আসল</th><th class="num">মোট পরিমাণ</th><th class="num">গড় দাম</th></tr>
      ${D.by_crop.map(c => `<tr><td>${CROPS[c.crop].i} ${esc(c.name)}</td><td class="num">${nf(c.all)}</td><td class="num">${nf(c.platform)}</td><td class="num">${monTxt(c.kg)}</td><td class="num">${c.avg_price != null ? tk(c.avg_price, 1) : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">এখনো কোনো সম্পন্ন লেনদেন নেই</td></tr>'}
    </table></div>
    <p class="muted xs" style="margin-top:6px">${D.first ? `আসল ডেটা: ${esc(D.first)} থেকে ${esc(D.last)} (${nf(D.span_days)} দিন)` : 'আসল ডেটা এখনো নেই; ডেমো অ্যাকাউন্টের লেনদেন আলাদা চিহ্নিত।'}</p></div>
    <div class="panel"><h3>নতুন করে প্রশিক্ষণ (Retraining)</h3>
      <p style="margin-top:6px">${R.ready ? '<span class="pill p-green">প্রস্তুত</span> যথেষ্ট আসল ডেটা আছে।' : '<span class="pill p-gold">এখনো নয়</span> জোর করে Retraining করা হবে না।'}</p>
      <ul class="sm" style="margin:8px 0 0;padding-left:18px">${R.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="sm" style="margin-top:10px"><b>নিয়ম:</b> ডেটা যাচাই ও পরিষ্কার → পুরনো সময়ের ডেটায় প্রশিক্ষণ → পরের সময়ের (না-দেখা) ডেটায় পরীক্ষা → ভুলের মাপ (MAPE) → নতুন মডেল পুরনোটার চেয়ে ভালো হলেই বদলানো হবে।</p>
      <p class="muted xs" style="margin-top:6px">চালানোর কমান্ড: <code>${esc(R.command)}</code></p></div></div>
  <div class="panel"><h3>মডেল মূল্যায়ন <span class="demo-tag">${M.data === 'simulated' ? 'সিমুলেটেড ডেটা' : esc(M.data)}</span></h3>
    <p class="muted sm" style="margin-top:4px">পরীক্ষার সময়: ${esc(M.test_period || '—')} · প্রশিক্ষণের সারি: ${nf(M.rows_train || 0)} · আজকের পূর্বাভাস: ${esc(M.as_of || '—')}</p>
    <div class="scroll"><table class="tbl" style="margin-top:8px">
      <tr><th>কত দিন আগে</th><th class="num">মডেলের ভুল (MAPE)</th><th class="num">"দাম একই থাকবে" ধরলে ভুল</th><th class="num">ওঠা-নামা ঠিক বলেছে</th></tr>
      ${Object.entries(M.horizons || {}).map(([h, v]) => `<tr><td>${nf(+h)} দিন</td><td class="num b">${nf(v.mape_model, 1)}%</td><td class="num">${nf(v.mape_naive, 1)}%</td><td class="num">${nf(v.direction_accuracy, 1)}%</td></tr>`).join('')}
    </table></div>
    ${M.market_choice ? `<p class="sm" style="margin-top:8px">বাজার বাছাই পরীক্ষা: ${nf(M.market_choice.cases)}টি ক্ষেত্রে AI-র পরামর্শ মানলে স্থানীয় হাটের চেয়ে গড়ে মণপ্রতি ${tk(M.market_choice.avg_extra_tk_per_mon)} বেশি; ${nf(M.market_choice.not_worse_than_local, 1)}% ক্ষেত্রে স্থানীয়ের চেয়ে খারাপ নয়।</p>` : ''}</div>
  <div class="panel"><h3>সাম্প্রতিক সম্পন্ন লেনদেন</h3><div class="scroll"><table class="tbl" style="margin-top:6px">
    <tr><th>তারিখ</th><th>ফসল</th><th class="num">পরিমাণ</th><th>রুট</th><th class="num">দাম/কেজি</th><th class="num">মোট</th><th class="num">ট্রাক</th><th>উৎস</th></tr>
    ${tx.rows.map(r => `<tr><td class="sm">${esc(r.completed_date)}</td><td>${CROPS[r.crop].i} ${esc(r.crop_bn)}</td><td class="num">${monTxt(r.qty_kg)}</td>
      <td class="sm">${PLACES[r.seller_district] ? PLACES[r.seller_district].n : esc(r.seller_district)} → ${PLACES[r.buyer_district] ? PLACES[r.buyer_district].n : esc(r.buyer_district)}</td>
      <td class="num">${tk(r.deal_price_per_kg, 1)}</td><td class="num">${tk(r.goods_total)}</td><td class="num">${r.transport_mode === 'reroute' ? tk(r.transport_total) : 'নিজে'}</td>
      <td>${r.data_source === 'platform' ? '<span class="pill p-green">আসল</span>' : '<span class="pill p-grey">ডেমো</span>'}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">এখনো কোনো সম্পন্ন লেনদেন নেই</td></tr>'}
  </table></div></div>`;
  return html;
};

/* =====================================================================
   Routing & events
   ===================================================================== */
function advMigrateLinks(){
  document.querySelectorAll('#view a[href="#/prices"]').forEach(a => {
    a.setAttribute('href', '#/advisor');
    const s = a.querySelector('span'), st = a.querySelector('strong');
    if (s) s.textContent = 'AI পরামর্শ';
    if (st) st.textContent = 'বাজারদর, পূর্বাভাস ও লাভ-ক্ষতি';
    applyLanguage(a);
  });
}

const __appRender = render;
render = function(){
  const p = parts(), u = me();
  if (p[0] === 'prices') { location.replace(location.pathname + location.search + '#/advisor'); return; }
  if (p[0] === 'advisor' || (p[0] === 'admin' && p[1] === 'ai' && u && u.role === 'admin')) {
    $('#view').innerHTML = p[0] === 'advisor' ? V.advisor() : V.adminAI();
    renderChrome();
    applyLanguage($('#view'));
    return;
  }
  __appRender();
  advMigrateLinks();
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-adv]');
  if (!el) return;
  e.preventDefault();
  const k = el.dataset.adv, v = el.dataset.v;
  if (k === 'dl') { advDownload(v, el.dataset.src || 'all'); return; }
  if (k === 'refresh') { Object.keys(ADV.cache).filter(x => x.includes('/admin/')).forEach(x => delete ADV.cache[x]); render(); return; }
  if (k === 'list') {
    nlReset();
    NL.crop = ADV.crop;
    NL.price = +v;
    NL.mon = Math.max(5, ADV.mon);
    if (ADV.cost !== '') NL.cost = ADV.cost;
    go('#/listings/new');
    return;
  }
  if (k === 'view') ADV.view = v;
  if (k === 'crop') { ADV.crop = v; ADV.days = ''; ADV.costTouched = false; advPrefillCost(); }
  render();
});

document.addEventListener('change', e => {
  const k = e.target.dataset.advf;
  if (!k) return;
  const v = e.target.value;
  if (k === 'mon') ADV.mon = Math.min(2500, Math.max(1, Math.round(+v || 1)));
  else if (k === 'cost') { ADV.cost = v === '' || !(+v >= 0) ? '' : String(+v); ADV.costTouched = true; }
  else ADV[k] = v;
  render();
});
