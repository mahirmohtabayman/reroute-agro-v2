# Changelog

## 3.0 — security, reliability and decision support (this release)

### Security (see SECURITY_REVIEW.md)
- Public database reset removed; reset only for an admin on a demo/development deployment; never in production.
- Start-up never seeds or resets a database with data, never seeds production, stops on database errors.
- Admin login by phone + password only; one-click login only for non-admin demo accounts in demo mode.
- Server-side sessions with expiry, logout, revocation on password change/reset; `SECRET_KEY` required.
- Database-backed rate limits on login, sign-up, OTP verify/resend, recovery, password change.
- Photo uploads: raster images only, verified; SVG and fake images refused; safe serving headers.
- Security headers (CSP, frame, nosniff, referrer, permissions, HSTS in production); CORS off by default;
  3 MB request limit; XSS fix in the dashboard to-do list; `esc()` escapes `'`.
- New `app/settings.py`; production refuses to start without PostgreSQL or a strong secret.

### Registration
- Sign-up OTP stored in the database (hashed, 5-min expiry, 5 attempts, 3 resends, single use); account
  created atomically; survives restarts and multiple workers. New `POST /api/register/resend`.
- Prototype notice on the OTP screen; code returned only in demo mode; sign-up closed without demo mode
  (no SMS gateway).
- Phone numbers normalised (+880, 880, spaces, Bangla digits) for sign-up, login and recovery.

### Data integrity
- One database transaction per write request; PostgreSQL advisory lock serialises writes across workers.
- Payment can only succeed while the order/booking is unpaid — checked before money moves; wallet can never go
  negative; balances re-read inside the transaction; truck capacity enforced; booking steps need a truck first
  (fixes a server error).
- Versioned, additive migrations (`schema_migrations`), new indexes; `python -m app.manage` (status, migrate,
  create-admin, seed-demo).
- Identical unread notifications within 10 minutes are not repeated.

### New features
- **Smart Selling Advisor** (`GET /api/ai/advisor/smart-sell`, `app/advisor.py`): sell now / wait / another
  market / insufficient evidence; revenue, transport, other costs, net proceeds and profit kept separate;
  advantage over the alternative with certainty; explanations generated from the numbers; risks; data source,
  date, horizon, model and back-test shown; simulated data labelled.
- **Crop freshness & spoilage risk** (`GET /api/ai/advisor/spoilage`): Low/Medium/High with reasons, action and
  limitation; configurable prototype rule set.
- **Ask in Bangla** (`POST /api/ai/advisor/parse` + browser speech recognition where available): shows what was
  understood, asks for missing details, advice only after confirmation, never a transaction; optional read-aloud.
- **Truck pooling** (`app/pooling.py`, `GET /api/admin/pool`, `POST /api/admin/pool/assign`, `GET /api/pool/mine`):
  route/day/handling/capacity matching, weight-based shared cost, standalone vs shared cost and savings,
  all-or-nothing assignment, saving hint on the user's own booking (no other users' data).
- **Impact dashboard** (`#/impact`, `GET /api/impact`): database metrics with demo vs registered split,
  labelled estimates, definitions, 8-week trend, period filter.
- **Dashboard**: today's action centre (offers to answer, listings needing attention, confirmed orders,
  deliveries, freshness, AI opportunity) and money in motion (expected payouts, payments due, recent wallet
  entries).
- **Offer page**: deal timeline with only the stages the app supports.
- **Homepage**: new headline and "Start as Farmer / Start as Buyer" buttons, link to the impact page.
- **Payment**: "simulated payment — no real money" notice on the method screen.
- **PWA**: manifest, icons, service worker caching only public static files, offline page; static files cached
  for a week, page always revalidated.
- English translations for the new interface text.

### Tests and docs
- `tests/` pytest suite (SQLite and PostgreSQL), `tests/e2e/smoke.mjs` browser smoke test.
- PROJECT_AUDIT, IMPLEMENTATION_PLAN, DATABASE_MIGRATIONS, DEPLOYMENT_GUIDE, SECURITY_REVIEW, TEST_REPORT,
  HACKATHON_DEMO, `.env.example`, `requirements-dev.txt`; `render.yaml` and `Dockerfile` updated.

### Breaking changes (intended)
- Existing logins end once (old tokens are rejected).
- `SECRET_KEY` and `DATABASE_URL` required in production.
- Demo mode is on by default (demo accounts, one-click login for non-admin demo accounts, on-screen prototype OTP);
  `ENABLE_DEMO_MODE=false` turns it off for a real launch.
- Seeded admin `123456` password removed; set `DEMO_ADMIN_PASSWORD` or use `manage create-admin`.
- `POST /api/login` returns 401 for both unknown phone and wrong password (was 404/401 — avoids revealing
  which numbers are registered). All other API request/response shapes are unchanged; new fields were only added.
