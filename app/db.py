"""SQLite database: schema and small helpers. Demo data lives in app/seed.py."""
import os
import sqlite3
import threading
import time
from pathlib import Path

DB_PATH = Path(os.environ.get("DB_PATH", Path(__file__).resolve().parents[1] / "data" / "reroute.db"))
_lock = threading.RLock()
SCHEMA_VERSION = 6

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, role TEXT, name TEXT, biz TEXT, phone TEXT UNIQUE, place TEXT,
  area TEXT, photo TEXT, verified INTEGER DEFAULT 0, joined INTEGER, pts INTEGER DEFAULT 0, wallet REAL DEFAULT 0,
  fee_credit REAL DEFAULT 0, transport_credit REAL DEFAULT 0, plus_until INTEGER DEFAULT 0, plus_cancelled INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS stock (uid TEXT, crop TEXT, qty REAL DEFAULT 0, cost REAL, PRIMARY KEY (uid, crop));
CREATE TABLE IF NOT EXISTS listings (id TEXT PRIMARY KEY, uid TEXT, crop TEXT, qty_total REAL, available REAL,
  reserved REAL DEFAULT 0, sold REAL DEFAULT 0, price REAL, moq REAL, grade TEXT, quality TEXT, harvest INTEGER,
  shelf INTEGER, photos TEXT DEFAULT '[]', status TEXT, created INTEGER, updated INTEGER, urgent REAL DEFAULT 0,
  alert_low INTEGER DEFAULT 0, alert_spoil INTEGER DEFAULT 0, prod_cost REAL);
CREATE TABLE IF NOT EXISTS offers (id TEXT PRIMARY KEY, listing TEXT, buyer TEXT, seller TEXT, crop TEXT, qty REAL,
  price REAL, listed_price REAL, status TEXT, waiting TEXT, transport TEXT, split TEXT, note TEXT, created INTEGER,
  updated INTEGER, expires INTEGER, order_id TEXT, reason TEXT);
CREATE TABLE IF NOT EXISTS offer_events (id TEXT PRIMARY KEY, offer TEXT, by TEXT, action TEXT, price REAL, at INTEGER, note TEXT);
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
  pref TEXT, note TEXT, status TEXT, reply TEXT, created INTEGER, updated INTEGER);
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
          "inspections", "payments", "wallet_tx", "points_tx", "entries", "notifs", "ratings"]


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con


CON = connect()


def q(sql, args=()):
    with _lock:
        return [dict(r) for r in CON.execute(sql, args).fetchall()]


def one(sql, args=()):
    rows = q(sql, args)
    return rows[0] if rows else None


def val(sql, args=()):
    with _lock:
        r = CON.execute(sql, args).fetchone()
        return r[0] if r else None


def run(sql, args=()):
    with _lock:
        CON.execute(sql, args)
        CON.commit()


def insert(table, row):
    cols = ",".join(f'"{c}"' for c in row)
    run(f"INSERT INTO {table} ({cols}) VALUES ({','.join('?' * len(row))})", tuple(row.values()))


def update(table, rid, **fields):
    sets = ",".join(f'"{k}"=?' for k in fields)
    run(f"UPDATE {table} SET {sets} WHERE id=?", (*fields.values(), rid))


def now_ms():
    return int(time.time() * 1000)


def reset():
    """Drop and recreate every table."""
    with _lock:
        for t in TABLES + ["sessions", "reqs", "lots", "stats"]:
            CON.execute(f"DROP TABLE IF EXISTS {t}")
        CON.executescript(SCHEMA)
        CON.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        CON.commit()


def needs_seed():
    with _lock:
        if CON.execute("PRAGMA user_version").fetchone()[0] != SCHEMA_VERSION:
            return True
        try:
            return CON.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
        except sqlite3.OperationalError:
            return True
