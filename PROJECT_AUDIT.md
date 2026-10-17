# Reroute Agro — Codebase Audit

Audit date: 2026-10-17 · Code audited: commit `d7fa2c9` (tag `checkpoint-before-master-prompt`).
Method: read every backend module (`app/*.py`), deployment files, and the frontend templates (`web/*.js`); then reproduced
the critical findings against a local server (`scratch` scripts, results quoted under *Evidence*).

Severity scale: **CRITICAL** (data loss or full account takeover, remotely, without credentials) · **HIGH**
(privilege or money integrity broken under realistic conditions) · **MEDIUM** (defence-in-depth gap, needs an extra
condition) · **LOW** (quality, maintainability).

## Repository structure (verified)

| Area | Files |
|---|---|
| API | `app/main.py` (routes, auth helpers), `app/ai_routes.py` (AI advisor + admin export) |
| Business logic | `app/services.py` (listings, inspections, offers, orders, transport negotiation, payments, bookings, P&L), `app/logic.py` (pricing rules) |
| Data | `app/db.py` (one shared connection, PostgreSQL via psycopg or SQLite), `app/seed.py` (demo data) |
| Auth | `app/auth.py` (PBKDF2 passwords, in-memory sign-up OTP, in-memory rate limit) |
| AI | `app/ai.py` + `ml/` (monthly staple-price model, real WFP data), `app/veg_ai.py` + `ml/veg*.py` (vegetable model, **simulated** data) |
| Frontend | `web/*` concatenated by `build.py` into `static/index.html` |
| Deploy | `render.yaml`, `Dockerfile`, `requirements.txt` |
| Tests | **none** |

---

## CRITICAL

### C1. Public database reset — `POST /api/reset` (`app/main.py: reset`)
- **Current behaviour:** no authentication. Calls `seed()`, which calls `db.reset()` → `DROP TABLE` on every table, then rebuilds demo data. Registered (`U…`) accounts are re-inserted but with wallet, points and credits set to 0; all of their listings, offers, orders, payments, notifications are deleted.
- **Evidence:** `E1 anonymous reset: 200`.
- **Risk:** anyone on the internet can wipe production data with one request.
- **Fix:** remove public access. Reset only through a CLI command (`python -m app.manage seed-demo`) that refuses to run when `APP_ENV=production`; keep the HTTP route only for an admin, only when `APP_ENV` is `demo`/`development` and demo mode is on.
- **Impact:** the demo "start over" button only works for an admin on a demo deployment.
- **Test:** anonymous/farmer/buyer → 401/403; production env + admin → 403; data unchanged.

### C2. Automatic destructive re-seeding (`app/main.py: refresh_demo_if_stale`, `db.needs_seed`)
- **Current behaviour:** `GET /api/state` (every page load) re-runs `seed()` when the data is older than `DEMO_TTL_HOURS` (default 12 h) and nobody wrote for 30 min. `DEMO_AUTO_REFRESH` defaults to `"1"`. Separately, `needs_seed()` returns `True` on **any** exception — a transient Neon connection error at start-up drops and re-creates every table.
- **Evidence:** code paths; `seed()` begins with `db.reset()`.
- **Risk:** production data silently wiped every 12 idle hours, or on an unlucky cold start.
- **Fix:** start-up never seeds unless the users table was read successfully, is empty, and demo mode is on outside production. Auto-refresh only when `APP_ENV=demo` **and** `DEMO_AUTO_REFRESH=1` explicitly.
- **Test:** simulate DB error in `needs_seed` → no seed; production env → no seed even when empty.

### C3. Passwordless admin login (`app/main.py: login`)
- **Current behaviour:** `{"user_id": "a1"}` returns an admin token. Every seeded id (including admin) works.
- **Evidence:** `E2 admin one-click login: 200 admin`.
- **Risk:** full admin control: user list with phone numbers, booking status changes, trucks, password resets of real users.
- **Fix:** one-click login only when `ENABLE_DEMO_MODE=true`, only for seeded **farmer/paikar** ids, never admin. Admin login always by phone + password.
- **Test:** `user_id=a1` → 403 in every mode; demo mode off → 403 for `f1`.

### C4. Publicly known admin password (`app/main.py` start-up `UPDATE users SET pw_hash=…`, `app/seed.py`)
- **Current behaviour:** every seeded account including admin `01300000000` gets password `123456`, printed on the login page.
- **Evidence:** `E4 admin login with public demo password: 200`.
- **Fix:** seeded admin gets no password unless `DEMO_ADMIN_PASSWORD` is set; real admins are created with `python -m app.manage create-admin`. Demo passwords only applied in demo mode.

### C5. Forgeable session tokens (`app/main.py: SECRET`, `sign`, `get_user`)
- **Current behaviour:** `SECRET_KEY` falls back to the string `reroute-agro-demo-secret`, which is in the public repository. `render.yaml` does not set `SECRET_KEY`. Token = `base64(user_id).HMAC(user_id)` — anyone who knows the fallback can mint a token for any id. Tokens never expire and cannot be revoked (logout and password change do nothing server-side).
- **Evidence:** `E3 forged admin token with default secret: 200 admin bundle`.
- **Fix:** server-side sessions table (`auth_sessions`): random 256-bit token, only its SHA-256 stored, expiry (default 7 days), revoked on logout and on password change/reset. `SECRET_KEY` required in production (used for OTP hashing); start-up fails clearly when missing.
- **Impact:** existing logged-in users must log in again once after deploy.

---

## HIGH

### H1. Stored XSS through SVG profile/listing photos (`app/main.py: check_image`, `image_response`)
- **Current behaviour:** any `data:image/*` accepted, served back with the stored media type from the site's own origin. An SVG with `<script>` runs JavaScript on the Reroute domain when the photo URL is opened, and can read the session token from `localStorage`.
- **Evidence:** `E6 svg photo accepted: 200, served as image/svg+xml`.
- **Fix:** allow only JPEG/PNG/WebP/GIF, verify magic bytes, decode base64 strictly, serve with `X-Content-Type-Options: nosniff` and a restrictive CSP.

### H2. Stored XSS in the dashboard to-do list (`web/4_trader_a.js: myTodos`, lines 5, 6, 10, 12, 13, rendered at 38)
- **Current behaviour:** counterparty `name`/`biz` and booking `pickup_time` are inserted into HTML without `esc()`. A user who registers with a name containing HTML runs script in the dashboard of everyone who trades with them.
- **Evidence:** static review (all other sinks do use `esc()`; this is the only gap found).
- **Fix:** escape at the sink. Also make `esc()` escape `'`.

### H3. Duplicate payment for one order (`app/services.py: start_payment`, `confirm_payment`)
- **Current behaviour:** several pending payments can be created for one order; each one can be confirmed. The order-status idempotency check happens **after** the payment is marked successful and **after** a wallet debit, so a second wallet payment (two tabs, or a double-click race) is charged and kept.
- **Evidence:** `E5 two payments for one order both: success success`.
- **Fix:** inside one transaction: lock, re-check the order is still `awaiting_payment` **before** debiting; one successful payment per order (conditional update); reuse an existing pending payment.

### H4. No transactions — multi-step money/stock operations are not atomic (`app/db.py`, all of `services.py`)
- **Current behaviour:** autocommit; the lock is held per statement only. `create_order` (reserve stock, consume credits, mark offer accepted), `complete` (stock, wallet payout, cashback), `release_order` (refund), wallet payment (check balance → debit) are separate statements. Concurrent requests interleave (FastAPI runs sync endpoints in a thread pool); a failure half-way leaves partial state.
- **Examples:** two accepts of the same offer → two orders and double reservation; two wallet payments at once → balance below zero; redeeming points twice in parallel → reward granted twice (`MAX(0,…)` hides the negative).
- **Fix:** `db.tx()` — one transaction per mutating request, `pg_advisory_xact_lock` on PostgreSQL so it also holds across several Render workers; rollback on any error. Status changes guarded with `WHERE status=…`.

### H5. Sign-up OTP held in process memory (`app/auth.py: _pending`)
- **Current behaviour:** lost on restart/redeploy; does not work with more than one worker; plaintext code.
- **Fix:** `pending_registrations` table, HMAC hash of the code, expiry, attempt counter, consumed flag, resend.

### H6. No rate limiting on login, registration, OTP verify (`app/main.py`)
- **Current behaviour:** unlimited password guessing (`123456`-style passwords and 5-digit OTP across restarts). The only limiter (password recovery) is in memory and per process.
- **Fix:** database-backed sliding-window limiter per phone and per IP, with short windows so a legitimate user is never locked out for long.

---

## MEDIUM

| # | Location | Issue | Fix |
|---|---|---|---|
| M1 | `main.py` CORS | `allow_origins=["*"]` | `ALLOWED_ORIGINS` env; same-origin by default (the frontend is served by the API itself). |
| M2 | `main.py` | No security headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP. |
| M3 | `db.py: _apply_migrations` | Swallows every error, version is one integer; a failed ALTER is silently skipped | Versioned migrations recorded in `schema_migrations`, idempotent statements, errors logged and raised. |
| M4 | `db.py` | No SQLite guard: production without `DATABASE_URL` silently uses temporary SQLite (data lost on every Render restart) | In production, missing/invalid `DATABASE_URL` stops start-up with a clear message. |
| M5 | `db.py: _execute` | Reconnect-and-retry also inside what should be a transaction | Retry only outside a transaction. |
| M6 | `main.py` login/register/forgot | Phone formats `+8801…`, `8801…`, spaces are not normalised → "not found" or duplicate risk | One `normalize_phone()` used everywhere. |
| M7 | `main.py: password_forgot` | IP from the **first** `X-Forwarded-For` value, which a client can forge | Use the hop appended by Render's proxy (right-most), configurable. |
| M8 | Request size | Profile photo up to 600 KB base64, listing up to 3 × 600 KB; no global body limit | Global request-size limit (2 MB). |
| M9 | `services.py: confirm_payment` | Demo PIN `12345` is public; payments look real | Payment UI and records are already labelled "ডেমো"; keep and add explicit "simulated, no money moves" text. |
| M10 | `/api/state` | Every page load runs `housekeeping()` writes (expiry of offers/orders) for anonymous visitors | Acceptable for prototype; now inside a transaction. |
| M11 | `services.py: create_booking` / `BookingIn` | No upper bound on `qty` | Bound to 100 t. |

## LOW

| # | Location | Issue |
|---|---|---|
| L1 | Tests | No automated tests at all. |
| L2 | Indexes | No indexes on `offers.buyer/seller`, `orders.buyer/seller`, `notifs."to"`, `listings.uid` etc. Fine at demo size; added. |
| L3 | `web/2_core.js: esc` | Does not escape `'` (no current exploit). |
| L4 | `Dockerfile` | Runs as root. |
| L5 | `README`/`render.yaml` | Says "Empty DATABASE_URL = temporary SQLite" — encourages unsafe production setup. |
| L6 | `veg_metrics.json` | Labelled `"data": "simulated"` — correct; the UI must keep showing that label. `metrics.json` (staples) is a genuine chronological back-test on real WFP prices (train ≤ 2022, test 2023–2025). Model beats the naive baseline by only 2.7 % MAE — must not be presented as strong accuracy. |

## Already correct (kept)
- Passwords: salted PBKDF2-SHA256, 200k iterations, constant-time compare.
- SQL: all queries parameterised (`?`), table/column names only from code.
- Ownership checks exist in services: listings (`my_listing`), inspections (seller/buyer checks), offers (`respond_offer` side check), orders (`get_order` restricts to buyer/seller/admin), transport proposals (recipient only), bookings (owner only), notifications (scoped by `"to"`), AI trade-check (party to the offer).
- Admin routes all use `need_admin`; AI admin export uses `_admin`.
- Frontend escapes user data everywhere except H2.
- Simulated AI data is labelled `simulated: true` in API responses and shown as such.

## Data-compatibility notes for production (Neon)
- Existing `users.phone` is already `UNIQUE`; no new uniqueness constraint added.
- New tables only (`auth_sessions`, `rate_hits`, `pending_registrations`, `schema_migrations`) and indexes; no column added, removed or retyped.
- Existing sessions (old token format) stop working → users log in once again.

## Model evaluation review (Phase 4.5)

| Model | Data | Split | Baseline | Result (from `models/*.json`, not re-computed) | Verdict |
|---|---|---|---|---|---|
| Staple prices (`app/ai.py`, `ml/train.py`) — rice, lentils, oil, wheat flour, monthly | **Real**: WFP/HDX Bangladesh food prices (`data/raw/bd_food_prices_ohlc.csv`) | Chronological: train 2008-01 → 2022-12, test 2023-01 → 2025-07 | Naive "next month = this month" | MAE 1.618 vs naive 1.664 (2.7 % better); direction right 70.8 % | Honest back-test on real data, but only marginally better than naive. Not used for the vegetable advice. |
| Vegetable prices (`app/veg_ai.py`, `ml/train_veg.py`) — 7 crops, 6 markets, daily, 1–3 days ahead | **Simulated** (`ml/vegsim.py`) | Chronological: test from 2025-07-01 | Naive "price stays the same" | MAPE 6.5 / 8.8 / 10.1 % vs naive 8.0 / 11.6 / 13.2 % for 1 / 2 / 3 days | Measures how well the model learns the **simulator's own rules**, not real-market accuracy. Labelled "simulated" everywhere in the UI and API. |

Checks done:
- **Leakage:** features use only past values (`shift(k>0)`, trailing rolling windows) and calendar flags of the
  target day, which are known in advance. Targets are future values. Minor boundary overlap: training rows in
  the last 1–3 days (veg) / last month (staples) before the test start have targets inside the test period.
  The effect is small; a purge gap of 3 days / 1 month would remove it.
- **Training accuracy is not reported** as generalisation accuracy; all numbers are from the held-out period.
- **Out-of-distribution inputs:** the API only accepts the 7 crops, 6 districts and 1–2,500 maunds the model
  was built for (400 otherwise); the Smart Selling Advisor returns "insufficient evidence" when the model is not
  loaded or the data is more than 2 days old.
- **Compatibility:** both models load with scikit-learn 1.8.0 pinned in `requirements.txt`; the staple model
  retrains on the spot if loading fails, the veg model falls back to "price unchanged" (and the advisor then says
  "insufficient evidence").
- No new accuracy figures were invented; the market-choice figures (e.g. ৳7.84/kg more than the local market)
  come from `models/veg_metrics.json` and are shown as simulated estimates.
