"""
AI advisor API (added module). Kept separate so the rest of the app is untouched:
main.py only does `app.include_router(ai_router)`.
Data: SIMULATED vegetable markets (ml/vegsim.py), model: models/veg_model.joblib.
"""
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from app import db, services as S
from app.logic import CROPS, PLACES
from app.veg_ai import VegAI

router = APIRouter(prefix="/api/ai/advisor", tags=["AI advisor (simulated data)"])
VEG = VegAI()


def _user(x_token):
    from app.main import get_user          # imported here to avoid a circular import
    return get_user(x_token)


def _ready():
    if not VEG.ready:
        raise HTTPException(503, "AI প্রস্তুত হচ্ছে, কয়েক সেকেন্ড পরে আবার চেষ্টা করুন")


def _check(place, crop):
    if place not in PLACES or crop not in CROPS:
        raise HTTPException(400, "জেলা ও ফসল ঠিক নেই")


@router.get("/status")
def status():
    return {"ready": VEG.ready, "date": VEG.state["date"] if VEG.ready else None, "metrics": VEG.metrics,
            "simulated": True, "error": VEG.error}


@router.get("/farmer")
def farmer(src: str, crop: str, qty: float, days_left: Optional[int] = None, cost: Optional[float] = None,
           x_token: Optional[str] = Header(None)):
    """Which market and which day gives the most money in hand (and which ones lose money)."""
    _ready()
    _check(src, crop)
    if not 40 <= qty <= 100_000:
        raise HTTPException(400, "পরিমাণ ১ মণ থেকে ২,৫০০ মণের মধ্যে দিন")
    u = _user(x_token)
    return VEG.advice(src, crop, qty, days_left, cost, bool(u and S.is_plus(u)))


@router.get("/buyer")
def buyer(place: str, crop: str, qty: float, x_token: Optional[str] = Header(None)):
    """Where good produce can be bought cheaply now, ranked by margin when resold in the buyer's market."""
    _ready()
    _check(place, crop)
    u = _user(x_token)
    raw = db.q("SELECT * FROM listings WHERE status='active' AND crop=?", (crop,))
    listings = [{**l, "eff_price": S.eff_price(l), "days_left": S.days_left(l)} for l in raw]
    ids = {l["uid"] for l in listings}
    users = {}
    for uid in ids:
        x = S.user(uid)
        if x:
            x["rating"] = db.val('SELECT ROUND(AVG(stars),1) FROM ratings WHERE "to"=?', (uid,))
            users[uid] = x
    return VEG.sources(place, crop, qty, listings, users, bool(u and S.is_plus(u)), u["id"] if u else None)


@router.get("/market")
def market(crop: str):
    """Today's price, the next 3 days and glut warnings in every market."""
    _ready()
    if crop not in CROPS:
        raise HTTPException(400, "ফসল ঠিক নেই")
    return VEG.overview(crop)


@router.get("/series")
def series(market: str, crop: str):
    _ready()
    _check(market, crop)
    s = VEG.state
    return {**s["series"][market][crop], "fc": s["fc"][market][crop], "interval": VEG.interval, "date": s["date"],
            "simulated": True}
