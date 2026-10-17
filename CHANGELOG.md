# Changelog

## 3.2 — UI refinement and complete Bangla/English (this release)

Presentation only: no API, database, payment, authentication or business-logic changes.

### Theme switching
- Colour tokens are registered as animatable colours (`@property`) and transition on the root element for
  300 ms only while the user switches theme, so every surface, text, border, gradient and freshly rendered
  element changes together. No delay, no opacity fade, no layout change; instant with reduced motion.
  The saved theme is still applied before the first paint (no flash).

### Language (Bangla / English)
- New `web/1b_i18n_catalog.js`: whole-sentence English for about 1,300 interface strings and server messages
  (errors, notifications, assistant answers, advisor explanations), found by scanning every Bangla string in
  `web/*.js` and `app/*.py`. Values inside a sentence (numbers, names, crops) are placeholders.
- The translator now uses the catalogue first, then translates sentence by sentence, keeps separators and
  spaces, and never mixes languages: text it cannot translate completely (names, places, a user's own notes)
  stays as written. Text and labels the app changes in place are re-translated (no stale text).
- Bangla mode uses one glossary: এআই পরামর্শ, ওয়ালেট ব্যালেন্স, মোট বিক্রয়, …; English words such as
  "Retraining", "export" and a file path were removed from Bangla text.
- English mode uses consistent labels (Dashboard, Marketplace, My Listings, Offers & Orders, Transportation,
  Stock & Accounts, Smart Hisab, AI Advisor, Points & Wallet, Wallet Balance, …).
- The Bangla assistant's answers now follow the language; its example questions still send Bangla.
- Known limits: names, places, truck numbers and user-written notes are not translated (by design); invoice,
  receipt and report PDFs and the admin dataset CSV stay in Bangla.

### Favicon and app icons
- The Reroute Agro leaf logo (the header logo artwork, matching the supplied image) is now the favicon:
  `favicon.ico` (16/32/48), 16/32/48 px PNGs, SVG, 180 px Apple touch icon, 192/512 px PWA icons and a
  maskable icon. Served at `/favicon.ico` and `/static/icons/…?v=2`; the service worker cache moved to v2 so
  old icons are replaced. The GitHub Pages showcase uses the same logo.

### Sidebar
- Light mode: soft sage background (`#EEF5EB`) with matching hover and active states; dark mode: forest
  green (`#172B22`). Width, order, icons, spacing and behaviour unchanged; keyboard focus ring added.

### Wallet balance card
- Forest-green gradient card with a larger balance (tabular figures), wallet icon, lime/gold accent line;
  dark-mode variant; shown first on phones. The points card stays as it was, one step smaller. Values still
  come from the signed-in user's account; nothing hard-coded.

### Layout stability and small-screen fixes
- Footer starts below the fold, the sidebar's space is reserved from the first paint for signed-in users,
  and the sidebar width animates only when the user toggles it. Locally measured layout shift: home page on
  desktop 0.411 → 0.002; signed-in pages up to 0.16 → at most 0.004 (local measurement, not Lighthouse).
- English labels wrap at 320 px (dashboard quick links, money list, full-width buttons).

## 3.1 — Smart Hisab, first-party trade data, Bangla assistant

### Smart Hisab (one new navigation item, four tabs)
- **হিসাব (overview)**: sales (platform vs user-reported), costs, profit/loss, receivables/payables for today,
  this week/month/year, all time or a custom range; recent invoices and receipts.
- **বিল/রসিদ**: invoices are issued automatically once an order's price and transport terms are final
  (unique numbers `RA-YYYY-NNNNNN`, a frozen snapshot of parties, goods, fees and transport). Search by number,
  crop or name; filter by date and payment status. Each invoice can be viewed, printed, downloaded as a PDF with
  correct Bengali text, or shared (Web Share, falling back to copying the number).
- Receipts (`RC-YYYY-NNNNNN`) are created from simulated payments, payouts, refunds and manual due payments —
  once per source event. **An invoice is never proof of payment**: paid/partial/unpaid comes from receipts only.
  Every platform receipt says *simulated (demo, not real money)*.
- A cancelled order keeps its invoice; a cancellation adjustment is added instead of overwriting it.
- **আয়-ব্যয়**: manual records (outside sale, crop purchase into stock, production/harvest/transport/storage/
  packaging/labour/other costs, money received/paid against a due) labelled *user-reported (not verified)*,
  with a likely-duplicate warning (same record, or a cost the platform already counts) that needs confirmation;
  records are voided with a reason, never deleted; optional receipt photo/PDF stored in the database
  (owner-only). Receivables/payables with due dates, partial payments, paid/partial/unpaid/overdue.
- **রিপোর্ট**: sales by day/week/month, by product, expense categories (platform vs user-reported), P&L and
  dues; CSV and PDF download.
- P&L rules (Decimal, integer poisha in the database): sales counted once; purchases go to stock and become cost
  when sold (no double counting); farmer production costs replace the listing cost for that crop; if any sold
  crop has no known cost the profit is not shown: *লাভের হিসাব সম্পূর্ণ নয় — কিছু খরচের তথ্য পাওয়া যায়নি।*
  The old "হিসাব খাতা" page now uses the same calculation.
- Dashboard money panel links to Smart Hisab.

### First-party trade data
- `trade_records`: one row per completed order (crop, grade, original and kg quantity, districts, listing /
  first offer / final price, transport, payment and delivery status, time), classified `real_platform` or
  `demo_marketplace`, verified, with quality checks (price range, quantity range, price above listing, missing
  listing/offer, duplicates within 10 minutes). Manual records and the simulated market file are reported as
  separate, never-eligible classes.
- Admin: `GET /api/admin/dataset` (summary) and `GET /api/admin/dataset/training.csv` — only eligible real
  trades, no names, phones, user ids or order ids. No automatic retraining.

### Bangla assistant
- Floating microphone button (bottom right, above the mobile tab bar) on farmer and paikar pages. Typed or
  spoken (browser speech recognition, `bn-BD`) questions: sales, profit, receivables, payables, latest bills,
  pending orders, best market for a quantity, today's market price. Answers come only from the user's own
  records and the existing AI services; market answers are labelled simulated; missing quantity is asked for.
  The text is shown for checking before sending; the assistant is read-only and never makes a transaction.

### Reliability and usability
- API calls time out after 20 s; GET requests retry once; clear messages when the server cannot be reached.
- Sign-up form and the Smart Hisab record form keep a draft on the device (passwords are never saved).
- `python -m app.manage status` failed on PostgreSQL because of a literal `%` in SQL; literal `%` is now escaped
  for PostgreSQL (regression test added).

### New files and dependencies
- `app/hisab.py`, `app/hisab_routes.py`, `app/pdfgen.py`, `app/dataset.py`, `app/assistant.py`,
  `app/fonts/NotoSansBengali-{Regular,Bold}.ttf` (SIL Open Font License), `web/5d_hisab.js`.
- `fpdf2==2.8.3`, `uharfbuzz==0.50.2` (Bengali text shaping) and their pinned dependencies `pillow`,
  `fonttools`, `defusedxml`.
- Migrations `0004_smart_hisab`, `0005_trade_records` (additive; see DATABASE_MIGRATIONS.md).

## 3.0 — security, reliability and decision support

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
