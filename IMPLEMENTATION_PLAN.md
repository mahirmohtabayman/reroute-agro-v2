# Implementation Plan

Order follows the priority list in the brief. Each step: inspect → change → test → document. Nothing is deployed
and no production database is touched; everything is verified on local SQLite and a local PostgreSQL 16 server.

| Step | Priority | Work | Files | Done when |
|---|---|---|---|---|
| 0 | P0 | Git checkpoint (`checkpoint-before-master-prompt`), audit, this plan | docs | ✔ |
| 1 | P1 | `app/settings.py`: `APP_ENV`, `ENABLE_DEMO_MODE`, `SECRET_KEY`, `ALLOWED_ORIGINS`, fail-fast rules | new | start-up refuses unsafe production config |
| 2 | P1 | Safe start-up: no destructive seed, no auto-refresh outside demo, reset endpoint admin+demo only, CLI `app/manage.py` | `main.py`, `db.py`, `seed.py` | C1, C2 tests pass |
| 3 | P1 | Login: demo one-click only for non-admin demo accounts in demo mode; admin password login form; `DEMO_ADMIN_PASSWORD` | `main.py`, `web/3_public.js`, `6_actions.js` | C3, C4 tests pass |
| 4 | P1 | Sessions table, expiring tokens, logout, revoke on password change/reset | `auth.py`, `main.py`, `ai_routes.py`, `web` | C5 tests pass |
| 5 | P1 | DB-backed rate limits on login, register, resend, verify, forgot, password change | `auth.py`, `main.py` | H6 tests pass |
| 6 | P1 | Image validation, security headers, CORS, body-size limit, XSS fix in to-do list | `main.py`, `web/4_trader_a.js`, `2_core.js` | H1, H2, M1, M2, M8 |
| 7 | P2 | `pending_registrations` OTP flow + resend, phone normalisation | `auth.py`, `main.py`, `web/6_actions.js` | OTP test matrix passes, survives restart |
| 8 | P3 | `db.tx()` + advisory lock around every mutating request; versioned migrations; indexes | `db.py`, `main.py`, `ai_routes.py` | concurrency tests pass |
| 9 | P3 | Payment idempotency, wallet non-negative, offer double-accept guard, booking/truck guards | `services.py` | H3, H4 tests pass |
| 10 | P4 | Smart Selling Advisor panel on top of the existing `/api/ai/advisor/farmer` output: revenue vs net proceeds vs profit, sell-now/wait/other-market decision, "why this market", data source/date/model labels | `app/advisor.py`, `web/5b_ai_advisor.js` | unit tests on the decision rules |
| 11 | P5 | Truck pooling: match open bookings by route, date and capacity; transparent shared-cost allocation by weight | `app/pooling.py`, admin + booking UI | allocation tests |
| 12 | P6 | Spoilage risk rules (labelled prototype rule set from existing `CROPS` shelf-life + `spoil_rate`) | `app/advisor.py` | rule tests |
| 13 | P7 | Bangla voice/text assistant (Web Speech API where available, text fallback, parse → advisor) | `web/5b_ai_advisor.js` | parser tests + browser check |
| 14 | P6/P7 | Farmer action centre + financial summary, impact dashboard (DB metrics + labelled estimates) | `main.py`, `web` | metrics tests |
| 15 | P7 | PWA manifest + service worker caching public static assets only, offline page | `static/` | browser check |
| 16 | P8 | pytest suite, Playwright smoke, docs (`CHANGELOG`, `DATABASE_MIGRATIONS`, `DEPLOYMENT_GUIDE`, `SECURITY_REVIEW`, `TEST_REPORT`, `HACKATHON_DEMO`, `.env.example`) | `tests/`, docs | all tests run green |

Out of scope unless approved: real SMS gateway, real payment gateway, maps API, deploying, touching the Neon database.
