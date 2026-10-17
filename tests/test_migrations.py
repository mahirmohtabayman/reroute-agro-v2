"""Phase 3: migrating an existing database keeps its data and never seeds or resets it.

Runs the real server start-up path in a separate process against a database built with the previous release's
schema (version 8, no auth tables), with production-like settings.
"""
import os
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

from app import db

ROOT = Path(__file__).resolve().parents[1]

OLD_SCHEMA_EXTRA = "INSERT INTO meta (key, val) VALUES ('schema_version', '8')"


def legacy_sqlite(path):
    con = sqlite3.connect(path)
    con.executescript(db.SCHEMA)          # the v8 tables (identical column set to the previous release)
    con.execute(OLD_SCHEMA_EXTRA)
    con.execute("INSERT INTO users (id, role, name, phone, place, wallet, pw_hash) VALUES "
                "('Uold0001', 'farmer', 'পুরনো কৃষক', '01711112222', 'natore', 1234.5, 'x')")
    con.execute("INSERT INTO users (id, role, name, phone, place) VALUES ('f1', 'farmer', 'ডেমো', '01711452318', 'rajshahi')")
    con.execute("INSERT INTO orders (id, buyer, seller, crop, qty, status) VALUES ('Dold', 'p1', 'Uold0001', 'tomato', 400, 'completed')")
    con.commit()
    con.close()


def start_server_process(env):
    code = "import app.main"            # runs migrate() + seed.startup() exactly like the server
    return subprocess.run([sys.executable, "-c", code], cwd=ROOT, env=env, capture_output=True, text=True, timeout=300)


@pytest.mark.skipif(db.PG, reason="SQLite variant; the PostgreSQL run uses the same code path")
def test_upgrade_keeps_data_and_does_not_seed():
    tmp = tempfile.mkdtemp()
    path = os.path.join(tmp, "old.db")
    legacy_sqlite(path)
    env = {**os.environ, "DB_PATH": path, "APP_ENV": "development", "ENABLE_DEMO_MODE": "false"}
    env.pop("DATABASE_URL", None)
    r = start_server_process(env)
    assert r.returncode == 0, r.stderr[-2000:]
    con = sqlite3.connect(path)
    assert con.execute("SELECT wallet FROM users WHERE id='Uold0001'").fetchone()[0] == 1234.5
    assert con.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 2           # nothing seeded
    assert con.execute("SELECT COUNT(*) FROM orders").fetchone()[0] == 1
    tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"auth_sessions", "rate_hits", "pending_registrations", "schema_migrations"} <= tables
    # a second start applies nothing new and still changes nothing
    r = start_server_process(env)
    assert r.returncode == 0
    assert con.execute("SELECT COUNT(*) FROM schema_migrations").fetchone()[0] == len(db.MIGRATIONS)


def test_production_refuses_to_start_without_postgres_or_secret():
    env = {**os.environ, "APP_ENV": "production", "SECRET_KEY": "x" * 40}
    env.pop("DATABASE_URL", None)
    r = start_server_process(env)
    assert r.returncode != 0 and "DATABASE_URL" in r.stderr
    env = {**os.environ, "APP_ENV": "production", "DATABASE_URL": "postgresql://u@127.0.0.1:1/x"}
    env.pop("SECRET_KEY", None)
    r = start_server_process(env)
    assert r.returncode != 0 and "SECRET_KEY" in r.stderr


def test_render_without_app_env_counts_as_production():
    env = {**os.environ, "RENDER": "true", "SECRET_KEY": "x" * 40}
    env.pop("APP_ENV", None)
    env.pop("DATABASE_URL", None)
    r = start_server_process(env)
    assert r.returncode != 0 and "DATABASE_URL" in r.stderr


def test_literal_percent_in_sql_works(client):
    """`LIKE 'U%'` written inline (as in `manage status`) must work on PostgreSQL as well as SQLite."""
    from app import db
    assert db.val("SELECT COUNT(*) FROM users WHERE id LIKE 'U%' AND id LIKE ?", ("U%",)) >= 0
    assert db.val("SELECT '100%'") == "100%"
