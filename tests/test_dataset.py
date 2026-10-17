"""First-party transaction dataset: classification, verification, eligibility, export without personal data."""
from app import dataset, db
from tests.conftest import H, admin_token, demo_token, register
from tests.test_hisab import make_order
from tests.test_transactions import confirm, pay


def complete(client, t):
    oid = t["order"]["id"]
    confirm(client, t["pt"], pay(client, t["pt"], oid).json()["id"])
    client.post(f"/api/orders/{oid}/handover", headers=H(t["ft"]))
    assert client.post(f"/api/orders/{oid}/complete", headers=H(t["pt"])).status_code == 200
    return db.one("SELECT * FROM trade_records WHERE order_id=?", (oid,))


def test_completed_real_trade_is_verified_and_eligible(client):
    t = make_order(client, qty=400, price=30)
    r = complete(client, t)
    assert r["data_class"] == "real_platform" and r["verification"] == "verified" and r["eligible"] == 1
    assert r["qty_kg"] == 400 and r["unit_original"] == "kg" and r["final_price"] == 30 and r["listing_price"] == 30
    assert r["first_offer_price"] == 30 and r["payment_status"] == "simulated_paid" and r["delivery_status"] == "received"


def test_unfinished_orders_are_not_sales(client):
    t = make_order(client)
    assert db.one("SELECT id FROM trade_records WHERE order_id=?", (t["order"]["id"],)) is None
    confirm(client, t["pt"], pay(client, t["pt"], t["order"]["id"]).json()["id"])
    assert db.one("SELECT id FROM trade_records WHERE order_id=?", (t["order"]["id"],)) is None


def test_demo_trades_are_labelled_and_excluded(client, fresh):
    assert dataset.backfill() >= 0
    rows = db.q("SELECT * FROM trade_records")
    assert rows and all(r["data_class"] == "demo_marketplace" and r["eligible"] == 0 for r in rows)
    assert dataset.training_rows() == []


def test_out_of_range_price_and_duplicates_are_not_eligible(client):
    t = make_order(client, qty=400, price=30)
    db.run("UPDATE orders SET price=999 WHERE id=?", (t["order"]["id"],))
    r = complete(client, t)
    assert r["eligible"] == 0 and "price_out_of_range" in r["quality_notes"]
    # an identical second trade between the same parties minutes later is flagged as a duplicate
    o = db.one("SELECT * FROM orders WHERE id=?", (t["order"]["id"],))
    twin = {**o, "id": "Dtwin" + o["id"][-4:], "price": 999}
    db.insert("orders", twin)
    rec = dataset.record_trade(db.one("SELECT * FROM orders WHERE id=?", (twin["id"],)))
    assert rec["duplicate_of"] == o["id"] and "duplicate" in rec["quality_notes"]


def test_training_export_has_no_personal_data(client):
    t = make_order(client, qty=400, price=30)
    complete(client, t)
    at = admin_token(client)
    csv = client.get("/api/admin/dataset/training.csv", headers=H(at)).text
    assert "record_id" in csv and "tomato" in csv
    for secret in (t["fu"]["id"], t["pu"]["id"], t["order"]["id"], t["fu"]["name"], t["fu"]["phone"]):
        assert secret not in csv
    s = client.get("/api/admin/dataset", headers=H(at)).json()
    assert s["classes"]["real_platform"]["eligible"] >= 1 and s["classes"]["simulated_model"]["eligible"] == 0


def test_dataset_endpoints_admin_only(client):
    assert client.get("/api/admin/dataset", headers=H(demo_token(client, "f1"))).status_code == 403
    assert client.get("/api/admin/dataset/training.csv").status_code == 401


def test_backfill_is_idempotent(client):
    t = make_order(client)
    complete(client, t)
    n = db.val("SELECT COUNT(*) FROM trade_records")
    dataset.backfill()
    dataset.backfill()
    assert db.val("SELECT COUNT(*) FROM trade_records") == n
