# Security Review

Scope: this repository at the end of this work (see CHANGELOG.md). Findings and evidence: PROJECT_AUDIT.md.
Each fix below has an automated test (file in brackets); results are in TEST_REPORT.md.

## Fixed

| # | Issue (severity) | Fix | Test |
|---|---|---|---|
| C1 | Public `POST /api/reset` wiped the database (CRITICAL) | Admin only, and only when `APP_ENV` is `demo`/`development` with demo mode on; production → 403. CLI `manage seed-demo` has the same guard | `test_security.py::test_reset_*`, `test_seed_function_refuses…` |
| C2 | Automatic re-seeding every 12 h and on any start-up DB error (CRITICAL) | Start-up seeds only an empty database, only outside production with demo mode; a DB error stops start-up. Auto-refresh only with `APP_ENV=demo` + explicit `DEMO_AUTO_REFRESH=true` | `test_startup_*`, `test_migrations.py::test_upgrade_keeps_data_and_does_not_seed` |
| C3 | One-click login as admin (CRITICAL) | One-click only in demo mode, only for seeded farmer/paikar accounts, never admin, never registered accounts | `test_admin_has_no_one_click_login`, `test_demo_login_disabled_without_demo_mode`, `test_registered_account_cannot_use_one_click_login` |
| C4 | Admin password `123456` shown on the login page (CRITICAL) | Seeded admin has no password unless `DEMO_ADMIN_PASSWORD` is set on a demo/development deployment; production clears it. Real admins via `manage create-admin` | `test_admin_public_demo_password_rejected`, `test_production_removes_demo_admin_password` |
| C5 | Forgeable, never-expiring tokens; hard-coded secret fallback (CRITICAL) | Server-side sessions: random 256-bit token, only SHA-256 stored, 7-day expiry, deleted on logout, all other sessions deleted on password change, all on admin reset. `SECRET_KEY` required outside development | `test_forged_old_style_token_rejected`, `test_session_is_stored_hashed_and_expires`, `test_logout_revokes_token`, `test_password_change_revokes_other_sessions`, `test_admin_password_reset_revokes_all_sessions`, `test_production_refuses_to_start_without_postgres_or_secret` |
| H1 | SVG "photo" served from our origin → stored XSS (HIGH) | Only JPEG/PNG/WebP/GIF, magic bytes checked, strict base64; served with `nosniff` and `sandbox` CSP; previously stored non-raster photos are not served | `test_svg_and_fake_images_refused`, `test_previously_stored_svg_is_not_served` |
| H2 | Dashboard to-do list printed names unescaped (HIGH) | Escaped; `esc()` now also escapes `'` | browser check; reviewed all `innerHTML` sinks |
| H3 | Two payments could succeed for one order (HIGH) | Order/booking must still be unpaid **before** money moves; conditional status update; inside one transaction | `test_second_payment_for_same_order_is_rejected`, `test_concurrent_wallet_payments_charge_once` |
| H4 | No transactions; races on stock, wallet, offers, points (HIGH) | Every write request runs in one transaction (`@atomic`); on PostgreSQL also an advisory lock so it holds across workers; wallet debit refuses to go below 0; re-read balances inside the transaction; truck capacity check | `test_concurrent_accept_creates_one_order`, `test_no_overselling…`, `test_wallet_never_goes_negative`, `test_failed_request_rolls_back_every_write`, `test_points_cannot_be_redeemed_twice_concurrently`, `test_truck_capacity_prevents_overbooking`, `test_write_transactions_are_serialised_across_connections` |
| H5 | Sign-up OTP in memory, plaintext (HIGH) | `pending_registrations` table, HMAC-SHA256 of the code with `SECRET_KEY`, 5-min expiry, 5 attempts (counted even when the request fails), 3 resends, single use, account created in the same transaction | `test_otp.py` (15 tests incl. concurrency and replay) |
| H6 | No login / sign-up rate limits (HIGH) | Database-backed sliding windows: failed logins 10/15 min per phone, 50/15 min per IP (only failures count, so the owner is never locked out by their own correct logins); sign-up 5/h per phone, 30/h per IP; verify 60/h per IP; resend 20/h per IP; recovery 3/h per phone, 10/h per IP; password change 10/h | `test_login_failures_are_rate_limited_per_phone`, `test_successful_logins_do_not_count…`, `test_signup_rate_limited_per_phone`, `test_forgot_password_generic_and_limited` |
| M1 | CORS `*` | Off by default (app is same-origin); `ALLOWED_ORIGINS` to allow specific sites | `test_no_wildcard_cors` |
| M2 | No security headers | CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (microphone self only), HSTS in production | `test_security_headers_present` |
| M3/M4/M5 | Silent migrations; SQLite fallback in production; retry inside transactions | Versioned migrations; production refuses non-PostgreSQL; no retry inside a transaction | `test_migrations.py` |
| M6 | Phone formats not normalised | `normalize_phone()` everywhere (+880 / 880 / spaces / Bangla digits) | `test_login_accepts_international_phone_format`, `test_equivalent_phone_formats_are_the_same_number` |
| M7 | Client-controlled IP for rate limits | Uses the proxy-appended `X-Forwarded-For` entry (`TRUSTED_PROXIES`) | code review |
| M8 | No request size limit | 3 MB limit (413) | `test_oversized_request_rejected` |
| — | Admin booking step skip crashed the server (500) | A truck must be assigned before later steps | `test_booking_status_only_moves_forward…` |

## Authorization review (IDOR)
All mutating endpoints were re-checked; ownership checks live in `app/services.py` and are exercised by tests:
listings (`my_listing`), offers (party check, turn check), orders (`get_order` → buyer/seller/admin only),
transport proposals (recipient only), payments (payer only, `uid` check), bookings (owner only), notifications
(scoped by recipient), AI trade-check (party to the offer), admin routes (`need_admin`), pooling (admin only;
the user view returns counts and their own costs, no other user's data). Profile edits cannot change `role`,
`wallet`, `verified` or points (Pydantic model whitelists fields) — `test_role_in_payload_does_not_grant_admin`.

## Secrets and logging
- No secret, URL or password in the repository; `.env.example` has placeholders only.
- Passwords: PBKDF2-SHA256, 200k iterations. OTP codes: only an HMAC is stored; the code is returned once to
  the browser that started the sign-up (demo mode only) and never logged (`test_code_not_written_to_logs`).
  Temporary passwords issued by an admin are shown once and never stored in plain text or logged.
- Error responses are short Bangla messages; tracebacks are not returned to clients.

## Remaining risks (not fixed — decide before real users)
1. **No phone ownership verification.** The on-screen prototype OTP proves nothing about the phone. Real
   launch needs an SMS gateway (send the code in `auth.start_otp`, stop returning it).
2. **Password recovery is operator-assisted**: an admin must verify the caller by phone; a careless operator
   could be social-engineered.
3. **CSP allows `'unsafe-inline'` scripts** because the single-page app is built as inline scripts. Moving the
   JS to a separate file would allow a strict CSP.
4. **Session token in `localStorage`**: an XSS would expose it. All known XSS sinks are escaped, but an
   HttpOnly cookie + CSRF protection would be stronger.
5. **IP-based limits behind proxies**: if Render's proxy chain differs from `TRUSTED_PROXIES=1`, per-IP limits
   are weaker (per-phone limits still hold). An attacker can delay one phone's logins for 15 minutes.
6. **Global write lock**: correct but serialises all writes; fine for a prototype, not for high traffic.
7. **Payments are simulated** (PIN 12345). No real gateway, no webhooks, no reconciliation.
8. **Demo mode is on by default** for the hackathon: anyone can use the seeded farmer/paikar demo accounts and
   sign up without phone verification. Set `ENABLE_DEMO_MODE=false` before real users join (or use a separate
   deployment). Admin is never one-click; seeding and reset stay forbidden in production.
9. No dependency vulnerability scan was run in this environment (pip-audit not installed).
