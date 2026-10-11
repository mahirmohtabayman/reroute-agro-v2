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
const advLoading = t => `<div class="sk-wrap" role="status" aria-busy="true" style="margin-top:6px"><span class="sr-only">${t || 'AI হিসাব করছে...'}</span><div class="sk sk-block" style="margin-top:0"></div><div class="sk sk-block"></div></div>`;
const advPct = v => `${v > 0 ? '+' : ''}${nf(v, 1)}%`;

function advControls(buyer) {
  return `<div class="chips">${Object.entries(CROPS).map(([k, c]) => `<button class="chip ${ADV.crop === k ? 'on' : ''}" data-adv="crop" data-v="${k}">${c.i} ${c.n}</button>`).join('')}</div>
  <div class="filters" style="grid-template-columns:repeat(${buyer ? 2 : 4},minmax(0,1fr))">
    <label><span>${buyer ? 'আপনার বাজার' : 'মাল কোথায় আছে'}</span><select data-advf="place">${Object.entries(PLACES).map(([k, p]) => `<option value="${k}" ${ADV.place === k ? 'selected' : ''}>${p.n}</option>`).join('')}</select></label>
    <label><span>কত মণ</span><input data-advf="mon" type="number" min="1" max="2500" value="${ADV.mon}"></label>
    ${buyer ? '' : `<label><span>আর কত দিন তাজা থাকবে</span><select data-advf="days"><option value="">ফসল অনুযায়ী</option>${[1, 2, 3, 4, 5, 6, 7, 10].map(d => `<option value="${d}" ${ADV.days === String(d) ? 'selected' : ''}>${nf(d)} দিন</option>`).join('')}</select></label>
    <label><span>উৎপাদন খরচ ৳/কেজি (ঐচ্ছিক)</span><input data-advf="cost" type="number" min="0" step="0.5" value="${ADV.cost}" placeholder="লাভ-লোকসান দেখতে"></label>`}</div>`;
}

/* ---------- Compact market row for farmer ---------- */
function advMarketRow(o, isLocal, isBest) {
  const label = isBest ? '<span class="pill p-green">সেরা</span>' : isLocal ? '<span class="pill p-grey">স্থানীয়</span>' : '';
  return `<tr class="${isBest ? 'b' : ''}" style="${isBest ? 'background:var(--green-soft)' : ''}">
    <td>${esc(o.name)} ${label}</td>
    <td class="num">${ADV_SEND[o.send_in_days]}</td>
    <td class="num">${tk(o.price, 1)}</td>
    <td class="num b" style="color:var(--${o.net >= 0 ? 'green' : 'red'})">${tk(o.net)}</td>
    <td class="num sm ${o.vs_local >= 0 ? '' : 'muted'}">${o.vs_local >= 0 ? '+' : ''}${tk(o.vs_local)}</td></tr>`;
}

/* ---------- farmer: where and when to sell ---------- */
function advFarmer() {
  const q = `/ai/advisor/farmer?src=${ADV.place}&crop=${ADV.crop}&qty=${ADV.mon * MON}${ADV.days ? `&days_left=${ADV.days}` : ''}${ADV.cost !== '' ? `&cost=${ADV.cost}` : ''}`;
  const d = advGet(q);
  let html = advControls(false);
  if (!d) return html + advLoading();
  const b = d.best, loc = d.local_today, c = CROPS[ADV.crop].n;
  html += d.warnings.map(w => `<div class="alert spoil">⚠️ ${esc(w)}</div>`).join('');

  /* মূল পরামর্শ */
  const profitLine = b.profit != null
    ? `উৎপাদন খরচ বাদে আনুমানিক লাভ <b>${tk(b.profit)}</b> — স্থানীয়ের চেয়ে <b>${tk(b.vs_local)}</b> বেশি।`
    : `হাতে থাকবে আনুমানিক <b>${tk(b.net)}</b> — স্থানীয়ের চেয়ে <b>${tk(b.vs_local)}</b> বেশি।`;
  html += `<div class="panel" style="border:2px solid var(--green);margin-bottom:14px">
    <div class="between"><h2 style="color:var(--green)">🤖 মূল পরামর্শ</h2></div>
    <p style="margin-top:8px;font-size:1.05rem"><b>${ADV_SEND[b.send_in_days]}</b>, <b>${esc(b.name)}</b> বাজারে পাঠান।</p>
    <p class="muted" style="margin-top:4px">${profitLine}</p>
    <div class="grid3" style="margin-top:12px;gap:8px">
      <div><span class="muted xs">প্রত্যাশিত দাম</span><div class="b">${tk(b.price, 1)}/কেজি</div><span class="muted xs">${tk(b.price_lo, 1)}–${tk(b.price_hi, 1)}</span></div>
      <div><span class="muted xs">হাতে থাকবে</span><div class="b" style="color:var(--green)">${tk(b.net)}</div><span class="muted xs">${monTxt(d.kg)}</span></div>
      <div><span class="muted xs">স্থানীয় হাটে</span><div class="b">${tk(loc.net)}</div><span class="muted xs">${tk(loc.price_now, 1)}/কেজি</span></div>
    </div></div>`;

  /* বাজার তুলনা: compact table */
  html += `<div class="panel"><h3>কোন বাজারে কত থাকবে</h3>
    <div class="scroll"><table class="tbl" style="margin-top:8px">
      <tr><th>বাজার</th><th>কখন</th><th class="num">দাম/কেজি</th><th class="num">হাতে</th><th class="num">স্থানীয়ের চেয়ে</th></tr>
      ${d.markets.map(o => advMarketRow(o, o.market === d.src && o.send_in_days === 0, o.market === b.market && o.send_in_days === b.send_in_days)).join('')}
    </table></div></div>`;

  /* দিন × বাজার গ্রিড: compact */
  const markets = d.markets.map(o => o.market);
  html += `<div class="panel"><h3>কোন দিন পাঠালে কত থাকবে</h3>
    <div class="scroll"><table class="tbl" style="margin-top:6px"><tr><th>বাজার</th>${[0,1,2,3].map(w=>`<th class="num">${ADV_DAY[w]}</th>`).join('')}</tr>
    ${markets.map(m => { const row = d.grid[m], name = d.markets.find(o => o.market === m).name;
      return `<tr><td>${esc(name)}</td>${[0,1,2,3].map(w => {
        const v = row[String(w)]; const best2 = m===b.market&&w===b.send_in_days;
        return `<td class="num ${best2?'b':''}" style="${best2?'color:var(--green)':''}">${v==null?'<span class="muted">—</span>':tk(v)}</td>`;
      }).join('')}</tr>`; }).join('')}</table></div>
    <p class="muted xs" style="margin-top:4px">— মানে ৩ দিনের বাইরে বা মাল ততদিন তাজা থাকবে না</p></div>`;
  return html;
}

/* ---------- paikar: where good produce is cheap ---------- */
function advBuyer() {
  const d = advGet(`/ai/advisor/buyer?place=${ADV.place}&crop=${ADV.crop}&qty=${ADV.mon * MON}`);
  let html = advControls(true);
  if (!d) return html + advLoading();
  const c = CROPS[ADV.crop].n, top = d.sources[0];

  if (top) {
    const nm = top.kind === 'listing' ? top.seller_name : top.name;
    html += `<div class="panel" style="border:2px solid var(--blue);margin-bottom:14px">
      <div class="between"><h2 style="color:var(--blue)">🤖 মূল পরামর্শ</h2></div>
      <p style="margin-top:8px;font-size:1.05rem"><b>${esc(nm)}</b>, <b>${PLACES[top.place].n}</b> থেকে কিনুন।</p>
      <p class="muted" style="margin-top:4px">পৌঁছে খরচ <b>${tk(top.landed, 1)}/কেজি</b> — আনুমানিক লাভ <b style="color:var(--${top.margin_kg>=0?'green':'red'})">${tk(top.margin_total)}</b>।</p>
      <div class="grid3" style="margin-top:12px;gap:8px">
        <div><span class="muted xs">কেনার দাম</span><div class="b">${tk(top.price, 1)}/কেজি</div></div>
        <div><span class="muted xs">পৌঁছে খরচ</span><div class="b">${tk(top.landed, 1)}/কেজি</div></div>
        <div><span class="muted xs">৮% লাভে সর্বোচ্চ কেনা</span><div class="b">${tk(d.max_buy_8pct, 1)}/কেজি</div></div>
      </div></div>`;
  }
  html += d.warnings.map(w => `<div class="alert low">ℹ️ ${esc(w)}</div>`).join('');

  html += `<div class="panel"><h3>কোথায় কম দামে ভালো ${c}</h3>
    <div class="scroll"><table class="tbl" style="margin-top:6px">
      <tr><th>উৎস</th><th class="num">দাম</th><th class="num">পৌঁছে</th><th class="num">লাভ/কেজি</th><th class="num">মোট লাভ</th><th></th></tr>
      ${d.sources.map((s,i) => `<tr ${i===0?'style="background:var(--blue-soft)"':''}>
        <td>${i===0?'🏆 ':''}<b>${s.kind==='listing'?esc(s.seller_name):esc(s.name)}</b><div class="muted xs">${PLACES[s.place].n}${s.kind==='listing'?` · ${freshTxt(s.days_left)}`:''}${s.glut?' · 🔻 বেশি মাল':''}</div></td>
        <td class="num">${tk(s.price,1)}</td><td class="num">${tk(s.landed,1)}</td>
        <td class="num b" style="color:var(--${s.margin_kg>=0?'green':'red'})">${tk(s.margin_kg,1)}</td>
        <td class="num">${tk(s.margin_total)}</td>
        <td>${s.kind==='listing'?`<a class="btn btn-soft btn-sm" href="#/listing/${s.listing}">দেখুন</a>`:''}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">এখন উৎস পাওয়া যায়নি</td></tr>'}
    </table>
    <p class="muted xs" style="margin-top:4px">লাভ = আগামীকাল আপনার বাজারের দর − পৌঁছে খরচ। ভাড়া অর্ধেক ধরা।</p></div>`;

  if (d.cheaper_soon.length) html += `<div class="panel"><h3>⏳ শিগগির দাম কমতে পারে</h3>
    ${d.cheaper_soon.map(t => `<div class="item"><div class="grow"><b>${esc(t.name)}</b><span class="muted sm"> — আজ ${tk(t.now,1)} → ৩ দিনে ${tk(t.fc3,1)}/কেজি</span></div><span class="pill p-green">${advPct(t.change_pct)}</span></div>`).join('')}
    <p class="muted xs" style="margin-top:6px">জরুরি না হলে কিছুদিন অপেক্ষা করে এসব বাজার থেকে কিনুন।</p></div>`;
  return html;
}

/* ---------- market overview ---------- */
function advMarket() {
  const d = advGet(`/ai/advisor/market?crop=${ADV.crop}`);
  let html = `<div class="chips">${Object.entries(CROPS).map(([k, c]) => `<button class="chip ${ADV.crop === k ? 'on' : ''}" data-adv="crop" data-v="${k}">${c.i} ${c.n}</button>`).join('')}</div>`;
  if (!d) return html + advLoading();
  html += d.warnings.map(w => `<div class="alert spoil">⚠️ ${esc(w)}</div>`).join('');
  const arrow = v => v>=2?`<span style="color:var(--green)">▲ ${advPct(v)}</span>`:v<=-2?`<span style="color:var(--red)">▼ ${advPct(v)}</span>`:`<span class="muted">→ ${advPct(v)}</span>`;
  html += `<div class="panel"><div class="scroll"><table class="tbl">
    <tr><th>বাজার</th><th class="num">আজ</th><th class="num">কাল</th><th class="num">পরশু</th><th class="num">৩ দিন</th><th class="num">দিকনির্দেশ</th></tr>
    ${d.markets.map(m=>`<tr ${m.glut?'style="background:var(--red-soft)"':''}><td><b>${esc(m.name)}</b>${m.glut?' <span class="pill p-red xs">মাল বেশি</span>':''}</td>
      <td class="num b">${tk(m.today,1)}</td>${m.fc.map(v=>`<td class="num">${tk(v,1)}</td>`).join('')}
      <td class="num">${arrow(m.change_3)}</td></tr>`).join('')}
    </table></div>
    <p class="muted xs" style="margin-top:6px">দাম ৳/কেজি। 🔻 মাল বেশি = কেনার ভালো সুযোগ হতে পারে।</p></div>`;
  return html;
}

V.advisor = () => {
  advDefaults();
  const st = advGet('/ai/advisor/status');
  return `<div class="phead"><div><h1>🤖 AI পরামর্শ</h1><p class="muted">কোন বাজারে কোন দিন বেচলে লাভ · কোথায় কম দামে মাল · বাজারের অবস্থা</p></div>
    </div>
    <div class="tabs">${[['farmer','🧑‍🌾 কোথায় বেচবেন'],['buyer','🚚 কোথায় কিনবেন'],['market','📊 বাজারের অবস্থা']].map(([k,t])=>`<button class="${ADV.tab===k?'on':''}" data-adv="tab" data-v="${k}">${t}</button>`).join('')}</div>
    ${ADV.tab==='farmer'?advFarmer():ADV.tab==='buyer'?advBuyer():advMarket()}`;
};

/* routing: show the advisor page for #/advisor */
const __appRender = render;
render = function () {
  if (parts()[0] !== 'advisor') return __appRender();
  $('#view').innerHTML = V.advisor();
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
