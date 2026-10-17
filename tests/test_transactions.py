"""Phase 3: marketplace, payments, wallet and logistics integrity."""
import threading

import pytest

from app import db, services as S
from tests.conftest import H, admin_token, register


def listing(client, tok, qty=1000, price=30, moq=200, crop="tomato"):
    r = client.post("/api/listings", json={"crop": crop, "qty": qty, "price": price, "moq": moq, "grade": "A",
                                           "quality": "ভালো", "harvest_days_ago": 0, "photos": []}, headers=H(tok))
    assert r.status_code == 200, r.text
    return r.json()


def offer(client, tok, lid, qty=200, price=30, transport="self"):
    r = client.post("/api/offers", json={"listing": lid, "qty": qty, "price": price, "transport": transport,
                                         "split": "half"}, headers=H(tok))
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture()
def trade(client):
    """A registered farmer with a listing and a registered paikar with an accepted (unpaid) order."""
    ft, fu, _ = register(client, "farmer")
    pt, pu, _ = register(client, "paikar")
    l = listing(client, ft)
    o = offer(client, pt, l["id"])
    r = client.post(f"/api/offers/{o['id']}/accept", headers=H(ft))
    assert r.status_code == 200, r.text
    return {"ft": ft, "fu": fu, "pt": pt, "pu": pu, "listing": l, "offer": o, "order": r.json()["order"]}


def pay(client, tok, oid, method="bkash"):
    p = client.post("/api/payments", json={"purpose": "order", "ref": oid, "method": method}, headers=H(tok))
    return p


def confirm(client, tok, pid):
    return client.post(f"/api/payments/{pid}/confirm", json={"account": "01700000000", "pin": S.DEMO_PIN}, headers=H(tok))

# ---------------------------------------------------------------- marketplace


def test_listing_edit_and_search_visibility(client):
    ft, _, _ = register(client, "farmer")
    l = listing(client, ft)
    r = client.patch(f"/api/listings/{l['id']}", json={"price": 32}, headers=H(ft))
    assert r.status_code == 200 and r.json()["price"] == 32
    assert any(x["id"] == l["id"] for x in client.get("/api/state").json()["listings"])


def test_other_user_cannot_edit_listing(client):
    ft, _, _ = register(client, "farmer")
    other, _, _ = register(client, "farmer")
    l = listing(client, ft)
    assert client.patch(f"/api/listings/{l['id']}", json={"price": 1}, headers=H(other)).status_code == 404


def test_counter_reject_and_accept_flow(client):
    ft, _, _ = register(client, "farmer")
    pt, _, _ = register(client, "paikar")
    l = listing(client, ft, price=30)
    o = offer(client, pt, l["id"], price=27)
    assert client.post(f"/api/offers/{o['id']}/counter", json={"price": 29}, headers=H(ft)).json()["status"] == "countered"
    assert client.post(f"/api/offers/{o['id']}/counter", json={"price": 29.5}, headers=H(ft)).status_code == 400  # buyer's turn
    assert client.post(f"/api/offers/{o['id']}/accept", headers=H(pt)).json()["status"] == "accepted"
    o2 = offer(client, pt, l["id"], price=25)
    assert client.post(f"/api/offers/{o2['id']}/reject", headers=H(ft)).json()["status"] == "rejected"


def test_offer_cannot_exceed_listed_price_or_stock(client):
    ft, _, _ = register(client, "farmer")
    pt, _, _ = register(client, "paikar")
    l = listing(client, ft, qty=400, price=30)
    assert client.post("/api/offers", json={"listing": l["id"], "qty": 200, "price": 31}, headers=H(pt)).status_code == 400
    assert client.post("/api/offers", json={"listing": l["id"], "qty": 600, "price": 30}, headers=H(pt)).status_code == 400


def test_no_overselling_when_two_offers_exceed_stock(client):
    ft, _, _ = register(client, "farmer")
    p1, _, _ = register(client, "paikar")
    p2, _, _ = register(client, "paikar")
    l = listing(client, ft, qty=400)
    a, b = offer(client, p1, l["id"], qty=300), offer(client, p2, l["id"], qty=300)
    assert client.post(f"/api/offers/{a['id']}/accept", headers=H(ft)).status_code == 200
    assert client.post(f"/api/offers/{b['id']}/accept", headers=H(ft)).status_code == 400
    row = db.one("SELECT available, reserved FROM listings WHERE id=?", (l["id"],))
    assert row["available"] == 100 and row["reserved"] == 300


def test_concurrent_accept_creates_one_order(client):
    ft, _, _ = register(client, "farmer")
    pt, _, _ = register(client, "paikar")
    l = listing(client, ft)
    o = offer(client, pt, l["id"])
    codes = []

    def go():
        codes.append(client.post(f"/api/offers/{o['id']}/accept", headers=H(ft)).status_code)
    ts = [threading.Thread(target=go) for _ in range(5)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert codes.count(200) == 1
    assert db.val("SELECT COUNT(*) FROM orders WHERE offer=?", (o["id"],)) == 1
    assert db.val("SELECT reserved FROM listings WHERE id=?", (l["id"],)) == 200

# ---------------------------------------------------------------- payments & wallet


def test_simulated_payment_completes_order(client, trade):
    p = pay(client, trade["pt"], trade["order"]["id"]).json()
    r = confirm(client, trade["pt"], p["id"]).json()
    assert r["status"] == "success" and r["txn"].startswith("TXN")
    assert db.val("SELECT status FROM orders WHERE id=?", (trade["order"]["id"],)) == "confirmed"


def test_second_payment_for_same_order_is_rejected(client, trade):
    oid = trade["order"]["id"]
    a, b = pay(client, trade["pt"], oid).json(), pay(client, trade["pt"], oid).json()
    assert confirm(client, trade["pt"], a["id"]).json()["status"] == "success"
    assert confirm(client, trade["pt"], b["id"]).json()["status"] == "failed"
    assert db.val("SELECT COUNT(*) FROM payments WHERE ref=? AND status='success'", (oid,)) == 1
    assert pay(client, trade["pt"], oid).status_code == 400      # cannot even start a new one


def test_concurrent_wallet_payments_charge_once(client, trade):
    oid, uid = trade["order"]["id"], trade["pu"]["id"]
    total = trade["order"]["buyer_total"]
    db.run("UPDATE users SET wallet=? WHERE id=?", (total * 3, uid))
    codes = []

    def go():
        codes.append(pay(client, trade["pt"], oid, "wallet").status_code)
    ts = [threading.Thread(target=go) for _ in range(5)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert db.val("SELECT COUNT(*) FROM payments WHERE ref=? AND status='success'", (oid,)) == 1
    assert db.val("SELECT wallet FROM users WHERE id=?", (uid,)) == pytest.approx(total * 2)
    assert db.val("SELECT COUNT(*) FROM wallet_tx WHERE uid=? AND kind='payment'", (uid,)) == 1


def test_wallet_never_goes_negative(client, trade):
    uid = trade["pu"]["id"]
    db.run("UPDATE users SET wallet=10 WHERE id=?", (uid,))
    r = pay(client, trade["pt"], trade["order"]["id"], "wallet").json()
    assert r["status"] == "failed"
    assert db.val("SELECT wallet FROM users WHERE id=?", (uid,)) == 10
    with pytest.raises(Exception):
        with db.tx():
            S.wallet(uid, -11, "test")
    assert db.val("SELECT wallet FROM users WHERE id=?", (uid,)) == 10


def test_wallet_balance_matches_ledger_after_full_trade(client, trade):
    oid = trade["order"]["id"]
    confirm(client, trade["pt"], pay(client, trade["pt"], oid).json()["id"])
    assert client.post(f"/api/orders/{oid}/handover", headers=H(trade["ft"])).status_code == 200
    assert client.post(f"/api/orders/{oid}/complete", headers=H(trade["pt"])).status_code == 200
    for uid in (trade["fu"]["id"], trade["pu"]["id"]):
        bal = db.val("SELECT wallet FROM users WHERE id=?", (uid,))
        ledger = db.val("SELECT COALESCE(SUM(amount),0) FROM wallet_tx WHERE uid=?", (uid,))
        assert bal == pytest.approx(ledger)
    l = db.one("SELECT * FROM listings WHERE id=?", (trade["listing"]["id"],))
    assert l["reserved"] == 0 and l["sold"] == 200


def test_cancel_refunds_once(client, trade):
    oid, uid = trade["order"]["id"], trade["pu"]["id"]
    confirm(client, trade["pt"], pay(client, trade["pt"], oid).json()["id"])
    assert client.post(f"/api/orders/{oid}/cancel", json={"reason": "আর লাগবে না"}, headers=H(trade["pt"])).status_code == 200
    assert client.post(f"/api/orders/{oid}/cancel", json={}, headers=H(trade["pt"])).status_code == 400
    assert db.val("SELECT COUNT(*) FROM wallet_tx WHERE uid=? AND kind='refund'", (uid,)) == 1
    assert db.val("SELECT available FROM listings WHERE id=?", (trade["listing"]["id"],)) == 1000


def test_unrelated_user_cannot_touch_order(client, trade):
    other, _, _ = register(client, "paikar")
    oid = trade["order"]["id"]
    assert pay(client, other, oid).status_code == 404
    assert client.post(f"/api/orders/{oid}/cancel", json={}, headers=H(other)).status_code == 404
    assert client.post(f"/api/orders/{oid}/complete", headers=H(other)).status_code == 404
    assert client.get(f"/api/orders/{oid}/transport", headers=H(other)).status_code == 404
    assert client.post(f"/api/offers/{trade['offer']['id']}/accept", headers=H(other)).status_code == 403


def test_buyer_cannot_confirm_someone_elses_payment(client, trade):
    other, _, _ = register(client, "paikar")
    p = pay(client, trade["pt"], trade["order"]["id"]).json()
    assert confirm(client, other, p["id"]).status_code == 400


def test_failed_request_rolls_back_every_write(client, monkeypatch):
    ft, _, _ = register(client, "farmer")
    pt, _, _ = register(client, "paikar")
    l = listing(client, ft)
    o = offer(client, pt, l["id"])

    def boom(*a, **k):
        raise RuntimeError("simulated crash after the order was written")
    monkeypatch.setattr(S, "_init_transport_negotiation", boom)
    monkeypatch.setattr(S, "notify", boom)
    with pytest.raises(RuntimeError):
        client.post(f"/api/offers/{o['id']}/accept", headers=H(ft))
    assert db.val("SELECT COUNT(*) FROM orders WHERE offer=?", (o["id"],)) == 0
    assert db.val("SELECT available FROM listings WHERE id=?", (l["id"],)) == 1000
    assert db.val("SELECT status FROM offers WHERE id=?", (o["id"],)) == "pending"

# ---------------------------------------------------------------- logistics


def booking(client, tok, qty=1000, src="natore", dst="dhaka"):
    r = client.post("/api/bookings", json={"pickup_place": src, "drop_place": dst, "crop": "potato", "qty": qty},
                    headers=H(tok))
    assert r.status_code == 200, r.text
    b = r.json()
    p = client.post("/api/payments", json={"purpose": "booking", "ref": b["id"], "method": "bkash"}, headers=H(tok)).json()
    assert confirm(client, tok, p["id"]).json()["status"] == "success"
    return b


def test_truck_capacity_prevents_overbooking(client):
    ft, _, _ = register(client, "farmer")
    at = admin_token(client)
    tid = client.post("/api/admin/trucks", json={"company": "পরীক্ষা ট্রাক", "driver": "চালক", "phone": "01711111111",
                                                 "number": "ঢাকা-১২৩", "vehicle": "pickup", "place": "natore"},
                      headers=H(at)).json()["id"]
    b1, b2 = booking(client, ft, 900), booking(client, ft, 900)       # pickup holds 1,500 kg
    assert client.post(f"/api/admin/bookings/{b1['id']}", json={"status": "confirmed", "truck": tid}, headers=H(at)).status_code == 200
    r = client.post(f"/api/admin/bookings/{b2['id']}", json={"status": "confirmed", "truck": tid}, headers=H(at))
    assert r.status_code == 400


def test_booking_status_only_moves_forward_and_owner_cancels(client):
    ft, _, _ = register(client, "farmer")
    other, _, _ = register(client, "farmer")
    at = admin_token(client)
    b = booking(client, ft, 500)
    tid = db.val("SELECT id FROM trucks WHERE vehicle='truck' AND status='available' LIMIT 1")
    assert client.post(f"/api/admin/bookings/{b['id']}", json={"status": "in_transit"}, headers=H(at)).status_code == 400
    assert client.post(f"/api/bookings/{b['id']}/cancel", headers=H(other)).status_code == 404
    assert client.post(f"/api/admin/bookings/{b['id']}", json={"status": "confirmed", "truck": tid}, headers=H(at)).status_code == 200
    assert client.post(f"/api/bookings/{b['id']}/cancel", headers=H(ft)).status_code == 200
    assert db.val("SELECT COUNT(*) FROM wallet_tx WHERE ref=? AND kind='refund'", (b["id"],)) == 1


def test_points_cannot_be_redeemed_twice_concurrently(client):
    ft, fu, _ = register(client, "farmer")
    db.run("UPDATE users SET pts=200 WHERE id=?", (fu["id"],))
    codes = []

    def go():
        codes.append(client.post("/api/rewards/transport", headers=H(ft)).status_code)
    ts = [threading.Thread(target=go) for _ in range(4)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert codes.count(200) == 1
    assert db.val("SELECT transport_credit FROM users WHERE id=?", (fu["id"],)) == 100


@pytest.mark.skipif(not db.PG, reason="PostgreSQL advisory lock")
def test_write_transactions_are_serialised_across_connections():
    """Another process holding the application write lock makes our transaction wait (several workers)."""
    import time

    import psycopg
    other = psycopg.connect(db.DATABASE_URL, autocommit=True)
    other.execute("SELECT pg_advisory_lock(%s)", (db.ADVISORY_KEY,))
    done = []

    def write():
        with db.tx():
            done.append(time.time())
    t = threading.Thread(target=write)
    start = time.time()
    t.start()
    time.sleep(0.5)
    assert not done                                     # still waiting for the lock
    other.execute("SELECT pg_advisory_unlock(%s)", (db.ADVISORY_KEY,))
    t.join(5)
    assert done and done[0] - start >= 0.5
    other.close()
