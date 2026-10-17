// Browser smoke test (Playwright). Needs a running DEVELOPMENT or DEMO server with demo mode on — never production:
//   APP_ENV=development ENABLE_DEMO_MODE=true DEMO_ADMIN_PASSWORD=admin-demo-pass-1 uvicorn app.main:app --port 8766
//   node tests/e2e/smoke.mjs http://localhost:8766 admin-demo-pass-1
// Set PLAYWRIGHT_MODULE if playwright is not resolvable from this folder.
const mod = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(mod);
const [base = 'http://localhost:8766', adminPw = 'admin-demo-pass-1'] = process.argv.slice(2);
const b = await chromium.launch();
const errors = [], fails = [];
const check = (ok, name) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) fails.push(name); };

async function page(vp = { width: 1366, height: 900 }, login = null) {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(base + '/');
  if (login) {
    const t = await p.evaluate(async l => (await (await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(l) })).json()).token, login);
    await p.evaluate(t => localStorage.setItem('reroute-token', t), t);
    await p.reload(); await p.waitForTimeout(800);
  }
  return p;
}
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);

// registration with the on-screen prototype OTP
let p = await page();
const phone = '016' + String(Date.now()).slice(-8);
await p.goto(base + '/#/register'); await p.waitForTimeout(1000);
await p.fill('#rg-name', 'স্মোক টেস্ট'); await p.fill('#rg-phone', phone);
await p.fill('#rg-password', 'secret12'); await p.fill('#rg-confirm', 'secret12');
await p.fill('#rg-upazila', 'পবা'); await p.fill('#rg-market', 'পবা বাজার');
await p.click('[data-act="register"]'); await p.waitForTimeout(1200);
check((await p.textContent('.otp-demo')).includes('প্রোটোটাইপ মোড'), 'OTP screen shows the prototype notice');
await p.fill('#otp-in', (await p.textContent('.otp-code')).trim()); await p.click('[data-act="otp-verify"]'); await p.waitForTimeout(1800);
check(p.url().endsWith('#/home'), 'correct OTP creates the account and signs in');

// login page: admin has a password form and no one-click button
p = await page();
await p.goto(base + '/#/login'); await p.waitForTimeout(800);
await p.click('[data-role="admin"]'); await p.waitForTimeout(300);
check(!!await p.$('#lg-password') && !(await p.$$('[data-act="login"]')).length, 'admin login is password-only');

// farmer: dashboard, advisor, ask in Bangla
p = await page(undefined, { user_id: 'f1' });
await p.goto(base + '/#/home'); await p.waitForTimeout(1200);
check(!!await p.$('#ac-h') && !!await p.$('#ms-h'), 'farmer dashboard has action centre and money summary');
await p.goto(base + '/#/advisor'); await p.waitForTimeout(5000);
check(!!await p.$('.ss-panel .ss-pill'), 'Smart Selling Advisor shows a decision');
await p.fill('#va-in', 'আমার ২০ মণ টমেটো কোন বাজারে বিক্রি করলে বেশি লাভ হবে'); await p.click('[data-fx="va-parse"]'); await p.waitForTimeout(900);
check((await p.textContent('.va-out')).includes('টমেটো'), 'Bangla question understood');

// admin: pooling and impact
p = await page(undefined, { phone: '01300000000', password: adminPw, role: 'admin' });
await p.goto(base + '/#/admin/pool'); await p.waitForTimeout(1500);
check(!!await p.$('.cap-bar'), 'admin pooling dashboard renders');
await p.goto(base + '/#/impact'); await p.waitForTimeout(1500);
check((await p.$$('.imp-kpi')).length === 8, 'impact dashboard shows 8 metrics');

// full trade journey with two new accounts: listing → offer → negotiation → sale → truck → simulated payment →
// invoice → Smart Hisab → assistant. Data steps go through the app's own api() in each signed-in browser session.
async function signup(role) {
  const q = await page();
  const ph = (role === 'farmer' ? '017' : '018') + String(Date.now()).slice(-8);
  const tok = await q.evaluate(async ({ role, ph }) => {
    const r = await (await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      role, name: role === 'farmer' ? 'যাত্রা কৃষক' : 'যাত্রা পাইকার', phone: ph, password: 'secret12', confirm_password: 'secret12',
      place: 'rajshahi', upazila: 'পবা', market: 'পবা বাজার', biz: role === 'paikar' ? 'যাত্রা আড়ত' : null }) })).json();
    const v = await (await fetch('/api/register/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reg_id: r.reg_id, otp: r.demo_otp }) })).json();
    return v.token;
  }, { role, ph });
  await q.evaluate(t => localStorage.setItem('reroute-token', t), tok); await q.reload(); await q.waitForTimeout(900);
  return q;
}
const call = (q, path, method = 'GET', body) => q.evaluate(([path, method, body]) => api(path, method, body, { quiet: true }), [path, method, body]);
const F = await signup('farmer'), P = await signup('paikar');
const lst = await call(F, '/listings', 'POST', { crop: 'tomato', qty: 1000, price: 30, moq: 200, grade: 'A', quality: 'ভালো', harvest_days_ago: 0, photos: [] });
check(!!lst.id, 'journey: farmer creates a listing');
let off = await call(P, '/offers', 'POST', { listing: lst.id, qty: 400, price: 28, transport: 'reroute', split: 'half' });
check(off.status === 'pending', 'journey: paikar sends an offer with Reroute truck');
const offId = off.id;
off = await call(F, `/offers/${offId}/counter`, "POST", { price: 29 });
check(off.status === 'countered', 'journey: farmer counters the price');
const acc = await call(P, `/offers/${offId}/accept`, 'POST', {});
const oid = acc.order && acc.order.id;
check(!!oid, 'journey: paikar accepts, sale order created');
const tn = await call(F, `/orders/${oid}/transport`);
const prop = (tn.proposals || []).find(x => x.status === 'pending');
if (prop) await call(F, `/orders/${oid}/transport/proposals/${prop.id}/respond`, 'POST', { action: 'accept' });
check((await call(F, `/orders/${oid}/transport`)).status === 'agreed', 'journey: truck fare split agreed');
const pm = await call(P, '/payments', 'POST', { purpose: 'order', ref: oid, method: 'bkash' });
const done = await call(P, `/payments/${pm.id}/confirm`, 'POST', { account: '01700000000', pin: '12345' });
check(done.status === 'success', 'journey: simulated bKash payment confirmed');
// operations team assigns a truck and schedules the pickup (admin, password login)
const A = await page(undefined, { phone: '01300000000', password: adminPw, role: 'admin' });
const bookingId = await F.evaluate(async oid => (await api('/state')).orders.find(o => o.id === oid).booking, oid);
const st = await call(A, '/state');
let assigned = false;
for (const t of st.trucks.filter(t => t.status === 'available' || t.status === 'booked')) {
  try { await call(A, `/admin/bookings/${bookingId}`, 'POST', { status: 'confirmed', truck: t.id }); assigned = true; break; } catch (e) {}
}
if (assigned) await call(A, `/admin/bookings/${bookingId}`, 'POST', { status: 'pickup_scheduled' });
check(assigned, 'journey: truck assigned and pickup scheduled');
await call(F, `/orders/${oid}/handover`, 'POST', {}); await call(P, `/orders/${oid}/complete`, 'POST', {});
check((await call(P, '/state')).orders.find(o => o.id === oid).status === 'completed', 'journey: farmer hands over, buyer confirms receipt (sale completed)');
await F.goto(base + '/#/hisab/bills'); await F.waitForTimeout(1500);
const invHref = await F.$eval('a.hb-row', a => a.getAttribute('href')).catch(() => null);
check(!!invHref, 'journey: invoice listed in Smart Hisab → Bills & Receipts');
await F.goto(base + '/' + invHref); await F.waitForTimeout(1500);
const invText = await F.textContent('#invoice-doc');
check(invText.includes('পরিশোধিত') && invText.includes('সিমুলেটেড'), 'journey: invoice shows paid, labelled simulated');
const invNo = (await F.textContent('.inv-head b')).trim();
const dl = await Promise.all([F.waitForEvent('download'), F.click('[data-hb="inv-pdf"]')]).then(([d]) => d.suggestedFilename()).catch(() => '');
check(dl === invNo + '.pdf', 'journey: invoice PDF downloads');
await F.goto(base + '/#/hisab'); await F.waitForTimeout(1500);
check((await F.textContent('.hb-kpis')).includes('৳'), 'journey: Smart Hisab overview shows totals');
await F.click('#as-fab'); await F.fill('#as-in', 'আমার শেষ তিনটা বিল দেখাও'); await F.click('[data-as="send"]'); await F.waitForTimeout(1500);
check((await F.textContent('.as-msgs')).includes(invNo), 'journey: assistant lists the new invoice');
await F.fill('#as-in', 'এই মাসে আমার লাভ কত?'); await F.click('[data-as="send"]'); await F.waitForTimeout(1500);
check((await F.textContent('.as-msgs')).includes('লাভ'), 'journey: assistant answers the profit question');
await P.goto(base + '/#/hisab/bills'); await P.waitForTimeout(1500);
check((await P.textContent('.hb-body')).includes(invNo), 'journey: buyer sees the same invoice');

// language switch and phone widths
p = await page({ width: 320, height: 700 });
await p.evaluate(() => localStorage.setItem('reroute-lang', 'en')); await p.reload(); await p.waitForTimeout(900);
check((await p.textContent('h1')).includes('Your Crop'), 'English homepage headline');
for (const w of [320, 375, 768]) {
  const q = await page({ width: w, height: 800 }, { user_id: 'p1' });
  for (const h of ['#/home', '#/market', '#/advisor', '#/impact', '#/hisab', '#/hisab/bills', '#/hisab/entries', '#/hisab/reports']) {
    await q.goto(base + '/' + h); await q.waitForTimeout(1500);
    const o = await overflow(q);
    if (o > 0) check(false, `no horizontal scroll at ${w}px on ${h} (${o}px)`);
  }
}
check(!fails.some(f => f.startsWith('no horizontal')), 'no horizontal scroll at 320/375/768 px');
check(!errors.length, 'no JavaScript errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await b.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
