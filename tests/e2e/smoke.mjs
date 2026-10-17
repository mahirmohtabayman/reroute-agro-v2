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

// language switch and phone widths
p = await page({ width: 320, height: 700 });
await p.evaluate(() => localStorage.setItem('reroute-lang', 'en')); await p.reload(); await p.waitForTimeout(900);
check((await p.textContent('h1')).includes('Your Crop'), 'English homepage headline');
for (const w of [320, 375, 768]) {
  const q = await page({ width: w, height: 800 }, { user_id: 'p1' });
  for (const h of ['#/home', '#/market', '#/advisor', '#/impact']) {
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
