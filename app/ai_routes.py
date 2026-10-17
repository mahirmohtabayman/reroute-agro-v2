"""
AI পরামর্শ API. Kept separate so the rest of the app is untouched: main.py only does
`app.include_router(ai_router)`.

* /api/ai/advisor/farmer, /buyer, /market   – the single "AI পরামর্শ" page (farmer or paikar view)
* /api/ai/advisor/trade-check                – Smart Trade Alert before an offer / acceptance / counter / listing
* /api/ai/advisor/admin/...                  – completed-transaction dataset, CSV / Excel export, model evaluation

Data: SIMULATED vegetable markets (ml/vegsim.py), model: models/veg_model.joblib.
The profit / loss numbers are plain arithmetic on known costs; the model only gives the expected resale price.
"""
import csv
import io
import zipfile
from datetime import datetime, timedelta, timezone
from typing import Optional
from xml.sax.saxutils import escape

from fastapi import APIRouter, Header, HTTPException, Response

from pydantic import BaseModel, Field

from app import advisor as ADVISOR, db, services as S
from app.logic import CROPS, PLACES, transport_quote
from app.veg_ai import SHELF, SPLIT_BUYER, VegAI

router = APIRouter(prefix="/api/ai/advisor", tags=["AI পরামর্শ (simulated market data)"])
VEG = VegAI()
BD_TZ = timezone(timedelta(hours=6))          # Asia/Dhaka, no daylight saving
RETRAIN_MIN_PER_CROP = 200                    # real completed deals needed per crop before retraining
RETRAIN_MIN_DAYS = 90                         # ... spread over at least this many days


def _user(x_token):
    from app.main import get_user          # imported here to avoid a circular import
    return get_user(x_token)


def _trader(x_token):
    u = _user(x_token)
    if not u:
        raise HTTPException(401, "আপনার সেশন শেষ হয়েছে, আবার লগ ইন করুন")
    if u["role"] not in ("farmer", "paikar"):
        raise HTTPException(403, "এই কাজ কৃষক বা পাইকারের জন্য")
    return u


def _admin(x_token):
    u = _user(x_token)
    if not u or u["role"] != "admin":
        raise HTTPException(403, "শুধু Reroute অপারেশন টিম")
    return u


def _ready():
    if not VEG.ready:
        raise HTTPException(503, "AI প্রস্তুত হচ্ছে, কয়েক সেকেন্ড পরে আবার চেষ্টা করুন")


def _check(place, crop):
    if place not in PLACES or crop not in CROPS:
        raise HTTPException(400, "জেলা ও ফসল ঠিক নেই")


def _qty(qty):
    if not 40 <= qty <= 100_000:
        raise HTTPException(400, "পরিমাণ ১ মণ থেকে ২,৫০০ মণের মধ্যে দিন")


def _stock_cost(uid, crop):
    """Average cost per kg of the seller's stock (production cost for farmers, landed cost for paikars)."""
    r = db.one("SELECT cost FROM stock WHERE uid=? AND crop=?", (uid, crop))
    return r["cost"] if r and r["cost"] is not None else None


# ---------------------------------------------------------------- the AI পরামর্শ page
@router.get("/status")
def status():
    return {"ready": VEG.ready, "date": VEG.state["date"] if VEG.ready else None, "metrics": VEG.metrics,
            "simulated": True, "error": VEG.error}


@router.get("/farmer")
def farmer(src: str, crop: str, qty: float, days_left: Optional[int] = None, cost: Optional[float] = None,
           x_token: Optional[str] = Header(None)):
    """Today's price, 3-day forecast, suggested selling price, where/when to sell and the expected profit."""
    _ready()
    _check(src, crop)
    _qty(qty)
    if cost is not None and cost < 0:
        raise HTTPException(400, "উৎপাদন খরচ ঠিক নেই")
    if days_left is not None and not 1 <= days_left <= 60:
        raise HTTPException(400, "তাজা থাকার দিন ঠিক নেই")
    u = _user(x_token)
    return VEG.advice(src, crop, qty, days_left, cost, bool(u and S.is_plus(u)))


@router.get("/smart-sell")
def smart_sell(src: str, crop: str, qty: float, days_left: Optional[int] = None, cost: Optional[float] = None,
               x_token: Optional[str] = Header(None)):
    """Smart Selling Advisor: one recommendation (sell now / wait / other market / insufficient evidence) with
    revenue, costs, net proceeds, profit (when the cost is known), risks, reasons and data provenance."""
    _ready()
    _check(src, crop)
    _qty(qty)
    if cost is not None and cost < 0:
        raise HTTPException(400, "উৎপাদন খরচ ঠিক নেই")
    if days_left is not None and not 1 <= days_left <= 60:
        raise HTTPException(400, "তাজা থাকার দিন ঠিক নেই")
    u = _user(x_token)
    adv = VEG.advice(src, crop, qty, days_left, cost, bool(u and S.is_plus(u)))
    out = ADVISOR.decide(adv, VEG.model is not None, temp=VEG.state["temp"].get(src, 27.0))
    out.update({"src": src, "crop": crop, "kg": qty, "days_left": adv["days_left"], "cost": cost,
                "markets": [{k: o[k] for k in ("market", "name", "send_in_days", "price", "net", "net_lo", "net_hi",
                                                "truck", "spoil_pct", "vs_local")} for o in adv["markets"]],
                "provenance": ADVISOR.provenance(VEG, adv), "simulated": True})
    return out


@router.get("/spoilage")
def spoilage(crop: str, harvest_days_ago: int = 0, travel_hours: float = 0, wait_days: int = 0,
             storage: str = "ambient", place: str = "rajshahi"):
    """Crop Freshness & Spoilage Risk (prototype rule set, see app/advisor.py RISK_RULES)."""
    _check(place, crop)
    if not 0 <= harvest_days_ago <= 60 or not 0 <= travel_hours <= 72 or not 0 <= wait_days <= 30 \
            or storage not in ("ambient", "cool"):
        raise HTTPException(400, "তথ্য ঠিক নেই")
    temp = VEG.state["temp"].get(place, 27.0) if VEG.ready else 27.0
    days_left = CROPS[crop][1] - harvest_days_ago
    return ADVISOR.spoilage_risk(crop, days_left, travel_hours, wait_days, temp, storage)


class AskIn(BaseModel):
    text: str = Field(min_length=1, max_length=300)


@router.post("/parse")
def parse(body: AskIn):
    """Understand a typed or spoken question. Only extracts fields; it never runs a transaction."""
    return ADVISOR.parse_query(body.text)


@router.get("/buyer")
def buyer(place: str, crop: str, qty: float, x_token: Optional[str] = Header(None)):
    """Suggested buying price, where good produce is cheap, where to resell and the expected profit."""
    _ready()
    _check(place, crop)
    _qty(qty)
    u = _user(x_token)
    raw = db.q("SELECT * FROM listings WHERE status='active' AND crop=?", (crop,))
    listings = [{**l, "eff_price": S.eff_price(l), "days_left": S.days_left(l)} for l in raw]
    users = {}
    for uid in {l["uid"] for l in listings}:
        x = S.user(uid)
        if x:
            x["rating"] = db.val('SELECT ROUND(AVG(stars),1) FROM ratings WHERE "to"=?', (uid,))
            users[uid] = x
    out = VEG.sources(place, crop, qty, listings, users, bool(u and S.is_plus(u)), u["id"] if u else None)
    live = [l for l in listings if not u or l["uid"] != u["id"]]
    out["reroute_listings"] = len(live)
    out["reroute_avg"] = round(sum(l["eff_price"] for l in live) / len(live), 1) if live else None
    return out


@router.get("/market")
def market(crop: str):
    """Today's price, the next 3 days and glut warnings in every market."""
    _ready()
    if crop not in CROPS:
        raise HTTPException(400, "ফসল ঠিক নেই")
    out = VEG.overview(crop)
    live = db.q("SELECT * FROM listings WHERE status='active' AND crop=?", (crop,))
    out["reroute_listings"] = len(live)
    out["reroute_avg"] = round(sum(S.eff_price(l) for l in live) / len(live), 1) if live else None
    return out


@router.get("/series")
def series(market: str, crop: str):
    _ready()
    _check(market, crop)
    s = VEG.state
    return {**s["series"][market][crop], "fc": s["fc"][market][crop], "interval": VEG.interval, "date": s["date"],
            "simulated": True}


# ---------------------------------------------------------------- Smart Trade Alert
@router.get("/trade-check")
def trade_check(mode: str, listing: Optional[str] = None, offer: Optional[str] = None, crop: Optional[str] = None,
                qty: Optional[float] = None, price: Optional[float] = None, transport: str = "reroute",
                split: str = "half", cost: Optional[float] = None, x_token: Optional[str] = Header(None)):
    """
    Profit / loss of one specific deal, worked out before the user confirms it.
      mode=offer   : paikar is about to send an offer on a listing (listing, qty, price, transport, split)
      mode=deal    : the logged-in party is about to accept an offer / counter, or the seller is about to
                     send a counter price (offer, optional price)
      mode=listing : a seller is about to publish a listing (crop, qty, price, optional cost)
    It never blocks the deal: the user decides after seeing the result.
    """
    _ready()
    u = _trader(x_token)
    if transport not in ("reroute", "self") or split not in SPLIT_BUYER:
        raise HTTPException(400, "পরিবহন বাছাই ঠিক নেই")
    if price is not None and price <= 0:
        raise HTTPException(400, "দাম ঠিক নেই")

    if mode == "offer":
        l = db.one("SELECT * FROM listings WHERE id=?", (listing,)) if listing else None
        if not l or l["uid"] == u["id"]:
            raise HTTPException(404, "লিস্টিং পাওয়া যায়নি")
        if qty is None or price is None:
            raise HTTPException(400, "পরিমাণ ও দাম দিন")
        seller = S.user(l["uid"])
        return VEG.check_buy(seller["place"], u["place"], l["crop"], qty, price, transport, split,
                             max(1, S.days_left(l)), S.is_plus(u), S.is_bulk(u["id"]))

    if mode == "deal":
        o = db.one("SELECT * FROM offers WHERE id=?", (offer,)) if offer else None
        if not o or u["id"] not in (o["buyer"], o["seller"]):
            raise HTTPException(404, "অফার পাওয়া যায়নি")
        buyer_u, seller_u = S.user(o["buyer"]), S.user(o["seller"])
        p = price if price is not None else o["price"]
        l = db.one("SELECT * FROM listings WHERE id=?", (o["listing"],))
        sp = o["split"] if o["split"] in SPLIT_BUYER else "half"
        if u["id"] == o["buyer"]:
            return VEG.check_buy(seller_u["place"], buyer_u["place"], o["crop"], o["qty"], p, o["transport"], sp,
                                 max(1, S.days_left(l)) if l else SHELF[o["crop"]],
                                 S.is_plus(buyer_u), S.is_bulk(buyer_u["id"]))
        share = 0
        if o["transport"] == "reroute" and seller_u["place"] != buyer_u["place"]:
            q = transport_quote(seller_u["place"], buyer_u["place"], o["qty"], S.is_plus(buyer_u),
                                S.is_bulk(buyer_u["id"]))
            share = q["total"] * (1 - SPLIT_BUYER[sp])
        c = (l["prod_cost"] if l and l["prod_cost"] is not None else _stock_cost(u["id"], o["crop"]))
        return VEG.check_sell(seller_u["place"], o["crop"], o["qty"], p, c, share, True)

    if mode == "listing":
        if crop not in CROPS or qty is None or price is None:
            raise HTTPException(400, "ফসল, পরিমাণ ও দাম দিন")
        if cost is not None and cost < 0:
            raise HTTPException(400, "খরচ ঠিক নেই")
        c = cost if cost is not None else _stock_cost(u["id"], crop)
        out = VEG.check_sell(u["place"], crop, qty, price, c, 0, False)
        fc = VEG.state["fc"]
        top = max(max(fc[m][crop]) for m in fc)
        out["market_top"] = round(top, 1)
        out["above_market"] = price > top * 1.15
        return out

    raise HTTPException(400, "অজানা হিসাব")


# ---------------------------------------------------------------- admin: transaction dataset, export, evaluation
COLUMNS = [
    ("transaction_id", "লেনদেন আইডি"), ("completed_date", "সম্পন্নের তারিখ (ঢাকা সময়)"),
    ("crop", "ফসল (কোড)"), ("crop_bn", "ফসল"), ("qty_kg", "পরিমাণ (কেজি)"),
    ("seller_role", "বিক্রেতার ধরন"), ("seller_district", "বিক্রেতার জেলা"), ("buyer_district", "ক্রেতার জেলা"),
    ("listed_price_per_kg", "তালিকার দাম ৳/কেজি"), ("deal_price_per_kg", "চূড়ান্ত দাম ৳/কেজি"),
    ("goods_total", "মালের মোট দাম ৳"), ("platform_fee", "প্ল্যাটফর্ম ফি ৳"), ("transport_mode", "পরিবহন"),
    ("transport_total", "মোট ট্রাক ভাড়া ৳"), ("transport_buyer_share", "ক্রেতার ভাড়ার ভাগ ৳"),
    ("transport_seller_share", "বিক্রেতার ভাড়ার ভাগ ৳"), ("buyer_paid_total", "ক্রেতা পরিশোধ ৳"),
    ("seller_payout", "বিক্রেতা পেয়েছেন ৳"), ("cashback", "ক্যাশব্যাক ৳"), ("status", "অবস্থা"),
    ("data_source", "ডেটার উৎস"),
]


def _is_demo(uid):
    return not str(uid).startswith("U")      # seed (demo) accounts are f1…, p1…; real sign-ups are U…


def transactions(limit=None):
    """Completed deals only — cancelled or unfinished orders are never mixed in. No names, phones or ids
    of people are exported: only what a price / profit model needs."""
    sql = ("SELECT o.*, s.place AS s_place, s.role AS s_role, b.place AS b_place FROM orders o "
           "JOIN users s ON s.id=o.seller JOIN users b ON b.id=o.buyer "
           "WHERE o.status='completed' ORDER BY o.completed_at DESC")
    rows = db.q(sql + (f" LIMIT {int(limit)}" if limit else ""))
    out = []
    for o in rows:
        t = o["completed_at"] or o["created"]
        out.append({
            "transaction_id": o["id"],
            "completed_date": datetime.fromtimestamp(t / 1000, BD_TZ).strftime("%Y-%m-%d %H:%M"),
            "crop": o["crop"], "crop_bn": CROPS[o["crop"]][0], "qty_kg": round(o["qty"], 1),
            "seller_role": o["s_role"], "seller_district": o["s_place"], "buyer_district": o["b_place"],
            "listed_price_per_kg": o["listed_price"], "deal_price_per_kg": o["price"],
            "goods_total": o["goods"], "platform_fee": round((o["fee"] or 0) - (o["fee_disc"] or 0)),
            "transport_mode": o["transport"], "transport_total": o["t_total"] or 0,
            "transport_buyer_share": o["t_buyer"] or 0, "transport_seller_share": o["t_seller"] or 0,
            "buyer_paid_total": o["buyer_total"], "seller_payout": o["payout"], "cashback": o["cashback"] or 0,
            "status": o["status"],
            "data_source": "demo" if (_is_demo(o["buyer"]) or _is_demo(o["seller"])) else "platform",
        })
    return out


def _summary(rows):
    real = [r for r in rows if r["data_source"] == "platform"]
    by_crop = {}
    for r in rows:
        c = by_crop.setdefault(r["crop"], {"crop": r["crop"], "name": r["crop_bn"], "all": 0, "platform": 0,
                                           "kg": 0, "avg_price": 0})
        c["all"] += 1
        c["kg"] += r["qty_kg"]
        c["avg_price"] += r["deal_price_per_kg"] * r["qty_kg"]
        if r["data_source"] == "platform":
            c["platform"] += 1
    for c in by_crop.values():
        c["avg_price"] = round(c["avg_price"] / c["kg"], 1) if c["kg"] else None
        c["kg"] = round(c["kg"])
    dates = sorted(r["completed_date"] for r in real)
    span = (datetime.fromisoformat(dates[-1][:10]) - datetime.fromisoformat(dates[0][:10])).days if dates else 0
    return {"completed_total": len(rows), "platform": len(real), "demo": len(rows) - len(real),
            "first": dates[0] if dates else None, "last": dates[-1] if dates else None, "span_days": span,
            "by_crop": sorted(by_crop.values(), key=lambda c: -c["all"])}


@router.get("/admin/transactions")
def admin_transactions(limit: int = 30, x_token: Optional[str] = Header(None)):
    _admin(x_token)
    rows = transactions()
    return {"summary": _summary(rows), "rows": rows[:max(1, min(limit, 500))], "columns": COLUMNS}


def _xlsx(headers, rows):
    """A minimal, valid Excel workbook built with the standard library (no extra dependency)."""
    def col(i):
        s = ""
        i += 1
        while i:
            i, r = divmod(i - 1, 26)
            s = chr(65 + r) + s
        return s

    def cell(ref, v):
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            return f'<c r="{ref}"><v>{v}</v></c>'
        return f'<c r="{ref}" t="inlineStr"><is><t xml:space="preserve">{escape(str(v if v is not None else ""))}</t></is></c>'

    lines = []
    for ri, row in enumerate([headers] + rows, start=1):
        lines.append(f'<row r="{ri}">' + "".join(cell(f"{col(ci)}{ri}", v) for ci, v in enumerate(row)) + "</row>")
    sheet = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
             '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
             '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews>'
             f'<sheetData>{"".join(lines)}</sheetData></worksheet>')
    files = {
        "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '</Types>',
        "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '</Relationships>',
        "xl/workbook.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="transactions" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '</Relationships>',
        "xl/worksheets/sheet1.xml": sheet,
    }
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in files.items():
            z.writestr(name, data)
    return buf.getvalue()


@router.get("/admin/export")
def admin_export(fmt: str = "csv", source: str = "all", x_token: Optional[str] = Header(None)):
    """Completed transactions as CSV (UTF-8 with BOM, opens in Excel with Bangla intact) or a real .xlsx."""
    _admin(x_token)
    if fmt not in ("csv", "xlsx") or source not in ("all", "platform"):
        raise HTTPException(400, "ফরম্যাট ঠিক নেই")
    rows = transactions()
    if source == "platform":
        rows = [r for r in rows if r["data_source"] == "platform"]
    keys = [k for k, _ in COLUMNS]
    stamp = datetime.now(BD_TZ).strftime("%Y%m%d-%H%M")
    name = f"reroute-transactions-{source}-{stamp}.{fmt}"
    if fmt == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(keys)
        for r in rows:
            w.writerow([r[k] for k in keys])
        return Response(("\ufeff" + buf.getvalue()).encode("utf-8"), media_type="text/csv; charset=utf-8",
                        headers={"Content-Disposition": f'attachment; filename="{name}"'})
    data = _xlsx(keys, [[r[k] for k in keys] for r in rows])
    return Response(data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/admin/evaluation")
def admin_evaluation(x_token: Optional[str] = Header(None)):
    """Current model quality (time-ordered back-test on simulated data) and whether there is enough real
    platform data to retrain. Retraining is never forced: a new model replaces the old one only when it
    is better on later, unseen days."""
    _admin(x_token)
    summary = _summary(transactions())
    m = VEG.metrics or {}
    reasons = []
    short = [c["name"] for c in summary["by_crop"] if c["platform"] < RETRAIN_MIN_PER_CROP]
    missing = [CROPS[c][0] for c in CROPS if c not in {x["crop"] for x in summary["by_crop"]}]
    if summary["platform"] == 0:
        reasons.append("এখনো কোনো আসল (ডেমো নয়) সম্পন্ন লেনদেন নেই")
    if short or missing:
        reasons.append(f"প্রতিটি ফসলে অন্তত {RETRAIN_MIN_PER_CROP}টি আসল লেনদেন দরকার")
    if summary["span_days"] < RETRAIN_MIN_DAYS:
        reasons.append(f"অন্তত {RETRAIN_MIN_DAYS} দিনের ডেটা দরকার (এখন {summary['span_days']} দিন)")
    reasons.append("শুধু লেনদেনের দাম দিয়ে বাজারভিত্তিক ৩ দিনের পূর্বাভাস হয় না — প্রতিদিনের বাজারদরও সংগ্রহ করতে হবে")
    return {
        "model": {"data": m.get("data", "simulated"), "rows_train": m.get("rows_train"),
                  "test_period": m.get("test_period"), "horizons": m.get("horizons", {}),
                  "market_choice": m.get("market_choice"), "ready": VEG.ready,
                  "as_of": VEG.state["date"] if VEG.ready else None},
        "dataset": summary,
        "retrain": {"ready": len(reasons) == 1 and summary["platform"] > 0, "reasons": reasons,
                    "min_per_crop": RETRAIN_MIN_PER_CROP, "min_days": RETRAIN_MIN_DAYS,
                    "command": "python -m ml.train_veg"},
    }
