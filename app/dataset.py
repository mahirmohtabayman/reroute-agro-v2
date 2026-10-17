"""First-party transaction dataset for future model training.

Every COMPLETED platform order gets one `trade_records` row (written in the same transaction as the completion,
and back-filled for older orders). Listings, offers and accepted-but-undelivered orders are never treated as sales.

Data classes (never mixed silently):
  real_platform      completed order between two registered (U…) accounts
  demo_marketplace   completed order involving a seeded demo account — excluded from training
  manual_record      user-reported external sale (entries table) — reported separately, excluded by default
  simulated_model    data/simulated/veg_prices_bd_sim.csv — what the current models are trained on
  external_import    reserved for future imports (none exist yet)

A record is ELIGIBLE for training only if: real_platform, verified (paid, handed over and confirmed received),
price and quantity pass range checks, required fields are present, and it is not a duplicate.
Nothing here retrains a model. The pipeline is: collect → validate → clean → (manual) train → evaluate → deploy.
"""
import csv
import io
import statistics

from app import db, services as S
from app.logic import CROPS

PRICE_RANGE = (1.0, 500.0)          # Tk/kg plausible for these vegetables; outside → flagged, not eligible
MIN_QTY_KG, MAX_QTY_KG = 40, 100_000
DUPLICATE_WINDOW_MS = 10 * 60_000
MIN_ROWS_PER_CROP = 200             # before anyone should consider training on platform data (ai_routes uses the same)

CLASS_BN = {"real_platform": "আসল প্ল্যাটফর্ম লেনদেন", "demo_marketplace": "ডেমো লেনদেন",
            "manual_record": "নিজে লেখা রেকর্ড", "simulated_model": "সিমুলেটেড মডেল ডেটা", "external_import": "বাইরের ডেটা"}


def is_demo_uid(uid):
    return not str(uid).startswith("U")


def quality(o, l, first_offer):
    """List of reasons the record must not be used for training (empty = fine)."""
    notes = []
    if o["status"] != "completed" or not o["paid_at"] or not o["handover_at"] or not o["completed_at"]:
        notes.append("not_verified_delivery_or_payment")
    price = o["price"]
    if price is None or not (PRICE_RANGE[0] <= price <= PRICE_RANGE[1]):
        notes.append("price_out_of_range")
    if not (MIN_QTY_KG <= (o["qty"] or 0) <= MAX_QTY_KG):
        notes.append("quantity_out_of_range")
    if o["listed_price"] and price and price > o["listed_price"] * 1.05:
        notes.append("price_above_listing")
    if o["crop"] not in CROPS:
        notes.append("unknown_crop")
    if not l:
        notes.append("listing_missing")
    if first_offer is None:
        notes.append("offer_missing")
    return notes


def find_duplicate(o):
    """Another completed order with the same parties, crop, quantity and price completed within 10 minutes."""
    r = db.one("SELECT order_id FROM trade_records WHERE order_id<>? AND crop=? AND qty_kg=? AND final_price=? "
               "AND completed_at BETWEEN ? AND ? AND order_id IN (SELECT id FROM orders WHERE seller=? AND buyer=?)",
               (o["id"], o["crop"], o["qty"], o["price"], (o["completed_at"] or 0) - DUPLICATE_WINDOW_MS,
                (o["completed_at"] or 0) + DUPLICATE_WINDOW_MS, o["seller"], o["buyer"]))
    return r["order_id"] if r else None


def record_trade(o):
    """Write the trade record of a completed order once (idempotent; order_id is UNIQUE)."""
    if o["status"] != "completed" or db.one("SELECT id FROM trade_records WHERE order_id=?", (o["id"],)):
        return None
    seller, buyer = S.user(o["seller"]), S.user(o["buyer"])
    l = db.one("SELECT * FROM listings WHERE id=?", (o["listing"],))
    first = db.one("SELECT price FROM offer_events WHERE offer=? AND action='offer' ORDER BY at LIMIT 1", (o["offer"],))
    demo = is_demo_uid(o["seller"]) or is_demo_uid(o["buyer"])
    notes = quality(o, l, first["price"] if first else None)
    dup = find_duplicate(o)
    if dup:
        notes.append("duplicate")
    verified = "verified" if "not_verified_delivery_or_payment" not in notes else "unverified"
    rec = {
        "id": S.nid("T"), "order_id": o["id"], "data_class": "demo_marketplace" if demo else "real_platform",
        "verification": verified, "eligible": int(not demo and not notes), "quality_notes": ",".join(notes) or None,
        "crop": o["crop"], "variety": None, "grade": l["grade"] if l else None,
        # the platform records quantity in kg; the original unit is kept so other units can be added later
        "qty_original": o["qty"], "unit_original": "kg", "qty_kg": o["qty"],
        "seller_district": seller["place"], "seller_role": seller["role"], "buyer_district": buyer["place"],
        "buyer_market": buyer.get("market"), "listing_created": l["created"] if l else None,
        "listing_price": l["price"] if l else None, "first_offer_price": first["price"] if first else None,
        "final_price": o["price"], "completed_price": o["price"], "goods_total": o["goods"],
        "completed_at": o["completed_at"], "transport_mode": o["transport"], "transport_total": o["t_total"],
        "payment_status": "simulated_paid" if o["paid_at"] else "unpaid",
        "delivery_status": "received" if o["completed_at"] else "handed_over" if o["handover_at"] else "pending",
        "source": "reroute_platform", "recorded_at": S.now(), "duplicate_of": dup,
    }
    db.insert("trade_records", rec)
    return rec


def backfill():
    """Create records for completed orders that pre-date this feature. Returns how many were added."""
    n = 0
    with db.tx():
        for o in db.q("SELECT * FROM orders WHERE status='completed' AND id NOT IN (SELECT order_id FROM trade_records)"):
            n += 1 if record_trade(o) else 0
    return n


EXPORT_COLUMNS = ["record_id", "crop", "grade", "qty_kg", "unit_original", "qty_original", "seller_district",
                  "seller_role", "buyer_district", "listing_price_tk_kg", "first_offer_price_tk_kg",
                  "final_price_tk_kg", "goods_total_tk", "completed_date", "completed_month", "transport_mode",
                  "transport_total_tk", "transport_tk_per_kg", "payment_status", "delivery_status", "data_class",
                  "verification", "source"]


def training_rows():
    """Eligible rows only, without names, phone numbers, user or order ids (record_id is a random id)."""
    from app.hisab import day_of
    out = []
    for r in db.q("SELECT * FROM trade_records WHERE eligible=1 AND data_class='real_platform' ORDER BY completed_at"):
        d = day_of(r["completed_at"])
        out.append({"record_id": r["id"], "crop": r["crop"], "grade": r["grade"], "qty_kg": r["qty_kg"],
                    "unit_original": r["unit_original"], "qty_original": r["qty_original"],
                    "seller_district": r["seller_district"], "seller_role": r["seller_role"],
                    "buyer_district": r["buyer_district"], "listing_price_tk_kg": r["listing_price"],
                    "first_offer_price_tk_kg": r["first_offer_price"], "final_price_tk_kg": r["final_price"],
                    "goods_total_tk": r["goods_total"], "completed_date": d, "completed_month": d[:7],
                    "transport_mode": r["transport_mode"], "transport_total_tk": r["transport_total"],
                    "transport_tk_per_kg": round(r["transport_total"] / r["qty_kg"], 3) if r["qty_kg"] else None,
                    "payment_status": r["payment_status"], "delivery_status": r["delivery_status"],
                    "data_class": r["data_class"], "verification": r["verification"], "source": r["source"]})
    return out


def training_csv():
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=EXPORT_COLUMNS)
    w.writeheader()
    for r in training_rows():
        w.writerow(r)
    return "﻿" + buf.getvalue()


def summary():
    """What the platform has collected so far, per class, with the reasons rows were excluded."""
    classes = {r["data_class"]: {"rows": r["n"], "eligible": r["e"] or 0}
               for r in db.q("SELECT data_class, COUNT(*) n, SUM(eligible) e FROM trade_records GROUP BY data_class")}
    reasons = {}
    for r in db.q("SELECT quality_notes FROM trade_records WHERE data_class='real_platform' AND eligible=0"):
        for k in (r["quality_notes"] or "").split(","):
            if k:
                reasons[k] = reasons.get(k, 0) + 1
    manual = db.val("SELECT COUNT(*) FROM entries WHERE kind='sale' AND voided_at IS NULL") or 0
    per_crop = {r["crop"]: r["n"] for r in db.q("SELECT crop, COUNT(*) n FROM trade_records WHERE eligible=1 GROUP BY crop")}
    prices = {}
    for c, n in per_crop.items():
        vals = [r["final_price"] for r in db.q("SELECT final_price FROM trade_records WHERE eligible=1 AND crop=?", (c,))]
        prices[c] = {"rows": n, "median_price_tk_kg": statistics.median(vals) if vals else None,
                     "ready_for_training": n >= MIN_ROWS_PER_CROP}
    return {
        "classes": {**{k: {"rows": 0, "eligible": 0} for k in ("real_platform", "demo_marketplace")}, **classes,
                    "manual_record": {"rows": manual, "eligible": 0},
                    "simulated_model": {"rows": "data/simulated/veg_prices_bd_sim.csv", "eligible": 0}},
        "class_bn": CLASS_BN, "excluded_reasons": reasons, "per_crop": prices, "min_rows_per_crop": MIN_ROWS_PER_CROP,
        "rules": {"price_range_tk_kg": PRICE_RANGE, "qty_range_kg": [MIN_QTY_KG, MAX_QTY_KG],
                  "duplicate_window_minutes": DUPLICATE_WINDOW_MS // 60_000},
        "note": "শুধু আসল (নিবন্ধিত অ্যাকাউন্টের), যাচাই করা ও সম্পন্ন লেনদেন ট্রেনিংয়ের যোগ্য। এগুলো Reroute-এর নিজের লেনদেন, "
                "সারা বাংলাদেশের বাজারের প্রতিনিধি নয়। মডেল নিজে থেকে আবার প্রশিক্ষণ হয় না।",
        "pipeline": ["collect", "validate", "clean", "train (manual)", "evaluate", "deploy (manual)"],
    }
