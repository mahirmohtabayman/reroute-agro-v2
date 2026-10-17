"""Phase 2: sign-up OTP stored in the database."""
import threading

from app import auth, db, settings
from tests.conftest import H, new_phone, register


def start(client, phone=None, role="farmer"):
    phone = phone or new_phone()
    r = client.post("/api/register", json={"role": role, "name": "নতুন কৃষক", "phone": phone, "password": "secret12",
                                           "confirm_password": "secret12", "place": "rajshahi", "upazila": "পবা",
                                           "market": "পবা বাজার"})
    assert r.status_code == 200, r.text
    return r.json(), phone


def verify(client, reg_id, otp):
    return client.post("/api/register/verify", json={"reg_id": reg_id, "otp": otp})


def wrong(otp):
    return f"{(int(otp) + 1) % 100000:05d}"


def test_farmer_and_paikar_registration(client):
    tok, u, _ = register(client, "farmer")
    assert u["role"] == "farmer" and u["id"].startswith("U")
    tok, u, _ = register(client, "paikar")
    assert u["role"] == "paikar" and u["biz"] == "পরীক্ষা আড়ত"
    assert client.get("/api/state", headers=H(tok)).json()["me"]["id"] == u["id"]


def test_code_is_stored_hashed_not_plain(client):
    j, phone = start(client)
    row = db.one("SELECT * FROM pending_registrations WHERE id=?", (j["reg_id"],))
    assert j["demo_otp"] not in row["otp_hash"] and j["demo_otp"] not in row["data"]
    assert "secret12" not in row["data"]                       # password only as a hash


def test_wrong_code_counts_attempts_then_locks(client):
    j, _ = start(client)
    for i in range(5):
        r = verify(client, j["reg_id"], wrong(j["demo_otp"]))
        assert r.status_code == 400
    assert db.val("SELECT attempts FROM pending_registrations WHERE id=?", (j["reg_id"],)) == 5
    assert verify(client, j["reg_id"], j["demo_otp"]).status_code == 400      # locked even with the right code


def test_expired_code_rejected_and_resend_works(client):
    j, _ = start(client)
    db.run("UPDATE pending_registrations SET expires=? WHERE id=?", (auth.now_ms() - 1, j["reg_id"]))
    assert verify(client, j["reg_id"], j["demo_otp"]).status_code == 400
    r = client.post("/api/register/resend", json={"reg_id": j["reg_id"]})
    assert r.status_code == 200
    new = r.json()["demo_otp"]
    assert verify(client, j["reg_id"], new).status_code == 200


def test_old_code_invalid_after_resend(client):
    j, _ = start(client)
    new = client.post("/api/register/resend", json={"reg_id": j["reg_id"]}).json()["demo_otp"]
    if new != j["demo_otp"]:
        assert verify(client, j["reg_id"], j["demo_otp"]).status_code == 400
    assert verify(client, j["reg_id"], new).status_code == 200


def test_resend_limit(client):
    j, _ = start(client)
    for _ in range(auth.OTP_MAX_RESENDS):
        assert client.post("/api/register/resend", json={"reg_id": j["reg_id"]}).status_code == 200
    assert client.post("/api/register/resend", json={"reg_id": j["reg_id"]}).status_code == 400


def test_used_code_cannot_be_replayed(client):
    j, _ = start(client)
    assert verify(client, j["reg_id"], j["demo_otp"]).status_code == 200
    assert verify(client, j["reg_id"], j["demo_otp"]).status_code == 400


def test_duplicate_phone_rejected(client):
    _, _, phone = register(client)
    r = client.post("/api/register", json={"role": "paikar", "name": "আরেকজন", "phone": phone, "password": "secret12",
                                           "confirm_password": "secret12", "place": "dhaka", "upazila": "মিরপুর",
                                           "market": "মিরপুর"})
    assert r.status_code == 409


def test_equivalent_phone_formats_are_the_same_number(client):
    _, _, phone = register(client)
    r = client.post("/api/register", json={"role": "farmer", "name": "আরেকজন", "phone": "+88 " + phone,
                                           "password": "secret12", "confirm_password": "secret12", "place": "dhaka",
                                           "upazila": "মিরপুর", "market": "মিরপুর"})
    assert r.status_code == 409


def test_two_pending_signups_for_one_phone_only_one_account(client):
    phone = new_phone()
    a, _ = start(client, phone)
    b, _ = start(client, phone)                 # the second start replaces the first
    assert verify(client, a["reg_id"], a["demo_otp"]).status_code == 400
    assert verify(client, b["reg_id"], b["demo_otp"]).status_code == 200
    assert db.val("SELECT COUNT(*) FROM users WHERE phone=?", (phone,)) == 1


def test_concurrent_verification_creates_one_account(client):
    j, phone = start(client)
    codes = []

    def go():
        codes.append(verify(client, j["reg_id"], j["demo_otp"]).status_code)
    ts = [threading.Thread(target=go) for _ in range(6)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert sorted(codes).count(200) == 1
    assert db.val("SELECT COUNT(*) FROM users WHERE phone=?", (phone,)) == 1


def test_pending_registration_survives_restart(client):
    """The pending sign-up lives in the database, not in process memory: a new process (simulated by not
    using any in-memory state) can verify it."""
    j, phone = start(client)
    assert not hasattr(auth, "_pending")
    assert db.one("SELECT id FROM pending_registrations WHERE id=?", (j["reg_id"],))
    assert verify(client, j["reg_id"], j["demo_otp"]).status_code == 200


def test_code_not_returned_and_signup_closed_without_demo_mode(client, monkeypatch):
    monkeypatch.setattr(settings, "DEMO_MODE", False)
    r = client.post("/api/register", json={"role": "farmer", "name": "নতুন", "phone": new_phone(), "password": "secret12",
                                           "confirm_password": "secret12", "place": "rajshahi", "upazila": "পবা",
                                           "market": "পবা বাজার"})
    assert r.status_code == 503 and "demo_otp" not in r.text


def test_code_not_written_to_logs(client, caplog):
    caplog.set_level("DEBUG")
    j, _ = start(client)
    verify(client, j["reg_id"], j["demo_otp"])
    assert j["demo_otp"] not in caplog.text


def test_signup_rate_limited_per_phone(client):
    phone = new_phone()
    for _ in range(5):
        start(client, phone)
    r = client.post("/api/register", json={"role": "farmer", "name": "নতুন", "phone": phone, "password": "secret12",
                                           "confirm_password": "secret12", "place": "rajshahi", "upazila": "পবা",
                                           "market": "পবা বাজার"})
    assert r.status_code == 429
