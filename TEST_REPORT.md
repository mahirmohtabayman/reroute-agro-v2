# Test Report

Date: 2026-10-17. Everything below was actually run in this environment (Linux, Python 3.13 with the pinned
requirements, PostgreSQL 16 local server, Chromium via Playwright). **Nothing was run against Neon or Render.**

## 1. Automated backend tests (pytest)

| Run | Command | Result |
|---|---|---|
| SQLite | `pytest -q` | **98 passed, 1 skipped** (the PostgreSQL-only lock test) |
| PostgreSQL 16 | `TEST_DATABASE_URL=postgresql://…/reroute_test pytest -q` | **98 passed, 1 skipped** (the SQLite-only migration test) |

99 tests in 5 files:

| File | Covers |
|---|---|
| `tests/test_security.py` (30) | reset refused for anonymous/farmer/buyer/production admin; seeding guards (production, demo off, DB error, non-empty DB); admin one-click and `123456` refused; demo login off without demo mode; role escalation via payload; forged old tokens; hashed + expiring sessions; logout; revocation on password change and admin reset; login/recovery rate limits; successful logins never lock out; SVG / fake images refused; stored SVG not served; security headers; 413 on oversized body; no wildcard CORS; +880 phone login |
| `tests/test_otp.py` (15) | farmer + paikar sign-up; code stored hashed; 5 wrong attempts lock; expiry + resend; old code invalid after resend; resend limit; replay of a used code; duplicate phone; equivalent phone formats; two pending sign-ups one account; **6 concurrent verifications → 1 account**; pending sign-up lives in the DB (restart-safe); no code and sign-up closed without demo mode; code not in logs; sign-up rate limit |
| `tests/test_transactions.py` (19) | listing edit + visibility; other user cannot edit; counter → accept, reject; offer above list price / stock refused; **no overselling**; **5 concurrent accepts → 1 order**; simulated payment completes order; **second payment rejected**; **5 concurrent wallet payments → charged once**; wallet never negative; wallet balance = ledger after a full trade, stock moved; cancel refunds exactly once; unrelated user cannot pay/cancel/complete/read; cannot confirm someone else's payment; **failure mid-request rolls back every write**; truck capacity; booking steps + owner-only cancel + refund; **points redeemed once under concurrency**; PostgreSQL advisory lock blocks a second connection |
| `tests/test_features.py` (32) | advisor decisions (sell now, other market, wait only with pessimistic evidence, no wait near end of shelf life, insufficient evidence for missing model or stale data); revenue/net/profit kept separate; explanations contain the real numbers; live endpoint arithmetic and simulated label; invalid inputs (4 cases) → 400; model not ready → 503; spoilage levels, cool storage, endpoint validation; Bangla/English question parsing (4 cases), missing values reported, parse never writes; pooling compatibility, cost allocation adds up, packing never exceeds 7 t; pooling dashboard + assignment + user view without other users' data; all-or-nothing assignment; role checks; impact metrics equal database counts and demo is labelled; notification de-duplication and privacy; PWA files and caching rules |
| `tests/test_migrations.py` (3) | a v8 database (previous release) upgrades in a separate process with data kept and nothing seeded, second start is a no-op; production refuses to start without PostgreSQL or `SECRET_KEY`; Render without `APP_ENV` counts as production |

## 2. Upgrade of a previous-release PostgreSQL database (manual run)
Created a database with the previous release (`checkpoint-before-master-prompt`), then started this release with
`APP_ENV=production`:

| | users | orders | listings | wallet_tx | Σ wallet | notifs |
|---|---|---|---|---|---|---|
| before | 16 | 9 | 14 | 17 | 396,462 | 133 |
| after | 16 | 9 | 14 | 17 | 396,462 | 133 |

Migrations `0001`–`0003` applied; no seeding; seeded admin's public password removed.

## 3. Browser tests (Chromium, Playwright)

| Test | Result |
|---|---|
| `tests/e2e/smoke.mjs` (11 checks: OTP notice + sign-up, admin password-only login, farmer action centre + money summary, Smart Selling decision, Bangla question, admin pooling, impact metrics, English headline, no horizontal scroll at 320/375/768 px on 4 pages, no JS errors) | **ALL PASSED** |
| Existing regression scripts: order → transport agreement → payment → confirmed; sign-up/OTP/login/wrong password/demo password; admin verification; theme persistence; sidebar/drawer at 360–1440 px; photo upload/replace/remove incl. demo accounts; password change; forgot password generic answer + rate limit; admin temporary password | **passed, no JS errors** (expected 400/401/429 responses from the negative cases) |
| PWA: service worker registers and controls the page; images load through it; cache holds only static files and the offline page, **no /api/ responses**; with the server unreachable the offline page is shown | **passed** |
| Full layout audit: 37 pages (public, farmer, paikar, admin incl. advisor, impact, pooling) × widths 320/375/768/1024/1440 × light/dark = **370 page views**, checking horizontal overflow and JS/console errors | First run: **1 issue** — new-listing page 29 px too wide at 320 px (a long text value in the cost summary did not wrap). Fixed; re-run at 320 px light+dark (74 page views): **no issues** |

## 4. Not tested / needs production verification
- **Neon and Render were not touched**: deployment, real Neon SSL connection, cold-start time on Render,
  memory on Render — verify after deploying (DEPLOYMENT_GUIDE.md §3).
- Real SMS delivery and real payments do not exist (simulated by design).
- Speech recognition with a real microphone: only the unsupported/denied paths and the text path were
  exercised; actual Bangla recognition quality depends on the browser (Chrome) and was not tested.
- Screen-reader testing with a real screen reader; Safari and Firefox.
- Load testing / many concurrent users across several Render workers (only the cross-connection lock was tested).
- Server-generated explanation sentences are only partly translated in English mode.
