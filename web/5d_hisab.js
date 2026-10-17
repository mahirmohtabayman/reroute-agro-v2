/* =====================================================================
   স্মার্ট হিসাব (Smart Hisab) — one navigation item, four tabs:
     #/hisab            হিসাব (overview)
     #/hisab/bills      বিল/রসিদ (invoices & receipts)
     #/hisab/entries    আয়-ব্যয় (manual records, dues)
     #/hisab/reports    রিপোর্ট
     #/hisab/invoice/ID one invoice (print, PDF, share)
   Floating Bangla assistant on farmer / paikar pages.
   ===================================================================== */

(function hisabNav(){
  if (NAV_TRADER.some(n => n[0] === '#/hisab')) return;
  const at = NAV_TRADER.findIndex(n => n[0] === '#/books');
  NAV_TRADER.splice(at >= 0 ? at + 1 : NAV_TRADER.length, 0, ['#/hisab', '🧾', 'স্মার্ট হিসাব']);
})();

/* English mode: whole sentences first (longest match wins), then the short labels */
const HB_I18N = [
  ['স্মার্ট হিসাব', 'Smart Hisab'], ['বিল/রসিদ', 'Bills & Receipts'], ['আয়-ব্যয়', 'Income & Expenses'], ['রিপোর্ট', 'Reports'],
  ['বিক্রি, খরচ, বিল, রসিদ, পাওনা-দেনা আর লাভ-ক্ষতি এক জায়গায়', 'Sales, costs, bills, receipts, dues and profit/loss in one place'],
  ['এই সপ্তাহ', 'This week'], ['এই মাস', 'This month'], ['এই বছর', 'This year'], ['সব সময়', 'All time'], ['নিজের মতো', 'Custom'],
  ['শুরু ও শেষের তারিখ বাছুন।', 'Pick a start and an end date.'], ['হিসাব তৈরি হচ্ছে...', 'Preparing your accounts...'],
  ['মোট বিক্রি', 'Total sales'], ['মোট খরচ', 'Total costs'], ['লাভ / ক্ষতি', 'Profit / loss'], ['পাওনা / দেনা (বাকি)', 'Receivable / payable (outstanding)'],
  ['মালের খরচ', 'Cost of goods'], [' · অন্য ', ' · other '], ['টি মেয়াদ পেরিয়েছে', ' overdue'],
  ['নিজে লেখা (যাচাই করা নয়)', 'User-reported (not verified)'], ['সিমুলেটেড (ডেমো, আসল টাকা নয়)', 'Simulated (demo, not real money)'],
  ['নিজে লেখা', 'user-reported'], ['প্ল্যাটফর্ম লেনদেন', 'Platform transaction'],
  ['লাভের হিসাব সম্পূর্ণ নয় — কিছু খরচের তথ্য পাওয়া যায়নি।', 'Profit calculation unavailable — missing cost information.'],
  ['এই সময়ে কোনো হিসাব নেই', 'No records for this period'],
  ['বাজারে বিক্রি সম্পূর্ণ হলে হিসাব নিজে থেকে আসবে। বাইরের বিক্রি বা খরচ "আয়-ব্যয়" থেকে লিখুন।', 'Marketplace sales appear here automatically once completed. Add outside sales or costs under "Income & Expenses".'],
  ['লাভ-ক্ষতির হিসাব', 'Profit & loss'], ['বিক্রি হওয়া মালের খরচ', 'Cost of goods sold'], ['ক্যাশব্যাক', 'Cashback'], ['হিসাব সম্পূর্ণ নয়', 'Incomplete'],
  ['মজুদে গেছে; বিক্রির সময় খরচ হিসেবে ধরা হয়, তাই দুবার গোনা হয় না।', 'went to stock; it counts as a cost when sold, so it is never counted twice.'], ['কেনা মাল ', 'Purchased goods '],
  ['খরচ জানা নেই: ', 'Cost unknown: '], ['"আয়-ব্যয়" থেকে উৎপাদন বা কেনার খরচ লিখুন।', 'Add production or purchase costs under "Income & Expenses".'],
  ['কীভাবে হিসাব', 'How it is calculated'],
  ['পাইকার: ভারিত গড় মজুদ খরচ (কেনা মজুদে যায়, বিক্রির সময় খরচ ধরা হয়)। কৃষক: উৎপাদন খরচ লেখা থাকলে সেটাই ওই ফসলের খরচ, না থাকলে লিস্টিংয়ে দেওয়া কেজিপ্রতি খরচ।',
    'Wholesaler: weighted-average stock cost (purchases go to stock and count as cost when sold). Farmer: recorded production costs are the cost of that crop; otherwise the per-kg cost given on the listing.'],
  ['সাম্প্রতিক ইনভয়েস', 'Recent invoices'], ['সাম্প্রতিক টাকার রসিদ', 'Recent payment receipts'], ['এখনো কোনো ইনভয়েস নেই।', 'No invoices yet.'],
  ['এখনো কোনো রসিদ নেই।', 'No receipts yet.'], ['সব বিল ও রসিদ', 'All bills & receipts'], ['স্মার্ট হিসাবে দেখুন', 'Open Smart Hisab'],
  ['ইনভয়েস নম্বর, ফসল, নাম', 'Invoice number, crop, name'], ['খুঁজুন', 'Search'], ['অপরিশোধিত', 'Unpaid'], ['আংশিক পরিশোধ', 'Partially paid'],
  ['পরিশোধিত', 'Paid'], ['আংশিক', 'Partial'], ['বাতিল, টাকা ফেরত', 'Cancelled, refunded'], ['মেয়াদ পেরিয়েছে', 'Overdue'], ['মেয়াদ পেরোনো', 'Overdue'],
  ['কোনো ইনভয়েস পাওয়া যায়নি', 'No invoices found'], ['ইনভয়েস পাওয়া যায়নি', 'Invoice not found'],
  ['অর্ডারের দাম ও পরিবহনের শর্ত চূড়ান্ত হলে ইনভয়েস নিজে থেকে তৈরি হয়।', 'An invoice is created automatically once the price and transport terms are final.'],
  ['ইনভয়েস দেখায় কত টাকা পাওনা; টাকা দেওয়া হয়েছে কিনা দেখায় রসিদ। প্ল্যাটফর্মের পেমেন্ট সিমুলেটেড।', 'An invoice shows what is owed; a receipt shows whether money was paid. Platform payments are simulated.'],
  ['টাকার রসিদ', 'Payment receipts'], ['পেমেন্ট দেওয়া হয়েছে', 'Payment made'], ['বিক্রির টাকা পাওয়া গেছে', 'Sale proceeds received'], ['টাকা ফেরত', 'Refund'],
  ['ডেমো লেনদেন', 'Demo transaction'], ['বিক্রেতার হিসাব', 'Seller account'], ['ক্রেতার হিসাব', 'Buyer account'], ['মালের দাম', 'Goods value'],
  ['ট্রাক ভাড়া (ক্রেতার ভাগ)', 'Truck fare (buyer share)'], ['ট্রাক ভাড়া (বিক্রেতার ভাগ)', 'Truck fare (seller share)'], ['ক্রেতা নিজে', 'Buyer arranges'],
  ['পরিবহন ক্রেডিট', 'Transport credit'], ['প্ল্যাটফর্ম ফি (১%)', 'Platform fee (1%)'], ['বিক্রেতা পাবেন', 'Seller receives'], ['মোট পরিশোধযোগ্য', 'Total payable'],
  ['পরিশোধ হয়েছে', 'Paid so far'], ['বিক্রেতার প্রাপ্তি', 'Seller settlement'], ['পেয়েছেন ', 'Received '], ['মাল বুঝে দিলে পাবেন', 'Paid after delivery'],
  ['পেমেন্টের অপেক্ষা', 'Awaiting payment'], ['সমন্বয়', 'Adjustment'], ['অর্ডার বাতিল', 'Order cancelled'], ['দাম/কেজি', 'Price/kg'], ['গ্রেড', 'Grade'],
  ['পেমেন্ট সিমুলেটেড (ডেমো গেটওয়ে), কোনো আসল টাকা লেনদেন হয়নি। ইনভয়েস নিজে পেমেন্টের প্রমাণ নয়।', 'Payment is simulated (demo gateway); no real money moved. An invoice by itself is not proof of payment.'],
  ['সিমুলেটেড পেমেন্ট (ডেমো গেটওয়ে)', 'Simulated payment (demo gateway)'],
  ['PDF ডাউনলোড', 'Download PDF'], ['প্রিন্ট', 'Print'], ['শেয়ার', 'Share'], ['বাজার: ', 'Market: '],
  ['নতুন হিসাব লিখুন', 'Add a record'],
  ['প্ল্যাটফর্মের বিক্রি, ফি আর Reroute ট্রাক ভাড়া নিজে থেকেই হিসাবে আসে; এগুলো আবার লিখবেন না। এখানে লেখা হিসাব "নিজে লেখা (যাচাই করা নয়)" হিসেবে থাকবে।',
    'Platform sales, fees and Reroute truck fares are added automatically; do not enter them again. Records added here are kept as "User-reported (not verified)".'],
  ['বাইরের বিক্রি', 'Outside sale'], ['ফসল কেনা (মজুদে যোগ)', 'Crop purchase (adds to stock)'], ['উৎপাদন খরচ (বীজ, সার, সেচ)', 'Production cost (seed, fertiliser, irrigation)'],
  ['উৎপাদন খরচ', 'Production cost'], ['ফসল তোলার খরচ', 'Harvest cost'], ['পরিবহন খরচ', 'Transport cost'], ['সংরক্ষণ খরচ', 'Storage cost'],
  ['প্যাকিং খরচ', 'Packaging cost'], ['শ্রমিক খরচ', 'Labour cost'], ['অন্যান্য খরচ', 'Other costs'],
  ['টাকা পেয়েছি (পাওনা থেকে)', 'Money received (against a receivable)'], ['টাকা দিয়েছি (দেনা থেকে)', 'Money paid (against a payable)'],
  ['টাকা পেয়েছি', 'Money received'], ['টাকা দিয়েছি', 'Money paid'], ['Reroute প্ল্যাটফর্ম ফি', 'Reroute platform fee'],
  ['Reroute ট্রাক ভাড়া (আপনার ভাগ)', 'Reroute truck fare (your share)'], ['সংরক্ষণ', 'Storage'], ['প্যাকিং', 'Packaging'], ['শ্রমিক', 'Labour'],
  ['টাকা (৳)', 'Amount (৳)'], ['পুরো খামার', 'Whole farm'], ['উল্লেখ নেই', 'Not specified'], ['কার সাথে (ঐচ্ছিক)', 'With whom (optional)'], ['কার সাথে', 'With whom'],
  ['রসিদের ছবি/PDF (ঐচ্ছিক)', 'Receipt photo/PDF (optional)'], ['বিবরণ (ঐচ্ছিক)', 'Description (optional)'], ['শেষ তারিখ (ঐচ্ছিক)', 'Due date (optional)'],
  ['পরিমাণ (কেজি)', 'Quantity (kg)'], ['কোন পাওনা থেকে', 'Against which receivable'], ['কোন দেনা থেকে', 'Against which payable'], ['ফাইল যুক্ত হয়েছে', 'File attached'],
  ['লেখা অবস্থায় এই ফর্ম এই ডিভাইসে নিজে থেকে রাখা থাকে।', 'This form is kept on this device while you type.'], ['মুছে ফেলুন', 'Clear'],
  ['সংরক্ষণ হচ্ছে...', 'Saving...'], ['সংরক্ষণ করুন', 'Save'], ['টাকার অঙ্ক দিন', 'Enter the amount'],
  ['পাওনা ও দেনা', 'Receivables & payables'], ['মোট পাওনা (বাকি)', 'Total receivable (outstanding)'], ['মোট দেনা (বাকি)', 'Total payable (outstanding)'],
  ['কোনো পাওনা বা দেনা নেই।', 'No receivables or payables.'], ['নতুন পাওনা/দেনা', 'New receivable/payable'], ['পাওনা (আমি পাব)', 'Receivable (I will receive)'],
  ['দেনা (আমি দেব)', 'Payable (I will pay)'], ['পাওনা: ', 'Receivable: '], ['দেনা: ', 'Payable: '], ['বার টাকা লেনদেন', ' payment(s) recorded'],
  [' · শেষ তারিখ ', ' · due '], ['টাকা লিখুন', 'Record payment'], ['যোগ করুন', 'Add'], ['লেখা হিসাব', 'Recorded entries'],
  ['এখনো নিজে কোনো হিসাব লেখেননি।', 'You have not recorded anything yet.'], ['বাতিল: ', 'voided: '],
  ['সময় অনুযায়ী বিক্রি', 'Sales over time'], ['পণ্য অনুযায়ী', 'By product'], ['খরচের খাত', 'Expense categories'], ['লাভ-ক্ষতি ও বাকি', 'Profit/loss & dues'],
  ['এই সময়ে বিক্রি নেই।', 'No sales in this period.'], ['এই সময়ে খরচ নেই।', 'No expenses in this period.'], ['গড় দাম', 'Avg price'],
  ['দৈনিক', 'Daily'], ['সাপ্তাহিক', 'Weekly'], ['মাসিক', 'Monthly'], ['খাত', 'Category'],
  ['প্ল্যাটফর্মের পেমেন্ট সিমুলেটেড; নিজে লেখা রেকর্ড যাচাই করা নয়।', 'Platform payments are simulated; user-reported records are not verified.'],
  ['বাংলা সহকারী খুলুন', 'Open the Bangla assistant'], ['বাংলা সহকারী', 'Bangla assistant'], ['সহকারী বন্ধ করুন', 'Close the assistant'],
  ['প্রশ্ন লিখুন বা মাইকে বলুন', 'Type or speak your question in Bangla'], ['প্রশ্ন লিখুন বা বলুন', 'Type or speak your question'],
  ['মাইক্রোফোনে বলুন', 'Speak into the microphone'], ['জিজ্ঞেস করুন', 'Ask'],
  ['বলার পর লেখাটা দেখে নিন, তারপর "জিজ্ঞেস করুন" চাপুন।', 'After speaking, check the text, then press "Ask".'],
  ['এই ব্রাউজারে কণ্ঠস্বর চেনা নেই, লিখে জিজ্ঞেস করুন।', 'This browser cannot recognise speech; type your question.'],
  ['সহকারী শুধু তথ্য দেখায়, কোনো লেনদেন করে না।', 'The assistant only shows information; it never makes a transaction.'],
  ['হিসাব লেখা হয়েছে', 'Record saved'], ['টাকা লেখা হয়েছে, রসিদ তৈরি হয়েছে', 'Payment recorded, receipt created'], ['হিসাব বাতিল হয়েছে', 'Record voided'],
  ['আগে থেকেই লেখা থাকতে পারে', 'This may already be recorded'], ['তবুও লিখুন', 'Record anyway'], ['হিসাবটি বাতিল করবেন?', 'Void this record?'],
  ['বাতিলের কারণ লিখুন (যেমন: ভুল অঙ্ক লিখেছি)। হিসাব মুছে যাবে না, বাতিল হিসেবে থাকবে।', 'Give a reason (e.g. wrong amount). The record is not deleted; it stays marked as voided.'],
  ['কত টাকা পেয়েছেন?', 'How much did you receive?'], ['কত টাকা দিয়েছেন?', 'How much did you pay?'], ['আংশিক টাকাও লেখা যায়।', 'Partial amounts are fine.'],
  ['ফাইল নামানো যায়নি, আবার চেষ্টা করুন', 'Could not download the file, please try again'], ['নাম আর টাকার অঙ্ক দিন', 'Enter a name and an amount'], ['যোগ হয়েছে', 'Added'],
  ['রিপোর্টের ভাগ', 'Report grouping'], ['যেমন: ', 'e.g. '], ['পণ্য', 'Product'], ['বিক্রি', 'Sale'], ['কেনা', 'Purchase'], ['রসিদ', 'Receipt'], ['ইনভয়েস', 'Invoice']
];
{ /* long, specific sentences go first; short labels go last so they never break other pages' phrases */
  const byLen = HB_I18N.slice().sort((x, y) => y[0].length - x[0].length);
  const oneWord = x => /^[\u0980-\u09ff]+$/.test(x[0]);
  I18N_PHRASES.unshift(...byLen.filter(x => !oneWord(x) && x[0].length >= 14));
  I18N_PHRASES.push(...byLen.filter(x => !oneWord(x) && x[0].length < 14));
  /* single words are matched as whole words only, so they never change part of a name or a longer word */
  byLen.filter(oneWord).forEach(([bn, en]) => { if (!Object.prototype.hasOwnProperty.call(I18N_WORDS, bn)) I18N_WORDS[bn] = en; });
}
function PROFIT_MISSING_BN(){ return 'লাভের হিসাব সম্পূর্ণ নয় — কিছু খরচের তথ্য পাওয়া যায়নি।'; }

const HB = {period: 'month', start: '', end: '', group: 'day', q: '', from: '', to: '', status: '', form: null, err: '', busy: false};
const HB_PERIODS = [['today', 'আজ'], ['week', 'এই সপ্তাহ'], ['month', 'এই মাস'], ['year', 'এই বছর'], ['all', 'সব সময়'], ['custom', 'নিজের মতো']];
const HB_TYPES = [['sale_external', 'বাইরের বিক্রি'], ['purchase', 'ফসল কেনা (মজুদে যোগ)'], ['expense_production', 'উৎপাদন খরচ'],
  ['expense_harvest', 'ফসল তোলার খরচ'], ['expense_transport', 'পরিবহন খরচ'], ['expense_storage', 'সংরক্ষণ খরচ'],
  ['expense_packaging', 'প্যাকিং খরচ'], ['expense_labor', 'শ্রমিক খরচ'], ['expense_other', 'অন্যান্য খরচ'],
  ['payment_received', 'টাকা পেয়েছি (পাওনা থেকে)'], ['payment_made', 'টাকা দিয়েছি (দেনা থেকে)']];
const HB_STATUS = {paid: 'p-green', partial: 'p-gold', unpaid: 'p-red', overdue: 'p-red', cancelled: 'p-grey', refunded: 'p-grey', pending: 'p-blue'};
const DRAFT_KEY = 'reroute-draft-hisab';
const hbToday = () => { const d = new Date(Date.now() + 6 * 3600e3); return d.toISOString().slice(0, 10); };
const hbPill = (st, txt) => `<span class="pill ${HB_STATUS[st] || 'p-grey'}">${esc(txt)}</span>`;
const hbQs = o => Object.entries(o).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
const hbRange = () => hbQs({period: HB.period, start: HB.period === 'custom' ? HB.start : '', end: HB.period === 'custom' ? HB.end : ''});
const hbRefresh = () => { fxDrop('/hisab'); render(); };

function hbDraft(save){
  try{
    if (save === undefined) return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    save ? localStorage.setItem(DRAFT_KEY, JSON.stringify(save)) : localStorage.removeItem(DRAFT_KEY);
  } catch (e) { return null; }
}
function hbForm(){
  if (!HB.form) HB.form = hbDraft() || {type: 'expense_production', amount: '', date: hbToday(), crop: '', qty: '', counterparty: '', description: '', due_id: ''};
  return HB.form;
}

/* authorised download of a PDF / CSV, then save it */
async function hbDownload(path, name){
  try{
    const r = await fetch('/api' + path, {headers: TOKEN ? {'X-Token': TOKEN} : {}});
    if (!r.ok) throw new Error(r.status);
    const blob = await r.blob(), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return blob;
  } catch (e) { toast('ফাইল নামানো যায়নি, আবার চেষ্টা করুন', 'error'); return null; }
}

function hbTabs(tab){
  const T = [['', 'হিসাব', 'chart'], ['bills', 'বিল/রসিদ', 'receipt'], ['entries', 'আয়-ব্যয়', 'edit'], ['reports', 'রিপোর্ট', 'book']];
  return `<nav class="hb-tabs" role="tablist" aria-label="স্মার্ট হিসাব">${T.map(([k, t, i]) =>
    `<a role="tab" href="#/hisab${k ? '/' + k : ''}" class="${tab === k ? 'on' : ''}" aria-selected="${tab === k}">${ic(i)}<span>${t}</span></a>`).join('')}</nav>`;
}
function hbPeriodPicker(){
  return `<div class="chips" role="group" aria-label="সময়">${HB_PERIODS.map(([k, t]) => `<button class="chip ${HB.period === k ? 'on' : ''}" data-hb="period" data-v="${k}">${t}</button>`).join('')}</div>
    ${HB.period === 'custom' ? `<div class="filters hb-range"><label><span>শুরু</span><input type="date" data-hbf="start" value="${esc(HB.start)}" max="${hbToday()}"></label>
      <label><span>শেষ</span><input type="date" data-hbf="end" value="${esc(HB.end)}" max="${hbToday()}"></label></div>` : ''}`;
}
const hbNeedRange = () => HB.period === 'custom' && !(HB.start && HB.end);

/* ---------- tab 1: overview ---------- */
function hbOverview(){
  if (hbNeedRange()) return hbPeriodPicker() + `<p class="muted sm" style="margin-top:10px">শুরু ও শেষের তারিখ বাছুন।</p>`;
  const path = `/hisab/overview?${hbRange()}`, d = fxGet(path, 30000);
  if (!d) return hbPeriodPicker() + (fxFailed(path) ? fxErr() : advLoading('হিসাব তৈরি হচ্ছে...'));
  const p = d.pnl, empty = !p.revenue && !p.total_expenses && !d.recent_invoices.length && !d.counts.records;
  return hbPeriodPicker() + `<div class="grid4 hb-kpis">
      <div class="kpi"><span class="muted sm">মোট বিক্রি</span><strong>${tk(p.revenue)}</strong><span class="muted xs">প্ল্যাটফর্ম ${tk(p.revenue_platform)} · নিজে লেখা ${tk(p.revenue_external)}</span></div>
      <div class="kpi"><span class="muted sm">মোট খরচ</span><strong>${tk(p.total_expenses + p.cost_of_goods)}</strong><span class="muted xs">মালের খরচ ${tk(p.cost_of_goods)} · অন্য ${tk(p.total_expenses)}</span></div>
      <div class="kpi ${p.profit_complete ? (p.profit >= 0 ? 'kpi-good' : 'kpi-bad') : ''}"><span class="muted sm">লাভ / ক্ষতি</span>
        <strong>${p.profit_complete ? (p.profit < 0 ? '−' : '') + tk(Math.abs(p.profit)) : '—'}</strong>
        ${p.profit_complete ? '' : `<span class="warn xs">${PROFIT_MISSING_BN()}</span>`}</div>
      <div class="kpi"><span class="muted sm">পাওনা / দেনা (বাকি)</span><strong>${tk(d.dues.receivable)}</strong><span class="muted xs">দেনা: ${tk(d.dues.payable)}${d.dues.overdue ? ` · ${nf(d.dues.overdue)}টি মেয়াদ পেরিয়েছে` : ''}</span></div>
    </div>
    ${empty ? emptyState('receipt', 'এই সময়ে কোনো হিসাব নেই', 'বাজারে বিক্রি সম্পূর্ণ হলে হিসাব নিজে থেকে আসবে। বাইরের বিক্রি বা খরচ "আয়-ব্যয়" থেকে লিখুন।', '<a class="btn btn-green" href="#/hisab/entries">নতুন হিসাব লিখুন</a>') : `
    <div class="grid2" style="margin-top:16px;align-items:start">
      <section class="panel"><h3>লাভ-ক্ষতির হিসাব</h3>${bill([
        ['বিক্রি', tk(p.revenue)], p.other_income ? ['ক্যাশব্যাক', tk(p.other_income)] : null,
        ['বিক্রি হওয়া মালের খরচ', '−' + tk(p.cost_of_goods), 'minus'],
        ...Object.values(p.expenses).map(e => [esc(e.label), '−' + tk(e.amount), 'minus']),
        [p.profit_complete ? (p.profit >= 0 ? 'লাভ' : 'ক্ষতি') : 'লাভ / ক্ষতি', p.profit_complete ? tk(Math.abs(p.profit)) : 'হিসাব সম্পূর্ণ নয়', 'tot']])}
        ${p.purchases_to_stock ? `<p class="muted xs" style="margin-top:6px">কেনা মাল ${tk(p.purchases_to_stock)} মজুদে গেছে; বিক্রির সময় খরচ হিসেবে ধরা হয়, তাই দুবার গোনা হয় না।</p>` : ''}
        ${p.profit_complete ? '' : `<p class="warn sm" style="margin-top:8px">${PROFIT_MISSING_BN()} ${p.unknown_cost_crops.length ? `খরচ জানা নেই: ${p.unknown_cost_crops.map(c => CROPS[c] ? CROPS[c].n : c).join(', ')}।` : ''} "আয়-ব্যয়" থেকে উৎপাদন বা কেনার খরচ লিখুন।</p>`}
        <details class="xs muted" style="margin-top:8px"><summary>কীভাবে হিসাব</summary><p>${esc(p.method)}</p></details></section>
      <section class="panel"><h3>সাম্প্রতিক ইনভয়েস</h3>${d.recent_invoices.length ? d.recent_invoices.map(hbInvRow).join('') : '<p class="muted sm">এখনো কোনো ইনভয়েস নেই।</p>'}
        <h3 style="margin-top:14px">সাম্প্রতিক টাকার রসিদ</h3>${d.recent_receipts.length ? d.recent_receipts.map(hbRecRow).join('') : '<p class="muted sm">এখনো কোনো রসিদ নেই।</p>'}
        <a class="linkbtn sm" href="#/hisab/bills">সব বিল ও রসিদ</a></section>
    </div>`}`;
}
function hbInvRow(i){
  const amt = i.side === 'seller' ? i.payout : i.buyer_total;
  return `<a class="hb-row" href="#/hisab/invoice/${i.id}"><span class="grow"><b>${esc(i.number)}</b><span class="muted xs">${esc(i.issued_date)} · ${CROPS[i.crop] ? CROPS[i.crop].n : esc(i.crop_bn)} ${nf(i.qty_kg)} কেজি · ${i.side === 'seller' ? 'বিক্রি' : 'কেনা'}${i.data_class === 'demo' ? ' · ডেমো' : ''}</span></span>
    <span class="hb-amt">${tk(amt)}</span>${hbPill(i.status, i.status_bn)}</a>`;
}
function hbRecRow(r){
  return `<div class="hb-row"><span class="grow"><b>${esc(r.number)}</b><span class="muted xs">${esc(r.date)} · ${esc(r.kind_bn)} · ${esc(r.verification_bn)}</span></span>
    <span class="hb-amt ${r.direction === 'in' ? 'pos' : 'neg'}">${r.direction === 'in' ? '+' : '−'}${tk(Math.abs(r.amount))}</span>
    <button class="iconbtn" data-hb="rec-pdf" data-id="${r.id}" data-n="${esc(r.number)}" aria-label="রসিদ ${esc(r.number)} PDF ডাউনলোড">${ic('download')}</button></div>`;
}

/* ---------- tab 2: bills & receipts ---------- */
function hbBills(){
  const path = `/hisab/invoices?${hbQs({q: HB.q, start: HB.from, end: HB.to, status: HB.status})}`, inv = fxGet(path, 30000), rec = fxGet('/hisab/receipts', 30000);
  return `<div class="filters hb-filters">
      <label class="q"><span>খুঁজুন</span><input data-hbf="q" value="${esc(HB.q)}" placeholder="ইনভয়েস নম্বর, ফসল, নাম"></label>
      <label><span>শুরু</span><input type="date" data-hbf="from" value="${esc(HB.from)}"></label>
      <label><span>শেষ</span><input type="date" data-hbf="to" value="${esc(HB.to)}"></label>
      <label><span>পেমেন্ট</span><select data-hbf="status">${[['', 'সব'], ['unpaid', 'অপরিশোধিত'], ['partial', 'আংশিক'], ['paid', 'পরিশোধিত'], ['cancelled', 'বাতিল'], ['refunded', 'টাকা ফেরত']].map(([k, t]) => `<option value="${k}" ${HB.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
    <section class="panel"><h3>${ic('receipt')} ইনভয়েস</h3>
      ${!inv ? (fxFailed(path) ? fxErr() : advLoading()) : inv.length ? inv.map(hbInvRow).join('')
        : emptyState('receipt', 'কোনো ইনভয়েস পাওয়া যায়নি', 'অর্ডারের দাম ও পরিবহনের শর্ত চূড়ান্ত হলে ইনভয়েস নিজে থেকে তৈরি হয়।', '', true)}
      <p class="muted xs" style="margin-top:8px">ইনভয়েস দেখায় কত টাকা পাওনা; টাকা দেওয়া হয়েছে কিনা দেখায় রসিদ। প্ল্যাটফর্মের পেমেন্ট সিমুলেটেড।</p></section>
    <section class="panel"><h3>${ic('wallet')} টাকার রসিদ</h3>
      ${!rec ? advLoading() : rec.length ? rec.map(hbRecRow).join('') : '<p class="muted sm">এখনো কোনো রসিদ নেই।</p>'}</section>`;
}

/* ---------- one invoice ---------- */
function hbInvoice(id){
  const v = fxGet(`/hisab/invoices/${id}`, 30000);
  const back = `<p class="no-print"><a class="back" href="#/hisab/bills">${ic('back')} বিল/রসিদ</a></p>`;
  if (!v) return back + (fxFailed(`/hisab/invoices/${id}`) ? emptyState('receipt', 'ইনভয়েস পাওয়া যায়নি', '') : advLoading());
  const party = (t, x) => `<div><span class="muted xs">${t}</span><b>${esc(x.role === 'paikar' && x.biz ? x.biz : x.name)}</b>
    <span class="muted sm">${x.role === 'paikar' && x.biz ? esc(x.name) + ' · ' : ''}${esc([x.area, x.district].filter(Boolean).join(', '))}${x.market ? ' · বাজার: ' + esc(x.market) : ''}</span></div>`;
  const fee = v.fee - v.fee_disc, ts = v.t_seller - v.t_cs;
  return back + `<article class="panel invoice" id="invoice-doc">
    <header class="inv-head"><div><span class="muted xs">Reroute Agro</span><h1>ইনভয়েস</h1><b>${esc(v.number)}</b></div>
      <div class="inv-meta"><span>তারিখ: ${esc(v.issued_date)}</span><span>অর্ডার: ${esc(v.order_id)}</span>${hbPill(v.status, v.status_bn)}
        ${v.data_class === 'demo' ? '<span class="demo-tag">ডেমো লেনদেন</span>' : ''}</div></header>
    <div class="inv-parties">${party('বিক্রেতা', v.seller)}${party('ক্রেতা', v.buyer)}</div>
    <div class="scroll"><table class="tbl"><tr><th>পণ্য</th><th>গ্রেড</th><th class="num">পরিমাণ</th><th class="num">দাম/কেজি</th><th class="num">মোট</th></tr>
      <tr><td>${CROPS[v.crop] ? CROPS[v.crop].n : esc(v.crop_bn)}</td><td>${esc(v.grade || '—')}</td><td class="num">${nf(v.qty_kg)} কেজি<span class="muted xs"> (${nf(v.qty_mon, 2)} মণ)</span></td>
        <td class="num">${tk(v.unit_price, 2)}</td><td class="num b">${tk(v.goods)}</td></tr></table></div>
    <div class="grid2" style="margin-top:12px;align-items:start">
      <div><h3>ক্রেতার হিসাব</h3>${bill([['মালের দাম', tk(v.goods)],
        v.transport === 'reroute' ? ['ট্রাক ভাড়া (ক্রেতার ভাগ)', tk(v.t_buyer)] : ['পরিবহন', 'ক্রেতা নিজে'],
        v.t_cb ? ['পরিবহন ক্রেডিট', '−' + tk(v.t_cb), 'minus'] : null, ['মোট পরিশোধযোগ্য', tk(v.buyer_total), 'tot']])}</div>
      <div><h3>বিক্রেতার হিসাব</h3>${bill([['মালের দাম', tk(v.goods)], ['প্ল্যাটফর্ম ফি (১%)', '−' + tk(fee), 'minus'],
        ts ? ['ট্রাক ভাড়া (বিক্রেতার ভাগ)', '−' + tk(ts), 'minus'] : null, ['বিক্রেতা পাবেন', tk(v.payout), 'tot']])}</div></div>
    <h3 style="margin-top:12px">পেমেন্ট</h3>
    ${bill([['পরিশোধ হয়েছে', tk(v.paid)], ['বাকি', tk(v.outstanding)],
      ['বিক্রেতার প্রাপ্তি', {received: `পেয়েছেন ${tk(v.payout_received)}`, pending: 'মাল বুঝে দিলে পাবেন', not_due: 'পেমেন্টের অপেক্ষা', cancelled: 'বাতিল'}[v.seller_settlement]]])}
    ${v.receipts.length ? `<div style="margin-top:8px">${v.receipts.map(hbRecRow).join('')}</div>` : ''}
    ${v.adjustments.map(a => `<p class="warn sm" style="margin-top:8px">সমন্বয় (${esc(a.date)}): ${a.kind === 'cancelled' ? 'অর্ডার বাতিল' : esc(a.kind)} · ${esc(a.note || '')}</p>`).join('')}
    <p class="muted xs" style="margin-top:10px">${esc(v.payment_note)}</p>
  </article>
  <div class="row wrap-it no-print" style="gap:8px;margin-top:12px">
    <button class="btn btn-green" data-hb="inv-pdf" data-id="${v.id}" data-n="${esc(v.number)}">${ic('download')} PDF ডাউনলোড</button>
    <button class="btn btn-line" data-hb="print">${ic('receipt')} প্রিন্ট</button>
    <button class="btn btn-line" data-hb="share" data-id="${v.id}" data-n="${esc(v.number)}">${ic('arrow')} শেয়ার</button>
    <a class="btn btn-soft" href="#/order/${esc(v.order_id)}">অর্ডার দেখুন</a></div>`;
}

/* ---------- tab 3: income & expenses, dues ---------- */
function hbEntries(){
  const f = hbForm(), rec = fxGet('/hisab/records', 30000), dues = fxGet('/hisab/dues', 30000);
  const manualDues = dues ? dues.dues.filter(d => d.source === 'user_reported' && d.outstanding > 0) : [];
  const isPay = f.type === 'payment_received' || f.type === 'payment_made';
  const dir = f.type === 'payment_received' ? 'receivable' : 'payable';
  const needCrop = f.type === 'purchase' || f.type === 'sale_external' || f.type === 'expense_production' || f.type === 'expense_harvest';
  return `<section class="panel" aria-labelledby="hb-new"><h3 id="hb-new">${ic('plus')} নতুন হিসাব লিখুন</h3>
    <p class="muted xs">প্ল্যাটফর্মের বিক্রি, ফি আর Reroute ট্রাক ভাড়া নিজে থেকেই হিসাবে আসে; এগুলো আবার লিখবেন না। এখানে লেখা হিসাব "নিজে লেখা (যাচাই করা নয়)" হিসেবে থাকবে।</p>
    <div class="filters hb-form">
      <label><span>ধরন</span><select data-hbx="type">${HB_TYPES.map(([k, t]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label><span>টাকা (৳)</span><input data-hbx="amount" inputmode="decimal" value="${esc(f.amount)}" placeholder="যেমন: 2500"></label>
      <label><span>তারিখ</span><input type="date" data-hbx="date" value="${esc(f.date)}" max="${hbToday()}"></label>
      ${isPay ? `<label><span>${dir === 'receivable' ? 'কোন পাওনা থেকে' : 'কোন দেনা থেকে'}</span><select data-hbx="due_id"><option value="">বাছুন</option>${manualDues.filter(d => d.direction === dir).map(d => `<option value="${d.id}" ${f.due_id === d.id ? 'selected' : ''}>${esc(d.counterparty)} · বাকি ${tk(d.outstanding)}</option>`).join('')}</select></label>`
        : `<label><span>ফসল ${needCrop ? '' : '(ঐচ্ছিক)'}</span><select data-hbx="crop"><option value="">${f.type === 'expense_production' ? 'পুরো খামার' : 'উল্লেখ নেই'}</option>${Object.entries(CROPS).map(([k, c]) => `<option value="${k}" ${f.crop === k ? 'selected' : ''}>${c.n}</option>`).join('')}</select></label>
        ${f.type === 'purchase' || f.type === 'sale_external' ? `<label><span>পরিমাণ (কেজি)</span><input data-hbx="qty" inputmode="numeric" value="${esc(f.qty)}" placeholder="যেমন: 400"></label>` : ''}
        <label><span>কার সাথে (ঐচ্ছিক)</span><input data-hbx="counterparty" maxlength="80" value="${esc(f.counterparty)}"></label>`}
      <label class="q"><span>বিবরণ (ঐচ্ছিক)</span><input data-hbx="description" maxlength="200" value="${esc(f.description)}"></label>
      ${isPay ? '' : `<label><span>রসিদের ছবি/PDF (ঐচ্ছিক)</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" data-hbfile="1">${f.document_id ? '<span class="good xs">ফাইল যুক্ত হয়েছে</span>' : ''}</label>`}
    </div>
    ${HB.err ? `<p class="form-error" role="alert">${esc(HB.err)}</p>` : ''}
    <div class="row wrap-it" style="gap:8px;margin-top:12px"><button class="btn btn-green" data-hb="save" ${HB.busy ? 'disabled' : ''}>${HB.busy ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}</button>
      <button class="btn btn-soft" data-hb="clear">মুছে ফেলুন</button><span class="muted xs" style="align-self:center">লেখা অবস্থায় এই ফর্ম এই ডিভাইসে নিজে থেকে রাখা থাকে।</span></div></section>

  <section class="panel" aria-labelledby="hb-dues"><h3 id="hb-dues">${ic('wallet')} পাওনা ও দেনা</h3>
    ${!dues ? advLoading() : `<div class="grid2 tight" style="margin-bottom:10px"><div class="kpi"><span class="muted sm">মোট পাওনা (বাকি)</span><strong>${tk(dues.summary.receivable)}</strong></div>
      <div class="kpi"><span class="muted sm">মোট দেনা (বাকি)</span><strong>${tk(dues.summary.payable)}</strong></div></div>
      ${dues.dues.length ? dues.dues.map(hbDueRow).join('') : '<p class="muted sm">কোনো পাওনা বা দেনা নেই।</p>'}`}
    <details class="hb-newdue"><summary class="btn btn-line btn-sm">${ic('plus')} নতুন পাওনা/দেনা</summary>
      <div class="filters hb-form" style="margin-top:10px">
        <label><span>ধরন</span><select id="due-dir"><option value="receivable">পাওনা (আমি পাব)</option><option value="payable">দেনা (আমি দেব)</option></select></label>
        <label><span>কার সাথে</span><input id="due-who" maxlength="80"></label>
        <label><span>টাকা (৳)</span><input id="due-amt" inputmode="decimal"></label>
        <label><span>শেষ তারিখ (ঐচ্ছিক)</span><input id="due-date" type="date"></label>
        <label class="q"><span>বিবরণ (ঐচ্ছিক)</span><input id="due-desc" maxlength="200"></label></div>
      <button class="btn btn-green btn-sm" style="margin-top:10px" data-hb="due-add">যোগ করুন</button></details></section>

  <section class="panel"><h3>${ic('book')} লেখা হিসাব</h3>
    ${!rec ? advLoading() : rec.length ? rec.map(e => `<div class="hb-row ${e.voided ? 'voided' : ''}"><span class="grow"><b>${esc(e.type_bn)}</b>
      <span class="muted xs">${esc(e.date)}${e.crop ? ' · ' + (CROPS[e.crop] ? CROPS[e.crop].n : esc(e.crop)) : ''}${e.qty_kg ? ' · ' + nf(e.qty_kg) + ' কেজি' : ''}${e.counterparty ? ' · ' + esc(e.counterparty) : ''}${e.description ? ' · ' + esc(e.description) : ''} · ${esc(e.source_bn)}${e.voided ? ' · বাতিল: ' + esc(e.void_reason || '') : ''}</span></span>
      <span class="hb-amt ${e.type === 'sale_external' ? 'pos' : ''}">${tk(e.amount)}</span>
      ${e.document_id ? `<button class="iconbtn" data-hb="doc" data-id="${e.document_id}" aria-label="সংযুক্ত রসিদ দেখুন">${ic('receipt')}</button>` : ''}
      ${e.voided ? '' : `<button class="iconbtn" data-hb="void" data-id="${e.id}" aria-label="এই হিসাব বাতিল করুন">${ic('x')}</button>`}</div>`).join('')
      : '<p class="muted sm">এখনো নিজে কোনো হিসাব লেখেননি।</p>'}</section>`;
}
function hbDueRow(d){
  const plat = d.source === 'platform';
  return `<div class="hb-row"><span class="grow"><b>${d.direction === 'receivable' ? 'পাওনা' : 'দেনা'}: ${esc(d.counterparty)}</b>
      <span class="muted xs">${esc(d.description || '')}${d.due_date ? ' · শেষ তারিখ ' + esc(d.due_date) : ''}${plat ? ' · প্ল্যাটফর্ম' : ' · নিজে লেখা'}${d.payments && d.payments.length ? ` · ${nf(d.payments.length)}বার টাকা লেনদেন` : ''}</span></span>
    <span class="hb-amt">${tk(d.outstanding)}${!plat && d.paid ? `<span class="muted xs"> / ${tk(d.amount)}</span>` : ''}</span>${hbPill(d.status, d.status_bn)}
    ${plat ? `<a class="iconbtn" href="${d.link}" aria-label="অর্ডার দেখুন">${ic('next')}</a>`
      : d.outstanding > 0 ? `<button class="btn btn-line btn-sm" data-hb="due-pay" data-id="${d.id}" data-dir="${d.direction}" data-out="${d.outstanding}">টাকা লিখুন</button>` : ''}</div>`;
}

/* ---------- tab 4: reports ---------- */
function hbReports(){
  if (hbNeedRange()) return hbPeriodPicker() + `<p class="muted sm" style="margin-top:10px">শুরু ও শেষের তারিখ বাছুন।</p>`;
  const q = `${hbRange()}&group=${HB.group}`, path = `/hisab/report?${q}`, r = fxGet(path, 30000);
  const head = hbPeriodPicker() + `<div class="row wrap-it" style="gap:8px;margin:10px 0">
      <div class="chips" role="group" aria-label="রিপোর্টের ভাগ">${[['day', 'দৈনিক'], ['week', 'সাপ্তাহিক'], ['month', 'মাসিক']].map(([k, t]) => `<button class="chip ${HB.group === k ? 'on' : ''}" data-hb="group" data-v="${k}">${t}</button>`).join('')}</div>
      <button class="btn btn-line btn-sm" data-hb="rep-csv">${ic('download')} CSV</button><button class="btn btn-green btn-sm" data-hb="rep-pdf">${ic('download')} PDF</button></div>`;
  if (!r) return head + (fxFailed(path) ? fxErr() : advLoading());
  const p = r.pnl;
  return head + `<div class="grid2" style="align-items:start">
    <section class="panel"><h3>সময় অনুযায়ী বিক্রি</h3>${r.sales.length ? `<div class="scroll"><table class="tbl"><tr><th>সময়</th><th class="num">লেনদেন</th><th class="num">কেজি</th><th class="num">বিক্রি</th></tr>
      ${r.sales.map(x => `<tr><td>${esc(x.period)}</td><td class="num">${nf(x.count)}</td><td class="num">${nf(x.kg)}</td><td class="num b">${tk(x.revenue)}</td></tr>`).join('')}</table></div>` : '<p class="muted sm">এই সময়ে বিক্রি নেই।</p>'}</section>
    <section class="panel"><h3>পণ্য অনুযায়ী</h3>${r.products.length ? `<div class="scroll"><table class="tbl"><tr><th>ফসল</th><th class="num">কেজি</th><th class="num">গড় দাম</th><th class="num">বিক্রি</th></tr>
      ${r.products.map(x => `<tr><td>${CROPS[x.crop] ? CROPS[x.crop].n : esc(x.crop_bn)}</td><td class="num">${nf(x.kg)}</td><td class="num">${x.avg_price != null ? tk(x.avg_price, 1) : '—'}</td><td class="num b">${tk(x.revenue)}</td></tr>`).join('')}</table></div>` : '<p class="muted sm">এই সময়ে বিক্রি নেই।</p>'}</section>
    <section class="panel"><h3>খরচের খাত</h3>${r.expenses.length ? `<div class="scroll"><table class="tbl"><tr><th>খাত</th><th class="num">প্ল্যাটফর্ম</th><th class="num">নিজে লেখা</th><th class="num">মোট</th></tr>
      ${r.expenses.map(x => `<tr><td>${esc(x.label)}</td><td class="num">${tk(x.platform)}</td><td class="num">${tk(x.user_reported)}</td><td class="num b">${tk(x.amount)}</td></tr>`).join('')}</table></div>` : '<p class="muted sm">এই সময়ে খরচ নেই।</p>'}</section>
    <section class="panel"><h3>লাভ-ক্ষতি ও বাকি</h3>${bill([['বিক্রি', tk(p.revenue)], ['মালের খরচ', '−' + tk(p.cost_of_goods), 'minus'], ['খরচ', '−' + tk(p.total_expenses), 'minus'],
      ['লাভ / ক্ষতি', p.profit_complete ? (p.profit < 0 ? '−' : '') + tk(Math.abs(p.profit)) : 'হিসাব সম্পূর্ণ নয়', 'tot']])}
      ${p.profit_complete ? '' : `<p class="warn sm" style="margin-top:6px">${PROFIT_MISSING_BN()}</p>`}
      ${bill([['মোট পাওনা (বাকি)', tk(r.dues.receivable)], ['মোট দেনা (বাকি)', tk(r.dues.payable)], ['মেয়াদ পেরোনো', nf(r.dues.overdue)]])}
      <p class="muted xs" style="margin-top:6px">${esc(r.note)}</p></section></div>`;
}

V.hisab = (tab, id) => {
  const head = `<div class="phead no-print"><div><h1>${ic('receipt')} স্মার্ট হিসাব</h1><p class="muted">বিক্রি, খরচ, বিল, রসিদ, পাওনা-দেনা আর লাভ-ক্ষতি এক জায়গায়</p></div></div>`;
  if (tab === 'invoice') return hbInvoice(id);
  const t = ['bills', 'entries', 'reports'].includes(tab) ? tab : '';
  return head + hbTabs(t) + `<div class="hb-body">${t === 'bills' ? hbBills() : t === 'entries' ? hbEntries() : t === 'reports' ? hbReports() : hbOverview()}</div>`;
};

/* dashboard: the money panel links to Smart Hisab */
const __hbMoney = moneySummary;
moneySummary = function(){
  return __hbMoney().replace('<a class="linkbtn sm" href="#/books">পুরো হিসাব দেখুন</a>', '<a class="linkbtn sm" href="#/hisab">স্মার্ট হিসাবে দেখুন</a>');
};

/* =====================================================================
   Floating Bangla assistant (farmer / paikar pages)
   ===================================================================== */
const AS = {open: false, busy: false, listening: false, msgs: [], speak: false};
function asEnsure(){
  if (document.getElementById('as-fab')) return;
  const fab = document.createElement('button');
  fab.id = 'as-fab'; fab.className = 'as-fab'; fab.type = 'button';
  fab.setAttribute('aria-label', 'বাংলা সহকারী খুলুন'); fab.setAttribute('aria-controls', 'as-panel'); fab.setAttribute('aria-expanded', 'false');
  fab.innerHTML = ic('mic');
  fab.addEventListener('click', () => { AS.open = !AS.open; asDraw(); if (AS.open) setTimeout(() => { const i = $('#as-in'); if (i) i.focus(); }, 30); });
  const panel = document.createElement('section');
  panel.id = 'as-panel'; panel.className = 'as-panel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'বাংলা সহকারী');
  document.body.append(fab, panel);
}
function asDraw(){
  asEnsure();
  const u = me(), show = !!u && (u.role === 'farmer' || u.role === 'paikar');
  const fab = $('#as-fab'), panel = $('#as-panel');
  fab.hidden = !show;
  if (!show) { panel.hidden = true; return; }
  fab.setAttribute('aria-expanded', String(AS.open));
  fab.classList.toggle('on', AS.open);
  panel.hidden = !AS.open;
  if (!AS.open) return;
  panel.innerHTML = `<header class="as-head"><b>${ic('mic')} বাংলা সহকারী</b>
      <button class="iconbtn" data-as="close" aria-label="সহকারী বন্ধ করুন">${ic('x')}</button></header>
    <div class="as-msgs" aria-live="polite" data-i18n-skip>${AS.msgs.length ? AS.msgs.map(m => m.me
      ? `<p class="as-me">${esc(m.text)}</p>`
      : `<div class="as-bot"><p>${esc(m.text)}</p>${m.items && m.items.length ? `<ul>${m.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
          ${m.links && m.links.length ? `<p class="as-links">${m.links.map(l => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join(' · ')}</p>` : ''}
          ${m.simulated ? '<span class="demo-tag">সিমুলেটেড বাজারদর</span>' : ''}
          ${'speechSynthesis' in window ? `<button class="linkbtn xs" data-as="say" data-i="${AS.msgs.indexOf(m)}">${ic('volume')} শুনুন</button>` : ''}</div>`).join('')
      : `<div class="as-bot"><p>আপনার হিসাব বা বাজার নিয়ে জিজ্ঞেস করুন, যেমন:</p><ul>${['আমার এই মাসে কত টাকার বিক্রি হয়েছে?', 'আমার কত টাকা পাওনা আছে?', 'আমার শেষ তিনটা বিল দেখাও', 'আজ আলুর বাজারদর কত?'].map(q => `<li><button class="linkbtn" data-as="ex">${q}</button></li>`).join('')}</ul></div>`}
      ${AS.busy ? `<p class="as-bot muted">${'ভাবছি...'}</p>` : ''}</div>
    <div class="as-input">
      <label class="sr-only" for="as-in">প্রশ্ন লিখুন বা বলুন</label>
      <input id="as-in" maxlength="300" placeholder="প্রশ্ন লিখুন বা মাইকে বলুন">
      ${SpeechRec ? `<button class="iconbtn ${AS.listening ? 'on' : ''}" data-as="mic" aria-pressed="${AS.listening}" aria-label="মাইক্রোফোনে বলুন">${ic('mic')}</button>` : ''}
      <button class="btn btn-green btn-sm" data-as="send" ${AS.busy ? 'disabled' : ''}>জিজ্ঞেস করুন</button></div>
    <p class="muted xs as-note">${SpeechRec ? 'বলার পর লেখাটা দেখে নিন, তারপর "জিজ্ঞেস করুন" চাপুন।' : 'এই ব্রাউজারে কণ্ঠস্বর চেনা নেই, লিখে জিজ্ঞেস করুন।'} সহকারী শুধু তথ্য দেখায়, কোনো লেনদেন করে না।</p>`;
  applyLanguage(panel);
  const box = panel.querySelector('.as-msgs'); box.scrollTop = box.scrollHeight;
}
async function asSend(text){
  text = (text || '').trim();
  if (!text || AS.busy) return;
  AS.msgs.push({me: true, text}); AS.busy = true; asDraw();
  try { AS.msgs.push(await api('/assistant/ask', 'POST', {text}, {quiet: true})); }
  catch (e) { AS.msgs.push({text: e.status === 401 ? 'আবার লগ ইন করুন।' : e.name === 'AbortError' || !e.status ? 'সার্ভারের সাথে যোগাযোগ হচ্ছে না। ইন্টারনেট দেখে আবার চেষ্টা করুন।' : (e.message || 'উত্তর পাওয়া যায়নি')}); }
  AS.busy = false;
  if (AS.msgs.length > 30) AS.msgs = AS.msgs.slice(-30);
  asDraw();
}
let AS_REC = null;
function asMic(){
  if (AS.listening && AS_REC) { AS_REC.stop(); return; }
  try {
    AS_REC = new SpeechRec(); AS_REC.lang = 'bn-BD'; AS_REC.interimResults = false;
    AS_REC.onresult = e => { const i = $('#as-in'); if (i) { i.value = e.results[0][0].transcript; i.focus(); } };
    AS_REC.onerror = e => { AS.msgs.push({text: e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'মাইক্রোফোনের অনুমতি দেওয়া হয়নি। ব্রাউজারে অনুমতি দিন বা লিখে জিজ্ঞেস করুন।' : e.error === 'no-speech' ? 'কোনো কথা শোনা যায়নি, আবার বলুন বা লিখুন।' : 'কণ্ঠস্বর চেনা যায়নি, লিখে জিজ্ঞেস করুন।'}); };
    AS_REC.onend = () => { AS.listening = false; const v = ($('#as-in') || {}).value; asDraw(); const i = $('#as-in'); if (i && v) i.value = v; };
    AS.listening = true; asDraw(); AS_REC.start();
  } catch (e) { AS.listening = false; asDraw(); }
}

/* =====================================================================
   Routes, clicks, inputs
   ===================================================================== */
const __hbRender = render;
render = function(){
  const p = parts(), u = me();
  if (p[0] === 'hisab' && u && (u.role === 'farmer' || u.role === 'paikar')) {
    $('#view').innerHTML = V.hisab(p[1], p[2]);
    renderChrome();
    applyLanguage($('#view'));
  } else {
    __hbRender();
  }
  asDraw();
};

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-as]');
  if (a) {
    e.preventDefault();
    const k = a.dataset.as;
    if (k === 'close') { AS.open = false; asDraw(); $('#as-fab').focus(); }
    if (k === 'send') asSend(($('#as-in') || {}).value);
    if (k === 'ex') asSend(a.textContent);
    if (k === 'mic') asMic();
    if (k === 'say') { const m = AS.msgs[+a.dataset.i]; if (m) say([m.text, ...(m.items || [])].join('। ')); }
    return;
  }
  const el = e.target.closest('[data-hb]');
  if (!el) return;
  e.preventDefault();
  const k = el.dataset.hb, id = el.dataset.id;
  if (k === 'period') { HB.period = el.dataset.v; render(); }
  if (k === 'group') { HB.group = el.dataset.v; render(); }
  if (k === 'inv-pdf') hbDownload(`/hisab/invoices/${id}/pdf`, `${el.dataset.n}.pdf`);
  if (k === 'rec-pdf') hbDownload(`/hisab/receipts/${id}/pdf`, `${el.dataset.n}.pdf`);
  if (k === 'rep-csv') hbDownload(`/hisab/report?${hbRange()}&group=${HB.group}&format=csv`, 'reroute-hisab-report.csv');
  if (k === 'rep-pdf') hbDownload(`/hisab/report?${hbRange()}&group=${HB.group}&format=pdf`, 'reroute-hisab-report.pdf');
  if (k === 'print') window.print();
  if (k === 'doc') {
    const r = await fetch(`/api/hisab/documents/${id}`, {headers: {'X-Token': TOKEN}});
    if (r.ok) window.open(URL.createObjectURL(await r.blob()), '_blank', 'noopener');
  }
  if (k === 'share') {
    const name = `${el.dataset.n}.pdf`;
    try {
      const r = await fetch(`/api/hisab/invoices/${id}/pdf`, {headers: {'X-Token': TOKEN}});
      const file = new File([await r.blob()], name, {type: 'application/pdf'});
      if (navigator.canShare && navigator.canShare({files: [file]})) { await navigator.share({files: [file], title: `Reroute ইনভয়েস ${el.dataset.n}`}); return; }
    } catch (err) { if (err && err.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(`Reroute Agro ইনভয়েস ${el.dataset.n}`); toast('শেয়ারের সুবিধা নেই; ইনভয়েস নম্বর কপি হয়েছে, PDF ডাউনলোড করে পাঠান', 'info'); }
    catch (err) { toast('এই ব্রাউজারে শেয়ার করা যায় না, PDF ডাউনলোড করে পাঠান', 'info'); }
  }
  if (k === 'clear') { HB.form = null; HB.err = ''; hbDraft(null); render(); }
  if (k === 'save') {
    const f = hbForm(), body = {type: f.type, amount: String(f.amount).trim(), date: f.date, crop: f.crop || null,
      qty_kg: f.qty ? +enDigits(String(f.qty)) : null, counterparty: f.counterparty || null, description: f.description || null,
      document_id: f.document_id || null, due_id: f.due_id || null};
    body.amount = enDigits(body.amount);
    if (!(+body.amount > 0)) { HB.err = 'টাকার অঙ্ক দিন'; render(); return; }
    HB.busy = true; HB.err = ''; render();
    try {
      try { await api('/hisab/records', 'POST', body, {quiet: true}); }
      catch (err) {
        if (err.status !== 409) throw err;
        if (!await confirmBox({title: 'আগে থেকেই লেখা থাকতে পারে', body: esc(err.message), ok: 'তবুও লিখুন'})) { HB.busy = false; render(); return; }
        await api('/hisab/records', 'POST', {...body, confirm_duplicate: true}, {quiet: true});
      }
      HB.form = null; hbDraft(null); toast('হিসাব লেখা হয়েছে');
      fxDrop('/hisab');
    } catch (err) { HB.err = err.message || 'সংরক্ষণ হয়নি'; }
    HB.busy = false; render();
  }
  if (k === 'void') {
    const reason = await hbAsk('হিসাবটি বাতিল করবেন?', 'বাতিলের কারণ লিখুন (যেমন: ভুল অঙ্ক লিখেছি)। হিসাব মুছে যাবে না, বাতিল হিসেবে থাকবে।');
    if (!reason) return;
    try { await api(`/hisab/records/${id}/void`, 'POST', {reason}); toast('হিসাব বাতিল হয়েছে'); hbRefresh(); } catch (err) {}
  }
  if (k === 'due-add') {
    const body = {direction: $('#due-dir').value, counterparty: $('#due-who').value.trim(), amount: enDigits($('#due-amt').value.trim()),
      due_date: $('#due-date').value || null, description: $('#due-desc').value.trim() || null};
    if (!body.counterparty || !(+body.amount > 0)) { toast('নাম আর টাকার অঙ্ক দিন', 'error'); return; }
    try { await api('/hisab/dues', 'POST', body); toast('যোগ হয়েছে'); hbRefresh(); } catch (err) {}
  }
  if (k === 'due-pay') {
    const amt = await hbAsk(el.dataset.dir === 'receivable' ? 'কত টাকা পেয়েছেন?' : 'কত টাকা দিয়েছেন?', `বাকি আছে ${tk(+el.dataset.out)}। আংশিক টাকাও লেখা যায়।`, 'decimal');
    if (!amt) return;
    try { await api(`/hisab/dues/${id}/payments`, 'POST', {amount: enDigits(amt), date: hbToday()}); toast('টাকা লেখা হয়েছে, রসিদ তৈরি হয়েছে'); hbRefresh(); } catch (err) {}
  }
});

/* small modal with one text input; resolves to the text or null */
function hbAsk(title, body, mode){
  return new Promise(res => {
    modal(`<div class="body"><h2>${esc(title)}</h2><p class="muted sm" style="margin-top:6px">${esc(body)}</p>
      <label class="field"><span class="sr-only">${esc(title)}</span><input id="hb-ask" ${mode === 'decimal' ? 'inputmode="decimal"' : ''} maxlength="200"></label>
      <div class="row" style="gap:8px;margin-top:14px"><button class="btn btn-green grow" id="hb-ask-ok">ঠিক আছে</button><button class="btn btn-soft grow" data-act="close">বাতিল</button></div></div>`);
    applyLanguage($('#modal'));
    const inp = $('#hb-ask'); inp.focus();
    const done = v => { closeModal(); res(v); };
    $('#hb-ask-ok').addEventListener('click', () => { const v = inp.value.trim(); if (v) done(v); });
    inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); const v = inp.value.trim(); if (v) done(v); } });
    const m = $('#modal'), obs = new MutationObserver(() => { if (!m.classList.contains('on')) { obs.disconnect(); res(null); } });
    obs.observe(m, {attributes: true, attributeFilter: ['class']});
  });
}

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.hbx) { hbForm()[t.dataset.hbx] = t.value; hbDraft(HB.form); }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.hbx) { hbForm()[t.dataset.hbx] = t.value; hbDraft(HB.form); if (t.dataset.hbx === 'type') { HB.err = ''; render(); } return; }
  if (t.dataset.hbf) { HB[t.dataset.hbf] = t.value; render(); return; }
  if (t.dataset.hbfile && t.files[0]) {
    const f = t.files[0];
    if (f.type !== 'application/pdf' && imageError(f)) { toast(imageError(f), 'error'); t.value = ''; return; }
    if (f.size > 500 * 1024) { toast('ফাইল ৫০০ কেবির মধ্যে দিন (ছবি হলে ছোট করে তুলুন)', 'error'); t.value = ''; return; }
    const data = await new Promise(r => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(f); });
    try { const d = await api('/hisab/documents', 'POST', {data}); hbForm().document_id = d.id; hbDraft(HB.form); toast('ফাইল যুক্ত হয়েছে'); render(); }
    catch (err) { t.value = ''; }
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'as-in') { e.preventDefault(); asSend(e.target.value); }
  if (e.key === 'Escape' && AS.open && e.target.closest && e.target.closest('#as-panel')) { AS.open = false; asDraw(); $('#as-fab').focus(); }
});
