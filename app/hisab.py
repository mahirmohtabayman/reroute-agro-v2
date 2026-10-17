"""Smart Hisab (স্মার্ট হিসাব): invoices, receipts, manual business records, dues, profit & loss and reports.

Accounting rules (also in DATABASE_MIGRATIONS.md and HACKATHON_DEMO.md):
* Money in the new tables is stored as integer poisha; all arithmetic here uses Decimal.
* Revenue is recognised when a platform sale is COMPLETED (goods delivered) or on the date of a user-reported
  external sale. Cash received is reported separately (receipts) — it is not revenue.
* An invoice is issued once the price and transport terms of an order are final. It is NOT proof of payment:
  payment status comes only from receipts. Platform payments are SIMULATED and labelled so.
* Issued invoices are never rewritten: cancellations and refunds are added as adjustments.
* Paikar inventory uses the existing WEIGHTED-AVERAGE cost (stock table): purchases go into stock, not
  expenses; cost of goods sold = average cost per kg × kg sold. Purchases are therefore never counted twice.
* Farmers: if production (or harvest) expenses are recorded for a crop — or without a crop, for the whole farm —
  those expenses are the cost of that crop and any per-kg production cost stored with the stock is ignored for
  it, so nothing is counted twice. Otherwise the per-kg production cost given when listing is used.
* If any quantity sold in the period has no known cost, profit is NOT shown ("missing cost information").
* Manual records are labelled "user-reported"; platform records "platform (simulated payment)".
"""
import csv
import io
import json
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException

from app import db, services as S
from app.logic import CROPS, MON, PLACES

BD_TZ = timezone(timedelta(hours=6))
D0 = Decimal(0)
MAX_AMOUNT_P = 10_000_000_000          # ৳10 crore

EXPENSE_CATEGORIES = {
    "production": "উৎপাদন খরচ (বীজ, সার, সেচ)", "harvest": "ফসল তোলার খরচ", "transport": "পরিবহন",
    "storage": "সংরক্ষণ", "packaging": "প্যাকিং", "labor": "শ্রমিক", "other": "অন্যান্য খরচ",
    # automatic categories (platform)
    "platform_fee": "Reroute প্ল্যাটফর্ম ফি", "platform_transport": "Reroute ট্রাক ভাড়া (আপনার ভাগ)",
}
ENTRY_TYPES = {
    "sale_external": "বাইরের বিক্রি", "purchase": "ফসল কেনা (মজুদে যোগ)",
    "expense_production": "উৎপাদন খরচ", "expense_harvest": "ফসল তোলার খরচ", "expense_transport": "পরিবহন খরচ",
    "expense_storage": "সংরক্ষণ খরচ", "expense_packaging": "প্যাকিং খরচ", "expense_labor": "শ্রমিক খরচ",
    "expense_other": "অন্যান্য খরচ", "payment_received": "টাকা পেয়েছি", "payment_made": "টাকা দিয়েছি",
}
SOURCE_BN = {"platform": "প্ল্যাটফর্ম লেনদেন", "user_reported": "নিজে লেখা (যাচাই করা নয়)"}
PROFIT_MISSING = "লাভের হিসাব সম্পূর্ণ নয় — কিছু খরচের তথ্য পাওয়া যায়নি।"
PROFIT_MISSING_EN = "Profit calculation unavailable — missing cost information."


def fail(code, msg):
    raise HTTPException(code, msg)


# ---------------------------------------------------------------- money & dates
def to_p(x):
    """Taka (number or string) → integer poisha, half-up."""
    return int((Decimal(str(x or 0)) * 100).quantize(Decimal(1), ROUND_HALF_UP))


def tk(p):
    """Integer poisha → Taka as a JSON number with at most 2 decimals."""
    return float((Decimal(p or 0) / 100).quantize(Decimal("0.01")))


def dec(x):
    return Decimal(str(x or 0))


def day_of(ms):
    return datetime.fromtimestamp((ms or 0) / 1000, BD_TZ).date().isoformat()


def today():
    return datetime.now(BD_TZ).date().isoformat()


def parse_day(s, field="তারিখ"):
    try:
        d = date.fromisoformat(str(s))
    except ValueError:
        fail(400, f"{field} ঠিক নেই (YYYY-MM-DD)")
    if d.year < 2000 or d > date.fromisoformat(today()) + timedelta(days=1):
        fail(400, f"{field} ঠিক নেই")
    return d.isoformat()


def in_range(d, start, end):
    return (start is None or d >= start) and (end is None or d <= end)


def nid(prefix):
    return prefix + uuid.uuid4().hex[:10]


def next_number(series):
    """Next number of a series (e.g. invoices of 2026). Runs inside the caller's transaction, which on
    PostgreSQL holds the global write lock, so two requests can never get the same number; the UNIQUE
    constraint on the number is a second guard."""
    row = db.one("SELECT val FROM counters WHERE name=?", (series,))
    if row:
        n = int(row["val"]) + 1
        db.run("UPDATE counters SET val=? WHERE name=?", (n, series))
    else:
        n = 1
        db.insert("counters", {"name": series, "val": n})
    return n


def audit(uid, entity, entity_id, action, data=None):
    db.insert("audit_events", {"id": nid("A"), "uid": uid, "entity": entity, "entity_id": entity_id,
                               "action": action, "data": json.dumps(data or {}, ensure_ascii=False), "at": S.now()})


def is_demo_uid(uid):
    return not str(uid).startswith("U")


# ---------------------------------------------------------------- invoices
def invoice_ready(o):
    """Price and transport terms are final (the amounts on the invoice will not change any more)."""
    if o["status"] in ("confirmed", "handed_over", "completed"):
        return True
    if o["status"] != "awaiting_payment":
        return False
    if o["transport"] != "reroute":
        return True
    tn = db.one("SELECT status FROM transport_negotiations WHERE order_id=?", (o["id"],))
    return tn is None or tn["status"] == "agreed"


def _party(u):
    return {"id": u["id"], "name": u["name"], "biz": u["biz"], "role": u["role"], "district": PLACES.get(u["place"], (u["place"],))[0],
            "area": u["area"], "market": u.get("market")}


def ensure_invoice(o):
    """Issue the invoice of an order once (idempotent). Returns the invoice row or None if not ready yet."""
    inv = db.one("SELECT * FROM invoices WHERE order_id=?", (o["id"],))
    if inv or not invoice_ready(o):
        return inv
    seller, buyer = S.user(o["seller"]), S.user(o["buyer"])
    listing = db.one("SELECT grade, quality FROM listings WHERE id=?", (o["listing"],)) or {}
    year = datetime.now(BD_TZ).year
    number = f"RA-{year}-{next_number(f'invoice:{year}'):06d}"
    snap = {
        "seller": _party(seller), "buyer": _party(buyer), "order_id": o["id"], "order_created": o["created"],
        "crop": o["crop"], "crop_bn": CROPS[o["crop"]][0], "grade": listing.get("grade"), "quality": listing.get("quality"),
        "qty_kg": o["qty"], "qty_mon": round(o["qty"] / MON, 2), "unit": "কেজি", "unit_price": o["price"],
        "listed_price": o["listed_price"], "goods": o["goods"], "fee": o["fee"], "fee_disc": o["fee_disc"],
        "transport": o["transport"], "t_total": o["t_total"], "t_buyer": o["t_buyer"], "t_seller": o["t_seller"],
        "t_cb": o["t_cb"], "t_cs": o["t_cs"], "buyer_total": o["buyer_total"], "payout": o["payout"],
        "payment_mode": "simulated",
    }
    inv = {"id": nid("I"), "number": number, "order_id": o["id"], "seller": o["seller"], "buyer": o["buyer"],
           "issued_at": S.now(), "data": json.dumps(snap, ensure_ascii=False), "goods_p": to_p(o["goods"]),
           "buyer_payable_p": to_p(o["buyer_total"]), "seller_net_p": to_p(o["payout"]),
           "data_class": "demo" if is_demo_uid(o["seller"]) or is_demo_uid(o["buyer"]) else "real"}
    db.insert("invoices", inv)
    audit(None, "invoice", inv["id"], "issued", {"number": number, "order_id": o["id"]})
    return inv


def _receipt(uid, kind, direction, amount_p, source_ref, at, verification, invoice_id=None, due_id=None,
             method=None, ref=None, note=None, pay_date=None):
    """Create a receipt once per source event (source_ref is UNIQUE)."""
    if db.one("SELECT id FROM receipts WHERE source_ref=?", (source_ref,)):
        return None
    year = datetime.now(BD_TZ).year
    r = {"id": nid("R"), "number": f"RC-{year}-{next_number(f'receipt:{year}'):06d}", "uid": uid,
         "invoice_id": invoice_id, "due_id": due_id, "source_ref": source_ref, "kind": kind, "direction": direction,
         "amount_p": amount_p, "method": method, "ref": ref, "at": at, "pay_date": pay_date or day_of(at),
         "verification": verification, "note": note}
    db.insert("receipts", r)
    return r


def sync_order(o):
    """Bring the invoice, receipts and adjustments of one order up to date. Idempotent."""
    inv = ensure_invoice(o)
    if not inv:
        return None
    for p in db.q("SELECT * FROM payments WHERE purpose='order' AND ref=? AND status='success'", (o["id"],)):
        _receipt(p["uid"], "payment", "out", to_p(p["amount"]), f"pay:{p['id']}", p["verified_at"] or p["created"],
                 "simulated", inv["id"], method=p["method"], ref=p["txn"], note="সিমুলেটেড পেমেন্ট (ডেমো গেটওয়ে)")
    for w in db.q("SELECT * FROM wallet_tx WHERE ref=? AND kind IN ('payout','refund')", (o["id"],)):
        _receipt(w["uid"], w["kind"], "in", to_p(w["amount"]), f"{w['kind']}:{w['id']}", w["at"], "simulated", inv["id"],
                 method="wallet", ref=w["id"], note=w["note"])
    if o["status"] == "cancelled" and not db.one("SELECT id FROM invoice_adjustments WHERE source_ref=?", (f"cancel:{o['id']}",)):
        db.insert("invoice_adjustments", {"id": nid("J"), "invoice_id": inv["id"], "at": o["cancelled_at"] or S.now(),
                                          "kind": "cancelled", "amount_p": -inv["buyer_payable_p"],
                                          "note": o["reason"] or "অর্ডার বাতিল", "by_uid": o["cancelled_by"],
                                          "source_ref": f"cancel:{o['id']}"})
        audit(o["cancelled_by"], "invoice", inv["id"], "adjusted", {"kind": "cancelled"})
    return inv


def sync_user(uid):
    """Issue missing invoices / receipts for every order of a user (also back-fills orders created before Smart
    Hisab existed). Runs in its own transaction."""
    with db.tx():
        for o in db.q("SELECT * FROM orders WHERE buyer=? OR seller=?", (uid, uid)):
            sync_order(o)


def invoice_status(inv):
    rec = db.q("SELECT * FROM receipts WHERE invoice_id=? ORDER BY at", (inv["id"],))
    adj = db.q("SELECT * FROM invoice_adjustments WHERE invoice_id=? ORDER BY at", (inv["id"],))
    paid = sum(r["amount_p"] for r in rec if r["kind"] == "payment")
    refunded = sum(r["amount_p"] for r in rec if r["kind"] == "refund")
    payout = sum(r["amount_p"] for r in rec if r["kind"] == "payout")
    cancelled = any(a["kind"] == "cancelled" for a in adj)
    payable = inv["buyer_payable_p"]
    net_paid = paid - refunded
    if cancelled:
        status, outstanding = ("refunded" if refunded else "cancelled"), 0
    else:
        outstanding = max(0, payable - net_paid)
        status = "paid" if net_paid >= payable else "partial" if net_paid > 0 else "unpaid"
    return {"status": status, "paid_p": net_paid, "outstanding_p": outstanding, "payout_p": payout,
            "seller_settlement": "received" if payout else ("cancelled" if cancelled else "pending" if net_paid else "not_due"),
            "receipts": rec, "adjustments": adj}


STATUS_BN = {"paid": "পরিশোধিত", "partial": "আংশিক পরিশোধ", "unpaid": "অপরিশোধিত", "cancelled": "বাতিল",
             "refunded": "বাতিল, টাকা ফেরত", "overdue": "মেয়াদ পেরিয়েছে"}


def invoice_view(inv, viewer):
    snap = json.loads(inv["data"])
    st = invoice_status(inv)
    o = db.one("SELECT status FROM orders WHERE id=?", (inv["order_id"],))
    side = "seller" if viewer == inv["seller"] else "buyer" if viewer == inv["buyer"] else "admin"
    return {"id": inv["id"], "number": inv["number"], "order_id": inv["order_id"], "issued_at": inv["issued_at"],
            "issued_date": day_of(inv["issued_at"]), "side": side, "data_class": inv["data_class"], **snap,
            "status": st["status"], "status_bn": STATUS_BN[st["status"]], "paid": tk(st["paid_p"]),
            "outstanding": tk(st["outstanding_p"]), "payout_received": tk(st["payout_p"]),
            "seller_settlement": st["seller_settlement"], "order_status": o["status"] if o else None,
            "receipts": [receipt_view(r) for r in st["receipts"]],
            "adjustments": [{"kind": a["kind"], "amount": tk(a["amount_p"]), "note": a["note"], "date": day_of(a["at"])}
                            for a in st["adjustments"]],
            "payment_note": "পেমেন্ট সিমুলেটেড (ডেমো গেটওয়ে), কোনো আসল টাকা লেনদেন হয়নি। ইনভয়েস নিজে পেমেন্টের প্রমাণ নয়।"}


def get_invoice(inv_id, u):
    inv = db.one("SELECT * FROM invoices WHERE id=? OR number=?", (inv_id, inv_id))
    if not inv or (u["role"] != "admin" and u["id"] not in (inv["seller"], inv["buyer"])):
        fail(404, "ইনভয়েস পাওয়া যায়নি")
    return inv


def list_invoices(uid, q=None, start=None, end=None, status=None):
    out = []
    for inv in db.q("SELECT * FROM invoices WHERE seller=? OR buyer=? ORDER BY issued_at DESC", (uid, uid)):
        v = invoice_view(inv, uid)
        if not in_range(v["issued_date"], start, end) or (status and v["status"] != status):
            continue
        if q:
            hay = " ".join(str(x) for x in (v["number"], v["order_id"], v["crop_bn"], v["crop"], v["seller"]["name"],
                                            v["seller"]["biz"], v["buyer"]["name"], v["buyer"]["biz"])).lower()
            if q.lower() not in hay:
                continue
        v.pop("receipts"), v.pop("adjustments")
        out.append(v)
    return out


KIND_BN = {"payment": "পেমেন্ট দেওয়া হয়েছে", "payout": "বিক্রির টাকা পাওয়া গেছে", "refund": "টাকা ফেরত",
           "manual_in": "টাকা পেয়েছি", "manual_out": "টাকা দিয়েছি"}
VERIFY_BN = {"simulated": "সিমুলেটেড (ডেমো, আসল টাকা নয়)", "user_reported": "নিজে লেখা (যাচাই করা নয়)"}


def receipt_view(r):
    k = r["kind"] if r["kind"] != "manual" else f"manual_{r['direction']}"
    inv = db.one("SELECT number FROM invoices WHERE id=?", (r["invoice_id"],)) if r["invoice_id"] else None
    return {"id": r["id"], "number": r["number"], "kind": r["kind"], "kind_bn": KIND_BN[k], "direction": r["direction"],
            "amount": tk(r["amount_p"]), "date": r["pay_date"], "method": r["method"], "ref": r["ref"],
            "verification": r["verification"], "verification_bn": VERIFY_BN[r["verification"]], "note": r["note"],
            "invoice_id": r["invoice_id"], "invoice_number": inv["number"] if inv else None, "due_id": r["due_id"]}


def get_receipt(rid, u):
    r = db.one("SELECT * FROM receipts WHERE id=? OR number=?", (rid, rid))
    if not r:
        fail(404, "রসিদ পাওয়া যায়নি")
    inv = db.one("SELECT seller, buyer FROM invoices WHERE id=?", (r["invoice_id"],)) if r["invoice_id"] else None
    allowed = u["role"] == "admin" or u["id"] == r["uid"] or (inv and u["id"] in (inv["seller"], inv["buyer"]))
    if not allowed:
        fail(404, "রসিদ পাওয়া যায়নি")
    return r


# ---------------------------------------------------------------- manual records
def _entry_date(e):
    return e.get("entry_date") or day_of(e["at"])


def possible_duplicate(u, etype, amount_p, d, crop):
    """A manual record that looks like something already recorded (automatically or by hand)."""
    lo = (date.fromisoformat(d) - timedelta(days=1)).isoformat()
    hi = (date.fromisoformat(d) + timedelta(days=1)).isoformat()
    if etype == "expense_transport":
        for b in db.q("SELECT * FROM bookings WHERE uid=? AND paid=1 AND status<>'cancelled'", (u["id"],)):
            if lo <= day_of(b["created"]) <= hi and to_p(b["total"] - b["credit_used"]) == amount_p:
                return "এই তারিখে একই অঙ্কের Reroute ট্রাক বুকিং আগে থেকেই হিসাবে আছে"
        for o in db.q("SELECT * FROM orders WHERE (seller=? OR buyer=?) AND status<>'cancelled'", (u["id"], u["id"])):
            share = (o["t_seller"] - o["t_cs"]) if o["seller"] == u["id"] else (o["t_buyer"] - o["t_cb"])
            if share and lo <= day_of(o["created"]) <= hi and to_p(share) == amount_p:
                return "এই তারিখে একই অঙ্কের অর্ডারের ট্রাক ভাড়া আগে থেকেই হিসাবে আছে"
    if etype == "sale_external":
        for o in db.q("SELECT * FROM orders WHERE seller=? AND status='completed'", (u["id"],)):
            if lo <= day_of(o["completed_at"]) <= hi and to_p(o["goods"]) == amount_p:
                return "এই তারিখে একই অঙ্কের প্ল্যাটফর্ম বিক্রি আগে থেকেই হিসাবে আছে"
    kind, cat = entry_kind(etype)
    for e in db.q("SELECT * FROM entries WHERE uid=? AND kind=? AND voided_at IS NULL", (u["id"], kind)):
        if (e.get("category") or "other") == (cat or "other") and _entry_date(e) == d and to_p(e["amount"]) == amount_p \
                and (e["crop"] or None) == (crop or None):
            return "একই তারিখে একই অঙ্কের একই রেকর্ড আগে থেকেই লেখা আছে"
    return None


def entry_kind(etype):
    if etype == "sale_external":
        return "sale", "external_sale"
    if etype == "purchase":
        return "stock", "crop_purchase"
    if etype.startswith("expense_"):
        return "expense", etype[len("expense_"):]
    return None, None


def add_record(u, etype, amount, d, crop=None, qty_kg=None, counterparty=None, description=None, document_id=None,
               due_id=None, confirm_duplicate=False):
    """Create one user-reported record. Runs inside the request transaction."""
    if etype not in ENTRY_TYPES:
        fail(400, "হিসাবের ধরন ঠিক নেই")
    amount_p = to_p(amount)
    if amount_p <= 0 or amount_p > MAX_AMOUNT_P or dec(amount) * 100 != Decimal(amount_p):
        fail(400, "টাকার অঙ্ক ঠিক নেই (সর্বোচ্চ ২ দশমিক ঘর)")
    d = parse_day(d)
    if crop is not None and crop not in CROPS:
        fail(400, "ফসল ঠিক নেই")
    if qty_kg is not None and not (0 < qty_kg <= 1_000_000):
        fail(400, "পরিমাণ ঠিক নেই")
    if document_id and not db.one("SELECT id FROM documents WHERE id=? AND uid=?", (document_id, u["id"])):
        fail(400, "সংযুক্ত ফাইল পাওয়া যায়নি")
    if etype in ("payment_received", "payment_made"):
        if not due_id:
            fail(400, "কোন পাওনা/দেনার বিপরীতে টাকা, সেটি বাছুন (পাওনা ও দেনা অংশ থেকে)")
        return pay_due(u, due_id, amount, d, description)
    if etype == "purchase" and (not crop or not qty_kg):
        fail(400, "কোন ফসল ও কত কেজি কিনেছেন দিন")
    dup = None if confirm_duplicate else possible_duplicate(u, etype, amount_p, d, crop)
    if dup:
        fail(409, dup + "। তবুও লিখতে চাইলে নিশ্চিত করুন।")
    kind, category = entry_kind(etype)
    cost_basis = None
    if etype == "sale_external" and crop and qty_kg:
        if S.unlisted(u["id"], crop) >= qty_kg:          # sold from recorded stock: take it out at average cost
            cost_basis = S.stock_take(u["id"], crop, qty_kg)
    if etype == "purchase":
        S.stock_add(u["id"], crop, qty_kg, float(dec(amount) / dec(qty_kg)))
    e = {"id": S.nid("X"), "uid": u["id"], "kind": kind, "crop": crop, "qty": qty_kg or 0, "amount": tk(amount_p),
         "cost_basis": cost_basis, "note": (description or "")[:200], "at": S.now(), "category": category,
         "entry_date": d, "counterparty": (counterparty or "")[:80] or None, "document_id": document_id,
         "source": "user_reported", "voided_at": None, "void_reason": None}
    db.insert("entries", e)
    audit(u["id"], "entry", e["id"], "created", {"type": etype, "amount_p": amount_p, "date": d})
    return entry_view(e)


def entry_type(e):
    if e["kind"] == "sale":
        return "sale_external"
    if e["kind"] == "stock":
        return "purchase"
    return "expense_" + (e.get("category") or "other")


def entry_view(e):
    t = entry_type(e)
    return {"id": e["id"], "type": t, "type_bn": ENTRY_TYPES.get(t, t), "amount": tk(to_p(e["amount"])),
            "date": _entry_date(e), "crop": e["crop"], "crop_bn": CROPS[e["crop"]][0] if e["crop"] in CROPS else None,
            "qty_kg": e["qty"] or None, "counterparty": e.get("counterparty"), "description": e["note"],
            "document_id": e.get("document_id"), "source": e.get("source") or "user_reported",
            "source_bn": SOURCE_BN["user_reported"], "voided": bool(e.get("voided_at")), "void_reason": e.get("void_reason")}


def void_record(u, entry_id, reason):
    e = db.one("SELECT * FROM entries WHERE id=? AND uid=?", (entry_id, u["id"]))
    if not e:
        fail(404, "রেকর্ড পাওয়া যায়নি")
    if e.get("voided_at"):
        fail(400, "এই রেকর্ড আগেই বাতিল করা হয়েছে")
    if not (reason or "").strip():
        fail(400, "বাতিলের কারণ লিখুন")
    if e["kind"] == "sale" and e["crop"] and e["cost_basis"] is not None and e["qty"]:
        S.stock_add(u["id"], e["crop"], e["qty"], e["cost_basis"])          # put the stock back at its cost
    if e["kind"] == "stock" and e["crop"] and e["qty"]:
        if S.unlisted(u["id"], e["crop"]) < e["qty"]:
            fail(400, "এই কেনা মালের কিছু অংশ বিক্রি বা লিস্টিং হয়ে গেছে, তাই বাতিল করা যাবে না")
        S.stock_take(u["id"], e["crop"], e["qty"])
    db.run("UPDATE entries SET voided_at=?, void_reason=? WHERE id=?", (S.now(), reason.strip()[:200], entry_id))
    audit(u["id"], "entry", entry_id, "voided", {"reason": reason.strip()[:200]})
    return {"ok": True}


def list_records(uid, start=None, end=None, include_voided=True):
    out = []
    for e in db.q("SELECT * FROM entries WHERE uid=? ORDER BY at DESC", (uid,)):
        v = entry_view(e)
        if in_range(v["date"], start, end) and (include_voided or not v["voided"]):
            out.append(v)
    return out


# ---------------------------------------------------------------- dues (receivable / payable)
def create_due(u, direction, counterparty, amount, due_date=None, description=None):
    if direction not in ("receivable", "payable"):
        fail(400, "পাওনা না দেনা, বাছুন")
    amount_p = to_p(amount)
    if amount_p <= 0 or amount_p > MAX_AMOUNT_P:
        fail(400, "টাকার অঙ্ক ঠিক নেই")
    if not (counterparty or "").strip():
        fail(400, "কার কাছে পাওনা/দেনা, নাম লিখুন")
    dd = None
    if due_date:
        try:
            dd = date.fromisoformat(due_date).isoformat()
        except ValueError:
            fail(400, "শেষ তারিখ ঠিক নেই")
    d = {"id": nid("Q"), "uid": u["id"], "direction": direction, "counterparty": counterparty.strip()[:80],
         "description": (description or "")[:200], "amount_p": amount_p, "due_date": dd, "created": S.now(),
         "voided_at": None, "void_reason": None}
    db.insert("dues", d)
    audit(u["id"], "due", d["id"], "created", {"direction": direction, "amount_p": amount_p})
    return due_view(d)


def due_view(d):
    pays = db.q("SELECT * FROM due_payments WHERE due_id=? ORDER BY at", (d["id"],))
    paid = sum(p["amount_p"] for p in pays)
    out = d["amount_p"] - paid
    status = "paid" if out <= 0 else "partial" if paid else "unpaid"
    if status != "paid" and d.get("due_date") and d["due_date"] < today():
        status = "overdue"
    return {"id": d["id"], "source": "user_reported", "direction": d["direction"], "counterparty": d["counterparty"],
            "description": d["description"], "amount": tk(d["amount_p"]), "paid": tk(paid), "outstanding": tk(max(out, 0)),
            "due_date": d.get("due_date"), "created_date": day_of(d["created"]), "status": status,
            "status_bn": STATUS_BN[status], "voided": bool(d.get("voided_at")),
            "payments": [{"id": p["id"], "amount": tk(p["amount_p"]), "date": p["pay_date"], "note": p["note"],
                          "receipt_id": p["receipt_id"]} for p in pays]}


def pay_due(u, due_id, amount, d, note=None):
    due = db.one("SELECT * FROM dues WHERE id=? AND uid=?", (due_id, u["id"]))
    if not due or due.get("voided_at"):
        fail(404, "পাওনা/দেনা পাওয়া যায়নি")
    amount_p = to_p(amount)
    v = due_view(due)
    if amount_p <= 0 or amount_p > to_p(v["outstanding"]):
        fail(400, f"টাকার অঙ্ক বাকি অঙ্কের ({v['outstanding']}) বেশি বা শূন্য হতে পারবে না")
    d = parse_day(d)
    pid = nid("P")
    r = _receipt(u["id"], "manual", "in" if due["direction"] == "receivable" else "out", amount_p, f"due:{pid}",
                 S.now(), "user_reported", due_id=due_id, note=(note or "")[:200], pay_date=d, method="manual")
    db.insert("due_payments", {"id": pid, "due_id": due_id, "amount_p": amount_p, "pay_date": d, "at": S.now(),
                               "note": (note or "")[:200], "receipt_id": r["id"]})
    audit(u["id"], "due", due_id, "payment", {"amount_p": amount_p, "date": d})
    return due_view(db.one("SELECT * FROM dues WHERE id=?", (due_id,)))


def void_due(u, due_id, reason):
    due = db.one("SELECT * FROM dues WHERE id=? AND uid=?", (due_id, u["id"]))
    if not due or due.get("voided_at"):
        fail(404, "পাওনা/দেনা পাওয়া যায়নি")
    if db.val("SELECT COUNT(*) FROM due_payments WHERE due_id=?", (due_id,)):
        fail(400, "টাকা লেনদেন হয়ে গেছে, তাই এটি বাতিল করা যাবে না")
    if not (reason or "").strip():
        fail(400, "বাতিলের কারণ লিখুন")
    db.run("UPDATE dues SET voided_at=?, void_reason=? WHERE id=?", (S.now(), reason.strip()[:200], due_id))
    audit(u["id"], "due", due_id, "voided", {"reason": reason.strip()[:200]})
    return {"ok": True}


def platform_dues(uid):
    """Amounts that follow from platform orders (not stored separately, so they can never disagree)."""
    out = []
    for o in db.q("SELECT * FROM orders WHERE (seller=? OR buyer=?) AND status IN ('awaiting_payment','confirmed','handed_over')",
                  (uid, uid)):
        other = S.user(o["buyer"] if o["seller"] == uid else o["seller"])
        name = other["biz"] if other["role"] == "paikar" and other["biz"] else other["name"]
        crop = CROPS[o["crop"]][0]
        if o["seller"] == uid and o["status"] in ("confirmed", "handed_over"):
            out.append({"id": o["id"], "source": "platform", "direction": "receivable", "amount": o["payout"],
                        "outstanding": o["payout"], "counterparty": f"Reroute এসক্রো ({name})", "status": "pending",
                        "status_bn": "মাল বুঝে দিলে ওয়ালেটে আসবে", "description": f"{crop} বিক্রি, অর্ডার {o['id']}",
                        "link": f"#/order/{o['id']}"})
        if o["buyer"] == uid and o["status"] == "awaiting_payment":
            out.append({"id": o["id"], "source": "platform", "direction": "payable", "amount": o["buyer_total"],
                        "outstanding": o["buyer_total"], "counterparty": name, "status": "unpaid",
                        "status_bn": STATUS_BN["unpaid"], "description": f"{crop} কেনা, অর্ডার {o['id']}",
                        "link": f"#/order/{o['id']}"})
    return out


def list_dues(uid, include_voided=False):
    manual = [due_view(d) for d in db.q("SELECT * FROM dues WHERE uid=? ORDER BY created DESC", (uid,))]
    manual = [d for d in manual if include_voided or not d["voided"]]
    return platform_dues(uid) + manual


def dues_summary(uid):
    ds = list_dues(uid)
    rec = sum(dec(d["outstanding"]) for d in ds if d["direction"] == "receivable")
    pay = sum(dec(d["outstanding"]) for d in ds if d["direction"] == "payable")
    return {"receivable": float(rec), "payable": float(pay),
            "overdue": sum(1 for d in ds if d.get("status") == "overdue")}


# ---------------------------------------------------------------- profit & loss
def pnl(uid, start=None, end=None):
    """Profit and loss for a date range (inclusive, Dhaka dates); None = all time. See module docstring."""
    u = S.user(uid)
    farmer = u["role"] == "farmer"
    sales, expenses = [], {}
    rev = cashback = fees = D0

    def add_exp(cat, amt, src):
        e = expenses.setdefault(cat, {"amount": D0, "platform": D0, "user_reported": D0})
        e["amount"] += amt
        e[src] += amt

    for o in db.q("SELECT * FROM orders WHERE seller=? AND status='completed'", (uid,)):
        if not in_range(day_of(o["completed_at"]), start, end):
            continue
        rev += dec(o["goods"])
        cashback += dec(o["cashback"])
        add_exp("platform_fee", dec(o["fee"]) - dec(o["fee_disc"]), "platform")
        if o["t_seller"]:
            add_exp("platform_transport", dec(o["t_seller"]) - dec(o["t_cs"]), "platform")
        sales.append((o["crop"], dec(o["qty"]), None if o["cost_basis"] is None else dec(o["cost_basis"])))
    for b in db.q("SELECT * FROM bookings WHERE uid=? AND order_id IS NULL AND paid=1 AND status<>'cancelled'", (uid,)):
        if in_range(day_of(b["created"]), start, end):
            add_exp("platform_transport", dec(b["total"]) - dec(b["credit_used"]), "platform")
    purchases = D0
    for o in db.q("SELECT * FROM orders WHERE buyer=? AND status='completed'", (uid,)):
        if in_range(day_of(o["completed_at"]), start, end):
            purchases += dec(o["goods"]) + dec(o["t_buyer"]) - dec(o["t_cb"])
    prod_crops, prod_general = set(), False
    ext_rev = D0
    for e in db.q("SELECT * FROM entries WHERE uid=? AND voided_at IS NULL", (uid,)):
        d = _entry_date(e)
        if e["kind"] == "expense" and (e.get("category") or "other") in ("production", "harvest"):
            # production costs cover their crop even when recorded in another period of the same season
            if e["crop"]:
                prod_crops.add(e["crop"])
            else:
                prod_general = True
        if not in_range(d, start, end):
            continue
        if e["kind"] == "sale":
            ext_rev += dec(e["amount"])
            sales.append((e["crop"], dec(e["qty"]) if e["qty"] else D0, None if e["cost_basis"] is None else dec(e["cost_basis"])))
        elif e["kind"] == "expense":
            add_exp(e.get("category") or "other", dec(e["amount"]), "user_reported")
        elif e["kind"] == "stock":
            purchases += dec(e["amount"])
    rev += ext_rev
    cogs, unknown_qty, unknown_crops = D0, D0, set()
    for crop, qty, cb in sales:
        if farmer and (prod_general or crop in prod_crops):
            continue                                     # costed through recorded production expenses
        if cb is not None and qty:
            cogs += cb * qty
        elif cb is None:
            unknown_qty += qty
            unknown_crops.add(crop)
    total_exp = sum((e["amount"] for e in expenses.values()), D0)
    # a sale without crop or quantity has an unknown cost too
    complete = unknown_qty == 0 and None not in unknown_crops
    profit = rev + cashback - cogs - total_exp
    q2 = Decimal("0.01")
    return {
        "range": {"start": start, "end": end}, "role": u["role"],
        "revenue": float(rev.quantize(q2)), "revenue_platform": float((rev - ext_rev).quantize(q2)),
        "revenue_external": float(ext_rev.quantize(q2)), "other_income": float(cashback.quantize(q2)),
        "cost_of_goods": float(cogs.quantize(q2)), "unknown_cost_qty_kg": float(unknown_qty),
        "unknown_cost_crops": sorted(c for c in unknown_crops if c),
        "expenses": {k: {"amount": float(v["amount"].quantize(q2)), "platform": float(v["platform"].quantize(q2)),
                         "user_reported": float(v["user_reported"].quantize(q2)), "label": EXPENSE_CATEGORIES.get(k, k)}
                     for k, v in sorted(expenses.items())},
        "total_expenses": float(total_exp.quantize(q2)), "purchases_to_stock": float(purchases.quantize(q2)),
        "profit_complete": complete, "profit": float(profit.quantize(q2)) if complete else None,
        "profit_message": None if complete else PROFIT_MISSING, "profit_message_en": None if complete else PROFIT_MISSING_EN,
        "sales_count": len(sales),
        "method": "পাইকার: ভারিত গড় মজুদ খরচ (কেনা মজুদে যায়, বিক্রির সময় খরচ ধরা হয়)। কৃষক: উৎপাদন খরচ লেখা থাকলে সেটাই ওই ফসলের খরচ, না থাকলে লিস্টিংয়ে দেওয়া কেজিপ্রতি খরচ।",
    }


def legacy_pnl(uid):
    """The fields the older "মজুদ ও হিসাব" page and dashboard use, computed by the same rules as Smart Hisab."""
    p = pnl(uid)
    ex = p["expenses"]
    transport = sum(v["amount"] for k, v in ex.items() if k in ("platform_transport", "transport"))
    fees = ex.get("platform_fee", {}).get("amount", 0)
    other = p["total_expenses"] - transport - fees
    buys = db.val("SELECT COUNT(*) FROM orders WHERE buyer=? AND status='completed'", (uid,)) or 0
    return {"revenue": p["revenue"], "cashback": p["other_income"], "cost_of_goods": p["cost_of_goods"],
            "unknown_cost_qty": p["unknown_cost_qty_kg"], "transport": transport, "fees": fees, "other": other,
            "expense": p["cost_of_goods"] + p["total_expenses"],
            "profit": round(p["revenue"] + p["other_income"] - p["cost_of_goods"] - p["total_expenses"], 2),
            "exact": p["profit_complete"], "purchases": p["purchases_to_stock"], "sales_count": p["sales_count"],
            "buys_count": buys}


# ---------------------------------------------------------------- overview & reports
def period_bounds(period, start=None, end=None):
    t = date.fromisoformat(today())
    if period == "today":
        return t.isoformat(), t.isoformat()
    if period == "week":
        return (t - timedelta(days=t.weekday())).isoformat(), t.isoformat()
    if period == "month":
        return t.replace(day=1).isoformat(), t.isoformat()
    if period == "year":
        return t.replace(month=1, day=1).isoformat(), t.isoformat()
    if period == "custom":
        s, e = parse_day(start, "শুরুর তারিখ"), parse_day(end, "শেষের তারিখ")
        if s > e:
            fail(400, "শুরুর তারিখ শেষের তারিখের পরে হতে পারে না")
        return s, e
    return None, None                                     # all time


def overview(uid, period="month", start=None, end=None):
    s, e = period_bounds(period, start, end)
    invs = list_invoices(uid)[:5]
    recs = [receipt_view(r) for r in db.q("SELECT * FROM receipts WHERE uid=? ORDER BY at DESC LIMIT 5", (uid,))]
    return {"period": period, "start": s, "end": e, "pnl": pnl(uid, s, e), "dues": dues_summary(uid),
            "recent_invoices": invs, "recent_receipts": recs,
            "counts": {"invoices": db.val("SELECT COUNT(*) FROM invoices WHERE seller=? OR buyer=?", (uid, uid)) or 0,
                       "records": db.val("SELECT COUNT(*) FROM entries WHERE uid=? AND voided_at IS NULL", (uid,)) or 0}}


def _bucket(d, group):
    x = date.fromisoformat(d)
    if group == "week":
        return (x - timedelta(days=x.weekday())).isoformat()
    if group == "month":
        return d[:7]
    return d


def report(uid, period="month", start=None, end=None, group="day"):
    if group not in ("day", "week", "month"):
        fail(400, "ভাগ ঠিক নেই")
    s, e = period_bounds(period, start, end)
    rows = []          # (date, crop, kg, amount, source)
    for o in db.q("SELECT * FROM orders WHERE seller=? AND status='completed'", (uid,)):
        d = day_of(o["completed_at"])
        if in_range(d, s, e):
            rows.append((d, o["crop"], dec(o["qty"]), dec(o["goods"]), "platform"))
    for x in db.q("SELECT * FROM entries WHERE uid=? AND kind='sale' AND voided_at IS NULL", (uid,)):
        d = _entry_date(x)
        if in_range(d, s, e):
            rows.append((d, x["crop"], dec(x["qty"]), dec(x["amount"]), "user_reported"))
    by_period, by_crop = {}, {}
    for d, crop, kg, amt, src in rows:
        b = by_period.setdefault(_bucket(d, group), {"revenue": D0, "kg": D0, "count": 0})
        b["revenue"] += amt
        b["kg"] += kg
        b["count"] += 1
        c = by_crop.setdefault(crop or "-", {"revenue": D0, "kg": D0, "count": 0})
        c["revenue"] += amt
        c["kg"] += kg
        c["count"] += 1
    p = pnl(uid, s, e)
    return {"start": s, "end": e, "group": group,
            "sales": [{"period": k, "revenue": float(v["revenue"]), "kg": float(v["kg"]), "count": v["count"]}
                      for k, v in sorted(by_period.items())],
            "products": [{"crop": k, "crop_bn": CROPS[k][0] if k in CROPS else "ফসল উল্লেখ নেই", "revenue": float(v["revenue"]),
                          "kg": float(v["kg"]), "avg_price": float((v["revenue"] / v["kg"]).quantize(Decimal("0.01"))) if v["kg"] else None,
                          "count": v["count"]} for k, v in sorted(by_crop.items(), key=lambda kv: -kv[1]["revenue"])],
            "expenses": [{"category": k, **v} for k, v in p["expenses"].items()],
            "pnl": p, "dues": dues_summary(uid),
            "note": "প্ল্যাটফর্মের পেমেন্ট সিমুলেটেড; নিজে লেখা রেকর্ড যাচাই করা নয়।"}


def report_csv(rep, user):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Reroute Agro — Smart Hisab report", user["name"], f"{rep['start'] or 'all'} to {rep['end'] or 'all'}"])
    w.writerow([])
    w.writerow(["section", "key", "label", "revenue_tk", "kg", "count"])
    for r in rep["sales"]:
        w.writerow(["sales_by_period", r["period"], "", r["revenue"], r["kg"], r["count"]])
    for r in rep["products"]:
        w.writerow(["sales_by_product", r["crop"], r["crop_bn"], r["revenue"], r["kg"], r["count"]])
    w.writerow([])
    w.writerow(["section", "category", "label", "amount_tk", "platform_tk", "user_reported_tk"])
    for r in rep["expenses"]:
        w.writerow(["expenses", r["category"], r["label"], r["amount"], r["platform"], r["user_reported"]])
    p = rep["pnl"]
    w.writerow([])
    w.writerow(["pnl", "revenue", "", p["revenue"]])
    w.writerow(["pnl", "other_income", "", p["other_income"]])
    w.writerow(["pnl", "cost_of_goods", "", p["cost_of_goods"]])
    w.writerow(["pnl", "total_expenses", "", p["total_expenses"]])
    w.writerow(["pnl", "profit", "", p["profit"] if p["profit_complete"] else "", p["profit_message_en"] or ""])
    w.writerow(["dues", "receivable_outstanding", "", rep["dues"]["receivable"]])
    w.writerow(["dues", "payable_outstanding", "", rep["dues"]["payable"]])
    w.writerow([])
    w.writerow(["note", "Platform payments are simulated; user-reported records are not verified."])
    return "﻿" + buf.getvalue()


# ---------------------------------------------------------------- documents (optional receipt photos / PDFs)
MAX_DOC_CHARS = 700_000


def save_document(u, data_url, decode_image):
    if len(data_url or "") > MAX_DOC_CHARS:
        fail(400, "ফাইল বড়, ৫০০ কেবির মধ্যে দিন")
    img = decode_image(data_url)
    if img:
        mime = img[0]
    else:
        import base64
        import binascii
        try:
            head, b64 = data_url.split(",", 1)
            raw = base64.b64decode(b64, validate=True)
        except (ValueError, binascii.Error):
            fail(400, "শুধু ছবি (JPG/PNG/WebP) বা PDF দেওয়া যাবে")
        if head != "data:application/pdf;base64" or not raw.startswith(b"%PDF-"):
            fail(400, "শুধু ছবি (JPG/PNG/WebP) বা PDF দেওয়া যাবে")
        mime = "application/pdf"
    doc = {"id": nid("F"), "uid": u["id"], "kind": "receipt_attachment", "mime": mime, "data": data_url, "created": S.now()}
    db.insert("documents", doc)
    audit(u["id"], "document", doc["id"], "uploaded", {"mime": mime})
    return {"id": doc["id"], "mime": mime}
