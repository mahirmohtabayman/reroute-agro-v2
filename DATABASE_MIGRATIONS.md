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

The old `meta.schema_version = 8` row is left in place and no longer used.

## Upgrade steps (Neon production)
1. **Back up first** (Neon console → your project → *Branches* → *Create branch* from `main`; a branch is an
   instant copy you can restore from). Alternatively `pg_dump "$DATABASE_URL" > backup.sql`.
2. Optional dry run on the branch: point a local checkout at the branch URL and run
   `APP_ENV=production SECRET_KEY=<any 32+ chars> DATABASE_URL=<branch url> python -m app.manage status`.
   It applies the migrations to the branch only and prints the account counts, so you can compare.
3. Deploy the new code. The first start applies the three migrations (a few seconds).
4. Check the log for `applying migration 0001_legacy_columns` … and no errors; `GET /api/health` returns `{"ok":true}`.

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
- Full restore: Neon console → *Restore* the branch created in step 1.

## Adding a migration
1. Write a function in `app/db.py` that only adds things (use `add_column`, `CREATE … IF NOT EXISTS`).
2. Append `("000N_name", function)` to `MIGRATIONS`. Never edit or reorder an applied migration.
3. Add a test (see `tests/test_migrations.py`) that upgrades an old-format database and checks data is kept.
4. Inspect production data before adding any constraint (e.g. `UNIQUE`) that existing rows might violate.
