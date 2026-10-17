"""Test set-up. Every run uses its own throw-away database:
  * default: a temporary SQLite file;
  * TEST_DATABASE_URL=postgresql://… : a PostgreSQL database that the tests may wipe (never production).
The application is configured as a development deployment with demo mode on; individual tests switch
settings (e.g. production, demo mode off) with monkeypatch.
"""
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

_tmp = os.environ.get("_REROUTE_TEST_TMP") or tempfile.mkdtemp(prefix="reroute-test-")
os.environ["_REROUTE_TEST_TMP"] = _tmp
os.environ.pop("RENDER", None)
os.environ.update({"APP_ENV": "development", "ENABLE_DEMO_MODE": "true", "DB_PATH": os.path.join(_tmp, "test.db"),
                   "SECRET_KEY": "test-secret-key-0123456789-abcdefghijklmnop", "DEMO_ADMIN_PASSWORD": "admin-pass-123",
                   "TRUSTED_PROXIES": "0"})
if os.environ.get("TEST_DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
else:
    os.environ.pop("DATABASE_URL", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import db  # noqa: E402

if db.PG and not os.environ.get("_REROUTE_TEST_DB_EMPTIED"):
    # start from an empty schema so the start-up path (migrate + seed) is exercised; once per run, because
    # pytest imports this file as "conftest" and the tests import it again as "tests.conftest"
    os.environ["_REROUTE_TEST_DB_EMPTIED"] = "1"
    for t in db.TABLES + ["schema_migrations"]:
        db.run(f"DROP TABLE IF EXISTS {t}")

from app import auth, seed as SEED, settings  # noqa: E402
from app.main import app  # noqa: E402

ADMIN_PHONE, ADMIN_PW = "01300000000", "admin-pass-123"


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture()
def fresh():
    """Rebuild the demo data and clear rate limits before a test that needs a known state."""
    SEED.seed()
    db.run("DELETE FROM rate_hits")


@pytest.fixture(autouse=True)
def _clear_limits():
    db.run("DELETE FROM rate_hits")
    yield


def demo_token(client, uid):
    r = client.post("/api/login", json={"user_id": uid})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def admin_token(client):
    r = client.post("/api/login", json={"phone": ADMIN_PHONE, "password": ADMIN_PW, "role": "admin"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def H(token):
    return {"X-Token": token}


_n = [0]


def new_phone():
    _n[0] += 1
    return f"0171{os.getpid() % 1000:03d}{_n[0]:04d}"


def register(client, role="farmer", phone=None, password="secret12"):
    """Complete sign-up through the real OTP endpoints; returns (token, user, phone)."""
    phone = phone or new_phone()
    r = client.post("/api/register", json={"role": role, "name": "পরীক্ষা ব্যবহারকারী", "phone": phone,
                                           "password": password, "confirm_password": password, "place": "natore",
                                           "upazila": "লালপুর", "market": "লালপুর বাজার",
                                           "biz": "পরীক্ষা আড়ত" if role == "paikar" else None})
    assert r.status_code == 200, r.text
    j = r.json()
    v = client.post("/api/register/verify", json={"reg_id": j["reg_id"], "otp": j["demo_otp"]})
    assert v.status_code == 200, v.text
    return v.json()["token"], v.json()["user"], phone
