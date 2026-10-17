# Database Migrations

## How it works
- `app/db.py` holds an ordered list `MIGRATIONS = [(id, function), …]`.
- `db.migrate()` runs on every server start (and via `python -m app.manage migrate`):
  1. `CREATE TABLE IF NOT EXISTS` for every base table (no effect on existing tables);
  2. creates `schema_migrations (id, applied_at)` if missing;
  3. runs each migration whose id is not yet in `schema_migrations`, **each in its own transaction**, and records it.
- Migrations only **add** (tables, columns via `add_column()` which checks first, indexes with `IF NOT EXISTS`).
  Nothing is dropped, renamed or retyped. Running them twice changes nothing.
- On PostgreSQL every write transaction takes an advisory lock, so two workers starting at once cannot apply the
  same migration twice.
- Start-up **never seeds or resets** a database that already has users, and never seeds in production
  (see `app/seed.py: startup`). A database error during start-up stops the server instead of being treated as
  "empty".

## Migrations in this release

| id | What it does | Data impact |
|---|---|---|
| `0001_legacy_columns` | Adds the columns introduced by schema versions 1–8 (`inspections.*_time/at`, `users.market`, `users.pw_hash`) if missing | none (columns already exist on the current Neon DB → no-op) |
| `0002_auth_tables` | New tables `auth_sessions`, `rate_hits`, `pending_registrations` + indexes | none |
| `0003_indexes` | Indexes on foreign-key-like columns (`orders.buyer`, `orders.seller`, `notifs."to"`, …) | none; index build on small tables takes milliseconds |
| `0004_smart_hisab` (3.1) | New columns on `entries` (`category`, `entry_date`, `counterparty`, `document_id`, `source`, `voided_at`, `void_reason`); new tables `counters`, `invoices` (`number` and `order_id` UNIQUE), `invoice_adjustments`, `receipts` (`number` and `source_ref` UNIQUE), `dues`, `due_payments`, `documents`, `audit_events` + indexes | none; existing entries keep their values (empty `source` is read as user-reported) |
| `0005_trade_records` (3.1) | New table `trade_records` (`order_id` UNIQUE) + indexes | none |

The old `meta.schema_version = 8` row is left in place and no longer used.

## Upgrade steps (Neon production)
1. **Back up first** (Neon console → your project → *Branches* → *Create branch* from `main`; a branch is an
   instant copy you can restore from). Alternatively `pg_dump "$DATABASE_URL" > backup.sql`.
2. Optional dry run on the branch: point a local checkout at the branch URL and run
   `APP_ENV=production SECRET_KEY=<any 32+ chars> DATABASE_URL=<branch url> python -m app.manage status`.
   It applies the migrations to the branch only and prints the account counts, so you can compare.
3. Deploy the new code. The first start applies the migrations that are still missing (a few seconds).
4. Check the log for `applying migration …` lines (on the current live database: `0004_smart_hisab` and
   `0005_trade_records`, if 0001–0003 were already applied) and no errors; `GET /api/health` returns `{"ok":true}`.
5. Invoices, receipts and trade records for existing orders are created lazily: when a user opens Smart Hisab
   (their own orders) and when an admin opens the dataset page (backfill). Nothing is rewritten.

## Rollback
- The migrations are additive, so the **previous release keeps working on the migrated database** (it ignores the
  new tables). To roll back the code, redeploy the previous commit in Render (*Manual Deploy → Deploy a specific
  commit*).
- Note: the previous release contains the vulnerabilities fixed here (public reset, admin one-click login) —
  only roll back temporarily.
- To remove the new objects completely (normally unnecessary):
  ```sql
  DROP TABLE IF EXISTS auth_sessions, rate_hits, pending_registrations;
  DELETE FROM schema_migrations WHERE id IN ('0002_auth_tables', '0003_indexes');
  ```
  Indexes from `0003` can stay; they only speed up queries.
- 3.1 objects (only if you really want them gone — this deletes all invoices, receipts, dues and attachments):
  ```sql
  DROP TABLE IF EXISTS trade_records, invoice_adjustments, receipts, due_payments, dues, documents,
                       audit_events, invoices, counters;
  DELETE FROM schema_migrations WHERE id IN ('0004_smart_hisab', '0005_trade_records');
  ```
  The new `entries` columns can stay; the previous release ignores them.
- Full restore: Neon console → *Restore* the branch created in step 1.

## Adding a migration
1. Write a function in `app/db.py` that only adds things (use `add_column`, `CREATE … IF NOT EXISTS`).
2. Append `("000N_name", function)` to `MIGRATIONS`. Never edit or reorder an applied migration.
3. Add a test (see `tests/test_migrations.py`) that upgrades an old-format database and checks data is kept.
4. Inspect production data before adding any constraint (e.g. `UNIQUE`) that existing rows might violate.

## Smart Hisab accounting rules (3.1)
- Money in the new tables is stored as integer poisha (`*_p` columns); calculations use `Decimal` and are rounded
  to 2 decimals only for display.
- **Invoice** = what is owed, issued once per order when price and transport are final (status `confirmed`,
  `handed_over`, `completed`, or `awaiting_payment` with self transport or an agreed truck split). Number from
  the `counters` table inside the same transaction; `UNIQUE` on number and order. The JSON snapshot is never
  edited; a cancellation adds an `invoice_adjustments` row.
- **Receipt** = money that moved (simulated on the platform, or user-reported). Created once per source event
  (`source_ref` UNIQUE: `pay:<payment>`, `wallet:<tx>`, `due:<payment>`). Invoice status comes only from receipts.
- **Sales** = completed platform sales (seller side) + user-reported outside sales; each counted once.
- **Cost of goods**: paikar — weighted-average stock cost (purchases add to stock; cost recognised when sold);
  farmer — recorded production/harvest costs for that crop (or whole-farm costs) replace the listing's per-kg
  cost. Unknown cost for any sold crop → profit not shown, with the message
  *লাভের হিসাব সম্পূর্ণ নয় — কিছু খরচের তথ্য পাওয়া যায়নি।*
- **Expenses**: platform fee and Reroute truck share (automatic) + user-reported categories; a manual expense
  that matches a platform cost needs explicit confirmation.
- Records and dues are voided with a reason (stock movements reversed), never deleted. Issuing or adjusting an
  invoice, creating/voiding a record or due, a due payment and an upload each write an `audit_events` row.

## Upgrade check for 3.1 (run locally on PostgreSQL 16, not on Neon)
Database created with the previous release (tag `checkpoint-before-smart-hisab`, demo data), then started with
this release in `APP_ENV=production`, demo mode off:

| | users | orders | listings | wallet_tx | Σ wallet | entries | notifs | payments |
|---|---|---|---|---|---|---|---|---|
| before | 16 | 9 | 14 | 17 | 396,462.00 | 6 | 133 | 11 |
| after | 16 | 9 | 14 | 17 | 396,462.00 | 6 | 133 | 11 |

Log: `applying migration 0004_smart_hisab`, `applying migration 0005_trade_records`, no seeding. Afterwards the
Smart Hisab overview computed P&L for the old entries, and the dataset backfill created 5 trade records, all
classified `demo_marketplace` (not eligible).
