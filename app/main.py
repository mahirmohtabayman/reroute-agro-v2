"""
Reroute Agro API (FastAPI)
Run locally:  uvicorn app.main:app --reload      →  http://127.0.0.1:8000      API docs: /docs
"""
import base64
import binascii
import functools
import json
import logging
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app import auth, db, impact as IMPACT, pooling as POOL, seed as SEED, services as S, settings
from app.ai import PriceAI
from app.logic import (CASHBACK, CASHBACK_MIN, CROPS, FEE_MAX, FEE_MIN, FEE_RATE, MIN_ORDER_KG, PLACES, PLUS_DAYS,
                       PLUS_PRICE, REDEEM, VEHICLES, CANCEL_PENALTY, COMMISSION, SERVICE, PLUS_SERVICE_OFF,
                       BULK_SERVICE_OFF, POOL_FACTOR, MIN_SHARE, FULL_LOAD, RETURN_LOAD, OFFLINE_MARKUP, SPEED)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("reroute")
STATIC = Path(__file__).resolve().parents[1] / "static"

app = FastAPI(title="Reroute Agro API", version="2.1",
              description="কৃষক ও পাইকারের পাইকারি বাজার: পরিদর্শন, অফার-দরদাম, পরিবহন চুক্তি, অনলাইন পেমেন্ট, নিজস্ব ট্রাক")
if settings.ALLOWED_ORIGINS:
    app.add_middleware(CORSMiddleware, allow_origins=settings.ALLOWED_ORIGINS, allow_methods=["GET", "POST", "PATCH"],
                       allow_headers=["Content-Type", "X-Token"])

log.info("starting: APP_ENV=%s, demo mode %s, database %s", settings.APP_ENV, "on" if settings.DEMO_MODE else "off",
         "PostgreSQL" if db.PG else "SQLite (development)")
db.migrate()
SEED.startup()
AI = PriceAI()

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=(self)",
    # the single-page app uses inline scripts/styles; everything else is same-origin except Google Fonts
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' "
                               "https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; "
                               "img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; "
                               "frame-ancestors 'none'; form-action 'self'",
}


@app.middleware("http")
async def guard(request, call_next):
    size = request.headers.get("content-length")
    if size and size.isdigit() and int(size) > settings.MAX_BODY_BYTES:
        return JSONResponse({"detail": "অনুরোধটি অনেক বড় (ছবি ছোট করে দিন)"}, status_code=413)
    if request.method != "GET" and request.url.path.startswith("/api/"):
        SEED.note_write()
    response = await call_next(request)
    for k, v in SECURITY_HEADERS.items():
        response.headers.setdefault(k, v)
    if settings.IS_PROD:
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000")
    return response


def atomic(fn):
    """Run a mutating endpoint as one database transaction: all of its writes happen, or none."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        with db.tx():
            return fn(*args, **kwargs)
    return wrapper


def client_ip(request: Request):
    """The caller's address. Behind Render's proxy the trustworthy entry is the one the proxy appended
    (counted from the right), not the first one, which the client can write itself."""
    parts = [p.strip() for p in (request.headers.get("x-forwarded-for") or "").split(",") if p.strip()]
    if settings.TRUSTED_PROXIES and len(parts) >= settings.TRUSTED_PROXIES:
        return parts[-settings.TRUSTED_PROXIES]
    return request.client.host if request.client else "unknown"


def too_many(msg="অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।"):
    raise HTTPException(429, msg)


# ---------------------------------------------------------------- auth
def is_demo(u):
    """Seeded demo accounts have short ids (f1, p2, a1…); self-registered accounts start with "U"."""
    return not u["id"].startswith("U")


def get_user(x_token: Optional[str] = Header(None)):
    uid = auth.session_uid(x_token)
    u = S.user(uid) if uid else None
    if u and is_demo(u) and not settings.DEMO_MODE:
        return None             # demo accounts only exist on demo deployments
    return u


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
PUBLIC_USER = "id, role, name, biz, place, area, market, verified, joined, (photo IS NOT NULL) AS has_photo, COALESCE(LENGTH(photo), 0) AS photo_v"


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
    me = {k: v for k, v in u.items() if k not in ("photo", "pw_hash")}
    me["has_photo"] = u["photo"] is not None
    me["photo_v"] = len(u["photo"] or "")   # changes with each new photo, so browsers don't show a cached old one
    me["plus_active"] = S.is_plus(u)
    me["bulk"] = S.is_bulk(u["id"])
    return me


CONFIG = {"vehicles": VEHICLES, "service": SERVICE, "commission": COMMISSION, "plus_off": PLUS_SERVICE_OFF,
          "bulk_off": BULK_SERVICE_OFF, "pool": POOL_FACTOR, "min_share": MIN_SHARE, "full_load": FULL_LOAD,
          "return_load": RETURN_LOAD, "offline": OFFLINE_MARKUP, "speed": SPEED, "fee_rate": FEE_RATE,
          "fee_min": FEE_MIN, "fee_max": FEE_MAX, "min_order": MIN_ORDER_KG, "plus_price": PLUS_PRICE,
          "plus_days": PLUS_DAYS, "redeem": REDEEM, "cashback": CASHBACK, "cashback_min": CASHBACK_MIN,
          "penalty": CANCEL_PENALTY, "demo_pin": S.DEMO_PIN, "demo_mode": settings.DEMO_MODE,
          "app_env": settings.APP_ENV}


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/state")
def state(u=Depends(get_user)):
    SEED.refresh_if_stale()
    with db.tx():
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

    # Transport negotiations for this user's orders
    order_ids = [o["id"] for o in orders]
    transport_negotiations = {}
    for oid in order_ids:
        tn = S.get_transport_negotiation(oid)
        if tn:
            transport_negotiations[oid] = tn

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
        "transport_negotiations": transport_negotiations,
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
    password: Optional[str] = None
    role: Optional[str] = None


class RegisterIn(BaseModel):
    role: str = Field(pattern="^(farmer|paikar)$")
    name: str = Field(min_length=2, max_length=60)
    phone: str = Field(max_length=20)
    password: str = Field(min_length=6, max_length=64)
    confirm_password: str = Field(min_length=6, max_length=64)
    place: str
    upazila: str = Field(min_length=2, max_length=60)
    market: str = Field(min_length=2, max_length=60)
    biz: Optional[str] = Field(None, max_length=80)


class OtpIn(BaseModel):
    reg_id: str = Field(min_length=8, max_length=64)
    otp: str = Field(pattern=r"^\d{5}$")


class ResendIn(BaseModel):
    reg_id: str = Field(min_length=8, max_length=64)


def signed_in(u):
    return {"token": auth.new_session(u["id"]), "user": private_me(u)}


LOGIN_FAIL = "মোবাইল নম্বর বা পাসওয়ার্ড ঠিক নেই"


@app.post("/api/login")
def login(body: LoginIn, request: Request):
    if body.user_id:
        # one-click login: demo deployments only, and never for an admin account
        if not settings.DEMO_MODE:
            raise HTTPException(403, "ডেমো লগ ইন এখন বন্ধ")
        u = S.user(body.user_id)
        if not u or not is_demo(u) or u["role"] == "admin":
            raise HTTPException(404, "ডেমো অ্যাকাউন্ট পাওয়া যায়নি")
        return signed_in(u)
    phone, ip = auth.normalize_phone(body.phone), client_ip(request)
    # only failed attempts are counted, so a user who types the right password is never blocked
    if auth.hits(f"login-fail-phone:{phone}", 900) >= 10 or auth.hits(f"login-fail-ip:{ip}", 900) >= 50:
        too_many("অনেকবার ভুল পাসওয়ার্ড দেওয়া হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।")
    # phone numbers are unique, so the account is found by phone alone; the role tab picked on the login page
    # does not matter (the app then opens the right dashboard for the account's real role)
    u = db.one("SELECT * FROM users WHERE phone=?", (phone,)) if phone else None
    if not u or not auth.check_password(body.password or "", u.get("pw_hash")):
        auth.hit(f"login-fail-phone:{phone}")
        auth.hit(f"login-fail-ip:{ip}")
        raise HTTPException(401, LOGIN_FAIL)
    if is_demo(u) and not settings.DEMO_MODE:
        raise HTTPException(401, LOGIN_FAIL)
    return signed_in(u)


@app.post("/api/logout")
def logout(x_token: Optional[str] = Header(None)):
    auth.end_session(x_token)
    return {"ok": True}


@app.post("/api/register")
def register(body: RegisterIn, request: Request):
    """Step 1 of sign-up: check the details and create a pending registration with a one-time code.
    There is no SMS gateway: the code is returned only in demo mode, for the on-screen prototype notice."""
    phone = auth.normalize_phone(body.phone)
    if not phone:
        raise HTTPException(400, "০১ দিয়ে শুরু ১১ সংখ্যার মোবাইল নম্বর দিন")
    if body.place not in PLACES:
        raise HTTPException(400, "জেলা ঠিক নেই")
    if body.password != body.confirm_password:
        raise HTTPException(400, "দুটো পাসওয়ার্ড মিলছে না")
    if not settings.DEMO_MODE:
        raise HTTPException(503, "নতুন অ্যাকাউন্ট খোলা এখন বন্ধ: SMS সেবা এখনো চালু হয়নি।")
    if not auth.allow(f"register-phone:{phone}", 5, 3600) or not auth.allow(f"register-ip:{client_ip(request)}", 30, 3600):
        too_many()
    if db.one("SELECT id FROM users WHERE phone=?", (phone,)):
        raise HTTPException(409, "এই নম্বরে আগেই অ্যাকাউন্ট আছে, লগ ইন করুন")
    data = body.model_dump(exclude={"password", "confirm_password"})
    data["phone"] = phone
    data["pw_hash"] = auth.hash_password(body.password)
    reg_id, otp = auth.start_otp(data)
    return {"reg_id": reg_id, "demo_otp": otp, "expires_in": auth.OTP_TTL, "prototype": True}


@app.post("/api/register/resend")
def register_resend(body: ResendIn, request: Request):
    if not settings.DEMO_MODE:
        raise HTTPException(503, "SMS সেবা এখনো চালু হয়নি।")
    if not auth.allow(f"resend-ip:{client_ip(request)}", 20, 3600):
        too_many()
    otp, err = auth.resend_otp(body.reg_id)
    if err:
        raise HTTPException(400, err)
    return {"reg_id": body.reg_id, "demo_otp": otp, "expires_in": auth.OTP_TTL, "prototype": True}


@app.post("/api/register/verify")
def register_verify(body: OtpIn, request: Request):
    """Step 2 of sign-up: the code matches, so the account is created — atomically, exactly once."""
    if not auth.allow(f"verify-ip:{client_ip(request)}", 60, 3600):
        too_many()
    with db.tx():
        data, err = auth.check_otp(body.reg_id, body.otp)
        uid = None
        if data and not db.one("SELECT id FROM users WHERE phone=?", (data["phone"],)):
            uid = S.nid("U")
            name = data["name"].strip()
            db.insert("users", {"id": uid, "role": data["role"], "name": name, "phone": data["phone"],
                                "place": data["place"], "area": data["upazila"].strip(), "market": data["market"].strip(),
                                "biz": (data["biz"] or f"{name}-এর আড়ত") if data["role"] == "paikar" else None,
                                "pw_hash": data["pw_hash"], "joined": S.now()})
        elif data:
            err = "এই নম্বরে আগেই অ্যাকাউন্ট আছে, লগ ইন করুন"
    # outside the transaction: a wrong code's attempt count is already committed
    if err:
        raise HTTPException(409 if data else 400, err)
    return signed_in(S.user(uid))


class ProfileIn(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=60)
    area: Optional[str] = Field(None, max_length=60)
    market: Optional[str] = Field(None, max_length=60)
    biz: Optional[str] = Field(None, max_length=80)
    photo: Optional[str] = None
    remove_photo: Optional[bool] = None


IMAGE_MAGIC = {"image/jpeg": (b"\xff\xd8\xff",), "image/png": (b"\x89PNG\r\n\x1a\n",),
               "image/gif": (b"GIF87a", b"GIF89a"), "image/webp": (b"RIFF",)}


def decode_image(data):
    """(media type, bytes) of a stored data-URL photo, or None if it is not an allowed raster image.
    SVG and anything else are refused: served from our own origin they could run script."""
    try:
        head, b64 = (data or "").split(",", 1)
        mime = head[5:].split(";")[0].lower() if head.startswith("data:") and head.endswith(";base64") else ""
        raw = base64.b64decode(b64, validate=True)
    except (ValueError, binascii.Error):
        return None
    if mime not in IMAGE_MAGIC or not raw.startswith(IMAGE_MAGIC[mime]):
        return None
    if mime == "image/webp" and raw[8:12] != b"WEBP":
        return None
    return mime, raw


def check_image(data):
    if len(data or "") > 600_000:
        raise HTTPException(400, "ছবি ছোট করে দিন (৪০০ কেবি পর্যন্ত)")
    if not decode_image(data):
        raise HTTPException(400, "শুধু JPG, PNG, WebP বা GIF ছবি দেওয়া যাবে")
    return data


@app.post("/api/me")
@atomic
def edit_me(body: ProfileIn, u=Depends(need_user)):
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    remove = fields.pop("remove_photo", False)
    if ("photo" in fields or remove) and is_demo(u):
        # demo accounts are shared by every visitor, so their photo is never changed on the server
        raise HTTPException(403, "ডেমো অ্যাকাউন্টের ছবি সার্ভারে বদলানো যায় না")
    if "photo" in fields:
        check_image(fields["photo"])
    elif remove:
        fields["photo"] = None
    if fields:
        db.update("users", u["id"], **fields)
    return {"ok": True}


def image_response(data):
    img = decode_image(data)
    if not img:                 # e.g. an SVG stored before uploads were validated
        raise HTTPException(404, "ছবি নেই")
    return Response(img[1], media_type=img[0],
                    headers={"Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff",
                             "Content-Security-Policy": "default-src 'none'; sandbox"})


@app.get("/api/users/{uid}/photo")
def user_photo(uid: str):
    u = S.user(uid)
    if not u or not u["photo"]:
        raise HTTPException(404, "ছবি নেই")
    return image_response(u["photo"])


@app.get("/api/users/{uid}")
def profile(uid: str):
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
@atomic
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
@atomic
def edit_listing(lid: str, body: ListingEdit, u=Depends(need_trader)):
    return shape_listing(S.update_listing(u, lid, **body.model_dump()))


@app.post("/api/listings/{lid}/urgent")
@atomic
def urgent(lid: str, u=Depends(need_trader)):
    return {"discount": S.make_urgent(u, lid)}


@app.get("/api/listings/{lid}/photo/{i}")
def listing_photo(lid: str, i: int):
    l = db.one("SELECT photos FROM listings WHERE id=?", (lid,))
    photos = json.loads(l["photos"] or "[]") if l else []
    if i < 0 or i >= len(photos):
        raise HTTPException(404, "ছবি নেই")
    return image_response(photos[i])


# ---------------------------------------------------------------- Inspection endpoints (full workflow)
class InspectIn(BaseModel):
    listing: str
    kind: str = Field(pattern="^(video|visit)$")
    pref: str = Field(min_length=1, max_length=80)
    note: str = Field("", max_length=200)


@app.post("/api/inspections")
@atomic
def inspect(body: InspectIn, u=Depends(need_trader)):
    return S.request_inspection(u, body.listing, body.kind, body.pref, body.note)


class ProposeTimeIn(BaseModel):
    proposed_time: str = Field(min_length=1, max_length=120)
    reply: str = Field("", max_length=200)


@app.post("/api/inspections/{iid}/propose-time")
@atomic
def inspection_propose_time(iid: str, body: ProposeTimeIn, u=Depends(need_trader)):
    """Farmer proposes an inspection date/time."""
    return S.farmer_propose_time(u, iid, body.proposed_time, body.reply)


@app.post("/api/inspections/{iid}/confirm-schedule")
@atomic
def inspection_confirm_schedule(iid: str, u=Depends(need_trader)):
    """Buyer confirms the farmer's proposed time — sets status to 'scheduled'."""
    return S.buyer_confirm_schedule(u, iid)


@app.post("/api/inspections/{iid}/buyer-done")
@atomic
def inspection_buyer_done(iid: str, u=Depends(need_trader)):
    """Buyer reports they have inspected the produce."""
    return S.buyer_report_inspection_done(u, iid)


class VerifyIn(BaseModel):
    confirm: bool = True
    note: str = Field("", max_length=200)


@app.post("/api/inspections/{iid}/seller-verify")
@atomic
def inspection_seller_verify(iid: str, body: VerifyIn, u=Depends(need_trader)):
    """Farmer confirms or disputes buyer's inspection report."""
    return S.seller_verify_inspection(u, iid, body.confirm, body.note)


class ReplyIn(BaseModel):
    reply: str = Field("", max_length=200)


@app.post("/api/inspections/{iid}/decline")
@atomic
def inspection_decline(iid: str, body: ReplyIn = ReplyIn(), u=Depends(need_trader)):
    """Farmer declines the inspection request."""
    S.decline_inspection(u, iid, body.reply)
    return {"ok": True}


@app.post("/api/inspections/{iid}/cancel")
@atomic
def inspection_cancel(iid: str, u=Depends(need_trader)):
    """Buyer cancels their inspection request."""
    S.cancel_inspection(u, iid)
    return {"ok": True}


# Legacy single-action endpoint — kept for backward compatibility
@app.post("/api/inspections/{iid}/{action}")
@atomic
def inspection_action(iid: str, action: str, body: ReplyIn = ReplyIn(), u=Depends(need_trader)):
    """Legacy: schedule/decline/done/cancel via single endpoint."""
    if action == "schedule":
        # old behavior: farmer schedules with reply text
        return S.farmer_propose_time(u, iid, body.reply or "সময় নিশ্চিত করা হবে", body.reply)
    elif action == "decline":
        S.decline_inspection(u, iid, body.reply)
        return {"ok": True}
    elif action == "done":
        return S.buyer_report_inspection_done(u, iid)
    elif action == "cancel":
        S.cancel_inspection(u, iid)
        return {"ok": True}
    raise HTTPException(404, "অজানা কাজ")


# ---------------------------------------------------------------- offers, payments, orders
class OfferIn(BaseModel):
    listing: str
    qty: float = Field(gt=0)
    price: float = Field(gt=0)
    transport: str = Field("reroute", pattern="^(reroute|self)$")
    split: str = Field("half", pattern="^(buyer|half|seller)$")
    note: str = Field("", max_length=200)


@app.post("/api/offers")
@atomic
def offer(body: OfferIn, u=Depends(need_trader)):
    return S.make_offer(u, body.listing, body.qty, body.price, body.transport, body.split, body.note)


class OfferAction(BaseModel):
    price: Optional[float] = None
    reason: Optional[str] = Field(None, max_length=200)


@app.post("/api/offers/{oid}/{action}")
@atomic
def offer_action(oid: str, action: str, body: OfferAction = OfferAction(), u=Depends(need_trader)):
    if action not in ("accept", "reject", "counter", "cancel"):
        raise HTTPException(404, "অজানা কাজ")
    return S.respond_offer(u, oid, action, body.price, body.reason)


# ---------------------------------------------------------------- Transport negotiation endpoints
class TransportProposalIn(BaseModel):
    buyer_pct: float = Field(ge=0, le=100)
    seller_pct: float = Field(ge=0, le=100)
    note: str = Field("", max_length=200)


@app.post("/api/orders/{oid}/transport/propose")
@atomic
def transport_propose(oid: str, body: TransportProposalIn, u=Depends(need_trader)):
    """Propose a new transport cost split (buyer_pct + seller_pct must = 100)."""
    return S.propose_transport_split(u, oid, body.buyer_pct, body.seller_pct, body.note)


class TransportRespondIn(BaseModel):
    action: str = Field(pattern="^(accept|reject)$")
    note: str = Field("", max_length=200)


@app.post("/api/orders/{oid}/transport/proposals/{pid}/respond")
@atomic
def transport_respond(oid: str, pid: str, body: TransportRespondIn, u=Depends(need_trader)):
    """Accept or reject a transport cost proposal."""
    return S.respond_transport_proposal(u, oid, pid, body.action, body.note)


@app.get("/api/orders/{oid}/transport")
def transport_negotiation(oid: str, u=Depends(need_trader)):
    """Get transport negotiation state for an order."""
    o = S.get_order(oid, u)
    tn = S.get_transport_negotiation(oid)
    if not tn:
        raise HTTPException(404, "পরিবহন চুক্তির তথ্য পাওয়া যায়নি")
    return tn


# ---------------------------------------------------------------- payments
class PayIn(BaseModel):
    purpose: str = Field(pattern="^(order|booking|plus)$")
    ref: Optional[str] = None
    method: str = Field(pattern="^(bkash|nagad|card|wallet)$")


@app.post("/api/payments")
@atomic
def pay(body: PayIn, u=Depends(need_user)):
    return S.start_payment(u, body.purpose, body.ref, body.method)


class ConfirmIn(BaseModel):
    account: Optional[str] = None
    pin: Optional[str] = None


@app.post("/api/payments/{pid}/confirm")
@atomic
def pay_confirm(pid: str, body: ConfirmIn, u=Depends(need_user)):
    return S.confirm_payment(u, pid, body.account, body.pin)


class ReasonIn(BaseModel):
    reason: Optional[str] = Field(None, max_length=200)


@app.post("/api/orders/{oid}/handover")
@atomic
def order_handover(oid: str, u=Depends(need_trader)):
    S.handover(u, oid)
    return {"ok": True}


@app.post("/api/orders/{oid}/complete")
@atomic
def order_complete(oid: str, u=Depends(need_trader)):
    S.complete(u, oid)
    return {"ok": True}


@app.post("/api/orders/{oid}/cancel")
@atomic
def order_cancel(oid: str, body: ReasonIn = ReasonIn(), u=Depends(need_trader)):
    S.cancel_order(u, oid, body.reason)
    return {"ok": True}


class RateIn(BaseModel):
    stars: int = Field(ge=1, le=5)
    text: Optional[str] = Field(None, max_length=120)


@app.post("/api/orders/{oid}/rate")
@atomic
def order_rate(oid: str, body: RateIn, u=Depends(need_trader)):
    S.rate(u, oid, body.stars, body.text)
    return {"ok": True}


# ---------------------------------------------------------------- transport bookings
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
@atomic
def book(body: BookingIn, u=Depends(need_trader)):
    if body.crop not in CROPS:
        raise HTTPException(400, "ফসল ঠিক নেই")
    return S.create_booking(u, body.pickup_place, body.pickup_addr, body.drop_place, body.drop_addr, body.crop,
                            body.qty, body.date)


@app.post("/api/bookings/{bid}/cancel")
@atomic
def booking_cancel(bid: str, u=Depends(need_trader)):
    S.cancel_booking(u, bid)
    return {"ok": True}


# ---------------------------------------------------------------- rewards, Plus, records, notifications
@app.post("/api/rewards/{rid}")
@atomic
def redeem(rid: str, u=Depends(need_trader)):
    return S.redeem(u, rid)


@app.post("/api/plus/{action}")
@atomic
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
@atomic
def entry(body: EntryIn, u=Depends(need_trader)):
    return S.add_entry(u, body.kind, body.crop, body.qty, body.amount, body.note)


@app.post("/api/notifs/read")
@atomic
def read_all(u=Depends(need_user)):
    db.run('UPDATE notifs SET read=1 WHERE "to"=?', (u["id"],))
    return {"ok": True}


@app.post("/api/notifs/{nid}/read")
@atomic
def read_one(nid: str, u=Depends(need_user)):
    db.run('UPDATE notifs SET read=1 WHERE id=? AND "to"=?', (nid, u["id"]))
    return {"ok": True}


# ---------------------------------------------------------------- admin: trucks, bookings, users
class StatusIn(BaseModel):
    status: str
    truck: Optional[str] = None
    pickup_time: Optional[str] = Field(None, max_length=60)
    actual_fare: Optional[float] = None
    note: Optional[str] = Field(None, max_length=120)


@app.post("/api/admin/bookings/{bid}")
@atomic
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
@atomic
def admin_add_truck(body: TruckIn, u=Depends(need_admin)):
    return S.add_truck(**body.model_dump())


class TruckStatus(BaseModel):
    status: str = Field(pattern="^(available|maintenance)$")


@app.patch("/api/admin/trucks/{tid}")
@atomic
def admin_truck_status(tid: str, body: TruckStatus, u=Depends(need_admin)):
    busy = db.val("SELECT COUNT(*) FROM bookings WHERE truck=? AND status IN ('confirmed','pickup_scheduled','in_transit')", (tid,))
    if busy:
        raise HTTPException(400, "এই ট্রাকে চলমান বুকিং আছে")
    db.update("trucks", tid, status=body.status)
    return {"ok": True}


@app.post("/api/admin/users/{uid}/verify")
@atomic
def admin_verify(uid: str, u=Depends(need_admin)):
    t = S.user(uid)
    if not t or t["verified"]:
        raise HTTPException(400, "আগেই যাচাই করা বা অ্যাকাউন্ট নেই")
    db.update("users", uid, verified=1)
    S.points(uid, 50, "verified", uid, "প্রোফাইল যাচাই")
    S.notify(uid, "✔️ আপনার প্রোফাইল যাচাই হয়েছে। +৫০ পয়েন্ট, আর অগ্রাধিকার ট্রাক বুকিং পাবেন।", "info", "#/account")
    return {"ok": True}


# ---------------------------------------------------------------- password recovery & change
class ForgotIn(BaseModel):
    phone: str = Field(max_length=20)


GENERIC_FORGOT = ("অনুরোধ পাওয়া গেছে। এই নম্বরে অ্যাকাউন্ট থাকলে Reroute অপারেশন টিম ফোন করে আপনার পরিচয় যাচাই করবে, "
                  "তারপর একটি অস্থায়ী পাসওয়ার্ড দেবে।")


@app.post("/api/password/forgot")
def password_forgot(body: ForgotIn, request: Request):
    """No SMS gateway yet, so recovery is operator-assisted. The answer is identical whether or not the number exists."""
    phone = auth.normalize_phone(body.phone)
    if not auth.allow(f"forgot-ip:{client_ip(request)}", 10, 3600) or not auth.allow(f"forgot-phone:{phone}", 3, 3600):
        raise HTTPException(429, "অনেকবার চেষ্টা করা হয়েছে। এক ঘণ্টা পরে আবার চেষ্টা করুন।")
    u = db.one("SELECT id, role, name, biz FROM users WHERE phone=?", (phone,)) if phone else None
    if u and u["id"].startswith("U"):
        who = u["biz"] if u["role"] == "paikar" and u["biz"] else u["name"]
        for a in db.q("SELECT id FROM users WHERE role='admin'"):
            S.notify(a["id"], f"পাসওয়ার্ড রিসেটের অনুরোধ: {who}। ফোন করে পরিচয় যাচাই করে ব্যবহারকারী তালিকা থেকে অস্থায়ী পাসওয়ার্ড দিন।",
                     "info", "#/admin/users")
    return {"ok": True, "message": GENERIC_FORGOT}


@app.post("/api/admin/users/{uid}/reset-password")
@atomic
def admin_reset_password(uid: str, u=Depends(need_admin)):
    """Admin sets a one-time temporary password after verifying the user by phone. Shown to the admin once only."""
    t = S.user(uid)
    if not t or not uid.startswith("U"):
        raise HTTPException(400, "শুধু নিবন্ধিত অ্যাকাউন্টের পাসওয়ার্ড রিসেট করা যায়")
    pw = auth.temp_password()
    db.update("users", uid, pw_hash=auth.hash_password(pw))
    auth.end_all_sessions(uid)
    S.notify(uid, "আপনার পাসওয়ার্ড অপারেশন টিম রিসেট করেছে। লগ ইন করে অ্যাকাউন্ট পাতা থেকে নতুন পাসওয়ার্ড দিন।", "info", "#/account")
    return {"temp_password": pw}


class PasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=64)
    new_password: str = Field(min_length=6, max_length=64)
    confirm_password: str = Field(min_length=6, max_length=64)


@app.post("/api/me/password")
def change_password(body: PasswordIn, u=Depends(need_user), x_token: Optional[str] = Header(None)):
    if is_demo(u):
        raise HTTPException(403, "ডেমো অ্যাকাউন্টের পাসওয়ার্ড বদলানো যায় না")
    if not auth.allow(f"pwchange:{u['id']}", 10, 3600):
        raise HTTPException(429, "অনেকবার চেষ্টা করা হয়েছে। পরে আবার চেষ্টা করুন।")
    if not auth.check_password(body.current_password, u.get("pw_hash")):
        raise HTTPException(400, "বর্তমান পাসওয়ার্ড ঠিক নেই")
    if body.new_password != body.confirm_password:
        raise HTTPException(400, "দুটো পাসওয়ার্ড মিলছে না")
    db.update("users", u["id"], pw_hash=auth.hash_password(body.new_password))
    auth.end_all_sessions(u["id"], keep_token=x_token)      # other devices are signed out
    return {"ok": True}


# ---------------------------------------------------------------- truck pooling & impact
class PoolAssignIn(BaseModel):
    bookings: List[str] = Field(min_length=1, max_length=20)
    truck: str


@app.get("/api/admin/pool")
def admin_pool(u=Depends(need_admin)):
    return POOL.suggestions()


@app.post("/api/admin/pool/assign")
@atomic
def admin_pool_assign(body: PoolAssignIn, u=Depends(need_admin)):
    """Put a pooled group on one truck: all bookings or none (capacity is re-checked for each)."""
    for bid in body.bookings:
        S.set_booking_status(bid, "confirmed", "শেয়ার্ড ট্রাকে যুক্ত (পুলিং)", body.truck)
    return {"ok": True}


@app.get("/api/pool/mine")
def my_pool(u=Depends(need_trader)):
    return POOL.for_user(u["id"])


@app.get("/api/impact")
def impact(days: int = 0):
    if days not in (0, 7, 30, 90, 365):
        raise HTTPException(400, "সময়সীমা ঠিক নেই")
    from app.ai_routes import VEG
    return IMPACT.summary(days, VEG.metrics)


# ---------------------------------------------------------------- AI + demo + frontend
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
@atomic
def reset(u=Depends(need_admin)):
    """Rebuild the demo data. Admin only, and only on a demo or development deployment with demo mode on —
    never in production. Self-registered accounts are kept."""
    if settings.IS_PROD or not settings.DEMO_MODE:
        raise HTTPException(403, "এই সার্ভারে ডেমো নতুন করে শুরু করা যায় না")
    SEED.seed()
    return {"ok": True}


from app.ai_routes import router as ai_router  # noqa: E402
app.include_router(ai_router)
from app.hisab_routes import router as hisab_router  # noqa: E402
app.include_router(hisab_router)

app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.middleware("http")
async def static_cache(request, call_next):
    """Public static files (fonts, photos, icons) are cached by browsers for a week; the page itself is
    revalidated every time so a new deploy shows at once."""
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/static/") and response.status_code == 200 and not path.endswith(".html"):
        response.headers.setdefault("Cache-Control", "public, max-age=604800")
    elif path in ("/", "/sw.js", "/offline.html", "/manifest.webmanifest"):
        response.headers["Cache-Control"] = "no-cache"
    return response


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/sw.js")
def service_worker():
    # served from the root so it may control the whole site (it never caches /api/ responses)
    return FileResponse(STATIC / "sw.js", media_type="application/javascript")


@app.get("/manifest.webmanifest")
def manifest():
    return FileResponse(STATIC / "manifest.webmanifest", media_type="application/manifest+json")


@app.get("/offline.html")
def offline():
    return FileResponse(STATIC / "offline.html")
