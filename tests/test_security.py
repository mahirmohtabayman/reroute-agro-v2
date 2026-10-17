"""Phase 1: reset endpoint, demo/admin login, sessions, rate limits, images, headers."""
import base64

import pytest

from app import auth, db, seed as SEED, settings
from tests.conftest import ADMIN_PHONE, ADMIN_PW, H, admin_token, demo_token, register

# ---------------------------------------------------------------- reset & seeding


def test_reset_refused_for_anonymous_farmer_and_buyer(client):
    assert client.post("/api/reset").status_code == 401
    assert client.post("/api/reset", headers=H(demo_token(client, "f1"))).status_code == 403
    assert client.post("/api/reset", headers=H(demo_token(client, "p1"))).status_code == 403


def test_reset_refused_in_production_even_for_admin(client, monkeypatch):
    tok = admin_token(client)
    before = db.user_count()
    monkeypatch.setattr(settings, "IS_PROD", True)
    assert client.post("/api/reset", headers=H(tok)).status_code == 403
    assert db.user_count() == before


def test_seed_function_refuses_in_production_and_without_demo_mode(monkeypatch):
    monkeypatch.setattr(settings, "IS_PROD", True)
    with pytest.raises(RuntimeError):
        SEED.seed()
    monkeypatch.setattr(settings, "IS_PROD", False)
    monkeypatch.setattr(settings, "DEMO_MODE", False)
    with pytest.raises(RuntimeError):
        SEED.seed()


def test_startup_never_seeds_a_database_that_has_users(monkeypatch):
    called = []
    monkeypatch.setattr(SEED, "seed", lambda: called.append(1))
    SEED.startup()
    assert not called


def test_startup_does_not_treat_a_database_error_as_empty(monkeypatch):
    called = []
    monkeypatch.setattr(SEED, "seed", lambda: called.append(1))

    def broken():
        raise RuntimeError("connection lost")
    monkeypatch.setattr(db, "user_count", broken)
    with pytest.raises(RuntimeError):
        SEED.startup()
    assert not called


def test_startup_does_not_seed_production_even_if_empty(monkeypatch):
    called = []
    monkeypatch.setattr(SEED, "seed", lambda: called.append(1))
    monkeypatch.setattr(SEED, "set_demo_passwords", lambda: None)
    monkeypatch.setattr(db, "user_count", lambda: 0)
    monkeypatch.setattr(settings, "IS_PROD", True)
    SEED.startup()
    assert not called


def test_demo_mode_off_removes_demo_admin_password(client, monkeypatch):
    monkeypatch.setattr(settings, "DEMO_MODE", False)
    SEED.set_demo_passwords()
    assert db.val("SELECT pw_hash FROM users WHERE id='a1'") is None
    r = client.post("/api/login", json={"phone": ADMIN_PHONE, "password": ADMIN_PW, "role": "admin"})
    assert r.status_code == 401
    monkeypatch.setattr(settings, "DEMO_MODE", True)
    SEED.set_demo_passwords()
    assert admin_token(client)


def test_demo_works_in_production_by_default(client, monkeypatch):
    """Hackathon default: on Render (production) with no extra settings, judges get demo accounts and the
    on-screen prototype OTP; seeding and reset stay forbidden."""
    import subprocess, sys, os
    env = {k: v for k, v in os.environ.items() if k not in ("ENABLE_DEMO_MODE", "APP_ENV")}
    env["RENDER"] = "true"
    out = subprocess.run([sys.executable, "-c", "from app import settings; print(settings.IS_PROD, settings.DEMO_MODE)"],
                         env=env, capture_output=True, text=True, cwd=os.path.dirname(os.path.dirname(__file__)))
    assert out.stdout.split() == ["True", "True"], out.stderr[-500:]
    monkeypatch.setattr(settings, "IS_PROD", True)
    assert client.post("/api/login", json={"user_id": "f1"}).status_code == 200
    from tests.conftest import new_phone
    r = client.post("/api/register", json={"role": "farmer", "name": "বিচারক", "phone": new_phone(), "password": "secret12",
                                           "confirm_password": "secret12", "place": "rajshahi", "upazila": "পবা",
                                           "market": "পবা বাজার"})
    assert r.status_code == 200 and len(r.json()["demo_otp"]) == 5
    assert client.post("/api/register/verify", json={"reg_id": r.json()["reg_id"], "otp": r.json()["demo_otp"]}).status_code == 200
    assert client.post("/api/reset", headers=H(admin_token(client))).status_code == 403


def test_demo_auto_refresh_is_off_by_default():
    assert settings.DEMO_AUTO_REFRESH is False

# ---------------------------------------------------------------- login


def test_admin_has_no_one_click_login(client):
    assert client.post("/api/login", json={"user_id": "a1"}).status_code == 404


def test_admin_public_demo_password_rejected(client):
    r = client.post("/api/login", json={"phone": ADMIN_PHONE, "password": "123456", "role": "admin"})
    assert r.status_code == 401


def test_admin_password_login_works(client):
    assert admin_token(client)
    # works whichever role tab was selected on the login page
    r = client.post("/api/login", json={"phone": ADMIN_PHONE, "password": ADMIN_PW, "role": "farmer"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "admin"


def test_demo_login_disabled_without_demo_mode(client, monkeypatch):
    tok = demo_token(client, "f1")
    monkeypatch.setattr(settings, "DEMO_MODE", False)
    assert client.post("/api/login", json={"user_id": "f1"}).status_code == 403
    r = client.post("/api/login", json={"phone": "01711452318", "password": "123456", "role": "farmer"})
    assert r.status_code == 401
    # an existing demo session stops working too
    assert client.get("/api/state", headers=H(tok)).json()["me"] is None


def test_registered_account_cannot_use_one_click_login(client):
    _, u, _ = register(client)
    assert client.post("/api/login", json={"user_id": u["id"]}).status_code == 404


def test_role_in_payload_does_not_grant_admin(client):
    _, u, phone = register(client)
    # the role sent by the login page is ignored: the account keeps its real role
    r = client.post("/api/login", json={"phone": phone, "password": "secret12", "role": "admin"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "farmer"
    tok = r.json()["token"]
    assert client.post(f"/api/admin/users/{u['id']}/verify", headers=H(tok)).status_code == 403
    assert client.get("/api/ai/advisor/admin/transactions", headers=H(tok)).status_code == 403
    # profile edits cannot change role
    client.post("/api/me", json={"role": "admin", "name": "নাম বদল"}, headers=H(tok))
    assert db.val("SELECT role FROM users WHERE id=?", (u["id"],)) == "farmer"


def test_login_accepts_international_phone_format(client):
    _, _, phone = register(client)
    r = client.post("/api/login", json={"phone": "+88" + phone, "password": "secret12", "role": "farmer"})
    assert r.status_code == 200

# ---------------------------------------------------------------- sessions


def test_forged_old_style_token_rejected(client):
    import hashlib
    import hmac
    forged = base64.urlsafe_b64encode(b"a1").decode() + "." + hmac.new(
        b"reroute-agro-demo-secret", b"a1", hashlib.sha256).hexdigest()[:32]
    assert client.get("/api/state", headers=H(forged)).json()["me"] is None
    assert client.post("/api/admin/trucks", json={}, headers=H(forged)).status_code == 401


def test_session_is_stored_hashed_and_expires(client):
    tok, u, _ = register(client)
    assert db.one("SELECT id FROM auth_sessions WHERE id=?", (tok,)) is None      # never the raw token
    db.run("UPDATE auth_sessions SET expires=? WHERE uid=?", (auth.now_ms() - 1, u["id"]))
    r = client.post("/api/me", json={"name": "নতুন নাম"}, headers=H(tok))
    assert r.status_code == 401


def test_logout_revokes_token(client):
    tok, _, _ = register(client)
    assert client.post("/api/logout", headers=H(tok)).status_code == 200
    assert client.get("/api/state", headers=H(tok)).json()["me"] is None


def test_password_change_revokes_other_sessions(client):
    tok1, _, phone = register(client)
    tok2 = client.post("/api/login", json={"phone": phone, "password": "secret12", "role": "farmer"}).json()["token"]
    r = client.post("/api/me/password", json={"current_password": "secret12", "new_password": "newpass99",
                                              "confirm_password": "newpass99"}, headers=H(tok1))
    assert r.status_code == 200
    assert client.get("/api/state", headers=H(tok1)).json()["me"] is not None
    assert client.get("/api/state", headers=H(tok2)).json()["me"] is None


def test_admin_password_reset_revokes_all_sessions(client):
    tok, u, phone = register(client)
    r = client.post(f"/api/admin/users/{u['id']}/reset-password", headers=H(admin_token(client)))
    temp = r.json()["temp_password"]
    assert client.get("/api/state", headers=H(tok)).json()["me"] is None
    assert client.post("/api/login", json={"phone": phone, "password": temp, "role": "farmer"}).status_code == 200

# ---------------------------------------------------------------- rate limits


def test_login_failures_are_rate_limited_per_phone(client):
    _, _, phone = register(client)
    for _ in range(10):
        assert client.post("/api/login", json={"phone": phone, "password": "wrong", "role": "farmer"}).status_code == 401
    r = client.post("/api/login", json={"phone": phone, "password": "secret12", "role": "farmer"})
    assert r.status_code == 429


def test_successful_logins_do_not_count_towards_the_limit(client):
    _, _, phone = register(client)
    for _ in range(15):
        assert client.post("/api/login", json={"phone": phone, "password": "secret12", "role": "farmer"}).status_code == 200


def test_rate_limit_survives_restart_because_it_is_in_the_database(client):
    auth.hit("login-fail-phone:01999999999")
    assert db.val("SELECT COUNT(*) FROM rate_hits WHERE key=?", ("login-fail-phone:01999999999",)) == 1


def test_forgot_password_generic_and_limited(client):
    _, _, phone = register(client)
    a = client.post("/api/password/forgot", json={"phone": phone}).json()
    b = client.post("/api/password/forgot", json={"phone": "01999999998"}).json()
    assert a == b
    client.post("/api/password/forgot", json={"phone": phone})
    client.post("/api/password/forgot", json={"phone": phone})
    assert client.post("/api/password/forgot", json={"phone": phone}).status_code == 429

# ---------------------------------------------------------------- images & headers


def _data_url(mime, raw):
    return f"data:{mime};base64," + base64.b64encode(raw).decode()


def test_svg_and_fake_images_refused(client):
    tok, _, _ = register(client)
    svg = _data_url("image/svg+xml", b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    assert client.post("/api/me", json={"photo": svg}, headers=H(tok)).status_code == 400
    fake = _data_url("image/png", b"<html><script>alert(1)</script></html>")
    assert client.post("/api/me", json={"photo": fake}, headers=H(tok)).status_code == 400


def test_real_png_accepted_and_served_safely(client):
    tok, u, _ = register(client)
    png = _data_url("image/png", b"\x89PNG\r\n\x1a\n" + b"\0" * 64)
    assert client.post("/api/me", json={"photo": png}, headers=H(tok)).status_code == 200
    r = client.get(f"/api/users/{u['id']}/photo")
    assert r.headers["content-type"] == "image/png"
    assert r.headers["x-content-type-options"] == "nosniff"


def test_previously_stored_svg_is_not_served(client):
    _, u, _ = register(client)
    db.run("UPDATE users SET photo=? WHERE id=?", (_data_url("image/svg+xml", b"<svg/>"), u["id"]))
    assert client.get(f"/api/users/{u['id']}/photo").status_code == 404


def test_security_headers_present(client):
    r = client.get("/api/health")
    for h in ("x-content-type-options", "x-frame-options", "content-security-policy", "referrer-policy"):
        assert h in r.headers


def test_oversized_request_rejected(client):
    r = client.post("/api/me", content=b"x" * (settings.MAX_BODY_BYTES + 1),
                    headers={"Content-Type": "application/json"})
    assert r.status_code == 413


def test_no_wildcard_cors(client):
    r = client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in r.headers
