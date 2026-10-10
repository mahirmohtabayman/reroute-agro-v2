/* =====================================================================
   🤖 AI পরামর্শ — added module (data: SIMULATED vegetable markets).
   Self-contained: adds one menu item and the #/advisor page; no existing page is changed.
   ===================================================================== */
NAV_TRADER.splice(Math.max(0, NAV_TRADER.findIndex(n => n[0] === '#/prices')), 0, ['#/advisor', '🤖', 'AI পরামর্শ']);

const ADV = {tab: null, crop: null, place: null, mon: 25, days: '', cost: '', cache: {}, busy: {}};
const ADV_DAY = ['আজ', 'কাল', 'পরশু', '৩ দিন পরে'];
const ADV_SEND = ['আজই পাঠান', 'কাল পাঠান', 'পরশু পাঠান', '৩ দিন পরে পাঠান'];
const ADV_STATUS = {best: ['🏆 সবচেয়ে লাভ', 'p-green'], better: ['👍 লাভ বেশি', 'p-green'], local: ['🏠 স্থানীয় হাট', 'p-grey'],
  worse: ['⚠️ কম পাবেন', 'p-gold'], loss: ['❌ লোকসান', 'p-red']};

function advGet(path) {
  const c = ADV.cache[path];
  if (c && !(c.error && Date.now() - c.at > 6000)) return c.error ? null : c;
  if (ADV.busy[path]) return null;
  ADV.busy[path] = 1;
  api(path).then(d => { ADV.cache[path] = d; }).catch(() => { ADV.cache[path] = {error: true, at: Date.now()}; })
    .finally(() => { delete ADV.busy[path]; if (parts()[0] === 'advisor') render(); });
  return null;
}
function advDefaults() {
  const u = me();
  if (!ADV.tab) ADV.tab = u && u.role === 'paikar' ? 'buyer' : 'farmer';
  if (!ADV.place) ADV.place = u && PLACES[u.place] ? u.place : 'rajshahi';
  if (!ADV.crop) {
    const l = u && (S.listings || []).find(x => x.uid === u.id && x.status === 'active');
    ADV.crop = l ? l.crop : 'tomato';
    if (l) { ADV.mon = Math.max(1, Math.round(l.available / MON)); ADV.days = String(Math.max(1, l.days_left)); }
  }
}
const advLoading = t => `<div class="empty">🤖 ${t || 'AI হিসাব করছে...'}</div>`;
const advPct = v => `${v > 0 ? '+' : ''}${nf(v, 1)}%`;

function advChart(sr, title) {
  if (!sr) return '';
  const pts = sr.price.slice(-21), mdl = sr.model.slice(-21), fc = sr.fc, n = pts.length, all = [...pts, ...fc, ...mdl];
  const mn = Math.min(...all) * 0.95, mx = Math.max(...all) * 1.05, W = 640, H = 200, pl = 40, pr = 12, pt = 10, pb = 26;
  const x = i => pl + i * (W - pl - pr) / (n + 2), y = v => pt + (mx - v) * (H - pt - pb) / (mx - mn || 1);
  let g = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:420px" role="img" aria-label="${esc(title)}">`;
  for (let k = 0; k <= 3; k++) { const v = mn + (mx - mn) * k / 3; g += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line)"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" style="fill:var(--muted)">${nf(v)}</text>`; }
  g += `<polyline fill="none" style="stroke:var(--ink)" stroke-width="2.5" points="${pts.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>`;
  g += `<polyline fill="none" style="stroke:var(--green)" stroke-width="2" stroke-dasharray="5 4" points="${mdl.slice(0, -1).map((v, i) => `${x(i + 1)},${y(v)}`).join(' ')}"/>`;
  const f = [pts[n - 1], ...fc];
  g += `<polyline fill="none" style="stroke:var(--red)" stroke-width="2.5" stroke-dasharray="3 3" points="${f.map((v, i) => `${x(n - 1 + i)},${y(v)}`).join(' ')}"/>`;
  fc.forEach((v, i) => { g += `<circle cx="${x(n + i)}" cy="${y(v)}" r="4" style="fill:var(--red)"/>`; });
  g += `<text x="${x(0)}" y="${H - 8}" font-size="11" style="fill:var(--muted)">৩ সপ্তাহ আগে</text><text x="${x(n - 1)}" y="${H - 8}" text-anchor="middle" font-size="11" style="fill:var(--muted)">আজ</text><text x="${x(n + 2)}" y="${H - 8}" text-anchor="end" font-size="11" style="fill:var(--muted)">+৩ দিন</text></svg>`;
  return `<div class="panel"><h3>${esc(title)}</h3><div class="scroll" style="margin-top:6px">${g}</div>
    <p class="muted sm">কালো: দাম · সবুজ ডটেড: আগের দিন AI যা বলেছিল · লাল: আগামী ৩ দিনের পূর্বাভাস (৳/কেজি)</p></div>`;
}
function advTrust() {
  const st = advGet('/ai/advisor/status'); if (!st || !st.metrics || !st.metrics.horizons) return '';
  const h = st.metrics.horizons, mc = st.metrics.market_choice || {};
  return `<details class="panel"><summary class="b" style="cursor:pointer">AI কতটা ঠিক বলে? (সিমুলেটেড ডেটায় পরীক্ষা)</summary>
    <div class="grid3" style="margin-top:10px">
      <div class="kpi"><span class="muted sm">কালকের দামে গড় ভুল</span><strong>${nf(h['1'].mape_model, 1)}%</strong><span class="muted sm">"দাম একই থাকবে" ধরলে ${nf(h['1'].mape_naive, 1)}%</span></div>
      <div class="kpi"><span class="muted sm">৩ দিন পরের দামে গড় ভুল</span><strong>${nf(h['3'].mape_model, 1)}%</strong><span class="muted sm">সাধারণ অনুমানে ${nf(h['3'].mape_naive, 1)}%</span></div>
      <div class="kpi"><span class="muted sm">AI-র বাজার বাছাই মানলে</span><strong>মণে +${tk(mc.avg_extra_tk_per_mon || 0)}</strong><span class="muted sm">স্থানীয় হাটের তুলনায়, ${nf(mc.not_worse_than_local || 0, 1)}% ক্ষেত্রে কম নয়</span></div></div>
    <p class="muted sm" style="margin-top:8px">মডেল ২০২১–জুন ২০২৫-এর সিমুলেটেড দৈনিক বাজারদরে শেখানো, জুলাই ২০২৫ থেকের অদেখা দিনে পরীক্ষা করা। আসল দাম নয়; পাইলটে কৃষি বিপণন অধিদপ্তরের দাম বসবে।</p></details>`;
}
function advControls(buyer) {
  return `<div class="chips">${Object.entries(CROPS).map(([k, c]) => `<button class="chip ${ADV.crop === k ? 'on' : ''}" data-adv="crop" data-v="${k}">${c.i} ${c.n}</button>`).join('')}</div>
  <div class="filters" style="grid-template-columns:repeat(${buyer ? 2 : 4},minmax(0,1fr))">
    <label><span>${buyer ? 'আপনার বাজার' : 'মাল কোথায় আছে'}</span><select data-advf="place">${Object.entries(PLACES).map(([k, p]) => `<option value="${k}" ${ADV.place === k ? 'selected' : ''}>${p.n}</option>`).join('')}</select></label>
    <label><span>কত মণ</span><input data-advf="mon" type="number" min="1" max="2500" value="${ADV.mon}"></label>
    ${buyer ? '' : `<label><span>আর কত দিন তাজা থাকবে</span><select data-advf="days"><option value="">ফসল অনুযায়ী</option>${[1, 2, 3, 4, 5, 6, 7, 10].map(d => `<option value="${d}" ${ADV.days === String(d) ? 'selected' : ''}>${nf(d)} দিন</option>`).join('')}</select></label>
    <label><span>উৎপাদন খরচ ৳/কেজি (ঐচ্ছিক)</span><input data-advf="cost" type="number" min="0" step="0.5" value="${ADV.cost}" placeholder="লাভ-লোকসান দেখতে"></label>`}</div>`;
}

/* ---------- farmer: where and when to sell ---------- */
function advFarmer() {
  const q = `/ai/advisor/farmer?src=${ADV.place}&crop=${ADV.crop}&qty=${ADV.mon * MON}${ADV.days ? `&days_left=${ADV.days}` : ''}${ADV.cost !== '' ? `&cost=${ADV.cost}` : ''}`;
  const d = advGet(q);
  let html = advControls(false);
  const u = me(), mine = u && (S.listings || []).find(l => l.uid === u.id && l.crop === ADV.crop && l.status === 'active');
  if (!d) return html + advLoading();
  const b = d.best, loc = d.local_today, c = CROPS[ADV.crop].n;
  if (mine && u.place === ADV.place) {
    const diff = (loc.price_now - mine.eff_price) / loc.price_now * 100;
    if (Math.abs(diff) >= 10) html += `<div class="${diff > 0 ? 'warn' : 'note'}" style="margin-bottom:10px">💡 আপনার লিস্টিংয়ে ${c}ের দাম ${tk(mine.eff_price, 1)}/কেজি, আর ${PLACES[ADV.place].n}-এ আজকের পাইকারি দর ${tk(loc.price_now, 1)}। ${diff > 0 ? 'দাম কিছুটা বাড়াতে পারেন।' : 'দাম বাজারের চেয়ে বেশি, বিক্রি দেরি হতে পারে।'} <a href="#/listings">লিস্টিং</a></div>`;
  }
  html += d.warnings.map(w => `<div class="alert spoil">⚠️ ${esc(w)}</div>`).join('');
  const speech = `${ADV_SEND[b.send_in_days]}, ${ADV_DAY[b.sell_day]} ${b.name} বাজারে বেচুন। হাতে থাকবে ${nf(b.net)} টাকা, আজ স্থানীয় হাটে বেচার চেয়ে ${nf(b.vs_local)} টাকা বেশি।`;
  html += `<div class="panel" style="border:2px solid var(--green)"><div class="between"><span class="pill p-green">🤖 AI-র পরামর্শ</span><button class="iconbtn" data-adv="say" data-v="${esc(speech)}" aria-label="শুনুন">🔊</button></div>
    <h2 style="margin-top:8px">${ADV_SEND[b.send_in_days]}, ${ADV_DAY[b.sell_day]} বেচুন: <b>${esc(b.name)}</b></h2>
    <div class="grid3" style="margin-top:12px"><div><span class="muted sm">হাতে থাকবে (${monTxt(d.kg)})</span><div class="b" style="font-size:1.6rem;color:var(--green)">${tk(b.net)}</div><span class="muted xs">সম্ভাব্য ${tk(b.net_lo)} – ${tk(b.net_hi)}</span></div>
      <div><span class="muted sm">আজ স্থানীয় হাটে বেচলে</span><div class="b" style="font-size:1.3rem">${tk(loc.net)}</div><span class="muted xs">${esc(loc.name)}, ${tk(loc.price_now, 1)}/কেজি</span></div>
      <div><span class="muted sm">${b.profit != null ? 'উৎপাদন খরচ বাদে লাভ' : 'বেশি পাবেন'}</span><div class="b" style="font-size:1.3rem;color:var(--${(b.profit != null ? b.profit : b.vs_local) >= 0 ? 'green' : 'red'})">${tk(b.profit != null ? b.profit : b.vs_local)}</div><span class="muted xs">${b.profit != null ? `স্থানীয়ের চেয়ে ${tk(b.vs_local)} বেশি` : 'ভাড়া, নষ্ট, খরচ সব বাদে'}</span></div></div>
    <p class="muted sm" style="margin-top:8px">বিক্রির দিন দাম ${tk(b.price, 1)}/কেজি (সম্ভাব্য ${tk(b.price_lo, 1)}–${tk(b.price_hi, 1)})। ${esc(b.vehicle)}, ${nf(b.km)} কিমি।</p></div>`;
  html += `<h2 style="margin:16px 0 8px">কোন বাজারে কত থাকবে</h2>` + d.markets.map(o => `<div class="panel">
    <div class="between"><div><b>${esc(o.name)}</b> ${pill(ADV_STATUS[o.status])}</div><div class="b" style="font-size:1.2rem">${tk(o.net)}</div></div>
    <div class="muted sm">${o.market === d.src && o.send_in_days === 0 ? 'আজ এখানেই বেচলে' : `${ADV_SEND[o.send_in_days]}, ${ADV_DAY[o.sell_day]} বিক্রি`} · দাম ${tk(o.price, 1)}/কেজি (আজ ${tk(o.price_now, 1)}) · ${o.vs_local >= 0 ? 'স্থানীয়ের চেয়ে +' + tk(o.vs_local) : 'স্থানীয়ের চেয়ে −' + tk(-o.vs_local)}${o.profit != null ? ` · ${o.profit >= 0 ? 'লাভ' : 'লোকসান'} ${tk(Math.abs(o.profit))}` : ''}</div>
    <details style="margin-top:6px"><summary class="sm muted" style="cursor:pointer">হিসাব দেখুন</summary>${bill([['বিক্রি', tk(o.gross)], ['পথে ও অপেক্ষায় নষ্ট (' + nf(o.spoil_pct, 1) + '%)', '−' + tk(o.spoil_tk), 'minus'],
      ['বাজার খরচ ও Reroute ফি', '−' + tk(o.fees_tk), 'minus'], [o.market === d.src ? 'স্থানীয় পরিবহন' : 'Reroute ট্রাক ভাড়া', '−' + tk(o.truck), 'minus'], ['হাতে থাকবে', tk(o.net), 'tot']])}</details>
    ${o.reasons.length ? `<div class="chips" style="flex-wrap:wrap;padding-bottom:0">${o.reasons.map(r => `<span class="pill p-blue">${esc(r)}</span>`).join('')}</div>` : ''}</div>`).join('');
  const markets = d.markets.map(o => o.market);
  html += `<div class="panel"><h3>কোন দিন পাঠালে কত থাকবে</h3><p class="muted sm">ফসল বেশি দিন রাখলে নষ্ট হয়, তাই অপেক্ষার লাভ-ক্ষতিও ধরা আছে</p><div class="scroll"><table class="tbl" style="margin-top:6px"><tr><th>বাজার</th>${[0, 1, 2, 3].map(w => `<th class="num">${ADV_SEND[w].replace(' পাঠান', '')}</th>`).join('')}</tr>
    ${markets.map(m => { const row = d.grid[m], name = d.markets.find(o => o.market === m).name; return `<tr><td>${esc(name)}</td>${[0, 1, 2, 3].map(w => { const v = row[String(w)];
      const isBest = m === b.market && w === b.send_in_days; return `<td class="num ${isBest ? 'b' : ''}" style="${isBest ? 'background:var(--green-soft);color:var(--green)' : ''}">${v == null ? '<span class="muted">—</span>' : tk(v)}</td>`; }).join('')}</tr>`; }).join('')}</table></div>
    <p class="muted xs">— মানে পূর্বাভাসের ৩ দিনের বাইরে বা ততদিন মাল তাজা থাকবে না</p></div>`;
  html += advChart(advGet(`/ai/advisor/series?market=${b.market}&crop=${ADV.crop}`), `${b.name}: ${c}ের দাম ও পূর্বাভাস`);
  if (b.market !== d.src) html += advChart(advGet(`/ai/advisor/series?market=${d.src}&crop=${ADV.crop}`), `${PLACES[d.src].n}: ${c}ের দাম ও পূর্বাভাস`);
  return html;
}

/* ---------- paikar: where good produce is cheap ---------- */
function advBuyer() {
  const d = advGet(`/ai/advisor/buyer?place=${ADV.place}&crop=${ADV.crop}&qty=${ADV.mon * MON}`);
  let html = advControls(true);
  if (!d) return html + advLoading();
  const c = CROPS[ADV.crop].n, top = d.sources[0];
  html += d.warnings.map(w => `<div class="alert low">ℹ️ ${esc(w)} <span class="muted sm">(কেনার জন্য ভালো সময় হতে পারে)</span></div>`).join('');
  if (top) {
    const nm = top.kind === 'listing' ? top.seller_name : top.name;
    html += `<div class="panel" style="border:2px solid var(--blue)"><span class="pill p-blue">🤖 AI-র পরামর্শ</span>
      <h2 style="margin-top:8px">সবচেয়ে ভালো: ${esc(nm)}, ${PLACES[top.place].n}</h2>
      <div class="grid3" style="margin-top:12px"><div><span class="muted sm">আপনার কাছে পৌঁছে খরচ</span><div class="b" style="font-size:1.4rem">${tk(top.landed, 1)}/কেজি</div><span class="muted xs">দাম ${tk(top.price, 1)} + ভাড়ার অর্ধেক + পথে নষ্ট</span></div>
        <div><span class="muted sm">কাল ${PLACES[d.buyer_place].n}-এ বেচার দাম</span><div class="b" style="font-size:1.4rem">${tk(d.resale_price, 1)}/কেজি</div><span class="muted xs">AI পূর্বাভাস</span></div>
        <div><span class="muted sm">আনুমানিক লাভ</span><div class="b" style="font-size:1.4rem;color:var(--${top.margin_kg >= 0 ? 'green' : 'red'})">${tk(top.margin_total)}</div><span class="muted xs">কেজিতে ${tk(top.margin_kg, 1)}</span></div></div>
      <p class="note sm" style="margin-top:10px">৮% লাভ রাখতে চাইলে পৌঁছে খরচ সর্বোচ্চ <b>${tk(d.max_buy_8pct, 1)}/কেজি</b> রাখুন।</p></div>`;
  }
  html += `<h2 style="margin:16px 0 8px">কোথায় কম দামে ভালো ${c}</h2><div class="panel scroll"><table class="tbl"><tr><th>কোথা থেকে</th><th>মান</th><th class="num">দাম</th><th class="num">পৌঁছে খরচ</th><th class="num">কেজিতে লাভ</th><th class="num">মোট লাভ</th><th></th></tr>
    ${d.sources.map((s, i) => `<tr><td>${i === 0 ? '🏆 ' : ''}${s.kind === 'listing' ? `<b>${esc(s.seller_name)}</b> ${s.verified ? '<span class="ver">✔</span>' : ''}<div class="muted xs">Reroute লিস্টিং, ${PLACES[s.place].n}, আছে ${monTxt(s.available)}</div>`
        : `<b>${esc(s.name)} বাজার</b><div class="muted xs">জেলার পাইকারি দর${s.glut ? ', 🔻 এখন মাল বেশি' : ''}</div>`}</td>
      <td class="sm">${s.kind === 'listing' ? `গ্রেড ${s.grade} · ${freshTxt(s.days_left)}${s.rating ? ` · ★ ${nf(s.rating, 1)}` : ''}` : `আমদানি ${advPct(s.arrivals_pct)}`}</td>
      <td class="num">${tk(s.price, 1)}</td><td class="num">${tk(s.landed, 1)}</td><td class="num b" style="color:var(--${s.margin_kg >= 0 ? 'green' : 'red'})">${tk(s.margin_kg, 1)}</td><td class="num">${tk(s.margin_total)}</td>
      <td>${s.kind === 'listing' ? `<a class="btn btn-soft btn-sm" href="#/listing/${s.listing}">দেখুন</a>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">এখন কিছু পাওয়া যায়নি</td></tr>'}</table>
    <p class="muted sm">লাভ = কাল আপনার বাজারে AI-র পূর্বাভাসিত দাম (বাজার খরচ বাদে) − পৌঁছে খরচ। ভাড়া অর্ধেক অর্ধেক ধরে।</p></div>`;
  if (d.cheaper_soon.length) html += `<div class="panel"><h3>⏳ শিগগির দাম কমতে পারে</h3>${d.cheaper_soon.map(t => `<div class="item"><div class="grow"><b>${esc(t.name)}</b><div class="muted sm">আজ ${tk(t.now, 1)} → ৩ দিনে ${tk(t.fc3, 1)}/কেজি</div></div><span class="pill p-green">${advPct(t.change_pct)}</span></div>`).join('')}<p class="muted sm">জরুরি না হলে ২–৩ দিন অপেক্ষা করে এসব বাজার থেকে কিনলে সস্তা পড়তে পারে।</p></div>`;
  html += advChart(advGet(`/ai/advisor/series?market=${ADV.place}&crop=${ADV.crop}`), `${PLACES[ADV.place].n}: ${c}ের দাম ও পূর্বাভাস`);
  return html;
}

/* ---------- market overview ---------- */
function advMarket() {
  const d = advGet(`/ai/advisor/market?crop=${ADV.crop}`);
  let html = `<div class="chips">${Object.entries(CROPS).map(([k, c]) => `<button class="chip ${ADV.crop === k ? 'on' : ''}" data-adv="crop" data-v="${k}">${c.i} ${c.n}</button>`).join('')}</div>`;
  if (!d) return html + advLoading();
  html += d.warnings.map(w => `<div class="alert spoil">⚠️ ${esc(w)}</div>`).join('');
  const arrow = v => v >= 2 ? `<span style="color:var(--green)">▲ ${advPct(v)}</span>` : v <= -2 ? `<span style="color:var(--red)">▼ ${advPct(v)}</span>` : `<span class="muted">➜ ${advPct(v)}</span>`;
  html += `<div class="panel scroll"><table class="tbl"><tr><th>বাজার</th><th class="num">আজ</th><th class="num">কাল</th><th class="num">পরশু</th><th class="num">৩ দিন পরে</th><th class="num">আমদানি</th></tr>
    ${d.markets.map(m => `<tr><td><b>${esc(m.name)}</b>${m.glut ? ' <span class="pill p-red">মাল বেশি</span>' : ''}</td><td class="num b">${tk(m.today, 1)}</td>
      ${m.fc.map(v => `<td class="num">${tk(v, 1)}</td>`).join('')}<td class="num">${advPct(m.arrivals_pct)}</td></tr>
      <tr><td></td><td></td><td class="num xs">${arrow((m.fc[0] / m.today - 1) * 100)}</td><td class="num xs">${arrow((m.fc[1] / m.today - 1) * 100)}</td><td class="num xs">${arrow(m.change_3)}</td><td></td></tr>`).join('')}</table>
    <p class="muted sm">দাম ৳/কেজি, পাইকারি। আমদানি: আজ স্বাভাবিকের চেয়ে কত বেশি/কম মাল উঠেছে।</p></div>`;
  return html;
}

V.advisor = () => {
  advDefaults();
  const st = advGet('/ai/advisor/status');
  return `<div class="phead"><div><h1>🤖 AI পরামর্শ</h1><p class="muted">কোন বাজারে, কোন দিন বেচলে লাভ · কোথায় কম দামে ভালো মাল · কোথায় মাল বেশি উঠছে</p></div>
    <span class="demo-tag">সিমুলেটেড ডেটায় প্রশিক্ষিত${st && st.date ? ' · ' + dateBn(new Date(st.date).getTime()) : ''}</span></div>
    <div class="tabs">${[['farmer', '🧑‍🌾 কোথায় বেচবেন'], ['buyer', '🚚 কোথায় কিনবেন'], ['market', '📊 বাজারের অবস্থা']].map(([k, t]) => `<button class="${ADV.tab === k ? 'on' : ''}" data-adv="tab" data-v="${k}">${t}</button>`).join('')}</div>
    ${ADV.tab === 'farmer' ? advFarmer() : ADV.tab === 'buyer' ? advBuyer() : advMarket()}
    ${advTrust()}`;
};

/* routing: show the advisor page for #/advisor, everything else goes to the app's own render() */
const __appRender = render;
render = function () {
  if (parts()[0] !== 'advisor') return __appRender();
  $('#view').innerHTML = (me() ? banners() : '') + V.advisor();
  renderChrome();
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-adv]'); if (!el) return;
  e.preventDefault();
  const k = el.dataset.adv, v = el.dataset.v;
  if (k === 'tab') ADV.tab = v;
  if (k === 'crop') { ADV.crop = v; ADV.days = ''; }
  if (k === 'say') { say(v); return; }
  render();
});
document.addEventListener('change', e => {
  const k = e.target.dataset.advf; if (!k) return;
  const v = e.target.value;
  if (k === 'mon') ADV.mon = Math.min(2500, Math.max(1, Math.round(+v || 1)));
  else ADV[k] = v;
  render();
});
