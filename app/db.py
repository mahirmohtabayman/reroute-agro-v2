"""Database: PostgreSQL when DATABASE_URL is set (required in production), otherwise SQLite for local development.

All access goes through one connection guarded by a re-entrant lock. Mutating requests run inside `tx()`: one
transaction, rolled back on any error, and on PostgreSQL also serialised across processes with an advisory lock,
so check-then-update sequences (stock, wallet, payment status) cannot interleave.
Schema changes are versioned migrations (see MIGRATIONS and DATABASE_MIGRATIONS.md). Demo data lives in app/seed.py.
"""
import logging
import os
import re
import sqlite3
import threading
import time
from contextlib import contextmanager
from pathlib import Path

from app import settings

log = logging.getLogger("reroute.db")

DB_PATH = Path(os.environ.get("DB_PATH", Path(__file__).resolve().parents[1] / "data" / "reroute.db"))
_lock = threading.RLock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, role TEXT, name TEXT, biz TEXT, phone TEXT UNIQUE, place TEXT,
  area TEXT, photo TEXT, verified INTEGER DEFAULT 0, joined INTEGER, pts INTEGER DEFAULT 0, wallet REAL DEFAULT 0,
  fee_credit REAL DEFAULT 0, transport_credit REAL DEFAULT 0, plus_until INTEGER DEFAULT 0, plus_cancelled INTEGER DEFAULT 0,
  market TEXT, pw_hash TEXT);
CREATE TABLE IF NOT EXISTS stock (uid TEXT, crop TEXT, qty REAL DEFAULT 0, cost REAL, PRIMARY KEY (uid, crop));
CREATE TABLE IF NOT EXISTS listings (id TEXT PRIMARY KEY, uid TEXT, crop TEXT, qty_total REAL, available REAL,
  reserved REAL DEFAULT 0, sold REAL DEFAULT 0, price REAL, moq REAL, grade TEXT, quality TEXT, harvest INTEGER,
  shelf INTEGER, photos TEXT DEFAULT '[]', status TEXT, created INTEGER, updated INTEGER, urgent REAL DEFAULT 0,
  alert_low INTEGER DEFAULT 0, alert_spoil INTEGER DEFAULT 0, prod_cost REAL);
CREATE TABLE IF NOT EXISTS offers (id TEXT PRIMARY KEY, listing TEXT, buyer TEXT, seller TEXT, crop TEXT, qty REAL,
  price REAL, listed_price REAL, status TEXT, waiting TEXT, transport TEXT, split TEXT, note TEXT, created INTEGER,
  updated INTEGER, expires INTEGER, order_id TEXT, reason TEXT);
CREATE TABLE IF NOT EXISTS offer_events (id TEXT PRIMARY KEY, offer TEXT, "by" TEXT, action TEXT, price REAL, at INTEGER, note TEXT);
CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, offer TEXT, listing TEXT, buyer TEXT, seller TEXT, crop TEXT,
  qty REAL, price REAL, listed_price REAL, goods REAL, fee REAL, fee_disc REAL DEFAULT 0, transport TEXT, split TEXT,
  booking TEXT, t_total REAL DEFAULT 0, t_buyer REAL DEFAULT 0, t_seller REAL DEFAULT 0, t_cb REAL DEFAULT 0,
  t_cs REAL DEFAULT 0, buyer_total REAL, payout REAL, cashback REAL DEFAULT 0, cost_basis REAL, status TEXT,
  created INTEGER, paid_at INTEGER, handover_at INTEGER, completed_at INTEGER, cancelled_at INTEGER,
  cancelled_by TEXT, reason TEXT, payment TEXT);
CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, uid TEXT, order_id TEXT, pickup_place TEXT, pickup_addr TEXT,
  drop_place TEXT, drop_addr TEXT, crop TEXT, qty REAL, vehicle TEXT, trucks_n INTEGER, km REAL, eta REAL, fare REAL,
  service REAL, commission REAL, total REAL, offline REAL, credit_used REAL DEFAULT 0, status TEXT, truck TEXT,
  pickup_time TEXT, priority INTEGER DEFAULT 0, paid INTEGER DEFAULT 0, created INTEGER, updated INTEGER,
  actual_fare REAL, payout REAL, date TEXT);
CREATE TABLE IF NOT EXISTS booking_events (id TEXT PRIMARY KEY, booking TEXT, status TEXT, note TEXT, at INTEGER);
CREATE TABLE IF NOT EXISTS trucks (id TEXT PRIMARY KEY, company TEXT, driver TEXT, phone TEXT, number TEXT,
  vehicle TEXT, place TEXT, areas TEXT, status TEXT, trips INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS inspections (id TEXT PRIMARY KEY, listing TEXT, buyer TEXT, seller TEXT, kind TEXT,
  pref TEXT, note TEXT, status TEXT, reply TEXT, created INTEGER, updated INTEGER,
  proposed_time TEXT, confirmed_time TEXT, buyer_confirmed_at INTEGER,
  buyer_done_at INTEGER, seller_verified_at INTEGER, scheduled_at INTEGER);
CREATE TABLE IF NOT EXISTS transport_negotiations (id TEXT PRIMARY KEY, order_id TEXT, buyer TEXT, seller TEXT,
  t_total REAL, status TEXT, agreed_buyer_pct REAL, agreed_seller_pct REAL,
  agreed_buyer_amt REAL, agreed_seller_amt REAL,
  created INTEGER, updated INTEGER, version INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS transport_proposals (id TEXT PRIMARY KEY, negotiation TEXT, proposer TEXT, recipient TEXT,
  buyer_pct REAL, seller_pct REAL, buyer_amt REAL, seller_amt REAL,
  status TEXT, note TEXT, created INTEGER, version INTEGER);
CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, uid TEXT, purpose TEXT, ref TEXT, amount REAL, method TEXT,
  status TEXT, created INTEGER, verified_at INTEGER, txn TEXT, message TEXT);
CREATE TABLE IF NOT EXISTS wallet_tx (id TEXT PRIMARY KEY, uid TEXT, amount REAL, kind TEXT, ref TEXT, note TEXT, at INTEGER);
CREATE TABLE IF NOT EXISTS points_tx (id TEXT PRIMARY KEY, uid TEXT, pts INTEGER, kind TEXT, ref TEXT, note TEXT, at INTEGER);
CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, uid TEXT, kind TEXT, crop TEXT, qty REAL, amount REAL,
  cost_basis REAL, note TEXT, at INTEGER);
CREATE TABLE IF NOT EXISTS notifs (id TEXT PRIMARY KEY, "to" TEXT, text TEXT, kind TEXT, link TEXT, at INTEGER,
  read INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS ratings (id TEXT PRIMARY KEY, order_id TEXT, "from" TEXT, "to" TEXT, stars INTEGER,
  text TEXT, at INTEGER);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, val TEXT);
"""

TABLES = ["meta", "users", "stock", "listings", "offers", "offer_events", "orders", "bookings", "booking_events", "trucks",
          "inspections", "transport_negotiations", "transport_proposals", "payments", "wallet_tx", "points_tx", "entries", "notifs", "ratings",
          "auth_sessions", "rate_hits", "pending_registrations"]

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
PG = DATABASE_URL.startswith(("postgres://", "postgresql://"))
if settings.IS_PROD and not PG:
    raise settings.ConfigError("DATABASE_URL is missing or is not a PostgreSQL URL. Production never falls back to a "
                               "temporary SQLite file. Set DATABASE_URL to your Neon connection string (with sslmode=require).")

if PG:
    import psycopg
    from psycopg.rows import dict_row
    from decimal import Decimal

ADVISORY_KEY = 4_242_017      # one application-wide write lock on PostgreSQL


def _pg_sql(sql):
    sql = sql.replace("?", "%s")
    sql = re.sub(r"\bMAX\(0,", "GREATEST(0,", sql)
    return sql


def _pg_types(sql):
    return sql.replace("INTEGER", "BIGINT").replace("REAL", "DOUBLE PRECISION")


def connect():
    if PG:
        return psycopg.connect(DATABASE_URL, autocommit=True, row_factory=dict_row, connect_timeout=15,
                               prepare_threshold=None, application_name="reroute-agro")
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    # isolation_level=None: no implicit transactions; tx() issues BEGIN/COMMIT itself
    con = sqlite3.connect(DB_PATH, check_same_thread=False, isolation_level=None, timeout=15)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=OFF")
    return con


CON = connect()
_depth = 0          # > 0 while a transaction is open (only touched by the thread holding _lock)


def _clean(row):
    return {k: (float(v) if PG and isinstance(v, Decimal) else v) for k, v in dict(row).items()}


def _execute(sql, args=()):
    """Run one statement. Outside a transaction a dropped PostgreSQL connection (Neon suspends idle computes)
    is reopened once; inside a transaction the error is raised so the whole transaction is rolled back."""
    global CON
    if PG:
        for attempt in (1, 2):
            try:
                cur = CON.cursor()
                cur.execute(_pg_sql(sql), args)
                return cur
            except (psycopg.OperationalError, psycopg.InterfaceError):
                if attempt == 2 or _depth:
                    raise
                log.warning("database connection lost, reconnecting")
                try:
                    CON.close()
                except Exception:
                    pass
                CON = connect()
    return CON.execute(sql, args)


@contextmanager
def tx():
    """One atomic unit of work. Nested calls join the outer transaction."""
    global _depth
    with _lock:
        if _depth:
            _depth += 1
            try:
                yield
            finally:
                _depth -= 1
            return
        _execute("BEGIN" if PG else "BEGIN IMMEDIATE")
        _depth = 1
        try:
            if PG:
                _execute("SELECT pg_advisory_xact_lock(?)", (ADVISORY_KEY,))
            yield
            _execute("COMMIT")
        except BaseException:
            try:
                _execute("ROLLBACK")
            except Exception:
                log.exception("rollback failed")
            raise
        finally:
            _depth = 0


def q(sql, args=()):
    with _lock:
        cur = _execute(sql, args)
        return [_clean(r) for r in cur.fetchall()]


def one(sql, args=()):
    rows = q(sql, args)
    return rows[0] if rows else None


def val(sql, args=()):
    rows = q(sql, args)
    return next(iter(rows[0].values())) if rows else None


def run(sql, args=()):
    """Execute a write; returns the number of affected rows."""
    with _lock:
        return _execute(sql, args).rowcount


def insert(table, row):
    cols = ",".join(f'"{c}"' for c in row)
    run(f"INSERT INTO {table} ({cols}) VALUES ({','.join('?' * len(row))})", tuple(row.values()))


def update(table, rid, **fields):
    sets = ",".join(f'"{k}"=?' for k in fields)
    return run(f"UPDATE {table} SET {sets} WHERE id=?", (*fields.values(), rid))


def set_meta(key, value):
    if PG:
        run("INSERT INTO meta (key, val) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET val=EXCLUDED.val", (key, str(value)))
    else:
        run("INSERT OR REPLACE INTO meta (key, val) VALUES (?, ?)", (key, str(value)))


def get_meta(key):
    return val("SELECT val FROM meta WHERE key=?", (key,))


def now_ms():
    return int(time.time() * 1000)


# ---------------------------------------------------------------- migrations
def columns(table):
    if PG:
        return {r["column_name"] for r in q("SELECT column_name FROM information_schema.columns "
                                             "WHERE table_schema=current_schema() AND table_name=?", (table,))}
    return {r["name"] for r in q(f"PRAGMA table_info({table})")}


def add_column(table, col, typ):
    """ALTER TABLE … ADD COLUMN only when the column is missing (idempotent on both databases)."""
    if col not in columns(table):
        run(f"ALTER TABLE {table} ADD COLUMN {col} {_pg_types(typ) if PG else typ}")


def _create(sql):
    for stmt in [x.strip() for x in sql.split(";") if x.strip()]:
        run(_pg_types(stmt) if PG else stmt)


def _m0001_legacy_columns():
    """Columns added before versioned migrations existed (schema versions 1–8)."""
    for col in ("proposed_time TEXT", "confirmed_time TEXT", "buyer_confirmed_at INTEGER", "buyer_done_at INTEGER",
                "seller_verified_at INTEGER", "scheduled_at INTEGER"):
        add_column("inspections", *col.split())
    add_column("users", "market", "TEXT")
    add_column("users", "pw_hash", "TEXT")


def _m0002_auth_tables():
    _create("""
    CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY, uid TEXT NOT NULL, created INTEGER NOT NULL,
      expires INTEGER NOT NULL, last_seen INTEGER);
    CREATE INDEX IF NOT EXISTS auth_sessions_uid ON auth_sessions (uid);
    CREATE TABLE IF NOT EXISTS rate_hits (key TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS rate_hits_key_at ON rate_hits (key, at);
    CREATE TABLE IF NOT EXISTS pending_registrations (id TEXT PRIMARY KEY, phone TEXT NOT NULL, role TEXT NOT NULL,
      data TEXT NOT NULL, otp_hash TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
      resends INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, consumed_at INTEGER);
    CREATE INDEX IF NOT EXISTS pending_registrations_phone ON pending_registrations (phone)
    """)


def _m0003_indexes():
    _create("""
    CREATE INDEX IF NOT EXISTS listings_uid ON listings (uid);
    CREATE INDEX IF NOT EXISTS listings_status ON listings (status);
    CREATE INDEX IF NOT EXISTS offers_buyer ON offers (buyer);
    CREATE INDEX IF NOT EXISTS offers_seller ON offers (seller);
    CREATE INDEX IF NOT EXISTS offer_events_offer ON offer_events (offer);
    CREATE INDEX IF NOT EXISTS orders_buyer ON orders (buyer);
    CREATE INDEX IF NOT EXISTS orders_seller ON orders (seller);
    CREATE INDEX IF NOT EXISTS bookings_uid ON bookings (uid);
    CREATE INDEX IF NOT EXISTS bookings_order ON bookings (order_id);
    CREATE INDEX IF NOT EXISTS booking_events_booking ON booking_events (booking);
    CREATE INDEX IF NOT EXISTS payments_uid ON payments (uid);
    CREATE INDEX IF NOT EXISTS payments_ref ON payments (ref);
    CREATE INDEX IF NOT EXISTS notifs_to ON notifs ("to");
    CREATE INDEX IF NOT EXISTS wallet_tx_uid ON wallet_tx (uid);
    CREATE INDEX IF NOT EXISTS inspections_listing ON inspections (listing);
    CREATE INDEX IF NOT EXISTS transport_negotiations_order ON transport_negotiations (order_id)
    """)


MIGRATIONS = [("0001_legacy_columns", _m0001_legacy_columns),
              ("0002_auth_tables", _m0002_auth_tables),
              ("0003_indexes", _m0003_indexes)]


def migrate():
    """Create missing tables and apply every migration not yet recorded in schema_migrations.
    Each migration runs in its own transaction and only adds things; nothing is dropped or rewritten."""
    _create(SCHEMA)
    _create("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at INTEGER)")
    done = {r["id"] for r in q("SELECT id FROM schema_migrations")}
    for mid, fn in MIGRATIONS:
        if mid in done:
            continue
        log.info("applying migration %s", mid)
        with tx():
            fn()
            run("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)", (mid, now_ms()))


def user_count():
    """Number of users. Raises on database errors — callers must never treat an error as "empty"."""
    return int(val("SELECT COUNT(*) FROM users") or 0)


def reset():
    """Drop and recreate every application table. Only app/seed.py calls this, and seed() refuses to run in
    production or on a database without demo mode (see seed.ensure_demo_allowed)."""
    with _lock:
        # plus tables left by older versions of the app
        for t in TABLES + ["sessions", "reqs", "lots", "stats", "schema_migrations"]:
            _execute(f"DROP TABLE IF EXISTS {t}")
    migrate()
