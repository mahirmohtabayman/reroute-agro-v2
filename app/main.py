"""
Reroute Agro API (FastAPI)
Run locally:  uvicorn app.main:app --reload      →  http://127.0.0.1:8000      API docs: /docs
"""
import base64
import hashlib
import hmac
import json
import logging
import os
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app import db, services as S
from app.ai import PriceAI
from app.logic import (CASHBACK, CASHBACK_MIN, CROPS, FEE_MAX, FEE_MIN, FEE_RATE, MIN_ORDER_KG, PLACES, PLUS_DAYS,
                       PLUS_PRICE, REDEEM, VEHICLES, CANCEL_PENALTY, COMMISSION, SERVICE, PLUS_SERVICE_OFF,
                       BULK_SERVICE_OFF, POOL_FACTOR, MIN_SHARE, FULL_LOAD, RETURN_LOAD, OFFLINE_MARKUP, SPEED)

logging.basicConfig(level=logging.INFO)
STATIC = Path(__file__).resolve().parents[1] / "static"
SECRET = os.environ.get("SECRET_KEY", "reroute-agro-demo-secret").encode()

app = FastAPI(title="Reroute Agro API", version="2.0",
              description="কৃষক ও পাইকারের পাইকারি বাজার: অফার-দরদাম, অনলাইন পেমেন্ট, নিজস্ব ট্রাক, মজুদ ও লাভ-ক্ষতি")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

if db.needs_seed():
    from app.seed import seed
    seed()
AI = PriceAI()

# ---------------------------------------------------------------- keep the public demo fresh
# Offers expire after 48 h and unpaid orders after 24 h, so a demo left alone for days would
# look empty to a judge who opens it later. When the demo data is older than DEMO_TTL and nobody
# has changed anything for DEMO_IDLE, it is rebuilt (never in the middle of someone's session).
DEMO_TTL = int(os.environ.get("DEMO_TTL_HOURS", "12")) * 3_600_000
DEMO_IDLE = 30 * 60_000
_last_write = [0]


@app.middleware("http")
async def track_writes(request, call_next):
    if request.method != "GET" and request.url.path.startswith("/api/"):
        _last_write[0] = db.now_ms()
    return await call_next(request)


def refresh_demo_if_stale():
    if os.environ.get("DEMO_AUTO_REFRESH", "1") != "1":
        return
    try:
        seeded = int(db.val("SELECT val FROM meta WHERE key='seeded_at'") or 0)
    except Exception:
        seeded = 0
    t = db.now_ms()
    if t - seeded > DEMO_TTL and t - _last_write[0] > DEMO_IDLE:
        from app.seed import seed
        seed()


# ---------------------------------------------------------------- auth: signed tokens
# A token is "user-id.signature". It is not stored on the server, so a restart never logs anyone out.
def sign(uid):
    sig = hmac.new(SECRET, uid.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{base64.urlsafe_b64encode(uid.encode()).decode()}.{sig}"


def get_user(x_token: Optional[str] = Header(None)):
    if not x_token or "." not in x_token:
        return None
    b64, sig = x_token.rsplit(".", 1)
    try:
        uid = base64.urlsafe_b64decode(b64.encode()).decode()
    except Exception:
        return None
    if not hmac.compare_digest(sig, hmac.new(SECRET, uid.encode(), hashlib.sha256).hexdigest()[:32]):
        return None
    return S.user(uid)


def need_user(u=Depends(get_user)):
    if not u:
        raise HTTPException(401, "আপনার সেশন শেষ হয়েছে, আবার লগ ইন করুন")
    return u


def need_trader(u=Depends(need_user)):
    if u["role"] not in ("farmer", "paikar"):
        raise HTTPException(403, "এই কাজ কৃষক বা পাইকারের জন্য")
    return u


def need_admin(u=Depends(need_user)):
    if u["role"] != "admin":
        raise HTTPException(403, "শুধু Reroute অপারেশন টিম")
    return u


# ---------------------------------------------------------------- shaping data
PUBLIC_USER = "id, role, name, biz, place, area, verified, joined, (photo IS NOT NULL) AS has_photo"


def public_users():
    rows = db.q(f"SELECT {PUBLIC_USER} FROM users WHERE role!='admin'")
    stats = {r["to"]: r for r in db.q('SELECT "to", ROUND(AVG(stars),1) AS rating, COUNT(*) AS reviews FROM ratings GROUP BY "to"')}
    deals = {}
    for r in db.q("SELECT seller AS u, COUNT(*) n FROM orders WHERE status='completed' GROUP BY seller "
                  "UNION ALL SELECT buyer, COUNT(*) FROM orders WHERE status='completed' GROUP BY buyer"):
        deals[r["u"]] = deals.get(r["u"], 0) + r["n"]
    for r in rows:
        s = stats.get(r["id"], {})
        r["rating"], r["reviews"], r["deals"] = s.get("rating"), s.get("reviews", 0), deals.get(r["id"], 0)
    return rows


def shape_listing(l):
    l = dict(l)
    l["photo_count"] = len(json.loads(l.pop("photos") or "[]"))
    l["days_left"] = S.days_left(l)
    l["eff_price"] = S.eff_price(l)
    return l


def private_me(u):
    me = {k: v for k, v in u.items() if k != "photo"}
    me["has_photo"] = u["photo"] is not None
    me["plus_active"] = S.is_plus(u)
    me["bulk"] = S.is_bulk(u["id"])
    return me


CONFIG = {"vehicles": VEHICLES, "service": SERVICE, "commission": COMMISSION, "plus_off": PLUS_SERVICE_OFF,
          "bulk_off": BULK_SERVICE_OFF, "pool": POOL_FACTOR, "min_share": MIN_SHARE, "full_load": FULL_LOAD,
          "return_load": RETURN_LOAD, "offline": OFFLINE_MARKUP, "speed": SPEED, "fee_rate": FEE_RATE,
          "fee_min": FEE_MIN, "fee_max": FEE_MAX, "min_order": MIN_ORDER_KG, "plus_price": PLUS_PRICE,
          "plus_days": PLUS_DAYS, "redeem": REDEEM, "cashback": CASHBACK, "cashback_min": CASHBACK_MIN,
          "penalty": CANCEL_PENALTY, "demo_pin": S.DEMO_PIN}


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/state")
def state(u=Depends(get_user)):
    refresh_demo_if_stale()
    S.housekeeping(u["id"] if u else None)
    if u:
        u = S.user(u["id"])
    out = {"config": CONFIG, "climate": AI.climate, "users": public_users(),
           "listings": [shape_listing(l) for l in db.q(
               "SELECT * FROM listings WHERE status IN ('active','sold_out') OR uid=? ORDER BY urgent DESC, created DESC",
               (u["id"] if u else "",))],
           "trucks": db.q("SELECT id, company, vehicle, place, areas, status, trips FROM trucks"), "me": None}
    if not u:
        return out
    uid = u["id"]
    out["me"] = private_me(u)
    out["notifs"] = db.q('SELECT * FROM notifs WHERE "to"=? ORDER BY at DESC LIMIT 40', (uid,))
    if u["role"] == "admin":
        out["admin"] = admin_bundle()
        return out
    offers = db.q("SELECT * FROM offers WHERE buyer=? OR seller=? ORDER BY updated DESC", (uid, uid))
    ev = db.q(f"SELECT * FROM offer_events WHERE offer IN ({','.join('?' * len(offers)) or 'NULL'}) ORDER BY at",
              tuple(o["id"] for o in offers))
    orders = db.q("SELECT * FROM orders WHERE buyer=? OR seller=? ORDER BY created DESC", (uid, uid))
    bookings = db.q("SELECT b.* FROM bookings b LEFT JOIN orders o ON o.id=b.order_id "
                    "WHERE b.uid=? OR o.buyer=? OR o.seller=? ORDER BY b.created DESC", (uid, uid, uid))
    bev = db.q(f"SELECT * FROM booking_events WHERE booking IN ({','.join('?' * len(bookings)) or 'NULL'}) ORDER BY at",
               tuple(b["id"] for b in bookings))
    truck_ids = {b["truck"] for b in bookings if b["truck"]}
    contacts = {}
    for o in orders:
        if o["paid_at"] and o["status"] != "cancelled":
            other = S.user(o["seller"] if o["buyer"] == uid else o["buyer"])
            contacts[other["id"]] = other["phone"]
    for o in orders:
        o["pnl"] = S.order_pnl(o, uid) if o["status"] == "completed" else None
    out.update({
        "offers": offers, "offer_events": ev, "orders": orders, "bookings": bookings, "booking_events": bev,
        "my_trucks": db.q(f"SELECT * FROM trucks WHERE id IN ({','.join('?' * len(truck_ids)) or 'NULL'})", tuple(truck_ids)),
        "inspections": db.q("SELECT * FROM inspections WHERE buyer=? OR seller=? ORDER BY updated DESC", (uid, uid)),
        "payments": db.q("SELECT * FROM payments WHERE uid=? ORDER BY created DESC LIMIT 20", (uid,)),
        "wallet_tx": db.q("SELECT * FROM wallet_tx WHERE uid=? ORDER BY at DESC LIMIT 40", (uid,)),
        "points_tx": db.q("SELECT * FROM points_tx WHERE uid=? ORDER BY at DESC LIMIT 40", (uid,)),
        "entries": db.q("SELECT * FROM entries WHERE uid=? ORDER BY at DESC", (uid,)),
        "inventory": S.inventory(uid), "pnl": S.pnl(uid), "contacts": contacts,
        "rated": [r["order_id"] for r in db.q('SELECT order_id FROM ratings WHERE "from"=?', (uid,))],
    })
    return out


def admin_bundle():
    t = S.now()
    rev_fee = db.val("SELECT COALESCE(SUM(fee-fee_disc),0) FROM orders WHERE status='completed'") or 0
    rev_svc = db.val("SELECT COALESCE(SUM(service),0) FROM bookings WHERE status='delivered'") or 0
    rev_com = db.val("SELECT COALESCE(SUM(COALESCE(actual_fare,fare)-payout),0) FROM bookings WHERE status='delivered'") or 0
    rev_plus = db.val("SELECT COALESCE(SUM(amount),0) FROM payments WHERE purpose='plus' AND status='success'") or 0
    cashback = db.val("SELECT COALESCE(SUM(cashback),0) FROM orders WHERE status='completed'") or 0
    count = lambda sql: db.val(sql) or 0
    return {
        "metrics": {
            "farmers": count("SELECT COUNT(*) FROM users WHERE role='farmer'"),
            "paikars": count("SELECT COUNT(*) FROM users WHERE role='paikar'"),
            "verified": count("SELECT COUNT(*) FROM users WHERE verified=1"),
            "plus": count(f"SELECT COUNT(*) FROM users WHERE plus_until>{t}"),
            "listings_active": count("SELECT COUNT(*) FROM listings WHERE status='active'"),
            "offers_open": count("SELECT COUNT(*) FROM offers WHERE status IN ('pending','countered')"),
            "orders": {r["status"]: r["n"] for r in db.q("SELECT status, COUNT(*) n FROM orders GROUP BY status")},
            "bookings": {r["status"]: r["n"] for r in db.q("SELECT status, COUNT(*) n FROM bookings GROUP BY status")},
            "gmv": count("SELECT COALESCE(SUM(goods),0) FROM orders WHERE status='completed'"),
            "kg": count("SELECT COALESCE(SUM(qty),0) FROM orders WHERE status='completed'"),
            "revenue": {"fee": rev_fee, "service": rev_svc, "commission": rev_com, "plus": rev_plus},
            "cashback": cashback, "escrow": count("SELECT COALESCE(SUM(buyer_total),0) FROM orders WHERE status IN ('confirmed','handed_over')"),
        },
        "users": db.q("SELECT id, role, name, biz, phone, place, area, verified, joined, pts, wallet, plus_until FROM users "
                      "WHERE role!='admin' ORDER BY role, name"),
        "bookings": db.q("SELECT * FROM bookings ORDER BY CASE status WHEN 'requested' THEN 0 WHEN 'confirmed' THEN 1 "
                         "WHEN 'pickup_scheduled' THEN 2 WHEN 'in_transit' THEN 3 ELSE 4 END, priority DESC, created DESC"),
        "booking_events": db.q("SELECT * FROM booking_events ORDER BY at"),
        "trucks": db.q("SELECT * FROM trucks ORDER BY place"),
        "orders": db.q("SELECT * FROM orders ORDER BY created DESC LIMIT 60"),
        "payments": db.q("SELECT * FROM payments ORDER BY created DESC LIMIT 40"),
    }


# ---------------------------------------------------------------- accounts & profiles
class LoginIn(BaseModel):
    user_id: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None


class RegisterIn(BaseModel):
    role: str = Field(pattern="^(farmer|paikar)$")
    name: str = Field(min_length=2, max_length=60)
    phone: str = Field(pattern=r"^01\d{9}$")
    place: str
    area: Optional[str] = Field(None, max_length=60)
    biz: Optional[str] = Field(None, max_length=80)


@app.post("/api/login")
def login(body: LoginIn):
    u = S.user(body.user_id) if body.user_id else db.one("SELECT * FROM users WHERE phone=? AND role=?",
                                                         ((body.phone or "").strip(), body.role))
    if not u:
        raise HTTPException(404, "এই নম্বরে অ্যাকাউন্ট নেই। ডেমো অ্যাকাউন্ট বাছুন বা নতুন খুলুন।")
    return {"token": sign(u["id"]), "user": private_me(u)}


@app.post("/api/register")
def register(body: RegisterIn):
    if body.place not in PLACES:
        raise HTTPException(400, "জেলা ঠিক নেই")
    if db.one("SELECT id FROM users WHERE phone=?", (body.phone,)):
        raise HTTPException(409, "এই নম্বরে আগেই অ্যাকাউন্ট আছে, লগ ইন করুন")
    uid = S.nid("U")
    db.insert("users", {"id": uid, "role": body.role, "name": body.name.strip(), "phone": body.phone,
                        "place": body.place, "area": body.area,
                        "biz": (body.biz or f"{body.name}-এর আড়ত") if body.role == "paikar" else None,
                        "joined": S.now()})
    return {"token": sign(uid), "user": private_me(S.user(uid))}


class ProfileIn(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=60)
    area: Optional[str] = Field(None, max_length=60)
    biz: Optional[str] = Field(None, max_length=80)
    photo: Optional[str] = None


def check_image(data):
    if not data.startswith("data:image/") or len(data) > 600_000:
        raise HTTPException(400, "ছবি ছোট করে দিন (৪০০ কেবি পর্যন্ত)")
    return data


@app.post("/api/me")
def edit_me(body: ProfileIn, u=Depends(need_user)):
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if "photo" in fields:
        check_image(fields["photo"])
    if fields:
        db.update("users", u["id"], **fields)
    return {"ok": True}


def image_response(data):
    head, b64 = data.split(",", 1)
    return Response(base64.b64decode(b64), media_type=head[5:].split(";")[0],
                    headers={"Cache-Control": "public, max-age=86400"})


@app.get("/api/users/{uid}/photo")
def user_photo(uid: str):
    u = S.user(uid)
    if not u or not u["photo"]:
        raise HTTPException(404, "ছবি নেই")
    return image_response(u["photo"])


@app.get("/api/users/{uid}")
def profile(uid: str):
    """Public profile: only what a trading partner needs. No phone, no money, no private history."""
    u = next((x for x in public_users() if x["id"] == uid), None)
    if not u:
        raise HTTPException(404, "অ্যাকাউন্ট পাওয়া যায়নি")
    done = db.one("SELECT COUNT(*) n, COALESCE(SUM(qty),0) kg FROM orders WHERE (seller=? OR buyer=?) AND status='completed'",
                  (uid, uid))
    cancelled = db.val("SELECT COUNT(*) FROM orders WHERE cancelled_by=?", (uid,)) or 0
    reviews = db.q('SELECT r.stars, r.text, r.at, f.name AS from_name, f.biz AS from_biz, f.role AS from_role '
                   'FROM ratings r JOIN users f ON f.id=r."from" WHERE r."to"=? ORDER BY r.at DESC LIMIT 10', (uid,))
    listings = [shape_listing(l) for l in db.q("SELECT * FROM listings WHERE uid=? AND status='active'", (uid,))]
    return {"user": u, "completed": done["n"], "kg": done["kg"], "cancelled": cancelled, "reviews": reviews,
            "listings": listings}


# ---------------------------------------------------------------- listings & inspections
class ListingIn(BaseModel):
    crop: str
    qty: float = Field(gt=0)
    price: float = Field(gt=0)
    moq: float = Field(gt=0)
    grade: str = Field("A", pattern="^(A|B|C)$")
    quality: str = Field("", max_length=300)
    harvest_days_ago: int = Field(0, ge=0, le=60)
    photos: List[str] = []
    prod_cost: Optional[float] = Field(None, ge=0)


@app.post("/api/listings")
def create_listing(body: ListingIn, u=Depends(need_trader)):
    if len(body.photos) > 3:
        raise HTTPException(400, "সর্বোচ্চ ৩টি ছবি")
    for p in body.photos:
        check_image(p)
    return S.create_listing(u, body.crop, body.qty, body.price, body.moq, body.grade, body.quality,
                            body.harvest_days_ago, body.photos, body.prod_cost)


class ListingEdit(BaseModel):
    price: Optional[float] = None
    add_qty: Optional[float] = None
    moq: Optional[float] = None
    quality: Optional[str] = Field(None, max_length=300)
    grade: Optional[str] = Field(None, pattern="^(A|B|C)$")
    status: Optional[str] = Field(None, pattern="^(active|paused|closed)$")


@app.patch("/api/listings/{lid}")
def edit_listing(lid: str, body: ListingEdit, u=Depends(need_trader)):
    return shape_listing(S.update_listing(u, lid, **body.model_dump()))


@app.post("/api/listings/{lid}/urgent")
def urgent(lid: str, u=Depends(need_trader)):
    return {"discount": S.make_urgent(u, lid)}


@app.get("/api/listings/{lid}/photo/{i}")
def listing_photo(lid: str, i: int):
    l = db.one("SELECT photos FROM listings WHERE id=?", (lid,))
    photos = json.loads(l["photos"] or "[]") if l else []
    if i < 0 or i >= len(photos):
        raise HTTPException(404, "ছবি নেই")
    return image_response(photos[i])


class InspectIn(BaseModel):
    listing: str
    kind: str = Field(pattern="^(video|visit)$")
    pref: str = Field(min_length=1, max_length=80)
    note: str = Field("", max_length=200)


@app.post("/api/inspections")
def inspect(body: InspectIn, u=Depends(need_trader)):
    return S.request_inspection(u, body.listing, body.kind, body.pref, body.note)


class ReplyIn(BaseModel):
    reply: str = Field("", max_length=200)


@app.post("/api/inspections/{iid}/{action}")
def inspection_action(iid: str, action: str, body: ReplyIn = ReplyIn(), u=Depends(need_trader)):
    S.respond_inspection(u, iid, action, body.reply)
    return {"ok": True}


# ---------------------------------------------------------------- offers, payments, orders
class OfferIn(BaseModel):
    listing: str
    qty: float = Field(gt=0)
    price: float = Field(gt=0)
    transport: str = Field("reroute", pattern="^(reroute|self)$")
    split: str = Field("half", pattern="^(buyer|half|seller)$")
    note: str = Field("", max_length=200)


@app.post("/api/offers")
def offer(body: OfferIn, u=Depends(need_trader)):
    return S.make_offer(u, body.listing, body.qty, body.price, body.transport, body.split, body.note)


class OfferAction(BaseModel):
    price: Optional[float] = None
    reason: Optional[str] = Field(None, max_length=200)


@app.post("/api/offers/{oid}/{action}")
def offer_action(oid: str, action: str, body: OfferAction = OfferAction(), u=Depends(need_trader)):
    if action not in ("accept", "reject", "counter", "cancel"):
        raise HTTPException(404, "অজানা কাজ")
    return S.respond_offer(u, oid, action, body.price, body.reason)


class PayIn(BaseModel):
    purpose: str = Field(pattern="^(order|booking|plus)$")
    ref: Optional[str] = None
    method: str = Field(pattern="^(bkash|nagad|card|wallet)$")


@app.post("/api/payments")
def pay(body: PayIn, u=Depends(need_user)):
    return S.start_payment(u, body.purpose, body.ref, body.method)


class ConfirmIn(BaseModel):
    account: Optional[str] = None
    pin: Optional[str] = None


@app.post("/api/payments/{pid}/confirm")
def pay_confirm(pid: str, body: ConfirmIn, u=Depends(need_user)):
    return S.confirm_payment(u, pid, body.account, body.pin)


class ReasonIn(BaseModel):
    reason: Optional[str] = Field(None, max_length=200)


@app.post("/api/orders/{oid}/handover")
def order_handover(oid: str, u=Depends(need_trader)):
    S.handover(u, oid)
    return {"ok": True}


@app.post("/api/orders/{oid}/complete")
def order_complete(oid: str, u=Depends(need_trader)):
    S.complete(u, oid)
    return {"ok": True}


@app.post("/api/orders/{oid}/cancel")
def order_cancel(oid: str, body: ReasonIn = ReasonIn(), u=Depends(need_trader)):
    S.cancel_order(u, oid, body.reason)
    return {"ok": True}


class RateIn(BaseModel):
    stars: int = Field(ge=1, le=5)
    text: Optional[str] = Field(None, max_length=120)


@app.post("/api/orders/{oid}/rate")
def order_rate(oid: str, body: RateIn, u=Depends(need_trader)):
    S.rate(u, oid, body.stars, body.text)
    return {"ok": True}


# ---------------------------------------------------------------- transport
@app.get("/api/quote")
def quote(src: str, dst: str, qty: float, u=Depends(get_user)):
    return S.quote_for(u or {"id": "", "plus_until": 0}, src, dst, qty)


class BookingIn(BaseModel):
    pickup_place: str
    pickup_addr: str = Field("", max_length=120)
    drop_place: str
    drop_addr: str = Field("", max_length=120)
    crop: str
    qty: float = Field(ge=100)
    date: str = Field("আগামীকাল", max_length=40)


@app.post("/api/bookings")
def book(body: BookingIn, u=Depends(need_trader)):
    if body.crop not in CROPS:
        raise HTTPException(400, "ফসল ঠিক নেই")
    return S.create_booking(u, body.pickup_place, body.pickup_addr, body.drop_place, body.drop_addr, body.crop,
                            body.qty, body.date)


@app.post("/api/bookings/{bid}/cancel")
def booking_cancel(bid: str, u=Depends(need_trader)):
    S.cancel_booking(u, bid)
    return {"ok": True}


# ---------------------------------------------------------------- rewards, Plus, records, notifications
@app.post("/api/rewards/{rid}")
def redeem(rid: str, u=Depends(need_trader)):
    return S.redeem(u, rid)


@app.post("/api/plus/{action}")
def plus(action: str, u=Depends(need_trader)):
    if action == "cancel":
        S.cancel_plus(u)
    elif action == "resume":
        S.resume_plus(u)
    else:
        raise HTTPException(404, "অজানা কাজ")
    return private_me(S.user(u["id"]))


class EntryIn(BaseModel):
    kind: str = Field(pattern="^(expense|sale|stock)$")
    crop: Optional[str] = None
    qty: float = 0
    amount: float = Field(ge=0)
    note: str = Field("", max_length=120)


@app.post("/api/entries")
def entry(body: EntryIn, u=Depends(need_trader)):
    return S.add_entry(u, body.kind, body.crop, body.qty, body.amount, body.note)


@app.post("/api/notifs/read")
def read_all(u=Depends(need_user)):
    db.run('UPDATE notifs SET read=1 WHERE "to"=?', (u["id"],))
    return {"ok": True}


@app.post("/api/notifs/{nid}/read")
def read_one(nid: str, u=Depends(need_user)):
    db.run('UPDATE notifs SET read=1 WHERE id=? AND "to"=?', (nid, u["id"]))
    return {"ok": True}


# ---------------------------------------------------------------- operations team (admin): trucks, bookings, users
class StatusIn(BaseModel):
    status: str
    truck: Optional[str] = None
    pickup_time: Optional[str] = Field(None, max_length=60)
    actual_fare: Optional[float] = None
    note: Optional[str] = Field(None, max_length=120)


@app.post("/api/admin/bookings/{bid}")
def admin_booking(bid: str, body: StatusIn, u=Depends(need_admin)):
    S.set_booking_status(bid, body.status, body.note, body.truck, body.pickup_time, body.actual_fare)
    return {"ok": True}


class TruckIn(BaseModel):
    company: str = Field(min_length=2, max_length=60)
    driver: str = Field(min_length=2, max_length=60)
    phone: str = Field(pattern=r"^01\d{9}$")
    number: str = Field(min_length=3, max_length=40)
    vehicle: str = Field(pattern="^(pickup|mini|truck)$")
    place: str
    areas: str = Field("", max_length=120)


@app.post("/api/admin/trucks")
def admin_add_truck(body: TruckIn, u=Depends(need_admin)):
    return S.add_truck(**body.model_dump())


class TruckStatus(BaseModel):
    status: str = Field(pattern="^(available|maintenance)$")


@app.patch("/api/admin/trucks/{tid}")
def admin_truck_status(tid: str, body: TruckStatus, u=Depends(need_admin)):
    busy = db.val("SELECT COUNT(*) FROM bookings WHERE truck=? AND status IN ('confirmed','pickup_scheduled','in_transit')", (tid,))
    if busy:
        raise HTTPException(400, "এই ট্রাকে চলমান বুকিং আছে")
    db.update("trucks", tid, status=body.status)
    return {"ok": True}


@app.post("/api/admin/users/{uid}/verify")
def admin_verify(uid: str, u=Depends(need_admin)):
    t = S.user(uid)
    if not t or t["verified"]:
        raise HTTPException(400, "আগেই যাচাই করা বা অ্যাকাউন্ট নেই")
    db.update("users", uid, verified=1)
    S.points(uid, 50, "verified", uid, "প্রোফাইল যাচাই")
    S.notify(uid, "✔️ আপনার প্রোফাইল যাচাই হয়েছে। +৫০ পয়েন্ট, আর অগ্রাধিকার ট্রাক বুকিং পাবেন।", "info", "#/account")
    return {"ok": True}


# ---------------------------------------------------------------- AI (real staples model) + demo + frontend
@app.get("/api/ai/summary")
def ai_summary():
    return AI.summary()


@app.get("/api/ai/predict")
def ai_predict(market: str, product: str):
    out = AI.predict(market, product)
    if not out:
        raise HTTPException(404, "এই বাজার বা পণ্য পাওয়া যায়নি")
    return out


@app.post("/api/reset")
def reset():
    from app.seed import seed
    seed()
    return {"ok": True}


# AI advisor (simulated vegetable market data) lives in its own module
from app.ai_routes import router as ai_router  # noqa: E402
app.include_router(ai_router)

app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")
