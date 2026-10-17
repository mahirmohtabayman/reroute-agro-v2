# Deployment Guide — Render + Neon PostgreSQL

Nothing in this release was deployed automatically. Follow these steps yourself.

## 1. Environment variables

| Variable | Production | Demo deployment | Notes |
|---|---|---|---|
| `APP_ENV` | `production` | `demo` | On Render it defaults to `production` when unset |
| `DATABASE_URL` | Neon URL (required) | a **separate** Neon database or branch | `postgresql://…?sslmode=require`. Without it the server refuses to start |
| `SECRET_KEY` | ≥ 32 random chars (required) | ≥ 32 random chars | `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Hashes OTP codes. Changing it invalidates pending sign-up codes only |
| `ENABLE_DEMO_MODE` | default `true` (hackathon); `false` for a real launch | `true` | Demo accounts, one-click demo login (never admin), on-screen prototype OTP |
| `DEMO_ADMIN_PASSWORD` | optional, ≥ 10 chars | ≥ 10 chars | Password for the seeded demo admin `01300000000` while demo mode is on; without it the demo admin cannot log in |
| `DEMO_AUTO_REFRESH` | not set | optional `true` | Rebuild idle demo data every `DEMO_TTL_HOURS` (12) |
| `ALLOWED_ORIGINS` | usually empty | usually empty | Only if another website must call the API |
| `TRUSTED_PROXIES` | `1` | `1` | Render adds one proxy hop |
| `SESSION_DAYS` | `7` | `7` | Login lifetime |
| `PYTHON_VERSION` | `3.12.3` | `3.12.3` | |

`.env.example` lists them with placeholders. Never commit real values.

## 2. Important: what changes for the current live site
1. **`SECRET_KEY` must be set** or the new release will not start on Render (by design).
2. **Demo mode is ON by default** (hackathon prototype): demo accounts with one-click login (never admin) and
   sign-up with the on-screen prototype OTP work without any extra setting. For a real launch set
   `ENABLE_DEMO_MODE=false`: demo accounts disappear and sign-up closes until an SMS gateway is added.
3. Everyone has to **log in once again** (old tokens were forgeable and are no longer accepted).
4. **The seeded admin `01300000000` no longer accepts `123456`.** Set `DEMO_ADMIN_PASSWORD` (10+ characters) to
   use it, or create a real admin with `manage create-admin` (step 3).
5. Demo data is **never rebuilt automatically in production** and the public reset endpoint is gone.

## 3. Production (existing service)
1. Back up Neon (see DATABASE_MIGRATIONS.md → Upgrade steps).
2. Push this code to the GitHub branch Render deploys from (you upload it manually, as before).
3. Render dashboard → your service → **Environment**:
   - add `SECRET_KEY` (generated value), `APP_ENV=production`, optional `DEMO_ADMIN_PASSWORD`,
     `TRUSTED_PROXIES=1`; keep `DATABASE_URL`.
4. Deploy. Build command and start command are unchanged:
   - Build: `pip install -r requirements.txt && python build.py`
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Health check: `/api/health`
5. Watch the log: `starting: APP_ENV=production, …, database PostgreSQL`, one `applying migration …` line
   per missing migration (upgrading from 3.0: `0004_smart_hisab` and `0005_trade_records`), then
   `Application startup complete`.
6. Create an operations account (Render's free plan has no shell, so run this **on your own computer** against
   Neon; it only inserts one row):
   ```bash
   pip install -r requirements.txt
   APP_ENV=production SECRET_KEY=<same as Render> DATABASE_URL=<neon url> \
     python -m app.manage create-admin --phone 01XXXXXXXXX --name "Reroute অপারেশন টিম"
   ```
   It asks for a password (min 10 characters). Log in with role "অপারেশন".
7. Check: `https://<your-app>.onrender.com/api/health` → `{"ok":true}`; log in; open `#/impact`.
8. Smart Hisab check (3.1): log in as a demo farmer → **স্মার্ট হিসাব** → বিল/রসিদ → open an invoice →
   **PDF ডাউনলোড** (the PDF must show Bengali text correctly) → রিপোর্ট → CSV. Then press the microphone
   button bottom right and ask *আমার কত টাকা পাওনা আছে?* (typing works too).

## 4. Separate demo deployment (recommended for judging)
1. Neon: create a new branch or database, e.g. `reroute_demo`. Never point a demo service at production data.
2. Render: *New → Web Service* from the same repo, same build/start commands, environment:
   `APP_ENV=demo`, `ENABLE_DEMO_MODE=true`, `DATABASE_URL=<demo db>`, `SECRET_KEY=<new random>`,
   `DEMO_ADMIN_PASSWORD=<10+ chars>`, `TRUSTED_PROXIES=1`, optional `DEMO_AUTO_REFRESH=true`.
3. First start on the empty demo database loads the demo data automatically.
4. To reset between judging sessions: log in as the demo admin → footer button "ডেমো নতুন করে শুরু", or locally
   `APP_ENV=demo ENABLE_DEMO_MODE=true DATABASE_URL=<demo db> SECRET_KEY=… python -m app.manage seed-demo --yes`.
   Both are refused in production.

## 5. Neon notes
- Use the connection string with `sslmode=require` (Neon's default). The app opens **one** connection per
  worker, reconnects once if Neon suspended the compute, and never retries inside a transaction.
- Neon free computes suspend after inactivity; the first request after that takes ~1–3 s longer.
- No connection pooler is needed at this scale (one Render worker = one connection).

## 6. Render free tier notes
- The service sleeps after ~15 min without traffic; the next request waits for Render to wake the container
  plus the app start. Locally the app answers `/api/health` about 3 s after launch and the AI advisor is ready
  about 6 s after launch (the vegetable market is simulated in a background thread); Render's container wake-up
  comes on top and is not under the app's control. Open the site a minute before a demo.
- Memory: measured locally at about 258 MB resident after start-up, many Smart Hisab pages, PDF downloads and
  browser tests (3.0 was about 226 MB), below the 512 MB free limit. Render's figure can differ; check the
  service's Metrics tab after deploying.
- 3.1 adds `fpdf2`, `uharfbuzz` (Bengali shaping for PDFs) and their pinned dependencies `pillow`, `fonttools`,
  `defusedxml`. All have ready-made Linux wheels for Python 3.12 (checked with `pip download`), so the build
  command is unchanged. The Bengali font files are in `app/fonts/` (SIL Open Font License).
- Receipt photos/PDFs that users attach in Smart Hisab are stored in the database, not on Render's disk.
- Local disk is not persistent: all data lives in Neon.
- Availability is not guaranteed on the free tier.

## 7. Local development
```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
python build.py
APP_ENV=development ENABLE_DEMO_MODE=true DEMO_ADMIN_PASSWORD=admin-demo-pass-1 uvicorn app.main:app --reload
pytest -q                                     # SQLite
TEST_DATABASE_URL=postgresql://…/scratch pytest -q   # a throw-away PostgreSQL database (it is wiped!)
```
