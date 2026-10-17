"""Phases 4–7 and 12: Smart Selling Advisor, spoilage risk, question parser, truck pooling, impact, notifications."""
import time
from datetime import date

import pytest

from app import advisor as A, db, pooling, services as S
from app.ai_routes import VEG
from tests.conftest import H, admin_token, register


def opt(market, w, net, lo=None, hi=None, price=30.0, travel=0, km=15, name=None):
    gross = round(price * 1000)
    return {"market": market, "name": name or market, "type": "x", "send_in_days": w, "sell_day": w + travel,
            "travel_days": travel, "km": km, "price_now": price, "price": price, "price_lo": price * .9,
            "price_hi": price * 1.1, "gross": gross, "spoil_pct": 1.0, "spoil_tk": 300, "fees_tk": 1000, "truck": 500,
            "net": net, "net_lo": lo if lo is not None else net, "net_hi": hi if hi is not None else net, "reasons": []}


def adv(options, cost=None, days_left=6, d=None):
    local = next(o for o in options if o["market"] == "rajshahi" and o["send_in_days"] == 0)
    for o in options:
        o["vs_local"] = o["net"] - local["net"]
    return {"date": (d or date.today()).isoformat(), "src": "rajshahi", "crop": "tomato", "kg": 1000,
            "days_left": days_left, "cost": cost, "options": options, "local_today": local,
            "markets": sorted(options, key=lambda o: -o["net"]), "warnings": []}

# ---------------------------------------------------------------- advisor decisions


def test_sell_now_when_other_market_does_not_cover_transport():
    r = A.decide(adv([opt("rajshahi", 0, 20000), opt("dhaka", 0, 20100, travel=1, km=300)]))
    assert r["decision"] == "sell_now" and r["market"] == "rajshahi"


def test_other_market_when_clearly_better_after_costs():
    r = A.decide(adv([opt("rajshahi", 0, 20000), opt("dhaka", 0, 23000, lo=21000, travel=1, km=300)]))
    assert r["decision"] == "other_market" and r["market"] == "dhaka"
    assert r["advantage"] == 3000 and r["advantage_certain"] is True


def test_wait_only_when_pessimistic_forecast_still_wins():
    base = [opt("rajshahi", 0, 20000)]
    r = A.decide(adv(base + [opt("rajshahi", 2, 24000, lo=19000)]))
    assert r["decision"] != "wait"                      # optimistic only: not enough evidence to wait
    r = A.decide(adv(base + [opt("rajshahi", 1, 24000, lo=21000)]))
    assert r["decision"] == "wait" and r["send_in_days"] == 1
    # tomato loses ~4 % a day while waiting: two days is High spoilage risk, so no "wait" advice
    r = A.decide(adv(base + [opt("rajshahi", 2, 24000, lo=21000)]))
    assert r["decision"] != "wait"


def test_no_wait_for_perishable_produce_near_end_of_shelf_life():
    r = A.decide(adv([opt("rajshahi", 0, 20000), opt("rajshahi", 2, 24000, lo=21000)], days_left=3))
    assert r["decision"] != "wait"


def test_insufficient_evidence_without_model_or_with_stale_data():
    o = [opt("rajshahi", 0, 20000), opt("dhaka", 0, 30000, travel=1, km=300)]
    assert A.decide(adv(o), model_loaded=False)["decision"] == "insufficient_evidence"
    assert A.decide(adv(o, d=date(2020, 1, 1)))["decision"] == "insufficient_evidence"


def test_profit_only_when_cost_known_and_terms_separate():
    r = A.decide(adv([opt("rajshahi", 0, 20000), opt("dhaka", 0, 20100, km=300)]))
    m = r["money"]
    assert m["profit"] is None and m["production_cost"] is None
    assert m["revenue"] == m["gross"] - m["spoilage"]
    assert any("উৎপাদন খরচ দেওয়া হয়নি" in x for x in r["risks"])
    r = A.decide(adv([opt("rajshahi", 0, 20000), opt("dhaka", 0, 20100, km=300)], cost=12))
    assert r["money"]["profit"] == 20000 - 12000


def test_explanation_uses_actual_numbers():
    r = A.decide(adv([opt("rajshahi", 0, 20000, price=25), opt("dhaka", 0, 23000, lo=21000, price=31, km=300)]))
    text = " ".join(r["why"])
    assert "৳২৩,০০০" in text and "৳৩১" in text


def test_live_smart_sell_endpoint(client):
    for _ in range(60):
        if VEG.ready:
            break
        time.sleep(1)
    r = client.get("/api/ai/advisor/smart-sell", params={"src": "natore", "crop": "tomato", "qty": 800, "cost": 14})
    assert r.status_code == 200
    j = r.json()
    m = j["money"]
    assert abs(m["revenue"] - m["other_costs"] - m["transport"] - m["net_proceeds"]) <= 2
    assert j["simulated"] is True and j["provenance"]["data"] == "simulated"
    assert j["decision"] in A.DECISION_BN


@pytest.mark.parametrize("params", [{"src": "x", "crop": "tomato", "qty": 800}, {"src": "natore", "crop": "mango", "qty": 800},
                                    {"src": "natore", "crop": "tomato", "qty": 5}, {"src": "natore", "crop": "tomato", "qty": 800, "cost": -1}])
def test_smart_sell_rejects_invalid_input(client, params):
    assert client.get("/api/ai/advisor/smart-sell", params=params).status_code == 400


def test_smart_sell_when_model_is_not_ready(client, monkeypatch):
    monkeypatch.setattr(VEG, "ready", False)
    assert client.get("/api/ai/advisor/smart-sell", params={"src": "natore", "crop": "tomato", "qty": 800}).status_code == 503

# ---------------------------------------------------------------- spoilage risk


def test_spoilage_levels():
    assert A.spoilage_risk("potato", 30, 6)["level"] == "low"
    assert A.spoilage_risk("tomato", 1, 8)["level"] == "high"
    mid = A.spoilage_risk("tomato", 2, 2)
    assert mid["level"] in ("medium", "high") and mid["prototype_rules"] and mid["limitation"]


def test_cool_storage_lowers_estimated_loss():
    a = A.spoilage_risk("tomato", 5, 10, 1, storage="ambient")["loss_pct"]
    b = A.spoilage_risk("tomato", 5, 10, 1, storage="cool")["loss_pct"]
    assert b < a


def test_spoilage_endpoint_validates(client):
    assert client.get("/api/ai/advisor/spoilage", params={"crop": "tomato", "harvest_days_ago": 2, "travel_hours": 6}).status_code == 200
    assert client.get("/api/ai/advisor/spoilage", params={"crop": "tomato", "travel_hours": 500}).status_code == 400

# ---------------------------------------------------------------- question parser


@pytest.mark.parametrize("text,crop,kg,intent", [
    ("আমার ২০ মণ টমেটো কোন বাজারে বিক্রি করলে বেশি লাভ হবে?", "tomato", 800, "sell"),
    ("৫০০ কেজি আলু কোথায় বেচব", "potato", 500, "sell"),
    ("বিশ মণ পেঁয়াজ কিনতে চাই", "onion", 800, "buy"),
    ("2 ton chili sell", "chili", 2000, "sell"),
])
def test_parser_understands_questions(text, crop, kg, intent):
    r = A.parse_query(text)
    assert (r["crop"], r["qty_kg"], r["intent"]) == (crop, kg, intent) and r["missing"] == []


def test_parser_reports_missing_values_instead_of_guessing():
    r = A.parse_query("কোন বাজারে দাম বেশি?")
    assert r["crop"] is None and r["qty_kg"] is None and set(r["missing"]) >= {"crop", "qty"}


def test_parse_endpoint_never_creates_anything(client):
    n = db.val("SELECT COUNT(*) FROM offers") + db.val("SELECT COUNT(*) FROM listings")
    r = client.post("/api/ai/advisor/parse", json={"text": "২০ মণ টমেটো বিক্রি করে দাও"})
    assert r.status_code == 200 and r.json()["crop"] == "tomato"
    assert db.val("SELECT COUNT(*) FROM offers") + db.val("SELECT COUNT(*) FROM listings") == n

# ---------------------------------------------------------------- pooling


def bk(i, qty, crop="potato", src="natore", dst="dhaka", date_label="আগামীকাল", created=None):
    return {"id": f"B{i}", "qty": qty, "crop": crop, "pickup_place": src, "drop_place": dst, "date": date_label,
            "created": created or db.now_ms(), "trucks_n": 1}


def test_compatibility_rules():
    assert pooling.compatible(bk(1, 1000), bk(2, 1000))
    assert not pooling.compatible(bk(1, 1000), bk(2, 1000, dst="bogura"))          # different destination
    assert not pooling.compatible(bk(1, 1000), bk(2, 1000, date_label="পরশু"))      # different day
    assert not pooling.compatible(bk(1, 1000), bk(2, 1000, crop="tomato"))          # handling class
    assert not pooling.compatible(bk(1, 5000), bk(2, 3000))                         # over 7 t


def test_allocation_is_transparent_and_adds_up():
    g = [bk(1, 1000), bk(2, 3000)]
    a = pooling.allocate(g)
    assert sum(m["shared_cost"] for m in a["members"]) == a["trip_cost"]
    assert a["members"][1]["shared_cost"] == pytest.approx(a["trip_cost"] * 0.75, abs=1)
    for m in a["members"]:
        assert m["savings"] == m["standalone_cost"] - m["shared_cost"]
    assert a["savings_total"] > 0 and a["km_estimated"]


def test_pack_never_exceeds_capacity():
    groups = pooling.pack([bk(i, q) for i, q in enumerate([4000, 3500, 3000, 2000, 1500, 800])])
    assert all(sum(b["qty"] for b in g) <= pooling.MAX_KG for g in groups)
    assert sum(len(g) for g in groups) == 6


def _paid_booking(client, tok, qty, crop="potato"):
    b = client.post("/api/bookings", json={"pickup_place": "natore", "drop_place": "dhaka", "crop": crop, "qty": qty},
                    headers=H(tok)).json()
    p = client.post("/api/payments", json={"purpose": "booking", "ref": b["id"], "method": "bkash"}, headers=H(tok)).json()
    client.post(f"/api/payments/{p['id']}/confirm", json={"account": "01700000000", "pin": S.DEMO_PIN}, headers=H(tok))
    return b


def test_pool_dashboard_assign_and_user_view(client):
    t1, _, _ = register(client, "farmer")
    t2, _, _ = register(client, "farmer")
    b1, b2 = _paid_booking(client, t1, 1200), _paid_booking(client, t2, 900)
    at = admin_token(client)
    d = client.get("/api/admin/pool", headers=H(at)).json()
    g = next(g for g in d["groups"] if {b1["id"], b2["id"]} <= set(g["bookings"]))
    assert g["savings_total"] > 0 and g["truck"]
    mine = client.get("/api/pool/mine", headers=H(t1)).json()
    me = next(m for m in mine if m["booking"] == b1["id"])
    assert me["compatible"] >= 1 and me["savings"] > 0
    assert "uid" not in str(mine) and "phone" not in str(mine)                 # no other user's details
    r = client.post("/api/admin/pool/assign", json={"bookings": g["bookings"], "truck": g["truck"]["id"]}, headers=H(at))
    assert r.status_code == 200
    assert {db.val("SELECT truck FROM bookings WHERE id=?", (x,)) for x in g["bookings"]} == {g["truck"]["id"]}


def test_pool_assign_is_all_or_nothing(client):
    t1, _, _ = register(client, "farmer")
    b1, b2 = _paid_booking(client, t1, 1000), _paid_booking(client, t1, 1000)
    at = admin_token(client)
    tid = client.post("/api/admin/trucks", json={"company": "ছোট পিকআপ", "driver": "চালক", "phone": "01711111112",
                                                 "number": "নাটোর-৯", "vehicle": "pickup", "place": "natore"},
                      headers=H(at)).json()["id"]
    r = client.post("/api/admin/pool/assign", json={"bookings": [b1["id"], b2["id"]], "truck": tid}, headers=H(at))
    assert r.status_code == 400                                                 # 2,000 kg > 1,500 kg pickup
    assert db.val("SELECT truck FROM bookings WHERE id=?", (b1["id"],)) is None


def test_pool_endpoints_need_the_right_role(client):
    t, _, _ = register(client, "farmer")
    assert client.get("/api/admin/pool", headers=H(t)).status_code == 403
    assert client.get("/api/pool/mine").status_code == 401

# ---------------------------------------------------------------- impact & notifications


def test_impact_metrics_match_database_and_label_demo(client, fresh):
    j = client.get("/api/impact").json()
    m = j["metrics"]
    assert m["orders_completed"]["total"] == db.val("SELECT COUNT(*) FROM orders WHERE status='completed'")
    assert m["volume_tk"]["total"] == round(db.val("SELECT COALESCE(SUM(goods),0) FROM orders WHERE status='completed'"))
    assert m["orders_completed"]["demo"] == m["orders_completed"]["total"]      # fresh demo database
    assert m["net_proceeds_gain_tk"]["simulated"] is True
    assert all(v.get("def") for v in m.values())
    assert len(j["trend"]) == 8
    assert client.get("/api/impact", params={"days": 3}).status_code == 400


def test_identical_notifications_are_not_repeated(client):
    _, u, _ = register(client)
    with db.tx():
        S.notify(u["id"], "একই খবর", "info", "#/x")
        S.notify(u["id"], "একই খবর", "info", "#/x")
        S.notify(u["id"], "একই খবর", "info", "#/y")
    assert db.val('SELECT COUNT(*) FROM notifs WHERE "to"=?', (u["id"],)) == 2


def test_notifications_are_private(client):
    t1, u1, _ = register(client)
    t2, _, _ = register(client)
    with db.tx():
        S.notify(u1["id"], "শুধু আমার জন্য")
    assert "শুধু আমার জন্য" not in str(client.get("/api/state", headers=H(t2)).json()["notifs"])
    nid = db.val('SELECT id FROM notifs WHERE "to"=?', (u1["id"],))
    client.post(f"/api/notifs/{nid}/read", headers=H(t2))
    assert db.val("SELECT read FROM notifs WHERE id=?", (nid,)) == 0

# ---------------------------------------------------------------- low bandwidth / PWA


def test_pwa_files_served_and_api_never_cached(client):
    sw = client.get("/sw.js")
    assert sw.status_code == 200 and "javascript" in sw.headers["content-type"]
    assert "startsWith('/api/')" in sw.text and "return;" in sw.text          # API requests bypass the cache
    m = client.get("/manifest.webmanifest")
    assert m.status_code == 200 and m.json()["short_name"] == "Reroute Agro"
    assert "ইন্টারনেট সংযোগ নেই" in client.get("/offline.html").text
    assert "max-age=604800" in client.get("/static/icons/icon-192.png").headers["cache-control"]
    assert client.get("/").headers["cache-control"] == "no-cache"


def test_favicon_assets_are_served(client):
    """The leaf logo favicon set exists and is cacheable; the page no longer embeds the old icon."""
    ico = client.get("/favicon.ico")
    assert ico.status_code == 200 and ico.content[:4] == b"\x00\x00\x01\x00"
    for f in ("logo.svg", "favicon-16.png", "favicon-32.png", "favicon-48.png", "apple-touch-icon.png",
              "icon-192.png", "icon-512.png", "icon-512-maskable.png"):
        r = client.get(f"/static/icons/{f}")
        assert r.status_code == 200, f
    page = client.get("/").text
    assert '/favicon.ico?v=2' in page and "/static/icons/logo.svg?v=2" in page
    assert "8A5A2B" not in page.split("</head>")[0]          # the old market-stall favicon is gone
