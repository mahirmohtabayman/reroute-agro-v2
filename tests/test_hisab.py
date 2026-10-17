"""Smart Hisab: invoices, receipts, manual records, dues, profit & loss, reports, PDFs, authorization."""
import subprocess
import tempfile
import threading
from datetime import date, timedelta

import pytest

from app import db, hisab, services as S
from tests.conftest import H, admin_token, register
from tests.test_transactions import confirm, listing, offer, pay

TODAY = hisab.today()


def make_order(client, qty=400, price=30, transport="self"):
    ft, fu, _ = register(client, "farmer")
    pt, pu, _ = register(client, "paikar")
    l = listing(client, ft, qty=1000, price=price)
    o = offer(client, pt, l["id"], qty=qty, price=price, transport=transport)
    order = client.post(f"/api/offers/{o['id']}/accept", headers=H(ft)).json()["order"]
    return {"ft": ft, "fu": fu, "pt": pt, "pu": pu, "listing": l, "order": order}


def inv_of(oid):
    return db.one("SELECT * FROM invoices WHERE order_id=?", (oid,))


def rec(client, tok, **kw):
    body = {"date": TODAY, **kw}
    return client.post("/api/hisab/records", json=body, headers=H(tok))

# ---------------------------------------------------------------- invoices & receipts


def test_invoice_issued_once_terms_are_final_and_is_not_proof_of_payment(client):
    t = make_order(client)
    inv = inv_of(t["order"]["id"])
    assert inv and inv["number"].startswith("RA-")
    v = client.get(f"/api/hisab/invoices/{inv['id']}", headers=H(t["pt"])).json()
    assert v["status"] == "unpaid" and v["paid"] == 0 and v["outstanding"] == t["order"]["buyer_total"]
    assert v["receipts"] == []


def test_issue_endpoint_is_idempotent(client):
    t = make_order(client)
    a = client.post(f"/api/hisab/orders/{t['order']['id']}/invoice", headers=H(t["ft"])).json()
    b = client.post(f"/api/hisab/orders/{t['order']['id']}/invoice", headers=H(t["pt"])).json()
    assert a["number"] == b["number"]
    assert db.val("SELECT COUNT(*) FROM invoices WHERE order_id=?", (t["order"]["id"],)) == 1


def test_concurrent_issue_creates_one_invoice_and_unique_numbers(client):
    t = make_order(client)
    oid = t["order"]["id"]
    db.run("DELETE FROM invoices WHERE order_id=?", (oid,))
    nums = []

    def go():
        nums.append(client.post(f"/api/hisab/orders/{oid}/invoice", headers=H(t["ft"])).json()["number"])
    ts = [threading.Thread(target=go) for _ in range(6)]
    [x.start() for x in ts]
    [x.join() for x in ts]
    assert len(set(nums)) == 1
    all_numbers = [r["number"] for r in db.q("SELECT number FROM invoices")]
    assert len(all_numbers) == len(set(all_numbers))


def test_reroute_transport_invoice_waits_for_agreement(client):
    t = make_order(client, transport="reroute")
    tn = db.one("SELECT status FROM transport_negotiations WHERE order_id=?", (t["order"]["id"],))
    if tn and tn["status"] != "agreed":
        assert inv_of(t["order"]["id"]) is None
        r = client.post(f"/api/hisab/orders/{t['order']['id']}/invoice", headers=H(t["ft"]))
        assert r.status_code == 400


def test_payment_receipt_payout_and_status(client):
    t = make_order(client)
    oid = t["order"]["id"]
    p = pay(client, t["pt"], oid).json()
    assert confirm(client, t["pt"], p["id"]).json()["status"] == "success"
    v = client.get(f"/api/hisab/invoices/{inv_of(oid)['id']}", headers=H(t["pt"])).json()
    assert v["status"] == "paid" and v["outstanding"] == 0
    r = v["receipts"][0]
    assert r["kind"] == "payment" and r["verification"] == "simulated" and r["amount"] == t["order"]["buyer_total"]
    assert v["seller_settlement"] == "pending"
    client.post(f"/api/orders/{oid}/handover", headers=H(t["ft"]))
    client.post(f"/api/orders/{oid}/complete", headers=H(t["pt"]))
    v = client.get(f"/api/hisab/invoices/{inv_of(oid)['id']}", headers=H(t["ft"])).json()
    assert v["seller_settlement"] == "received" and v["payout_received"] == t["order"]["payout"]
    assert db.val("SELECT COUNT(*) FROM receipts WHERE invoice_id=?", (inv_of(oid)["id"],)) == 2


def test_cancellation_adds_adjustment_and_keeps_history(client):
    t = make_order(client)
    oid = t["order"]["id"]
    inv_before = inv_of(oid)
    confirm(client, t["pt"], pay(client, t["pt"], oid).json()["id"])
    client.post(f"/api/orders/{oid}/cancel", json={"reason": "আর লাগবে না"}, headers=H(t["pt"]))
    after = inv_of(oid)
    assert after["data"] == inv_before["data"] and after["buyer_payable_p"] == inv_before["buyer_payable_p"]
    v = client.get(f"/api/hisab/invoices/{after['id']}", headers=H(t["pt"])).json()
    assert v["status"] == "refunded" and v["adjustments"][0]["kind"] == "cancelled"
    assert any(r["kind"] == "refund" for r in v["receipts"])


def test_invoice_snapshot_not_changed_by_later_edits(client):
    t = make_order(client)
    inv = inv_of(t["order"]["id"])
    client.patch(f"/api/listings/{t['listing']['id']}", json={"price": 99, "grade": "C"}, headers=H(t["ft"]))
    client.post("/api/me", json={"name": "নতুন নাম"}, headers=H(t["ft"]))
    v = client.get(f"/api/hisab/invoices/{inv['id']}", headers=H(t["ft"])).json()
    assert v["unit_price"] == 30 and v["grade"] == "A" and v["seller"]["name"] != "নতুন নাম"


def test_invoices_and_receipts_are_private(client):
    t = make_order(client)
    other, _, _ = register(client, "paikar")
    inv = inv_of(t["order"]["id"])
    assert client.get(f"/api/hisab/invoices/{inv['id']}", headers=H(other)).status_code == 404
    assert client.get(f"/api/hisab/invoices/{inv['number']}/pdf", headers=H(other)).status_code == 404
    assert all(i["id"] != inv["id"] for i in client.get("/api/hisab/invoices", headers=H(other)).json())
    assert client.post(f"/api/hisab/orders/{t['order']['id']}/invoice", headers=H(other)).status_code == 404
    confirm(client, t["pt"], pay(client, t["pt"], t["order"]["id"]).json()["id"])
    rid = db.val("SELECT id FROM receipts WHERE invoice_id=?", (inv["id"],))
    assert client.get(f"/api/hisab/receipts/{rid}/pdf", headers=H(other)).status_code == 404
    assert client.get("/api/hisab/overview").status_code == 401
    assert client.get(f"/api/hisab/invoices/{inv['id']}", headers=H(admin_token(client))).status_code == 200


def test_invoice_pdf_contains_bengali_text(client):
    t = make_order(client)
    inv = inv_of(t["order"]["id"])
    r = client.get(f"/api/hisab/invoices/{inv['id']}/pdf", headers=H(t["ft"]))
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf" and r.content.startswith(b"%PDF")
    assert "no-store" in r.headers["cache-control"]
    with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
        f.write(r.content)
        f.flush()
        try:
            text = subprocess.run(["pdftotext", f.name, "-"], capture_output=True, text=True).stdout
        except FileNotFoundError:
            pytest.skip("pdftotext not installed")
    assert inv["number"] in text and "INVOICE" in text
    assert any("ঀ" <= ch <= "৿" for ch in text)          # Bengali glyphs are embedded as text


def test_invoice_search_and_filters(client):
    t = make_order(client)
    inv = inv_of(t["order"]["id"])
    lst = client.get("/api/hisab/invoices", params={"q": inv["number"]}, headers=H(t["ft"])).json()
    assert [i["number"] for i in lst] == [inv["number"]]
    assert client.get("/api/hisab/invoices", params={"status": "paid"}, headers=H(t["ft"])).json() == []
    assert client.get("/api/hisab/invoices", params={"start": "2001-01-01", "end": "2001-12-31"}, headers=H(t["ft"])).json() == []
    assert client.get("/api/hisab/invoices", params={"status": "bogus"}, headers=H(t["ft"])).status_code == 400

# ---------------------------------------------------------------- manual records and P&L


def test_records_are_user_reported_and_validated(client):
    tok, _, _ = register(client, "farmer")
    r = rec(client, tok, type="expense_labor", amount="1200.50", description="ধান কাটার শ্রমিক")
    assert r.status_code == 200 and r.json()["source"] == "user_reported"
    assert rec(client, tok, type="expense_labor", amount="10.123").status_code == 422
    assert rec(client, tok, type="expense_labor", amount="10", date="2999-01-01").status_code == 400
    assert rec(client, tok, type="nonsense", amount="10").status_code == 400
    assert rec(client, tok, type="purchase", amount="100").status_code == 400          # crop + qty required


def test_duplicate_record_needs_confirmation(client):
    tok, _, _ = register(client, "farmer")
    assert rec(client, tok, type="expense_storage", amount="500").status_code == 200
    assert rec(client, tok, type="expense_storage", amount="500").status_code == 409
    assert rec(client, tok, type="expense_storage", amount="500", confirm_duplicate=True).status_code == 200


def test_transport_already_recorded_by_platform_is_flagged(client):
    tok, _, _ = register(client, "farmer")
    b = client.post("/api/bookings", json={"pickup_place": "natore", "drop_place": "dhaka", "crop": "potato", "qty": 500},
                    headers=H(tok)).json()
    p = client.post("/api/payments", json={"purpose": "booking", "ref": b["id"], "method": "bkash"}, headers=H(tok)).json()
    confirm(client, tok, p["id"])
    amount = b["total"] - b["credit_used"]
    assert rec(client, tok, type="expense_transport", amount=str(amount)).status_code == 409


def test_profit_unavailable_when_cost_missing_then_available(client):
    tok, _, _ = register(client, "farmer")
    rec(client, tok, type="sale_external", amount="20000", crop="tomato", qty_kg=800)
    p = client.get("/api/hisab/overview", headers=H(tok)).json()["pnl"]
    assert p["revenue"] == 20000 and p["profit"] is None and p["profit_message"] == hisab.PROFIT_MISSING
    rec(client, tok, type="expense_production", amount="12000", crop="tomato")
    rec(client, tok, type="expense_transport", amount="1500")
    p = client.get("/api/hisab/overview", headers=H(tok)).json()["pnl"]
    assert p["profit_complete"] and p["profit"] == 20000 - 12000 - 1500


def test_farmer_production_cost_not_counted_twice(client):
    t = make_order(client, qty=400, price=30)
    # the farmer listed with no per-kg cost; record production expenses for the crop, then complete the sale
    rec(client, t["ft"], type="expense_production", amount="5000", crop="tomato")
    oid = t["order"]["id"]
    confirm(client, t["pt"], pay(client, t["pt"], oid).json()["id"])
    client.post(f"/api/orders/{oid}/handover", headers=H(t["ft"]))
    client.post(f"/api/orders/{oid}/complete", headers=H(t["pt"]))
    db.run("UPDATE orders SET cost_basis=10 WHERE id=?", (oid,))      # even with a per-kg cost on the order …
    p = hisab.pnl(t["fu"]["id"])
    assert p["cost_of_goods"] == 0                                   # … the recorded expenses are the cost
    o = db.one("SELECT * FROM orders WHERE id=?", (oid,))
    expected = o["goods"] + o["cashback"] - 5000 - (o["fee"] - o["fee_disc"]) - (o["t_seller"] - o["t_cs"])
    assert p["profit"] == pytest.approx(expected)


def test_paikar_weighted_average_cost_and_purchases_not_expenses(client):
    tok, u, _ = register(client, "paikar")
    rec(client, tok, type="purchase", amount="20000", crop="onion", qty_kg=1000)
    rec(client, tok, type="purchase", amount="30000", crop="onion", qty_kg=1000)
    assert db.val("SELECT cost FROM stock WHERE uid=? AND crop='onion'", (u["id"],)) == pytest.approx(25)
    rec(client, tok, type="sale_external", amount="15000", crop="onion", qty_kg=500)
    p = hisab.pnl(u["id"])
    assert p["purchases_to_stock"] == 50000 and p["total_expenses"] == 0
    assert p["cost_of_goods"] == 12500 and p["profit"] == 2500


def test_void_removes_record_from_totals_and_restores_stock(client):
    tok, u, _ = register(client, "paikar")
    rec(client, tok, type="purchase", amount="10000", crop="potato", qty_kg=1000)
    sale = rec(client, tok, type="sale_external", amount="6000", crop="potato", qty_kg=400).json()
    assert db.val("SELECT qty FROM stock WHERE uid=? AND crop='potato'", (u["id"],)) == 600
    assert client.post(f"/api/hisab/records/{sale['id']}/void", json={"reason": ""}, headers=H(tok)).status_code == 422
    assert client.post(f"/api/hisab/records/{sale['id']}/void", json={"reason": "ভুল লিখেছি"}, headers=H(tok)).status_code == 200
    assert db.val("SELECT qty FROM stock WHERE uid=? AND crop='potato'", (u["id"],)) == 1000
    assert hisab.pnl(u["id"])["revenue"] == 0
    assert db.val("SELECT COUNT(*) FROM audit_events WHERE entity_id=? AND action='voided'", (sale["id"],)) == 1
    other, _, _ = register(client, "paikar")
    assert client.post(f"/api/hisab/records/{sale['id']}/void", json={"reason": "x"}, headers=H(other)).status_code == 404


def test_decimal_precision(client):
    tok, u, _ = register(client, "farmer")
    rec(client, tok, type="expense_other", amount="0.10")
    rec(client, tok, type="expense_other", amount="0.20", description="b")
    assert hisab.pnl(u["id"])["total_expenses"] == 0.30


def test_legacy_books_page_uses_the_same_numbers(client):
    tok, u, _ = register(client, "farmer")
    rec(client, tok, type="sale_external", amount="9000", crop="carrot", qty_kg=300)
    rec(client, tok, type="expense_production", amount="4000", crop="carrot")
    legacy = S.pnl(u["id"])
    smart = hisab.pnl(u["id"])
    assert legacy["revenue"] == smart["revenue"] and legacy["profit"] == smart["profit"] == 5000

# ---------------------------------------------------------------- dues


def test_due_partial_payments_and_overpayment(client):
    tok, _, _ = register(client, "farmer")
    d = client.post("/api/hisab/dues", json={"direction": "receivable", "counterparty": "করিম ভাই", "amount": "5000"},
                    headers=H(tok)).json()
    assert d["status"] == "unpaid"
    d = client.post(f"/api/hisab/dues/{d['id']}/payments", json={"amount": "2000", "date": TODAY}, headers=H(tok)).json()
    assert d["status"] == "partial" and d["outstanding"] == 3000
    assert client.post(f"/api/hisab/dues/{d['id']}/payments", json={"amount": "3000.01", "date": TODAY},
                       headers=H(tok)).status_code == 400
    r = rec(client, tok, type="payment_received", amount="3000", due_id=d["id"]).json()
    assert r["status"] == "paid" and len(r["payments"]) == 2
    receipts = client.get("/api/hisab/receipts", headers=H(tok)).json()
    assert {x["verification"] for x in receipts} == {"user_reported"} and len(receipts) == 2
    assert client.post(f"/api/hisab/dues/{d['id']}/void", json={"reason": "x"}, headers=H(tok)).status_code == 400


def test_overdue_and_platform_dues(client):
    t = make_order(client)
    past = (date.fromisoformat(TODAY) - timedelta(days=3)).isoformat()
    client.post("/api/hisab/dues", json={"direction": "payable", "counterparty": "সার দোকান", "amount": "1200",
                                         "due_date": past}, headers=H(t["pt"]))
    j = client.get("/api/hisab/dues", headers=H(t["pt"])).json()
    assert any(x["status"] == "overdue" for x in j["dues"])
    plat = [x for x in j["dues"] if x["source"] == "platform"]
    assert plat and plat[0]["direction"] == "payable" and plat[0]["amount"] == t["order"]["buyer_total"]
    assert j["summary"]["payable"] == pytest.approx(1200 + t["order"]["buyer_total"])


def test_dues_are_private(client):
    a, _, _ = register(client, "farmer")
    b, _, _ = register(client, "farmer")
    d = client.post("/api/hisab/dues", json={"direction": "receivable", "counterparty": "x", "amount": "100"},
                    headers=H(a)).json()
    assert client.post(f"/api/hisab/dues/{d['id']}/payments", json={"amount": "10", "date": TODAY}, headers=H(b)).status_code == 404
    assert all(x["id"] != d["id"] for x in client.get("/api/hisab/dues", headers=H(b)).json()["dues"])

# ---------------------------------------------------------------- reports, documents, roles


def test_reports_json_csv_pdf(client):
    tok, _, _ = register(client, "farmer")
    rec(client, tok, type="sale_external", amount="8000", crop="brinjal", qty_kg=400)
    rec(client, tok, type="expense_packaging", amount="300")
    for g in ("day", "week", "month"):
        r = client.get("/api/hisab/report", params={"period": "month", "group": g}, headers=H(tok)).json()
        assert r["sales"][0]["revenue"] == 8000 and r["products"][0]["crop"] == "brinjal"
    c = client.get("/api/hisab/report", params={"period": "year", "format": "csv"}, headers=H(tok))
    assert c.status_code == 200 and "expenses,packaging" in c.text
    p = client.get("/api/hisab/report", params={"period": "all", "format": "pdf"}, headers=H(tok))
    assert p.content.startswith(b"%PDF")
    bad = client.get("/api/hisab/report", params={"period": "custom", "start": "2026-05-02", "end": "2026-05-01"}, headers=H(tok))
    assert bad.status_code == 400


def test_attachments_owner_only_and_validated(client):
    import base64
    tok, _, _ = register(client, "farmer")
    other, _, _ = register(client, "farmer")
    png = "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\0" * 40).decode()
    d = client.post("/api/hisab/documents", json={"data": png}, headers=H(tok)).json()
    assert client.get(f"/api/hisab/documents/{d['id']}", headers=H(tok)).status_code == 200
    assert client.get(f"/api/hisab/documents/{d['id']}", headers=H(other)).status_code == 404
    svg = "data:image/svg+xml;base64," + base64.b64encode(b"<svg/>").decode()
    assert client.post("/api/hisab/documents", json={"data": svg}, headers=H(tok)).status_code == 400
    assert rec(client, tok, type="expense_other", amount="50", document_id=d["id"]).status_code == 200
    assert rec(client, other, type="expense_other", amount="50", document_id=d["id"]).status_code == 400


def test_smart_hisab_is_for_traders_only(client):
    assert client.get("/api/hisab/overview", headers=H(admin_token(client))).status_code == 403


def test_demo_accounts_have_seeded_invoices(client, fresh):
    tok = client.post("/api/login", json={"user_id": "f1"}).json()["token"]
    invs = client.get("/api/hisab/invoices", headers=H(tok)).json()
    assert invs and all(i["data_class"] == "demo" for i in invs)
