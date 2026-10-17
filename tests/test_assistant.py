"""Bangla assistant: intents, answers from the user's own data, missing data, no side effects, auth."""
import time

import pytest

from app import assistant, db, hisab
from app.ai_routes import VEG
from tests.conftest import H, admin_token, register
from tests.test_hisab import make_order, rec

TODAY = hisab.today()


def ask(client, tok, text):
    r = client.post("/api/assistant/ask", json={"text": text}, headers=H(tok))
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.parametrize("text,intent", [
    ("আমার এই মাসে কত টাকার বিক্রি হয়েছে?", "sales"),
    ("আমার কত টাকা পাওনা আছে?", "receivables"),
    ("আমার দেনা কত?", "payables"),
    ("এই মাসে আমার লাভ কত?", "profit"),
    ("আমার শেষ তিনটা বিল দেখাও।", "bills"),
    ("আমার কয়টা অর্ডার পেন্ডিং?", "pending_orders"),
    ("আমার ২০ মণ টমেটো কোন বাজারে বিক্রি করলে ভালো হবে?", "best_market"),
    ("আজ আলুর বাজারদর কত?", "market_price"),
    ("আবহাওয়া কেমন?", "help"),
])
def test_intents(text, intent):
    assert assistant.detect(text)[0] == intent


def test_bill_count_parsing():
    assert assistant.count_of("শেষ তিনটা বিল") == 3
    assert assistant.count_of("শেষ ৫টা বিল দেখাও") == 5
    assert assistant.count_of("আমার বিল") == 3


def test_sales_profit_and_missing_cost(client):
    tok, _, _ = register(client, "farmer")
    a = ask(client, tok, "আমার এই মাসে কত টাকার বিক্রি হয়েছে?")
    assert "কোনো বিক্রি হিসাবে নেই" in a["text"]
    rec(client, tok, type="sale_external", amount="12000", crop="tomato", qty_kg=500)
    a = ask(client, tok, "আমার এই মাসে কত টাকার বিক্রি হয়েছে?")
    assert "৳১২,০০০" in a["text"]
    a = ask(client, tok, "এই মাসে আমার লাভ কত?")
    assert hisab.PROFIT_MISSING in a["text"]
    rec(client, tok, type="expense_production", amount="7000", crop="tomato")
    a = ask(client, tok, "এই মাসে আমার লাভ কত?")
    assert "লাভ ৳৫,০০০" in a["text"]


def test_receivables_and_bills_use_only_own_data(client):
    t = make_order(client)
    other, _, _ = register(client, "farmer")
    client.post("/api/hisab/dues", json={"direction": "receivable", "counterparty": "রফিক", "amount": "5000"},
                headers=H(t["ft"]))
    a = ask(client, t["ft"], "আমার কত টাকা পাওনা আছে?")
    assert "৳৫,০০০" in a["text"] and any("রফিক" in i for i in a["items"])
    b = ask(client, other, "আমার কত টাকা পাওনা আছে?")
    assert "কোনো পাওনা" in b["text"]
    inv = db.one("SELECT number FROM invoices WHERE order_id=?", (t["order"]["id"],))["number"]
    assert any(inv in i for i in ask(client, t["ft"], "আমার শেষ তিনটা বিল দেখাও")["items"])
    assert not any(inv in i for i in ask(client, other, "আমার শেষ তিনটা বিল দেখাও")["items"])


def test_pending_orders(client):
    t = make_order(client)
    a = ask(client, t["pt"], "আমার কয়টা অর্ডার পেন্ডিং?")
    assert "১টি" in a["text"]


def test_market_answers_are_labelled_simulated_and_need_quantity(client):
    for _ in range(60):
        if VEG.ready:
            break
        time.sleep(1)
    tok, _, _ = register(client, "farmer")
    a = ask(client, tok, "আজ আলুর বাজারদর কত?")
    assert a["simulated"] and "সিমুলেটেড" in a["text"]
    a = ask(client, tok, "টমেটো কোন বাজারে বিক্রি করলে ভালো হবে?")
    assert a["missing"] == ["qty"]
    a = ask(client, tok, "আমার ২০ মণ টমেটো কোন বাজারে বিক্রি করলে ভালো হবে?")
    assert a["simulated"] and "নিশ্চিত নয়" in a["text"]


def test_assistant_never_changes_anything(client):
    tok, _, _ = register(client, "paikar")
    counts = [db.val(f"SELECT COUNT(*) FROM {t}") for t in ("orders", "offers", "payments", "entries", "dues")]
    for q in assistant.EXAMPLES + ["২০ মণ টমেটো কিনে দাও", "১০০০ টাকা পেমেন্ট করো"]:
        ask(client, tok, q)
    assert [db.val(f"SELECT COUNT(*) FROM {t}") for t in ("orders", "offers", "payments", "entries", "dues")] == counts


def test_assistant_requires_trader_login(client):
    assert client.post("/api/assistant/ask", json={"text": "লাভ কত"}).status_code == 401
    assert client.post("/api/assistant/ask", json={"text": "লাভ কত"}, headers=H(admin_token(client))).status_code == 403
