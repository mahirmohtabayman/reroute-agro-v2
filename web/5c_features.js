/* =====================================================================
   Reroute Agro — decision-support features
   * Smart Selling Advisor panel (sell now / wait / other market / insufficient evidence)
   * Ask in Bangla: typed or spoken question → understood fields → advice (never a transaction)
   * Crop freshness & spoilage risk
   * Truck pooling (admin dashboard + saving hint on the user's booking)
   * Impact dashboard (#/impact)
   * Dashboard action centre & money summary, negotiation timeline
   ===================================================================== */

ICONS.mic = '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>';
ICONS.layers = '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>';

NAV_ADMIN.push(['#/admin/pool', '🚚', 'ট্রাক পুলিং'], ['#/impact', '📊', 'প্রভাব']);

I18N_PHRASES.unshift(
  ['আপনার ফসল, সঠিক বাজার, ভালো সিদ্ধান্ত।', 'Your Crop. Your Market. Your Better Decision.'],
  ['বাজার তুলনা করুন, সরাসরি দরদাম করুন, আর কম খরচে পরিবহন ঠিক করুন: সব এক কৃষি প্ল্যাটফর্মে।', 'Compare markets, negotiate directly, and arrange smarter transportation — all in one agricultural platform.'],
  ['কৃষক হিসেবে শুরু করুন', 'Start as Farmer'],
  ['পাইকার হিসেবে শুরু করুন', 'Start as Buyer'],
  ['প্ল্যাটফর্মের প্রভাব', 'Platform impact'],
  ['অপারেশন টিমের অ্যাকাউন্ট শুধু Reroute তৈরি করে।', 'Operations accounts are created by Reroute only.'],
  ['নতুন অ্যাকাউন্ট খোলা এখন বন্ধ: SMS সেবা এখনো চালু হয়নি। চালু হলে এখানে নিবন্ধন করা যাবে।', 'New sign-ups are closed: SMS service is not enabled yet. You can register here once it is.'],
  ['প্রোটোটাইপ মোড: SMS সেবা এখনো চালু করা হয়নি। আপনার ডেমো ভেরিফিকেশন কোড:', 'Prototype Mode: SMS delivery is not enabled. Your demonstration verification code is'],
  ['এই কোড শুধু এই নিবন্ধনের জন্য, সার্ভারে যাচাই হয়। এটি ফোন নম্বরের মালিকানা প্রমাণ করে না।', 'This code is only for this sign-up and is checked by the server. It does not prove ownership of the phone number.'],
  ['প্রোটোটাইপ মোড', 'Prototype Mode'],
  ['সিমুলেটেড পেমেন্ট:', 'Simulated payment:'],
  ['এটি প্রোটোটাইপ, কোনো আসল টাকা লেনদেন বা ব্যাংক/বিকাশ/নগদ সংযোগ হয় না।', 'This is a prototype: no real money moves and no bank/bKash/Nagad connection is made.'],
  ['কৃষক কত ভালো দাম পাচ্ছেন, পরিবহনে কত সাশ্রয়: ডাটাবেসের আসল হিসাব আর স্পষ্টভাবে চিহ্নিত অনুমান', 'How much better farmers sell and how much transport saves: database figures and clearly labelled estimates'],
  ['ডেমো অ্যাকাউন্টের লেনদেন আলাদা দেখানো হয়েছে; আসল প্রভাব হিসেবে শুধু নিবন্ধিত অ্যাকাউন্টের সংখ্যা ধরুন। সব পেমেন্ট সিমুলেটেড, কোনো আসল টাকা লেনদেন হয়নি।', 'Demo-account activity is shown separately; count only registered accounts as real impact. All payments are simulated; no real money moved.'],
  ['সাপ্তাহিক সম্পন্ন অর্ডার (গত ৮ সপ্তাহ)', 'Completed orders per week (last 8 weeks)'],
  ['শেয়ার্ড ট্রাকে অংশগ্রহণ', 'Shared truck participation'],
  ['পচন থেকে বাঁচানো সম্ভাব্য ফসল', 'Produce potentially saved from spoilage'],
  ['কৃষকের বাড়তি আয়', 'Extra farmer net proceeds'],
  ['পরিবহনে সাশ্রয়', 'Transport savings'],
  ['বিক্রি হওয়া ফসল', 'Produce sold'],
  ['লেনদেনের পরিমাণ', 'Transaction volume'],
  ['সম্পন্ন অর্ডার', 'Completed orders'],
  ['কীভাবে হিসাব', 'How it is calculated'],
  ['একই রুট, একই দিন ও একই ধরনের ফসলের বুকিং এক ট্রাকে: খরচ ওজনের অনুপাতে ভাগ', 'Same route, same day, compatible crops on one truck: cost shared by weight'],
  ['ট্রাকের অপেক্ষায় বুকিং', 'Bookings waiting for a truck'],
  ['পুলিংয়ের সুযোগ', 'Pooling opportunities'],
  ['শেয়ার্ড ট্রাকে গেছে', 'Travelled on a shared truck'],
  ['ট্রাক ও ধারণক্ষমতা', 'Trucks and capacity'],
  ['নরম ফসল (ক্রেটে, উপরে চাপ ছাড়া)', 'Delicate produce (crates, nothing stacked on top)'],
  ['শক্ত ফসল (বস্তায়)', 'Robust produce (sacks)'],
  ['একা গেলে', 'Standalone'],
  ['ভাগাভাগিতে', 'Shared'],
  ['প্রস্তাবিত ট্রাক', 'Suggested truck'],
  ['একই পথে যাওয়া ট্রাকে যোগ হবে', 'Joins a truck already going this way'],
  ['এই ট্রাকে দিন', 'Assign to this truck'],
  ['নতুন করে দেখুন', 'Refresh'],
  ['এখন পুলিংয়ের সুযোগ নেই', 'No pooling opportunities right now'],
  ['শেয়ার্ড ট্রাকের সুযোগ:', 'Shared truck opportunity:'],
  ['উত্তর দিতে হবে এমন অফার', 'Offers awaiting your reply'],
  ['নজর দিতে হবে এমন লিস্টিং', 'Listings needing attention'],
  ['নিশ্চিত অর্ডার', 'Confirmed orders'],
  ['চলমান ডেলিভারি', 'Deliveries in progress'],
  ['তাজা থাকার সময় কম (২ দিন বা কম)', 'Freshness running out (2 days or less)'],
  ['এআই বাজার সুযোগ', 'AI market opportunity'],
  ['কোন বাজারে বেচলে হাতে বেশি থাকবে দেখুন', 'See which market leaves you the most money'],
  ['পুরো হিসাব দেখুন', 'See full accounts'],
  ['কিছু বিক্রির উৎপাদন খরচ জানা নেই, তাই লাভের হিসাব আংশিক। "মজুদ ও হিসাব"-এ খরচ লিখুন।', 'Production cost is unknown for some sales, so profit is partial. Add costs in "Stock & accounts".'],
  ['পরিবহন ও হস্তান্তর', 'Transport & handover'],
  ['পাল্টা দাম', 'Counter-offer'],
  ['প্রত্যাখ্যাত', 'Rejected'],
  ['মেয়াদ শেষ', 'Expired'],
  ['যেমন: "আমার ২০ মণ টমেটো কোন বাজারে বিক্রি করলে বেশি লাভ হবে?"', 'e.g. "Where should I sell my 20 maunds of tomatoes for the most profit?"'],
  ['মাইক্রোফোনে বলুন', 'Speak into the microphone'],
  ['এই ব্রাউজারে কণ্ঠস্বর চেনার সুবিধা নেই, লিখে জিজ্ঞেস করুন।', 'Voice input is not available in this browser; please type your question.'],
  ['প্রশ্নে যোগ করে আবার "বুঝে নিন" চাপুন।', 'Add it to the question and press "Understand" again.'],
  ['কোন ফসল?', 'Which crop?'],
  ['কত মণ বা কেজি?', 'How many maunds or kg?'],
  ['বিক্রি করবেন না কিনবেন?', 'Selling or buying?'],
  ['(আগের মতো)', '(as before)'],
  ['কত দিন আগে তোলা', 'Harvested how many days ago'],
  ['পথে কত ঘণ্টা', 'Hours on the road'],
  ['কত দিন পরে পাঠাবেন', 'Send after how many days'],
  ['রাখার অবস্থা', 'Storage'],
  ['খোলা জায়গা', 'Open air'],
  ['ছায়া / ঠান্ডা ঘর', 'Shade / cool room'],
  ['স্থানীয় হাট', 'Local market'],
  ['পচনের ঝুঁকি', 'Spoilage risk'],
  ['পরামর্শ:', 'Advice:'],
  ['প্রোটোটাইপ নিয়ম: ফসল তাজা থাকার দিন ও তাপমাত্রা অনুযায়ী আনুমানিক হিসাব। এটি যাচাই করা মেশিন লার্নিং মডেল নয়; আসল সংরক্ষণ অবস্থা, প্যাকিং ও মালের মান অনুযায়ী ঝুঁকি আলাদা হতে পারে।', 'Prototype rules: an estimate from typical shelf life and temperature. This is not a validated machine-learning model; real risk depends on storage, packing and produce quality.'],
  ['ডেটার উৎস ও মডেল', 'Data source and model'],
  ['উৎপাদন খরচ দিলে দেখাবে', 'Shown when production cost is given'],
  ['কমিশন ও ১% ফি', 'Commission & 1% fee'],
  ['পচন বাদে', 'after spoilage'],
  ['বড় কোনো ঝুঁকি দেখা যাচ্ছে না।', 'No major risk found.'],
  ['এই দামে লিস্টিং দিন', 'List at this price'],
  ['তথ্য আনা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।', 'Could not load data. Check your connection and try again.'],
  ['আবার চেষ্টা', 'Retry'],
  ['স্মার্ট বিক্রয় পরামর্শ', 'Smart Selling Advisor'],
  ['এখনই বিক্রি করুন', 'Sell now'],
  ['কিছুদিন অপেক্ষা করার কথা ভাবুন', 'Consider waiting'],
  ['অন্য বাজারে বিক্রির কথা ভাবুন', 'Consider another market'],
  ['যথেষ্ট তথ্য নেই', 'Insufficient evidence'],
  ['প্রস্তাবিত বাজার', 'Recommended market'],
  ['আনুমানিক বিক্রয়মূল্য', 'Estimated selling price'],
  ['আনুমানিক বিক্রির টাকা', 'Estimated selling revenue'],
  ['আনুমানিক পরিবহন খরচ', 'Estimated transport cost'],
  ['অন্যান্য খরচ', 'Other costs'],
  ['আনুমানিক হাতে থাকবে', 'Estimated net proceeds'],
  ['আনুমানিক লাভ', 'Expected profit'],
  ['বিকল্পের চেয়ে বেশি', 'Advantage over alternative'],
  ['কেন এই বাজার?', 'Why this market?'],
  ['ঝুঁকি', 'Risks'],
  ['ডেটার উৎস', 'Data source'],
  ['পূর্বাভাসের সময়সীমা', 'Forecast horizon'],
  ['মডেল', 'Model'],
  ['বাংলায় জিজ্ঞেস করুন', 'Ask in Bangla'],
  ['বলুন বা লিখুন', 'Speak or type'],
  ['বুঝে নিন', 'Understand'],
  ['যা বুঝেছি', 'What I understood'],
  ['পরামর্শ দেখুন', 'Show advice'],
  ['শুনুন', 'Listen'],
  ['শুনছি…', 'Listening…'],
  ['ফসলের তাজা থাকা ও পচনের ঝুঁকি', 'Crop freshness & spoilage risk'],
  ['ট্রাক পুলিং', 'Truck pooling'],
  ['প্ল্যাটফর্মের প্রভাব', 'Platform impact'],
  ['আজকের কাজের কেন্দ্র', "Today's action center"],
  ['টাকার লেনদেন', 'Money in motion'],
  ['বিক্রির টাকা আসার অপেক্ষায়', 'Sale money on its way'],
  ['পেমেন্ট দিতে বাকি', 'Payments due'],
  ['লেনদেনের ধাপ', 'Deal timeline']
);

/* short single words go last, so longer phrases that contain them are matched first */
I18N_PHRASES.push(
  ['সম্ভাব্য', 'Likely'],
  ['নিবন্ধিত', 'registered'],
  ['আনুমানিক', 'Estimated'],
  ['সিমুলেটেড', 'simulated'],
  ['সাশ্রয়', 'Savings'],
  ['ভরা', 'Load'],
  ['ওজন (কেজি)', 'Weight (kg)'],
  ['ভাগ (%)', 'Share (%)'],
  ['ধারণক্ষমতা', 'capacity'],
  ['সব সময়', 'All time'],
  ['প্রভাব', 'Impact']
);

/* ---------- small cached GET for these pages (re-renders while the same page is open) ---------- */
const FX = {cache: {}, busy: {}};
function fxGet(path, ttl = 120000){
  const c = FX.cache[path], here = location.hash;
  if (c && !c.error && Date.now() - c.at < ttl) return c.d;
  if (!FX.busy[path]) {
    FX.busy[path] = 1;
    fetch('/api' + path, {headers: TOKEN ? {'X-Token': TOKEN} : {}})
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { FX.cache[path] = {d, at: Date.now()}; })
      .catch(() => { FX.cache[path] = {error: true, at: Date.now()}; })
      .finally(() => { delete FX.busy[path]; if (location.hash === here) render(); });
  }
  return c && !c.error ? c.d : null;
}
const fxFailed = path => !!(FX.cache[path] && FX.cache[path].error);
const fxDrop = prefix => Object.keys(FX.cache).filter(k => k.startsWith(prefix)).forEach(k => delete FX.cache[k]);
const riskPill = (lvl, bnTxt) => `<span class="pill ${lvl === 'high' ? 'p-red' : lvl === 'medium' ? 'p-gold' : 'p-green'}">পচনের ঝুঁকি: <span data-i18n-skip>${isEn() ? {low: 'Low', medium: 'Medium', high: 'High'}[lvl] : bnTxt}</span></span>`;
const fxErr = t => `<div class="note" role="alert">${ic('alert')} ${t || 'তথ্য আনা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।'} <button class="linkbtn" data-fx="retry">আবার চেষ্টা</button></div>`;

/* =====================================================================
   Smart Selling Advisor
   ===================================================================== */
const SS_TONE = {sell_now: 'green', other_market: 'blue', wait: 'gold', insufficient_evidence: 'grey'};
function ssQuery(){
  return `/ai/advisor/smart-sell?src=${ADV.place}&crop=${ADV.crop}&qty=${ADV.mon * MON}${ADV.days ? `&days_left=${ADV.days}` : ''}${ADV.cost !== '' ? `&cost=${ADV.cost}` : ''}`;
}
function ssSpeech(r){
  const m = r.money;
  return `${r.decision_bn}। ${r.market_name} বাজারে ${r.send_bn} পাঠালে আনুমানিক দাম কেজিপ্রতি ${tk(m.price, 1)}, `
    + `হাতে থাকবে প্রায় ${tk(m.net_proceeds)}` + (m.profit != null ? `, লাভ প্রায় ${tk(m.profit)}` : '') + '। এটি সিমুলেটেড তথ্যের উপর অনুমান, নিশ্চিত নয়।';
}
function ssPanel(){
  const r = advGet(ssQuery());
  if (!r) return `<div class="panel ss-panel">${advLoading('স্মার্ট পরামর্শ তৈরি হচ্ছে...')}</div>`;
  const m = r.money, tone = SS_TONE[r.decision], alt = r.alternative, pv = r.provenance;
  const fig = (label, val, sub = '', strong = false) => `<div class="ss-fig${strong ? ' strong' : ''}"><span class="muted xs">${label}</span><b>${val}</b>${sub ? `<span class="muted xs">${sub}</span>` : ''}</div>`;
  return `<section class="panel ss-panel ss-${tone}" aria-labelledby="ss-h">
    <div class="ss-head"><h2 id="ss-h">${ic('sparkles')} স্মার্ট বিক্রয় পরামর্শ</h2><span class="pill ss-pill">${r.decision_bn}</span></div>
    <p class="ss-lead">${r.decision === 'insufficient_evidence'
      ? `পূর্বাভাসের ভিত্তি দুর্বল (${esc(r.evidence_gaps.join(', '))})। আজকের স্থানীয় দর অনুযায়ী হিসাব নিচে।`
      : `প্রস্তাবিত বাজার: <b>${esc(r.market_name)}</b> · ${esc(r.send_bn)} পাঠান`}</p>
    <div class="ss-grid">
      ${fig('আনুমানিক বিক্রয়মূল্য', `${tk(m.price, 1)}/কেজি`, m.price_lo !== m.price_hi ? `সম্ভাব্য ${tk(m.price_lo, 1)}–${tk(m.price_hi, 1)}` : 'আজকের দর')}
      ${fig('আনুমানিক বিক্রির টাকা', tk(m.revenue), `পচন বাদে (${nf(m.spoil_pct, 1)}%)`)}
      ${fig('আনুমানিক পরিবহন খরচ', tk(m.transport))}
      ${fig('অন্যান্য খরচ', tk(m.other_costs), 'কমিশন ও ১% ফি')}
      ${fig('আনুমানিক হাতে থাকবে', tk(m.net_proceeds), `সম্ভাব্য ${tk(m.net_lo)}–${tk(m.net_hi)}`, true)}
      ${m.profit != null ? fig('আনুমানিক লাভ', `${m.profit < 0 ? '−' : ''}${tk(Math.abs(m.profit))}`, `উৎপাদন খরচ ${tk(m.production_cost)} বাদে`, true)
        : fig('আনুমানিক লাভ', '—', 'উৎপাদন খরচ দিলে দেখাবে')}
      ${r.advantage > 0 ? fig('বিকল্পের চেয়ে বেশি', tk(r.advantage), `${esc(alt.market_name)} (${ADV_SEND[alt.send_in_days].replace(' পাঠান', '')})-এর তুলনায়${r.advantage_certain ? '' : ' · নিশ্চিত নয়'}`) : ''}
    </div>
    <div class="ss-cols">
      <div><h3>কেন এই বাজার?</h3><ul class="ss-list">${r.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>
      <div><h3>ঝুঁকি</h3><p style="margin:6px 0">${riskPill(r.spoilage.level, r.spoilage.level_bn)}</p>
        ${r.risks.length ? `<ul class="ss-list">${r.risks.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '<p class="muted sm">বড় কোনো ঝুঁকি দেখা যাচ্ছে না।</p>'}</div>
    </div>
    <div class="row wrap-it" style="gap:8px;margin-top:12px">
      ${'speechSynthesis' in window ? `<button class="btn btn-line btn-sm" data-fx="speak">${ic('volume')} শুনুন</button>` : ''}
      ${me() && me().role !== 'admin' ? `<button class="btn btn-green btn-sm" data-adv="list" data-v="${r.money.price}">এই দামে লিস্টিং দিন</button>` : ''}
    </div>
    <details class="ss-src"><summary>${ic('info')} ডেটার উৎস ও মডেল</summary>
      <ul class="ss-list xs">
        <li>ডেটার উৎস: ${esc(pv.data_bn)} · তারিখ ${esc(pv.data_date)} <span class="demo-tag">সিমুলেটেড</span></li>
        <li>পূর্বাভাসের সময়সীমা: ১–৩ দিন · মডেল: ${esc(pv.model_bn)}</li>
        <li>${esc(pv.backtest_note)} ${Object.entries(pv.backtest || {}).map(([h, v]) => `${bd(h)} দিন: ভুল ${nf(v.mape_model, 1)}% (সাধারণ অনুমানে ${nf(v.mape_naive, 1)}%)`).join(' · ')}</li>
        <li>${esc(pv.interval_note)}</li>
        <li>${esc(r.terms.net_proceeds)}। ${esc(r.terms.profit)}।</li>
      </ul></details>
  </section>`;
}

/* replace the old "main advice" box with the decision-aware panel, and add the assistant and risk card */
const __advFarmer = advFarmer;
advFarmer = function(){
  const html = __advFarmer();
  if (!ADV.crop || html.indexOf('sk-wrap') >= 0 && html.indexOf('মূল পরামর্শ') < 0) return vaPanel() + html;
  return vaPanel() + html.replace(/<div class="panel" style="border:2px solid var\(--(red|green)\);margin-bottom:14px">[\s\S]*?<\/div>/, ssPanel()) + spPanel();
};

/* =====================================================================
   Ask in Bangla (typed or spoken). Shows what was understood; advice only after the user confirms.
   ===================================================================== */
const VA = {text: '', parsed: null, listening: false, err: '', busy: false};
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
function vaPanel(){
  const p = VA.parsed, miss = p ? p.missing : [];
  const ask = {crop: 'কোন ফসল?', qty: 'কত মণ বা কেজি?', intent: 'বিক্রি করবেন না কিনবেন?'};
  return `<section class="panel va-panel" aria-labelledby="va-h">
    <h3 id="va-h">${ic('mic')} বাংলায় জিজ্ঞেস করুন</h3>
    <p class="muted sm">যেমন: "আমার ২০ মণ টমেটো কোন বাজারে বিক্রি করলে বেশি লাভ হবে?"</p>
    <div class="va-row">
      <label class="sr-only" for="va-in">বলুন বা লিখুন</label>
      <input id="va-in" maxlength="300" placeholder="বলুন বা লিখুন" value="${esc(VA.text)}">
      ${SpeechRec ? `<button class="btn btn-line" data-fx="va-mic" aria-pressed="${VA.listening}" aria-label="মাইক্রোফোনে বলুন">${ic('mic')} ${VA.listening ? 'শুনছি…' : 'বলুন'}</button>` : ''}
      <button class="btn btn-green" data-fx="va-parse" ${VA.busy ? 'disabled' : ''}>বুঝে নিন</button>
    </div>
    ${SpeechRec ? '' : '<p class="muted xs" style="margin-top:6px">এই ব্রাউজারে কণ্ঠস্বর চেনার সুবিধা নেই, লিখে জিজ্ঞেস করুন।</p>'}
    ${VA.err ? `<p class="form-error" role="alert">${esc(VA.err)}</p>` : ''}
    ${p ? `<div class="va-out" role="status"><b>যা বুঝেছি:</b>
      <span class="pill ${p.crop ? 'p-green' : 'p-grey'}">ফসল: ${p.crop ? esc(p.crop_bn) : '?'}</span>
      <span class="pill ${p.qty_kg ? 'p-green' : 'p-grey'}">পরিমাণ: ${p.qty_kg ? monTxt(p.qty_kg) : '?'}</span>
      <span class="pill ${p.place ? 'p-green' : 'p-grey'}">জেলা: ${p.place ? esc(p.place_bn) : esc(PLACES[ADV.place].n) + ' (আগের মতো)'}</span>
      <span class="pill ${p.intent ? 'p-green' : 'p-grey'}">কাজ: ${p.intent === 'buy' ? 'কেনা' : p.intent === 'sell' ? 'বিক্রি' : '?'}</span>
      ${miss.length ? `<p class="warn sm" style="margin-top:8px">${miss.map(k => ask[k]).join(' ')} প্রশ্নে যোগ করে আবার "বুঝে নিন" চাপুন।</p>`
        : p.intent === 'buy' ? `<p class="sm" style="margin-top:8px">কেনার পরামর্শ দেখতে "পাইকার হিসেবে দেখুন" বাছুন বা পাইকার হিসেবে লগ ইন করুন।</p>`
        : `<button class="btn btn-green btn-sm" style="margin-top:8px" data-fx="va-go">পরামর্শ দেখুন</button>`}
    </div>` : ''}
  </section>`;
}
let VA_REC = null;
function vaListen(){
  if (VA.listening && VA_REC) { VA_REC.stop(); return; }
  try {
    VA_REC = new SpeechRec();
    VA_REC.lang = 'bn-BD';
    VA_REC.interimResults = false;
    VA_REC.maxAlternatives = 1;
    VA_REC.onresult = e => { VA.text = e.results[0][0].transcript; VA.parsed = null; VA.err = ''; };
    VA_REC.onerror = e => {
      VA.err = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'মাইক্রোফোনের অনুমতি দেওয়া হয়নি। ব্রাউজারে অনুমতি দিন বা লিখে জিজ্ঞেস করুন।'
        : e.error === 'no-speech' ? 'কোনো কথা শোনা যায়নি। আবার বলুন বা লিখুন।' : 'কণ্ঠস্বর চেনা যায়নি। লিখে জিজ্ঞেস করুন।';
    };
    VA_REC.onend = () => { VA.listening = false; render(); };
    VA.listening = true; VA.err = '';
    VA_REC.start();
    render();
  } catch (e) { VA.listening = false; VA.err = 'কণ্ঠস্বর চেনা চালু করা যায়নি। লিখে জিজ্ঞেস করুন।'; render(); }
}
async function vaParse(){
  const inp = $('#va-in');
  VA.text = (inp ? inp.value : VA.text).trim();
  if (!VA.text) { VA.err = 'প্রশ্নটি লিখুন বা বলুন'; render(); return; }
  VA.busy = true; VA.err = ''; render();
  try { VA.parsed = await api('/ai/advisor/parse', 'POST', {text: VA.text}); }
  catch (e) { VA.err = e.message || 'বোঝা যায়নি'; }
  VA.busy = false; render();
}
function vaGo(){
  const p = VA.parsed;
  if (!p || p.missing.length) return;
  ADV.crop = p.crop; ADV.days = ''; ADV.costTouched = false; advPrefillCost();
  ADV.mon = Math.min(2500, Math.max(1, Math.round(p.qty_kg / MON)));
  if (p.place) ADV.place = p.place;
  render();
  setTimeout(() => { const el = $('.ss-panel'); if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'}); }, 50);
}

/* =====================================================================
   Crop freshness & spoilage risk (prototype rule set, labelled)
   ===================================================================== */
const SP = {harvest: 0, hours: 8, wait: 0, storage: 'ambient'};
function spPanel(){
  const r = advGet(`/ai/advisor/spoilage?crop=${ADV.crop}&place=${ADV.place}&harvest_days_ago=${SP.harvest}&travel_hours=${SP.hours}&wait_days=${SP.wait}&storage=${SP.storage}`);
  const sel = (k, opts) => `<select data-spf="${k}">${opts.map(([v, t]) => `<option value="${v}" ${String(SP[k]) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  return `<section class="panel" aria-labelledby="sp-h"><h3 id="sp-h">${ic('leaf')} ফসলের তাজা থাকা ও পচনের ঝুঁকি <span class="muted sm">(${CROPS[ADV.crop].n})</span></h3>
    <div class="filters" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-top:8px">
      <label><span>কত দিন আগে তোলা</span>${sel('harvest', [0, 1, 2, 3, 4, 5, 7, 10].map(d => [d, d ? `${bd(d)} দিন` : 'আজ']))}</label>
      <label><span>পথে কত ঘণ্টা</span>${sel('hours', [0, 3, 6, 8, 12, 18, 24].map(h => [h, h ? `${bd(h)} ঘণ্টা` : 'স্থানীয় হাট']))}</label>
      <label><span>কত দিন পরে পাঠাবেন</span>${sel('wait', [0, 1, 2, 3].map(d => [d, d ? `${bd(d)} দিন পরে` : 'আজ']))}</label>
      <label><span>রাখার অবস্থা</span>${sel('storage', [['ambient', 'খোলা জায়গা'], ['cool', 'ছায়া / ঠান্ডা ঘর']])}</label></div>
    ${!r ? advLoading('ঝুঁকি হিসাব হচ্ছে...') : `<div class="risk-box risk-${r.level}">${riskPill(r.level, r.level_bn)}
      <ul class="ss-list">${r.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="sm"><b>পরামর্শ:</b> ${esc(r.action)}</p></div>
      <p class="muted xs" style="margin-top:6px">${esc(r.limitation)}</p>`}
  </section>`;
}
document.addEventListener('change', e => {
  const k = e.target.dataset.spf;
  if (!k) return;
  SP[k] = k === 'storage' ? e.target.value : +e.target.value;
  render();
});

/* =====================================================================
   Truck pooling — admin dashboard
   ===================================================================== */
V.adminPool = () => {
  const d = fxGet('/admin/pool', 30000);
  const head = `<div class="phead"><div><h1>${ic('layers')} ট্রাক পুলিং</h1><p class="muted">একই রুট, একই দিন ও একই ধরনের ফসলের বুকিং এক ট্রাকে: খরচ ওজনের অনুপাতে ভাগ</p></div>
    <button class="btn btn-line btn-sm" data-fx="pool-refresh">${ic('refresh')} নতুন করে দেখুন</button></div>`;
  if (!d) return head + (fxFailed('/admin/pool') ? fxErr() : advLoading());
  const pt = d.participation;
  return head + `<div class="grid3" style="margin-bottom:16px">
      <div class="kpi"><span class="muted sm">ট্রাকের অপেক্ষায় বুকিং</span><strong>${nf(d.waiting)}টি</strong></div>
      <div class="kpi"><span class="muted sm">পুলিংয়ের সুযোগ</span><strong>${nf(d.groups.length)}টি</strong></div>
      <div class="kpi"><span class="muted sm">শেয়ার্ড ট্রাকে গেছে</span><strong>${pt.pct == null ? '—' : nf(pt.pct, 1) + '%'}</strong><span class="muted xs">${nf(pt.shared)} / ${nf(pt.delivered)} সম্পন্ন বুকিং</span></div></div>
    <h2 class="sec-title">পুলিংয়ের সুযোগ</h2>
    ${d.groups.length ? d.groups.map(g => `<div class="panel pool-card">
      <div class="row wrap-it" style="justify-content:space-between;gap:8px"><div><b>${esc(g.route)}</b> · ${esc(g.day)} · <span class="muted sm">${esc(g.handling_bn)}</span></div>
        <span class="pill p-green">সাশ্রয় ${tk(g.savings_total)}</span></div>
      <p class="muted sm" style="margin-top:4px">${esc(g.vehicle_name)} · মোট ${nf(g.total_kg)} কেজি / ধারণক্ষমতা ${nf(g.capacity)} কেজি · দূরত্ব প্রায় ${nf(g.km)} কিমি (আনুমানিক) · পুরো ট্রিপ ${tk(g.trip_cost)}</p>
      <div class="cap-bar" role="img" aria-label="ট্রাকের ${nf(Math.round(g.total_kg / g.capacity * 100))}% ভরা"><span style="width:${Math.min(100, g.total_kg / g.capacity * 100)}%"></span></div>
      <div class="scroll"><table class="tbl" style="margin-top:8px"><tr><th>বুকিং</th><th>ফসল</th><th class="num">ওজন (কেজি)</th><th class="num">ভাগ (%)</th><th class="num">একা গেলে</th><th class="num">ভাগাভাগিতে</th><th class="num">সাশ্রয়</th></tr>
        ${g.members.map(x => `<tr><td><a href="#/booking/${x.booking}">${esc(x.booking)}</a></td><td>${CROPS[x.crop].n}</td><td class="num">${nf(x.qty)} কেজি</td><td class="num">${nf(x.share_pct, 1)}%</td>
          <td class="num">${tk(x.standalone_cost)}</td><td class="num">${tk(x.shared_cost)}</td><td class="num b">${tk(x.savings)}</td></tr>`).join('')}
      </table></div>
      ${g.truck ? `<div class="row wrap-it" style="gap:8px;margin-top:10px"><span class="sm">${g.truck.joins_trip ? 'একই পথে যাওয়া ট্রাকে যোগ হবে' : 'প্রস্তাবিত ট্রাক'}: <b>${esc(g.truck.company)}</b> (${esc(g.truck.number)}), খালি ${nf(g.truck.free)} কেজি</span>
        <button class="btn btn-green btn-sm" data-fx="pool-assign" data-b="${g.bookings.join(',')}" data-t="${g.truck.id}">এই ট্রাকে দিন</button></div>`
        : '<p class="warn sm" style="margin-top:8px">এই দলের জন্য যথেষ্ট খালি ট্রাক নেই।</p>'}
    </div>`).join('') : emptyState('truck', 'এখন পুলিংয়ের সুযোগ নেই', 'একই রুট ও দিনের একাধিক বুকিং এলে এখানে দেখাবে।', '', true)}
    <h2 class="sec-title">ট্রাক ও ধারণক্ষমতা</h2>
    <div class="panel scroll"><table class="tbl"><tr><th>ট্রাক</th><th>ধরন</th><th>জেলা</th><th>অবস্থা</th><th class="num">বুক করা</th><th class="num">খালি</th><th style="min-width:120px">ভরা</th></tr>
      ${d.trucks.map(t => `<tr><td><b>${esc(t.company)}</b><div class="muted xs">${esc(t.number)}</div></td><td>${esc(t.vehicle_name)}</td><td>${PLACES[t.place] ? PLACES[t.place].n : esc(t.place)}</td>
        <td>${{available: 'খালি', booked: 'বুক করা', on_trip: 'পথে', maintenance: 'মেরামতে'}[t.status] || esc(t.status)}</td><td class="num">${nf(t.reserved)} কেজি</td><td class="num">${nf(t.free)} কেজি</td>
        <td><div class="cap-bar sm"><span style="width:${Math.min(100, t.reserved / t.capacity * 100)}%"></span></div></td></tr>`).join('')}
    </table></div>
    <p class="muted xs" style="margin-top:8px">${esc(d.method)}</p>`;
};

/* saving hint on the user's own booking page (no other user's details) */
const __vBooking = V.booking;
V.booking = id => {
  const html = __vBooking(id), b = (S.bookings || []).find(x => x.id === id);
  if (!b || !me() || b.uid !== me().id || b.status !== 'requested') return html;
  const mine = fxGet('/pool/mine', 60000), r = mine && mine.find(x => x.booking === id);
  if (!r || !r.compatible) return html;
  return html + `<div class="panel note-panel">${ic('layers')} <b>শেয়ার্ড ট্রাকের সুযোগ:</b> একই রুট ও দিনে আরও ${nf(r.compatible)}টি বুকিং আছে।
    একসাথে গেলে ট্রিপ খরচে আপনার ভাগ আনুমানিক ${tk(r.shared_cost)}, একা পুরো ট্রাকে ${tk(r.standalone_cost)} — সাশ্রয় প্রায় ${tk(r.savings)}।
    <p class="muted xs" style="margin-top:6px">${esc(r.method)} অপারেশন টিম ট্রাক ঠিক করার সময় এটি বিবেচনা করে।</p></div>`;
};

/* =====================================================================
   Impact dashboard (public)
   ===================================================================== */
let IMP_DAYS = 0;
function impCard(key, title, icon, m, fmt){
  const v = m.total == null ? '—' : fmt(m.total);
  const split = m.demo != null && m.total ? `<span class="muted xs">${m.registered ? `নিবন্ধিত ${fmt(m.registered)}` : 'নিবন্ধিত ০'} · ডেমো ${fmt(m.demo)}</span>` : '';
  return `<div class="kpi imp-kpi"><span class="kpi-ic">${ic(icon)}</span><span class="muted sm">${title}${m.estimate ? ' <span class="pill p-gold">আনুমানিক</span>' : ''}${m.simulated ? ' <span class="demo-tag">সিমুলেটেড</span>' : ''}</span>
    <strong>${v}</strong>${split}<details><summary class="xs">কীভাবে হিসাব</summary><p class="xs muted" data-i18n-skip>${esc(isEn() && m.def_en ? m.def_en : m.def)}</p></details></div>`;
}
V.impact = () => {
  const path = `/impact?days=${IMP_DAYS}`, d = fxGet(path, 60000);
  const head = `<div class="phead"><div><h1>${ic('chart')} প্ল্যাটফর্মের প্রভাব</h1><p class="muted">কৃষক কত ভালো দাম পাচ্ছেন, পরিবহনে কত সাশ্রয়: ডাটাবেসের আসল হিসাব আর স্পষ্টভাবে চিহ্নিত অনুমান</p></div></div>
    <div class="chips" role="group" aria-label="সময়সীমা">${[[0, 'সব সময়'], [7, '৭ দিন'], [30, '৩০ দিন'], [90, '৯০ দিন']].map(([v, t]) => `<button class="chip ${IMP_DAYS === v ? 'on' : ''}" data-fx="imp-days" data-v="${v}">${t}</button>`).join('')}</div>`;
  if (!d) return head + (fxFailed(path) ? fxErr() : advLoading());
  const M = d.metrics, mon = v => `${nf(v, 1)} মণ`, cnt = v => nf(v), pct = M.shared_transport;
  const maxO = Math.max(1, ...d.trend.map(w => w.orders));
  const bars = d.trend.map((w, i) => {
    const h = Math.round(w.orders / maxO * 100), x = i * 40 + 8;
    return `<g><rect x="${x}" y="${110 - h}" width="26" height="${h}" rx="4" class="bar"><title>${nf(w.orders)}টি অর্ডার, ${tk(w.volume_tk)}</title></rect>
      <text x="${x + 13}" y="${104 - h}" text-anchor="middle" class="bar-t">${w.orders ? nf(w.orders) : ''}</text></g>`;
  }).join('');
  return head + `${d.demo_mode ? `<div class="note" style="margin:12px 0"><span data-i18n-skip>${esc(isEn() && d.note_en ? d.note_en : d.note)}</span></div>` : `<p class="muted sm" style="margin:12px 0"><span data-i18n-skip>${esc(isEn() && d.note_en ? d.note_en : d.note)}</span></p>`}
    <div class="grid4 imp-grid">
      ${impCard('farmers', 'কৃষক', 'users', M.farmers, cnt)}
      ${impCard('buyers', 'পাইকার', 'users', M.buyers, cnt)}
      ${impCard('orders', 'সম্পন্ন অর্ডার', 'checkc', M.orders_completed, cnt)}
      ${impCard('volume', 'লেনদেনের পরিমাণ', 'wallet', M.volume_tk, v => tk(v))}
      ${impCard('mon', 'বিক্রি হওয়া ফসল', 'package', M.volume_mon, mon)}
      ${impCard('tsave', 'পরিবহনে সাশ্রয়', 'truck', M.transport_savings_tk, v => tk(v))}
      ${impCard('gain', 'কৃষকের বাড়তি আয়', 'sparkles', M.net_proceeds_gain_tk, v => tk(v))}
      ${impCard('loss', 'পচন থেকে বাঁচানো সম্ভাব্য ফসল', 'leaf', M.loss_reduction_mon, mon)}
    </div>
    <div class="grid2" style="margin-top:16px">
      <div class="panel"><h3>সাপ্তাহিক সম্পন্ন অর্ডার (গত ৮ সপ্তাহ)</h3>
        ${d.trend.some(w => w.orders) ? `<svg class="fx-chart" viewBox="0 0 330 120" role="img" aria-label="গত ৮ সপ্তাহে সাপ্তাহিক সম্পন্ন অর্ডারের সংখ্যা">${bars}<line x1="0" y1="110.5" x2="330" y2="110.5" class="axis"/></svg>
          <p class="muted xs">প্রতিটি বার এক সপ্তাহ, বাঁ থেকে পুরনো থেকে নতুন। মোট ${tk(d.trend.reduce((a, w) => a + w.volume_tk, 0))}।</p>`
          : emptyState('chart', 'এই সময়ে সম্পন্ন অর্ডার নেই', '', '', true)}</div>
      <div class="panel"><h3>শেয়ার্ড ট্রাকে অংশগ্রহণ</h3>
        <strong class="big-num">${pct.pct == null ? '—' : nf(pct.pct, 1) + '%'}</strong>
        <p class="muted sm">${nf(pct.shared)}টি / ${nf(pct.delivered)}টি সম্পন্ন ট্রাক বুকিং অন্য বুকিংয়ের সাথে একই ট্রাকে গেছে।</p>
        <details><summary class="xs">কীভাবে হিসাব</summary><p class="xs muted" data-i18n-skip>${esc(isEn() && pct.def_en ? pct.def_en : pct.def)}</p></details></div>
    </div>`;
};

/* =====================================================================
   Dashboard: action centre and money summary
   ===================================================================== */
function actionCentre(){
  const u = me(), id = u.id;
  const offers = (S.offers || []).filter(o => (o.status === 'pending' && o.waiting === 'seller' && o.seller === id) || (o.status === 'countered' && o.waiting === 'buyer' && o.buyer === id)).length;
  const attention = myAlerts().length;
  const confirmed = (S.orders || []).filter(o => o.status === 'confirmed').length;
  const deliveries = (S.bookings || []).filter(b => ['pickup_scheduled', 'in_transit'].includes(b.status)).length;
  const fresh = (S.listings || []).filter(l => l.uid === id && l.status === 'active' && l.available > 0 && l.days_left <= 2).length;
  const items = [
    [offers, 'উত্তর দিতে হবে এমন অফার', '#/deals', 'inbox'],
    [attention, 'নজর দিতে হবে এমন লিস্টিং', '#/listings', 'alert'],
    [confirmed, 'নিশ্চিত অর্ডার', '#/deals', 'checkc'],
    [deliveries, 'চলমান ডেলিভারি', '#/transport', 'truck'],
    [fresh, 'তাজা থাকার সময় কম (২ দিন বা কম)', '#/listings', 'leaf'],
  ].filter(x => x[0] > 0);
  const ai = u.role === 'farmer' ? `<a class="ac-item ac-ai" href="#/advisor">${ic('sparkles')}<span><b>এআই বাজার সুযোগ</b><span class="muted xs">কোন বাজারে বেচলে হাতে বেশি থাকবে দেখুন</span></span></a>` : '';
  if (!items.length && !ai) return '';
  return `<section class="ac" aria-labelledby="ac-h"><h2 class="sec-title" id="ac-h">আজকের কাজের কেন্দ্র</h2><div class="ac-grid">
    ${items.map(([n, t, h, i]) => `<a class="ac-item" href="${h}">${ic(i)}<span><b>${nf(n)}</b> <span class="sm">${t}</span></span></a>`).join('')}${ai}</div></section>`;
}
function moneySummary(){
  const u = me(), P = S.pnl || {}, id = u.id;
  const pendingIn = (S.orders || []).filter(o => o.seller === id && ['confirmed', 'handed_over'].includes(o.status)).reduce((a, o) => a + (o.payout || 0), 0);
  const pendingOut = (S.orders || []).filter(o => o.buyer === id && o.status === 'awaiting_payment').reduce((a, o) => a + (o.buyer_total || 0), 0);
  const tx = (S.wallet_tx || []).slice(0, 5);
  // sales, expenses and profit are already in the "এ পর্যন্ত লাভ-ক্ষতি" box; this adds money in motion
  return `<section class="panel" aria-labelledby="ms-h"><h3 id="ms-h">${ic('wallet')} টাকার লেনদেন</h3>
    <div class="ms-grid">
      <div><span class="muted xs">বিক্রির টাকা আসার অপেক্ষায়</span><b>${tk(pendingIn)}</b></div>
      <div><span class="muted xs">পেমেন্ট দিতে বাকি</span><b>${tk(pendingOut)}</b></div></div>
    ${P.revenue && !P.exact ? '<p class="muted xs" style="margin-top:6px">কিছু বিক্রির উৎপাদন খরচ জানা নেই, তাই লাভের হিসাব আংশিক। "মজুদ ও হিসাব"-এ খরচ লিখুন।</p>' : ''}
    ${tx.length ? `<ul class="ms-tx">${tx.map(t => `<li><span>${esc(t.note || t.kind)}</span><b class="${t.amount < 0 ? 'neg' : 'pos'}">${t.amount < 0 ? '−' : '+'}${tk(Math.abs(t.amount))}</b></li>`).join('')}</ul>` : ''}
    <a class="linkbtn sm" href="#/books">পুরো হিসাব দেখুন</a></section>`;
}
const __vDash = V.dash;
V.dash = () => {
  const html = __vDash();
  return html.replace('<div class="dash-grid"><div>', `${actionCentre()}<div class="dash-grid"><div>`)
             .replace(/(<div class="dash-grid"><div>[\s\S]*?<\/div><div>)/, `$1${moneySummary()}`);
};

/* =====================================================================
   Negotiation timeline on the offer page (only stages the app supports; the order page has its own steps)
   ===================================================================== */
function dealTimeline(o, order){
  const ev = (S.offer_events || []).filter(e => e.offer === o.id);
  const insp = (S.inspections || []).filter(i => i.listing === o.listing && i.buyer === o.buyer).sort((a, b) => b.created - a.created)[0];
  const ended = ['rejected', 'cancelled', 'expired'].includes(o.status) ? o.status : order && order.status === 'cancelled' ? 'cancelled' : null;
  const steps = [];
  if (insp) steps.push(['পরিদর্শন', insp.status === 'completed' ? 'done' : 'skip']);
  steps.push(['অফার', 'done']);
  if (ev.some(e => e.action === 'counter')) steps.push(['পাল্টা দাম', 'done']);
  steps.push(['রাজি', o.status === 'accepted' ? 'done' : 'todo']);
  steps.push(['পেমেন্ট', order && order.paid_at ? 'done' : 'todo']);
  steps.push([order && order.transport === 'reroute' ? 'পরিবহন ও হস্তান্তর' : 'হস্তান্তর', order && order.handover_at ? 'done' : 'todo']);
  steps.push(['সম্পন্ন', order && order.status === 'completed' ? 'done' : 'todo']);
  const cur = steps.findIndex(s => s[1] === 'todo');
  return `<ol class="tl" aria-label="লেনদেনের ধাপ">${steps.filter(s => s[1] !== 'skip').map(([t, st], i, arr) => {
    const isCur = !ended && arr.findIndex(s => s[1] === 'todo') === i;
    return `<li class="${st === 'done' ? 'done' : isCur ? 'cur' : ''}" ${isCur ? 'aria-current="step"' : ''}><span class="dot">${st === 'done' ? ic('check') : bd(i + 1)}</span><span>${t}</span></li>`;
  }).join('')}${ended ? `<li class="end"><span class="dot">${ic('x')}</span><span>${{rejected: 'প্রত্যাখ্যাত', cancelled: 'বাতিল', expired: 'মেয়াদ শেষ'}[ended]}</span></li>` : ''}</ol>`;
}
const __vOffer = V.offer;
V.offer = id => {
  const html = __vOffer(id), o = (S.offers || []).find(x => x.id === id);
  if (!o) return html;
  const order = (S.orders || []).find(x => x.offer === o.id);
  return html.replace('</p>', `</p>${dealTimeline(o, order)}`);
};

/* =====================================================================
   Routes and clicks
   ===================================================================== */
const __fxRender = render;
render = function(){
  const p = parts(), u = me();
  if (p[0] === 'impact' || (p[0] === 'admin' && p[1] === 'pool' && u && u.role === 'admin')) {
    $('#view').innerHTML = p[0] === 'impact' ? V.impact() : V.adminPool();
    renderChrome();
    applyLanguage($('#view'));
    return;
  }
  __fxRender();
};

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-fx]');
  if (!el) return;
  e.preventDefault();
  const k = el.dataset.fx;
  if (k === 'retry') { FX.cache = {}; Object.keys(ADV.cache).forEach(x => { if (ADV.cache[x].error) delete ADV.cache[x]; }); render(); }
  if (k === 'pool-refresh') { fxDrop('/admin/pool'); render(); }
  if (k === 'imp-days') { IMP_DAYS = +el.dataset.v; render(); }
  if (k === 'va-mic') vaListen();
  if (k === 'va-parse') vaParse();
  if (k === 'va-go') vaGo();
  if (k === 'speak') { const r = advGet(ssQuery()); if (r) say(ssSpeech(r)); }
  if (k === 'pool-assign') {
    if (el.dataset.busy) return;
    if (!await confirmBox({title: 'এই বুকিংগুলো এক ট্রাকে দেবেন?', body: 'সব বুকিং একসাথে নিশ্চিত হবে, কোনো একটিতে জায়গা না হলে কোনোটিই হবে না।', ok: 'হ্যাঁ, দিন'})) return;
    el.dataset.busy = '1';
    try {
      await api('/admin/pool/assign', 'POST', {bookings: el.dataset.b.split(','), truck: el.dataset.t});
      toast('বুকিংগুলো শেয়ার্ড ট্রাকে দেওয়া হয়েছে');
      fxDrop('/admin/pool');
      await refresh();
    } catch (err) { /* api() already showed the reason */ }
    delete el.dataset.busy;
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'va-in') { e.preventDefault(); vaParse(); }
});
