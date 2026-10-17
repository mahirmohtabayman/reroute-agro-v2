"""
Business logic for Reroute Agro.

Deal flow:
  Listing → Inspection Requested → Inspection Scheduled → Inspection Completed
  → Offer (produce price) → Transport Cost Agreement → Payment → Order Confirmed
  → Handover → Completed

Transport negotiation:
  Buyer selects split option (buyer/half/seller) → Proposal sent to farmer if cost falls on farmer
  → Farmer accepts/rejects/counters → Counter-offer loop → Agreement confirmed
  → Payment unlocked
"""
import json
import uuid
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException

from app import db
from app.logic import (CANCEL_PENALTY, CASHBACK, CASHBACK_MIN, CASHBACK_WEEK, COMMISSION, CREDIT_MAX_SHARE, CROPS,
                       DAY, HOUR, MIN_ORDER_KG, MON, OFFER_HOURS, PAY_HOURS, PLACES, PLUS_DAYS, PLUS_PRICE, REDEEM,
                       VEHICLES, bn, crop_name, mon, place_name, platform_fee, tk, transport_quote)

_clock = [None]


def now():
    return _clock[0] if _clock[0] is not None else db.now_ms()


def nid(prefix):
    return prefix + uuid.uuid4().hex[:8]


def fail(code, msg):
    raise HTTPException(code, msg)


def user(uid):
    return db.one("SELECT * FROM users WHERE id=?", (uid,))


def who(u):
    return u["biz"] if u["role"] == "paikar" else u["name"]


def is_plus(u):
    return (u.get("plus_until") or 0) > now()


def is_bulk(uid):
    return (db.val("SELECT COUNT(*) FROM orders WHERE buyer=? AND status='completed' AND completed_at>?",
                   (uid, now() - 30 * DAY)) or 0) >= 5


def days_left(l):
    return l["shelf"] - int((now() - l["harvest"]) // DAY)


def eff_price(l):
    return round(l["price"] * (1 - (l["urgent"] or 0)), 1)


# ---------------------------------------------------------------- notifications, wallet, points
def notify(to, text, kind="info", link=None):
    """In-app notification for one user. An identical unread one from the last 10 minutes is not repeated."""
    if db.val('SELECT COUNT(*) FROM notifs WHERE "to"=? AND text=? AND COALESCE(link,\'\')=? AND read=0 AND at>?',
              (to, text, link or "", now() - 10 * 60_000)):
        return
    db.insert("notifs", {"id": nid("N"), "to": to, "text": text, "kind": kind, "link": link, "at": now(), "read": 0})


def seen(uid, link):
    db.run('UPDATE notifs SET read=1 WHERE "to"=? AND link=?', (uid, link))


def wallet(uid, amount, kind, ref=None, note=None):
    """Credit (amount > 0) or debit a wallet and write the ledger row. A debit never takes the balance below zero."""
    if not db.run("UPDATE users SET wallet=wallet+? WHERE id=? AND wallet+?>=-0.005", (amount, uid, amount)):
        fail(400, "ওয়ালেটে যথেষ্ট টাকা নেই")
    db.insert("wallet_tx", {"id": nid("W"), "uid": uid, "amount": round(amount, 2), "kind": kind, "ref": ref,
                            "note": note, "at": now()})


def points(uid, pts, kind, ref=None, note=None):
    if not pts:
        return
    db.run("UPDATE users SET pts=MAX(0, pts+?) WHERE id=?", (pts, uid))
    db.insert("points_tx", {"id": nid("P"), "uid": uid, "pts": pts, "kind": kind, "ref": ref, "note": note, "at": now()})


# ---------------------------------------------------------------- stock / inventory
def stock_row(uid, crop):
    s = db.one("SELECT * FROM stock WHERE uid=? AND crop=?", (uid, crop))
    if not s:
        db.run("INSERT INTO stock (uid, crop, qty, cost) VALUES (?,?,0,NULL)", (uid, crop))
        s = {"uid": uid, "crop": crop, "qty": 0, "cost": None}
    return s


def stock_add(uid, crop, qty, cost_per_kg=None):
    s = stock_row(uid, crop)
    new_qty = s["qty"] + qty
    if cost_per_kg is None or (s["cost"] is None and s["qty"] > 0):
        cost = s["cost"] if cost_per_kg is None else None
    else:
        cost = ((s["cost"] or 0) * s["qty"] + cost_per_kg * qty) / new_qty if new_qty else cost_per_kg
    db.run("UPDATE stock SET qty=?, cost=? WHERE uid=? AND crop=?", (new_qty, cost, uid, crop))


def stock_take(uid, crop, qty):
    s = stock_row(uid, crop)
    db.run("UPDATE stock SET qty=MAX(0, qty-?) WHERE uid=? AND crop=?", (qty, uid, crop))
    return s["cost"]


def unlisted(uid, crop):
    s = stock_row(uid, crop)
    on_market = db.val("SELECT COALESCE(SUM(available+reserved),0) FROM listings WHERE uid=? AND crop=? "
                       "AND status IN ('active','paused','sold_out')", (uid, crop)) or 0
    return max(0, s["qty"] - on_market)


def inventory(uid):
    crops = {r["crop"] for r in db.q("SELECT crop FROM stock WHERE uid=? AND qty>0", (uid,))}
    crops |= {r["crop"] for r in db.q("SELECT crop FROM orders WHERE (buyer=? OR seller=?)", (uid, uid))}
    crops |= {r["crop"] for r in db.q("SELECT crop FROM listings WHERE uid=?", (uid,))}
    out = []
    for c in sorted(crops):
        s = stock_row(uid, c)
        ls = db.one("SELECT COALESCE(SUM(available),0) a, COALESCE(SUM(reserved),0) r FROM listings "
                    "WHERE uid=? AND crop=? AND status IN ('active','paused','sold_out')", (uid, c))
        sold = (db.val("SELECT COALESCE(SUM(qty),0) FROM orders WHERE seller=? AND crop=? AND status='completed'", (uid, c)) or 0) \
            + (db.val("SELECT COALESCE(SUM(qty),0) FROM entries WHERE uid=? AND crop=? AND kind='sale' "
                      "AND voided_at IS NULL", (uid, c)) or 0)
        bought = db.val("SELECT COALESCE(SUM(qty),0) FROM orders WHERE buyer=? AND crop=? AND status='completed'", (uid, c)) or 0
        incoming = db.val("SELECT COALESCE(SUM(qty),0) FROM orders WHERE buyer=? AND crop=? "
                          "AND status IN ('confirmed','handed_over')", (uid, c)) or 0
        out.append({"crop": c, "in_hand": s["qty"], "listed": ls["a"], "reserved": ls["r"],
                    "unlisted": max(0, s["qty"] - ls["a"] - ls["r"]), "sold": sold, "bought": bought,
                    "incoming": incoming, "cost": s["cost"]})
    return out


# ---------------------------------------------------------------- listings
def create_listing(u, crop, qty, price, moq, grade="A", quality="", harvest_days_ago=0, photos=None, prod_cost=None):
    if crop not in CROPS:
        fail(400, "ফসল ঠিক নেই")
    if moq < MIN_ORDER_KG:
        fail(400, f"সর্বনিম্ন অর্ডার অন্তত {mon(MIN_ORDER_KG)} মণ হতে হবে (পাইকারি প্ল্যাটফর্ম)")
    if qty < moq:
        fail(400, "মোট পরিমাণ সর্বনিম্ন অর্ডারের চেয়ে কম হতে পারবে না")
    if price <= 0:
        fail(400, "দাম দিন")
    free = unlisted(u["id"], crop)
    if u["role"] == "farmer":
        if qty > free:
            stock_add(u["id"], crop, qty - free, prod_cost)
    elif qty > free:
        fail(400, f"আপনার মজুদে বিক্রির মতো {crop_name(crop)} আছে {mon(free)} মণ। এর বেশি তালিকায় দেওয়া যাবে না")
    l = {"id": nid("L"), "uid": u["id"], "crop": crop, "qty_total": qty, "available": qty, "reserved": 0, "sold": 0,
         "price": price, "moq": moq, "grade": grade, "quality": quality,
         "harvest": now() - int(harvest_days_ago) * DAY, "shelf": CROPS[crop][1], "photos": json.dumps(photos or []),
         "status": "active", "created": now(), "updated": now(), "urgent": 0, "prod_cost": prod_cost}
    db.insert("listings", l)
    return l


def my_listing(u, lid):
    l = db.one("SELECT * FROM listings WHERE id=?", (lid,))
    if not l or l["uid"] != u["id"]:
        fail(404, "লিস্টিং পাওয়া যায়নি")
    return l


def update_listing(u, lid, price=None, add_qty=None, moq=None, quality=None, grade=None, status=None):
    l = my_listing(u, lid)
    fields = {"updated": now()}
    if price is not None:
        if price <= 0:
            fail(400, "দাম ঠিক নেই")
        fields["price"] = price
    if moq is not None:
        if moq < MIN_ORDER_KG:
            fail(400, f"সর্বনিম্ন অর্ডার অন্তত {mon(MIN_ORDER_KG)} মণ")
        fields["moq"] = moq
    if quality is not None:
        fields["quality"] = quality
    if grade is not None:
        fields["grade"] = grade
    if add_qty:
        if add_qty < 0 and -add_qty > l["available"]:
            fail(400, "বিক্রিযোগ্য পরিমাণের চেয়ে বেশি কমানো যাবে না")
        if add_qty > 0:
            free = unlisted(u["id"], l["crop"])
            if add_qty > free:
                if u["role"] == "farmer":
                    stock_add(u["id"], l["crop"], add_qty - free, l["prod_cost"])
                else:
                    fail(400, f"মজুদে আর মাত্র {mon(free)} মণ আছে")
        fields["available"] = l["available"] + add_qty
        fields["qty_total"] = l["qty_total"] + add_qty
        fields["alert_low"] = 0
        if fields["available"] > 0 and l["status"] == "sold_out":
            fields["status"] = "active"
    if status in ("active", "paused"):
        if status == "active" and (fields.get("available", l["available"]) <= 0):
            fail(400, "বিক্রির মতো মাল নেই, আগে পরিমাণ বাড়ান")
        fields["status"] = status
    if status == "closed":
        if l["reserved"] > 0:
            fail(400, "চলমান অর্ডার আছে, তাই এখন বন্ধ করা যাবে না")
        fields["status"] = "closed"
        fields["available"] = 0
    db.update("listings", lid, **fields)
    return db.one("SELECT * FROM listings WHERE id=?", (lid,))


def make_urgent(u, lid):
    l = my_listing(u, lid)
    if l["status"] != "active" or l["available"] <= 0:
        fail(400, "শুধু চালু লিস্টিং জরুরি করা যায়")
    d = days_left(l)
    disc = 0.12 if d <= 1 else 0.10 if d <= 2 else 0.07
    db.update("listings", lid, urgent=disc, updated=now())
    for p in db.q("SELECT id FROM users WHERE role='paikar'"):
        notify(p["id"], f"🚨 জরুরি বিক্রি: {who(u)} ({place_name(u['place'])}) {mon(l['available'])} মণ "
                        f"{crop_name(l['crop'])}, {bn(round(disc * 100))}% কম দামে। নষ্ট হওয়ার আগে কিনুন।", "urgent", f"#/listing/{lid}")
    return disc


def check_listing_alerts(l):
    seller = l["uid"]
    if l["available"] <= 0 and l["status"] == "active":
        db.update("listings", l["id"], status="sold_out")
        notify(seller, f"📦 আপনার {crop_name(l['crop'])}-এর লিস্টিং পুরো বিক্রি/বুক হয়ে গেছে।", "stock", f"#/listing/{l['id']}")
    elif 0 < l["available"] < 2 * l["moq"] and not l["alert_low"]:
        db.update("listings", l["id"], alert_low=1)
        notify(seller, f"⚠️ {crop_name(l['crop'])}-এর লিস্টিংয়ে আর মাত্র {mon(l['available'])} মণ বাকি।", "stock", f"#/listing/{l['id']}")


# ---------------------------------------------------------------- STEP 1 & 2: Inspection workflow
def request_inspection(u, lid, kind, pref, note=""):
    """Buyer requests inspection of a farmer's listing."""
    l = db.one("SELECT * FROM listings WHERE id=?", (lid,))
    if not l or l["uid"] == u["id"]:
        fail(400, "এই মাল পরিদর্শন করা যাবে না")
    if l["status"] != "active":
        fail(400, "এই লিস্টিং এখন চালু নেই")
    if u["role"] != "paikar":
        fail(403, "পাইকার হিসেবে লগ ইন করুন")
    i = {"id": nid("I"), "listing": lid, "buyer": u["id"], "seller": l["uid"], "kind": kind, "pref": pref,
         "note": note, "status": "requested", "reply": None, "created": now(), "updated": now(),
         "proposed_time": None, "confirmed_time": None, "buyer_confirmed_at": None,
         "buyer_done_at": None, "seller_verified_at": None, "scheduled_at": None}
    db.insert("inspections", i)
    notify(l["uid"], f"🔍 {who(u)} আপনার {crop_name(l['crop'])} {'ভিডিও কলে' if kind == 'video' else 'সরাসরি এসে'} "
                     f"দেখতে চান। পছন্দের সময়: {pref}।", "inspection", f"#/inspection/{i['id']}")
    return i


def farmer_propose_time(u, iid, proposed_time, reply=""):
    """Farmer accepts inspection request and proposes a specific date/time (Step 1 part 2)."""
    i = db.one("SELECT * FROM inspections WHERE id=?", (iid,))
    if not i:
        fail(404, "পরিদর্শন পাওয়া যায়নি")
    if u["id"] != i["seller"]:
        fail(403, "শুধু বিক্রেতা সময় প্রস্তাব করতে পারেন")
    if i["status"] != "requested":
        fail(400, "এখন সময় প্রস্তাব করা যাবে না")
    if not proposed_time or not proposed_time.strip():
        fail(400, "পরিদর্শনের তারিখ ও সময় দিন")
    db.update("inspections", iid, status="time_proposed", proposed_time=proposed_time,
              reply=reply or "", updated=now())
    seen(u["id"], f"#/inspection/{iid}")
    notify(i["buyer"], f"📅 {who(u)} পরিদর্শনের সময় প্রস্তাব করেছেন: {proposed_time}। নিশ্চিত করুন।",
           "inspection", f"#/inspection/{iid}")
    return db.one("SELECT * FROM inspections WHERE id=?", (iid,))


def buyer_confirm_schedule(u, iid):
    """Buyer confirms the farmer's proposed inspection time — sets status to 'scheduled' (Step 1 final)."""
    i = db.one("SELECT * FROM inspections WHERE id=?", (iid,))
    if not i:
        fail(404, "পরিদর্শন পাওয়া যায়নি")
    if u["id"] != i["buyer"]:
        fail(403, "শুধু ক্রেতা সময় নিশ্চিত করতে পারেন")
    if i["status"] != "time_proposed":
        fail(400, "বিক্রেতার প্রস্তাবিত সময় নিশ্চিত করুন")
    db.update("inspections", iid, status="scheduled", confirmed_time=i["proposed_time"],
              buyer_confirmed_at=now(), scheduled_at=now(), updated=now())
    seen(u["id"], f"#/inspection/{iid}")
    notify(i["seller"], f"✅ {who(u)} পরিদর্শনের সময় নিশ্চিত করেছেন: {i['proposed_time']}।",
           "inspection", f"#/inspection/{iid}")
    return db.one("SELECT * FROM inspections WHERE id=?", (iid,))


def buyer_report_inspection_done(u, iid):
    """Buyer reports they have physically inspected the produce (Step 2 part 1)."""
    i = db.one("SELECT * FROM inspections WHERE id=?", (iid,))
    if not i:
        fail(404, "পরিদর্শন পাওয়া যায়নি")
    if u["id"] != i["buyer"]:
        fail(403, "শুধু ক্রেতা মাল দেখার রিপোর্ট করতে পারেন")
    if i["status"] != "scheduled":
        fail(400, "পরিদর্শন সময়সূচি নিশ্চিত না হলে এটি করা যাবে না")
    db.update("inspections", iid, status="buyer_done", buyer_done_at=now(), updated=now())
    seen(u["id"], f"#/inspection/{iid}")
    notify(i["seller"], f"🔍 {who(u)} বলছেন মাল দেখেছেন। আপনি কি এটি নিশ্চিত করবেন?",
           "inspection", f"#/inspection/{iid}")
    return db.one("SELECT * FROM inspections WHERE id=?", (iid,))


def seller_verify_inspection(u, iid, confirm=True, note=""):
    """Farmer confirms or disputes that buyer visited and inspected the produce (Step 2 final)."""
    i = db.one("SELECT * FROM inspections WHERE id=?", (iid,))
    if not i:
        fail(404, "পরিদর্শন পাওয়া যায়নি")
    if u["id"] != i["seller"]:
        fail(403, "শুধু বিক্রেতা পরিদর্শন নিশ্চিত করতে পারেন")
    if i["status"] != "buyer_done":
        fail(400, "ক্রেতার রিপোর্টের পরেই নিশ্চিত করা যাবে")
    buyer = user(i["buyer"])
    if confirm:
        db.update("inspections", iid, status="completed", seller_verified_at=now(), reply=note or "", updated=now())
        seen(u["id"], f"#/inspection/{iid}")
        notify(i["buyer"], f"✅ {who(u)} নিশ্চিত করেছেন — পরিদর্শন সম্পন্ন। এখন অফার দিতে পারেন।",
               "inspection", f"#/inspection/{iid}")
    else:
        db.update("inspections", iid, status="disputed", reply=note or "বিক্রেতা বলছেন ক্রেতা আসেননি", updated=now())
        seen(u["id"], f"#/inspection/{iid}")
        notify(i["buyer"], f"❌ {who(u)} পরিদর্শন নিশ্চিত করেননি। কারণ: {note or 'বিক্রেতা বলছেন ক্রেতা আসেননি'}",
               "inspection", f"#/inspection/{iid}")
    return db.one("SELECT * FROM inspections WHERE id=?", (iid,))


def decline_inspection(u, iid, reply=""):
    """Farmer declines an inspection request."""
    i = db.one("SELECT * FROM inspections WHERE id=?", (iid,))
    if not i or u["id"] != i["seller"]:
        fail(403, "এই পরিদর্শন আপনার নয়")
    if i["status"] != "requested":
        fail(400, "এখন বাতিল করা যাবে না")
    db.update("inspections", iid, status="declined", reply=reply, updated=now())
    seen(u["id"], f"#/inspection/{iid}")
    notify(i["buyer"], f"❌ {who(u)} পরিদর্শনে রাজি হননি।" + (f" কারণ: {reply}" if reply else ""),
           "inspection", f"#/inspection/{iid}")


def cancel_inspection(u, iid):
    """Buyer cancels their own inspection request."""
    i = db.one("SELECT * FROM inspections WHERE id=?", (iid,))
    if not i or u["id"] != i["buyer"]:
        fail(403, "এই পরিদর্শন আপনার নয়")
    if i["status"] in ("completed", "cancelled", "declined"):
        fail(400, "এই পরিদর্শন বাতিল করা যাবে না")
    db.update("inspections", iid, status="cancelled", updated=now())
    seen(u["id"], f"#/inspection/{iid}")
    notify(i["seller"], f"{who(u)} পরিদর্শনের অনুরোধ বাতিল করেছেন।",
           "inspection", f"#/inspection/{iid}")


# ---------------------------------------------------------------- offers & negotiation
def offer_event(oid, by, action, price, note=None):
    db.insert("offer_events", {"id": nid("E"), "offer": oid, "by": by, "action": action, "price": price, "at": now(), "note": note})


def make_offer(u, lid, qty, price, transport="reroute", split="half", note=""):
    """Buyer makes an offer. Inspection must be completed if it exists for this listing/buyer pair."""
    l = db.one("SELECT * FROM listings WHERE id=?", (lid,))
    if not l or l["status"] != "active":
        fail(400, "এই লিস্টিং এখন চালু নেই")
    if l["uid"] == u["id"]:
        fail(400, "নিজের মালে অফার দেওয়া যায় না")
    if qty < l["moq"]:
        fail(400, f"সর্বনিম্ন অর্ডার {mon(l['moq'])} মণ")
    if qty > l["available"]:
        fail(400, f"বিক্রির জন্য আছে মাত্র {mon(l['available'])} মণ")
    listed = eff_price(l)
    if price <= 0 or price > listed:
        fail(400, f"দাম তালিকার দাম ৳{bn(listed, 1)}/কেজি বা তার কম হতে হবে")
    if transport not in ("reroute", "self") or split not in ("buyer", "half", "seller"):
        fail(400, "পরিবহন বাছাই ঠিক নেই")

    # Check: if inspection exists for this buyer+listing, it must be completed
    existing_insp = db.one(
        "SELECT * FROM inspections WHERE listing=? AND buyer=? ORDER BY created DESC LIMIT 1",
        (lid, u["id"])
    )
    if existing_insp and existing_insp["status"] not in ("completed", "cancelled", "declined"):
        fail(400, "পরিদর্শন সম্পন্ন হওয়ার আগে অফার দেওয়া যাবে না")

    o = {"id": nid("O"), "listing": lid, "buyer": u["id"], "seller": l["uid"], "crop": l["crop"], "qty": qty,
         "price": price, "listed_price": listed, "status": "pending", "waiting": "seller", "transport": transport,
         "split": split if transport == "reroute" else "buyer", "note": note, "created": now(), "updated": now(),
         "expires": now() + OFFER_HOURS * HOUR, "order_id": None, "reason": None}
    db.insert("offers", o)
    offer_event(o["id"], u["id"], "offer", price, note)
    lower = price < listed
    notify(l["uid"], f"📩 {who(u)} {mon(qty)} মণ {crop_name(l['crop'])} কিনতে চান, "
                     f"{'কম দামে ' if lower else ''}৳{bn(price, 1)}/কেজি (আপনার দাম ৳{bn(listed, 1)})।", "offer", f"#/offer/{o['id']}")
    return o


def get_offer(oid):
    o = db.one("SELECT * FROM offers WHERE id=?", (oid,))
    if not o:
        fail(404, "অফার পাওয়া যায়নি")
    return o


def respond_offer(u, oid, action, price=None, reason=None):
    """Seller: accept / reject / counter. Buyer: accept / reject a counter, or cancel."""
    o = get_offer(oid)
    side = "seller" if u["id"] == o["seller"] else "buyer" if u["id"] == o["buyer"] else None
    if not side:
        fail(403, "এই অফার আপনার নয়")
    if o["status"] not in ("pending", "countered"):
        fail(400, "এই অফার আর চালু নেই")
    other = o["buyer"] if side == "seller" else o["seller"]
    seen(u["id"], f"#/offer/{oid}")
    if action == "cancel":
        if side != "buyer":
            fail(400, "বিক্রেতা অফার বাতিল নয়, প্রত্যাখ্যান করতে পারেন")
        db.update("offers", oid, status="cancelled", reason=reason, updated=now())
        offer_event(oid, u["id"], "cancel", o["price"], reason)
        notify(other, f"{who(u)} তাঁর অফার তুলে নিয়েছেন ({mon(o['qty'])} মণ {crop_name(o['crop'])})."
               + (f" কারণ: {reason}" if reason else ""), "cancel", f"#/offer/{oid}")
        return {"status": "cancelled"}
    if o["waiting"] != side:
        fail(400, "এখন অন্যজনের উত্তরের অপেক্ষা")
    if action == "reject":
        db.update("offers", oid, status="rejected", reason=reason, updated=now())
        offer_event(oid, u["id"], "reject", o["price"], reason)
        notify(other, f"❌ {who(u)} {mon(o['qty'])} মণ {crop_name(o['crop'])}-এর "
               f"{'অফার' if side == 'seller' else 'পাল্টা দাম'} গ্রহণ করেননি।" + (f" কারণ: {reason}" if reason else ""),
               "cancel", f"#/offer/{oid}")
        return {"status": "rejected"}
    if action == "counter":
        if side != "seller":
            fail(400, "পাল্টা দাম বিক্রেতা দেন")
        if price is None or price <= o["price"] or price > o["listed_price"]:
            fail(400, f"পাল্টা দাম ক্রেতার দামের (৳{bn(o['price'], 1)}) বেশি এবং তালিকার দামের (৳{bn(o['listed_price'], 1)}) মধ্যে হতে হবে")
        db.update("offers", oid, status="countered", waiting="buyer", price=price, updated=now(),
                  expires=now() + OFFER_HOURS * HOUR)
        offer_event(oid, u["id"], "counter", price)
        notify(other, f"↔️ {who(u)} পাল্টা দাম দিয়েছেন: ৳{bn(price, 1)}/কেজি ({mon(o['qty'])} মণ {crop_name(o['crop'])})। "
                      "রাজি হলে পেমেন্ট করুন।", "offer", f"#/offer/{oid}")
        return {"status": "countered"}
    if action == "accept":
        order = create_order(o, u)
        return {"status": "accepted", "order": order}
    fail(400, "অজানা কাজ")


def create_order(o, accepted_by):
    """
    Creates the order after offer acceptance.
    For reroute transport: creates a transport negotiation record.
    The booking is NOT created until transport negotiation is agreed.
    """
    l = db.one("SELECT * FROM listings WHERE id=?", (o["listing"],))
    if not l or l["available"] < o["qty"]:
        fail(400, "লিস্টিংয়ে এখন এত মাল নেই")
    buyer, seller = user(o["buyer"]), user(o["seller"])
    goods = round(o["price"] * o["qty"])
    fee = platform_fee(goods)
    fee_disc = min(seller["fee_credit"] or 0, fee)

    t_total = t_buyer = t_seller = t_cb = t_cs = 0
    booking = None

    if o["transport"] == "reroute":
        qd = transport_quote(seller["place"], buyer["place"], o["qty"], is_plus(buyer), is_bulk(buyer["id"]))
        t_total = qd["total"]
        # Initial split from offer — will be overridden by transport negotiation
        t_buyer = {"buyer": t_total, "half": t_total / 2, "seller": 0}[o["split"]]
        t_seller = t_total - t_buyer
        t_cb = min(buyer["transport_credit"] or 0, t_buyer * CREDIT_MAX_SHARE)
        t_cs = min(seller["transport_credit"] or 0, t_seller * CREDIT_MAX_SHARE)

    oid = nid("D")
    order = {"id": oid, "offer": o["id"], "listing": o["listing"], "buyer": buyer["id"], "seller": seller["id"],
             "crop": o["crop"], "qty": o["qty"], "price": o["price"], "listed_price": o["listed_price"], "goods": goods,
             "fee": fee, "fee_disc": fee_disc, "transport": o["transport"], "split": o["split"], "booking": booking,
             "t_total": round(t_total), "t_buyer": round(t_buyer), "t_seller": round(t_seller),
             "t_cb": round(t_cb), "t_cs": round(t_cs),
             "buyer_total": round(goods + t_buyer - t_cb),
             "payout": round(goods - (fee - fee_disc) - (t_seller - t_cs)), "status": "awaiting_payment",
             "created": now()}
    db.insert("orders", order)

    # Reserve goods and credits
    db.run("UPDATE listings SET available=available-?, reserved=reserved+?, updated=? WHERE id=?",
           (o["qty"], o["qty"], now(), l["id"]))
    db.run("UPDATE users SET fee_credit=fee_credit-?, transport_credit=transport_credit-? WHERE id=?",
           (fee_disc, round(t_cs), seller["id"]))
    db.run("UPDATE users SET transport_credit=transport_credit-? WHERE id=?", (round(t_cb), buyer["id"]))
    db.update("offers", o["id"], status="accepted", order_id=oid, updated=now())
    offer_event(o["id"], accepted_by["id"], "accept", o["price"])
    check_listing_alerts(db.one("SELECT * FROM listings WHERE id=?", (l["id"],)))

    if o["transport"] == "reroute":
        # Create transport negotiation record
        _init_transport_negotiation(oid, buyer["id"], seller["id"], round(t_total), o["split"])
        # Status will stay awaiting_payment until transport is agreed
        _send_transport_proposal_from_split(oid, buyer, seller, round(t_total), o["split"])
        notify(buyer["id"], f"✅ {who(seller)} রাজি: {mon(o['qty'])} মণ {crop_name(o['crop'])} ৳{bn(o['price'], 1)}/কেজি। "
                            f"পরিবহন খরচ ভাগাভাগি নিশ্চিত করুন।", "pay", f"#/order/{oid}")
        notify(seller["id"], f"✅ {mon(o['qty'])} মণ {crop_name(o['crop'])} বিক্রিতে রাজি হয়েছেন। "
                             f"পরিবহন খরচের প্রস্তাব আপনার কাছে পাঠানো হয়েছে।", "order", f"#/order/{oid}")
    else:
        # Self transport — no negotiation needed, proceed directly
        notify(buyer["id"], f"✅ {who(seller)} রাজি: {mon(o['qty'])} মণ {crop_name(o['crop'])} ৳{bn(o['price'], 1)}/কেজি। "
                            f"এখন {tk(order['buyer_total'])} পেমেন্ট করুন, {bn(PAY_HOURS)} ঘণ্টার মধ্যে।", "pay", f"#/order/{oid}")
        notify(seller["id"], f"✅ {mon(o['qty'])} মণ {crop_name(o['crop'])} বিক্রিতে রাজি হয়েছেন। "
                             f"{who(buyer)} পেমেন্ট করলেই অর্ডার নিশ্চিত হবে।", "order", f"#/order/{oid}")
    books(oid)
    return order


# ---------------------------------------------------------------- STEPS 3 & 4: Transport Cost Negotiation
def _money(val):
    """Round money to 2 decimal places using ROUND_HALF_UP."""
    return float(Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _init_transport_negotiation(order_id, buyer_id, seller_id, t_total, initial_split):
    """Create the transport_negotiations record for a new reroute-transport order."""
    nid_val = nid("TN")
    db.insert("transport_negotiations", {
        "id": nid_val, "order_id": order_id, "buyer": buyer_id, "seller": seller_id,
        "t_total": t_total, "status": "pending",
        "agreed_buyer_pct": None, "agreed_seller_pct": None,
        "agreed_buyer_amt": None, "agreed_seller_amt": None,
        "created": now(), "updated": now(), "version": 1
    })
    return nid_val


def _send_transport_proposal_from_split(order_id, buyer, seller, t_total, split):
    """
    Create initial transport proposal based on the offer's split choice.
    buyer=100% (option A): no farmer consent needed, auto-confirm.
    half (option B): notify farmer to accept/reject/counter.
    seller=100% (option C): notify farmer to accept/reject/counter.
    """
    pct_map = {"buyer": (100, 0), "half": (50, 50), "seller": (0, 100)}
    buyer_pct, seller_pct = pct_map[split]
    buyer_amt = _money(t_total * buyer_pct / 100)
    seller_amt = _money(t_total * seller_pct / 100)

    tn = db.one("SELECT * FROM transport_negotiations WHERE order_id=?", (order_id,))
    if not tn:
        return

    prop = {"id": nid("TP"), "negotiation": tn["id"], "proposer": buyer["id"], "recipient": seller["id"],
            "buyer_pct": buyer_pct, "seller_pct": seller_pct,
            "buyer_amt": buyer_amt, "seller_amt": seller_amt,
            "status": "pending", "note": "", "created": now(), "version": 1}
    db.insert("transport_proposals", prop)

    if split == "buyer":
        # Buyer pays 100% — auto-confirm, no farmer consent needed
        _confirm_transport_agreement(tn["id"], buyer_pct, seller_pct, buyer_amt, seller_amt)
    else:
        cost_txt = f"আপনার ভাগ: ৳{bn(seller_amt)} ({bn(seller_pct)}%)" if seller_amt > 0 else "আপনার ভাগ: ০ টাকা"
        notify(seller["id"], f"🚚 পরিবহন খরচের প্রস্তাব এসেছে। মোট ভাড়া: ৳{bn(t_total)}। {cost_txt}। "
                              "রাজি হলে 'গ্রহণ করুন', না হলে 'পাল্টা প্রস্তাব দিন'।",
               "transport", f"#/order/{order_id}")


def propose_transport_split(u, order_id, buyer_pct, seller_pct, note=""):
    """
    Buyer or farmer submits a transport cost sharing proposal (percentage-based).
    buyer_pct + seller_pct must = 100. Both must be 0-100.
    """
    o = get_order(order_id, u)
    tn = db.one("SELECT * FROM transport_negotiations WHERE order_id=?", (order_id,))
    if not tn:
        fail(404, "পরিবহন চুক্তির তথ্য পাওয়া যায়নি")
    if tn["status"] == "agreed":
        fail(400, "পরিবহন চুক্তি আগেই চূড়ান্ত হয়েছে")
    if o["status"] not in ("awaiting_payment",):
        fail(400, "এই পর্যায়ে পরিবহন প্রস্তাব করা যাবে না")

    side = "buyer" if u["id"] == o["buyer"] else "seller" if u["id"] == o["seller"] else None
    if not side:
        fail(403, "এই অর্ডার আপনার নয়")

    # Validation
    buyer_pct = round(float(buyer_pct), 2)
    seller_pct = round(float(seller_pct), 2)
    if abs(buyer_pct + seller_pct - 100) > 0.01:
        fail(400, "ক্রেতা ও বিক্রেতার শতাংশের যোগফল ১০০ হতে হবে")
    if buyer_pct < 0 or seller_pct < 0 or buyer_pct > 100 or seller_pct > 100:
        fail(400, "শতাংশ ০ থেকে ১০০-এর মধ্যে হতে হবে")

    t_total = tn["t_total"]
    buyer_amt = _money(t_total * buyer_pct / 100)
    seller_amt = _money(t_total * seller_pct / 100)

    # Mark any existing pending proposals as superseded
    db.run("UPDATE transport_proposals SET status='superseded' WHERE negotiation=? AND status='pending'", (tn["id"],))

    recipient = o["seller"] if side == "buyer" else o["buyer"]
    new_version = (tn["version"] or 1) + 1

    prop = {"id": nid("TP"), "negotiation": tn["id"], "proposer": u["id"], "recipient": recipient,
            "buyer_pct": buyer_pct, "seller_pct": seller_pct,
            "buyer_amt": buyer_amt, "seller_amt": seller_amt,
            "status": "pending", "note": note or "", "created": now(), "version": new_version}
    db.insert("transport_proposals", prop)
    db.update("transport_negotiations", tn["id"], version=new_version, updated=now())

    recipient_user = user(recipient)
    proposer_user = user(u["id"])
    cost_txt = (f"আপনার ভাগ: ৳{bn(seller_amt)} ({bn(seller_pct)}%)" if side == "buyer"
                else f"ক্রেতার ভাগ: ৳{bn(buyer_amt)} ({bn(buyer_pct)}%), আপনার ভাগ: ৳{bn(seller_amt)} ({bn(seller_pct)}%)")
    notify(recipient, f"🔄 {who(proposer_user)} পরিবহন খরচের নতুন প্রস্তাব দিয়েছেন। "
                      f"মোট ভাড়া: ৳{bn(t_total)}। {cost_txt}।",
           "transport", f"#/order/{order_id}")

    return {"proposal": prop, "negotiation": db.one("SELECT * FROM transport_negotiations WHERE id=?", (tn["id"],))}


def respond_transport_proposal(u, order_id, proposal_id, action, note=""):
    """
    Accept or reject a transport proposal. Only the recipient can act.
    action: 'accept' | 'reject'
    """
    o = get_order(order_id, u)
    tn = db.one("SELECT * FROM transport_negotiations WHERE order_id=?", (order_id,))
    if not tn:
        fail(404, "পরিবহন চুক্তির তথ্য পাওয়া যায়নি")
    if tn["status"] == "agreed":
        fail(400, "পরিবহন চুক্তি আগেই চূড়ান্ত হয়েছে")

    prop = db.one("SELECT * FROM transport_proposals WHERE id=?", (proposal_id,))
    if not prop or prop["negotiation"] != tn["id"]:
        fail(404, "প্রস্তাব পাওয়া যায়নি")
    if prop["status"] != "pending":
        fail(400, "এই প্রস্তাব আর সক্রিয় নেই (পুরনো বা ইতিমধ্যে সাড়া দেওয়া হয়েছে)")
    if prop["recipient"] != u["id"]:
        fail(403, "এই প্রস্তাব আপনার কাছে পাঠানো হয়নি")

    if action == "accept":
        db.update("transport_proposals", proposal_id, status="accepted")
        _confirm_transport_agreement(tn["id"], prop["buyer_pct"], prop["seller_pct"],
                                     prop["buyer_amt"], prop["seller_amt"])
        _apply_agreed_transport_to_order(order_id, prop["buyer_amt"], prop["seller_amt"],
                                         prop["buyer_pct"], prop["seller_pct"])
        proposer = user(prop["proposer"])
        notify(prop["proposer"], f"✅ পরিবহন খরচের প্রস্তাব গৃহীত হয়েছে। "
                                  f"ক্রেতার ভাগ: ৳{bn(prop['buyer_amt'])}, বিক্রেতার ভাগ: ৳{bn(prop['seller_amt'])}। "
                                  "এখন পেমেন্ট করুন।",
               "transport", f"#/order/{order_id}")
        return {"status": "agreed"}
    elif action == "reject":
        db.update("transport_proposals", proposal_id, status="rejected")
        db.update("transport_negotiations", tn["id"], updated=now())
        rejector = user(u["id"])
        notify(prop["proposer"], f"❌ {who(rejector)} পরিবহন খরচের প্রস্তাব গ্রহণ করেননি।"
                                  + (f" কারণ: {note}" if note else "") + " নতুন প্রস্তাব দিন।",
               "transport", f"#/order/{order_id}")
        return {"status": "rejected"}
    else:
        fail(400, "অজানা কাজ")


def _confirm_transport_agreement(tn_id, buyer_pct, seller_pct, buyer_amt, seller_amt):
    """Mark transport negotiation as agreed with final amounts."""
    db.update("transport_negotiations", tn_id,
              status="agreed",
              agreed_buyer_pct=buyer_pct, agreed_seller_pct=seller_pct,
              agreed_buyer_amt=buyer_amt, agreed_seller_amt=seller_amt,
              updated=now())


def _apply_agreed_transport_to_order(order_id, buyer_amt, seller_amt, buyer_pct, seller_pct):
    """
    Update order's transport amounts and create the booking.
    Also update buyer_total and payout.
    """
    o = db.one("SELECT * FROM orders WHERE id=?", (order_id,))
    if not o:
        return
    buyer_obj = user(o["buyer"])
    seller_obj = user(o["seller"])

    t_total = o["t_total"]
    t_buyer = round(buyer_amt)
    t_seller = round(seller_amt)

    # Restore old credits first, then recalculate
    old_t_cb = o["t_cb"]
    old_t_cs = o["t_cs"]
    db.run("UPDATE users SET transport_credit=transport_credit+? WHERE id=?", (old_t_cb, o["buyer"]))
    db.run("UPDATE users SET transport_credit=transport_credit+? WHERE id=?", (old_t_cs, o["seller"]))

    buyer_obj = user(o["buyer"])
    seller_obj = user(o["seller"])
    t_cb = round(min(buyer_obj["transport_credit"] or 0, t_buyer * CREDIT_MAX_SHARE))
    t_cs = round(min(seller_obj["transport_credit"] or 0, t_seller * CREDIT_MAX_SHARE))

    db.run("UPDATE users SET transport_credit=transport_credit-? WHERE id=?", (t_cb, o["buyer"]))
    db.run("UPDATE users SET transport_credit=transport_credit-? WHERE id=?", (t_cs, o["seller"]))

    goods = o["goods"]
    fee = o["fee"]
    fee_disc = o["fee_disc"]
    buyer_total = round(goods + t_buyer - t_cb)
    payout = round(goods - (fee - fee_disc) - (t_seller - t_cs))

    # Create the booking
    qd = transport_quote(seller_obj["place"], buyer_obj["place"], o["qty"],
                         is_plus(buyer_obj), is_bulk(buyer_obj["id"]))
    booking_id = nid("B")
    db.insert("bookings", {
        "id": booking_id, "uid": buyer_obj["id"], "order_id": order_id,
        "pickup_place": seller_obj["place"], "pickup_addr": seller_obj["area"] or "",
        "drop_place": buyer_obj["place"], "drop_addr": buyer_obj["area"] or "",
        "crop": o["crop"], "qty": o["qty"], "vehicle": qd["vehicle"], "trucks_n": qd["trucks"],
        "km": qd["km"], "eta": qd["eta"], "fare": qd["fare"], "service": qd["service"],
        "commission": qd["commission"], "total": t_total, "offline": qd["offline"],
        "credit_used": t_cb + t_cs, "status": "awaiting_payment", "truck": None,
        "pickup_time": None,
        "priority": 1 if (seller_obj["verified"] or is_plus(buyer_obj)) else 0,
        "paid": 0, "created": now(), "updated": now(), "date": "অর্ডারের সাথে"
    })

    db.run("""UPDATE orders SET t_buyer=?, t_seller=?, t_cb=?, t_cs=?,
              buyer_total=?, payout=?, booking=?, split=? WHERE id=?""",
           (t_buyer, t_seller, t_cb, t_cs, buyer_total, payout, booking_id,
            f"{buyer_pct}/{seller_pct}", order_id))

    notify(o["buyer"], f"✅ পরিবহন চুক্তি নিশ্চিত হয়েছে। এখন ৳{bn(buyer_total)} পেমেন্ট করুন।",
           "pay", f"#/order/{order_id}")
    books(order_id)


def get_transport_negotiation(order_id):
    """Get current transport negotiation state including all proposals."""
    tn = db.one("SELECT * FROM transport_negotiations WHERE order_id=?", (order_id,))
    if not tn:
        return None
    proposals = db.q("SELECT * FROM transport_proposals WHERE negotiation=? ORDER BY created DESC", (tn["id"],))
    return {**tn, "proposals": proposals}


def books(oid):
    """Keep Smart Hisab in step with an order: issue its invoice once terms are final, add receipts for
    (simulated) payments, payouts and refunds, an adjustment on cancellation, and the training-data record
    on completion. Runs in the caller's transaction, so it commits or rolls back with the order change."""
    from app import dataset, hisab
    o = db.one("SELECT * FROM orders WHERE id=?", (oid,))
    if o:
        hisab.sync_order(o)
        if o["status"] == "completed":
            dataset.record_trade(o)


def get_order(oid, u=None):
    o = db.one("SELECT * FROM orders WHERE id=?", (oid,))
    if not o or (u and u["role"] != "admin" and u["id"] not in (o["buyer"], o["seller"])):
        fail(404, "অর্ডার পাওয়া যায়নি")
    return o


# ---------------------------------------------------------------- STEP 5: Payments
DEMO_PIN = "12345"


def start_payment(u, purpose, ref, method):
    if method not in ("bkash", "nagad", "card", "wallet"):
        fail(400, "পেমেন্ট পদ্ধতি ঠিক নেই")
    if purpose == "order":
        o = get_order(ref, u)
        if o["buyer"] != u["id"] or o["status"] != "awaiting_payment":
            fail(400, "এই অর্ডারের পেমেন্ট এখন করা যাবে না")
        # For reroute transport, transport negotiation must be agreed
        if o["transport"] == "reroute":
            tn = db.one("SELECT * FROM transport_negotiations WHERE order_id=?", (ref,))
            if tn and tn["status"] != "agreed":
                fail(400, "পরিবহন খরচের চুক্তি নিশ্চিত হওয়ার আগে পেমেন্ট করা যাবে না")
        amount = o["buyer_total"]
    elif purpose == "booking":
        b = db.one("SELECT * FROM bookings WHERE id=?", (ref,))
        if not b or b["uid"] != u["id"] or b["order_id"] or b["status"] != "awaiting_payment":
            fail(400, "এই বুকিংয়ের পেমেন্ট এখন করা যাবে না")
        amount = b["total"] - b["credit_used"]
    elif purpose == "plus":
        if u["role"] != "paikar":
            fail(400, "প্লাস পাইকারদের জন্য")
        amount, ref = PLUS_PRICE, u["id"]
    else:
        fail(400, "অজানা পেমেন্ট")
    p = {"id": nid("Y"), "uid": u["id"], "purpose": purpose, "ref": ref, "amount": round(amount), "method": method,
         "status": "pending", "created": now(), "verified_at": None, "txn": None, "message": None}
    db.insert("payments", p)
    if method == "wallet":
        return confirm_payment(u, p["id"])
    return p


def confirm_payment(u, pid, account=None, pin=None):
    """SIMULATED gateway callback: no real money moves. Real gateways verify on their server; the demo checks
    PIN 12345. Runs inside the request's transaction, so the checks below and the money movement are atomic."""
    u = user(u["id"])                      # fresh balance, not the one read before the transaction started
    p = db.one("SELECT * FROM payments WHERE id=?", (pid,))
    if not p or p["uid"] != u["id"] or p["status"] != "pending":
        fail(400, "পেমেন্ট পাওয়া যায়নি")
    ok, msg = True, None
    # the thing being paid for must still be unpaid — checked before any money moves
    if p["purpose"] == "order":
        o = get_order(p["ref"])
        if o["status"] != "awaiting_payment" or o["buyer"] != u["id"]:
            ok, msg = False, "এই অর্ডারের পেমেন্ট আগেই হয়ে গেছে বা অর্ডারটি আর চালু নেই। টাকা কাটা হয়নি।"
    elif p["purpose"] == "booking":
        b = db.one("SELECT * FROM bookings WHERE id=?", (p["ref"],))
        if not b or b["paid"] or b["status"] != "awaiting_payment":
            ok, msg = False, "এই বুকিংয়ের পেমেন্ট আগেই হয়ে গেছে। টাকা কাটা হয়নি।"
    if ok and p["method"] == "wallet":
        if (u["wallet"] or 0) < p["amount"]:
            ok, msg = False, f"ওয়ালেটে যথেষ্ট টাকা নেই (আছে {tk(u['wallet'] or 0)})"
    elif ok and p["method"] in ("bkash", "nagad"):
        if not account or not (len(account) == 11 and account.startswith("01") and account.isdigit()):
            ok, msg = False, "সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন"
        elif pin != DEMO_PIN:
            ok, msg = False, "পিন ভুল। পেমেন্ট হয়নি, আপনার টাকা কাটা হয়নি।"
    elif ok and p["method"] == "card":
        if not account or len(account.replace(" ", "")) != 16 or pin != DEMO_PIN:
            ok, msg = False, "কার্ড যাচাই হয়নি। পেমেন্ট হয়নি।"
    if not ok:
        db.update("payments", pid, status="failed", message=msg, verified_at=now())
        return {**p, "status": "failed", "message": msg}
    txn = "TXN" + uuid.uuid4().hex[:10].upper()
    if p["method"] == "wallet":
        wallet(u["id"], -p["amount"], "payment", pid, {"order": "অর্ডারের পেমেন্ট", "booking": "পরিবহন বুকিং",
                                                     "plus": "প্লাস সাবস্ক্রিপশন"}[p["purpose"]])
    db.update("payments", pid, status="success", verified_at=now(), txn=txn, message="পেমেন্ট সফল")
    if p["purpose"] == "order":
        if not db.run("UPDATE orders SET status='confirmed', paid_at=?, payment=? WHERE id=? AND status='awaiting_payment'",
                      (now(), pid, o["id"])):
            fail(409, "অর্ডারের অবস্থা বদলে গেছে, আবার চেষ্টা করুন")
        seen(u["id"], f"#/order/{o['id']}")
        if o["booking"]:
            db.update("bookings", o["booking"], paid=1, status="requested", updated=now())
            booking_event(o["booking"], "requested", "অর্ডারের পেমেন্টের সাথে বুকিং হয়েছে")
        seller = user(o["seller"])
        notify(o["seller"], f"💰 {who(u)} {tk(o['buyer_total'])} পেমেন্ট করেছেন, টাকা Reroute-এ জমা আছে। "
                            f"{'Reroute ট্রাক আসবে, মাল তৈরি রাখুন।' if o['transport'] == 'reroute' else 'পাইকার নিজে মাল নিতে আসবেন।'}",
               "order", f"#/order/{o['id']}")
        notify(o["buyer"], f"✅ অর্ডার নিশ্চিত হয়েছে! পেমেন্ট সফল (TXN: {txn})।",
               "order", f"#/order/{o['id']}")
        books(o["id"])
    elif p["purpose"] == "booking":
        db.update("bookings", p["ref"], paid=1, status="requested", updated=now())
        booking_event(p["ref"], "requested", "পেমেন্টের পর বুকিং অনুরোধ")
    elif p["purpose"] == "plus":
        start = max(now(), u["plus_until"] or 0)
        db.run("UPDATE users SET plus_until=?, plus_cancelled=0 WHERE id=?", (start + PLUS_DAYS * DAY, u["id"]))
        notify(u["id"], f"⭐ Reroute প্লাস চালু হয়েছে, {bn(PLUS_DAYS)} দিনের জন্য।", "plus", "#/account")
    return {**p, "status": "success", "txn": txn, "message": "পেমেন্ট সফল"}


# ---------------------------------------------------------------- STEP 6: Order steps
def handover(u, oid):
    o = get_order(oid, u)
    if o["seller"] != u["id"] or o["status"] != "confirmed":
        fail(400, "এখন হস্তান্তর করা যাবে না")
    if o["transport"] == "reroute":
        b = db.one("SELECT * FROM bookings WHERE id=?", (o["booking"],))
        if b["status"] not in ("pickup_scheduled", "in_transit"):
            fail(400, "Reroute ট্রাক এখনো আসেনি। ট্রাক পৌঁছালে মাল তুলে দিন।")
        if b["status"] == "pickup_scheduled":
            set_booking_status(b["id"], "in_transit", "কৃষক মাল ট্রাকে তুলে দিয়েছেন")
    db.update("orders", oid, status="handed_over", handover_at=now())
    seen(u["id"], f"#/order/{oid}")
    notify(o["buyer"], f"🚚 {who(u)} মাল হস্তান্তর করেছেন ({mon(o['qty'])} মণ {crop_name(o['crop'])})। "
                       "মাল পেলে \"মাল বুঝে পেয়েছি\" চাপুন।", "order", f"#/order/{oid}")


def complete(u, oid):
    o = get_order(oid, u)
    if o["buyer"] != u["id"] or o["status"] != "handed_over":
        fail(400, "এখন অর্ডার সম্পূর্ণ করা যাবে না")
    if o["transport"] == "reroute":
        b = db.one("SELECT * FROM bookings WHERE id=?", (o["booking"],))
        if b["status"] != "delivered":
            set_booking_status(b["id"], "delivered", "ক্রেতা মাল বুঝে পেয়েছেন")
    seller = user(o["seller"])
    db.run("UPDATE listings SET reserved=MAX(0,reserved-?), sold=sold+?, updated=? WHERE id=?",
           (o["qty"], o["qty"], now(), o["listing"]))
    cost_basis = stock_take(seller["id"], o["crop"], o["qty"])
    landed_cost = (o["goods"] + o["t_buyer"] - o["t_cb"]) / o["qty"]
    stock_add(u["id"], o["crop"], o["qty"], landed_cost)
    cashback = 0
    if seller["role"] == "farmer" and o["goods"] >= CASHBACK_MIN and seller["verified"]:
        n = db.val("SELECT COUNT(*) FROM orders WHERE seller=? AND cashback>0 AND completed_at>?",
                   (seller["id"], now() - 7 * DAY)) or 0
        if n < CASHBACK_WEEK:
            cashback = CASHBACK
    wallet(seller["id"], o["payout"], "payout", oid, f"{mon(o['qty'])} মণ {crop_name(o['crop'])} বিক্রির টাকা")
    if cashback:
        wallet(seller["id"], cashback, "cashback", oid, "সফল বিক্রির ক্যাশব্যাক")
    db.update("orders", oid, status="completed", completed_at=now(), cashback=cashback, cost_basis=cost_basis)
    seen(u["id"], f"#/order/{oid}")
    award_points(o, seller, u)
    notify(seller["id"], f"🎉 বিক্রি সম্পূর্ণ! {tk(o['payout'] + cashback)} আপনার ওয়ালেটে জমা হয়েছে"
                         + (f" (৳{bn(cashback)} ক্যাশব্যাকসহ)" if cashback else "") + "।", "done", f"#/order/{oid}")
    notify(u["id"], f"🎉 কেনা সম্পূর্ণ। {mon(o['qty'])} মণ {crop_name(o['crop'])} আপনার মজুদে যোগ হয়েছে।", "done", f"#/order/{oid}")
    books(oid)


def award_points(o, seller, buyer):
    pair = db.val("SELECT COUNT(*) FROM points_tx WHERE uid=? AND kind='sale' AND note=? AND at>?",
                  (seller["id"], buyer["id"], now() - 7 * DAY)) or 0
    if o["goods"] >= 5000 and pair < 3:
        points(seller["id"], int(o["qty"] // MON), "sale", o["id"], buyer["id"])
        points(buyer["id"], int(o["qty"] // (2 * MON)), "purchase", o["id"], seller["id"])
        l = db.one("SELECT * FROM listings WHERE id=?", (o["listing"],))
        first = db.val("SELECT COUNT(*) FROM orders WHERE listing=? AND status='completed'", (o["listing"],)) == 1
        if first and l and json.loads(l["photos"] or "[]") and l["quality"]:
            points(seller["id"], 10, "listing_info", l["id"], "ছবি ও মানের তথ্যসহ লিস্টিং")
    if o["transport"] == "reroute":
        points(seller["id"], 10, "transport", o["id"], "Reroute ট্রাক ব্যবহার")
        points(buyer["id"], 10, "transport", o["id"], "Reroute ট্রাক ব্যবহার")


def cancel_order(u, oid, reason=None):
    o = get_order(oid, u)
    if o["status"] not in ("awaiting_payment", "confirmed"):
        fail(400, "মাল হস্তান্তরের পর অর্ডার বাতিল করা যায় না")
    other = o["buyer"] if u["id"] == o["seller"] else o["seller"]
    release_order(o, u["id"], reason)
    points(u["id"], -CANCEL_PENALTY, "penalty", oid, "রাজি হওয়ার পর অর্ডার বাতিল")
    notify(other, f"❌ {who(u)} {mon(o['qty'])} মণ {crop_name(o['crop'])}-এর অর্ডার বাতিল করেছেন।"
           + (f" কারণ: {reason}" if reason else "") + (" আপনার টাকা ওয়ালেটে ফেরত দেওয়া হয়েছে।" if o["paid_at"] and other == o["buyer"] else ""),
           "cancel", f"#/order/{oid}")


def release_order(o, by, reason):
    db.run("UPDATE listings SET available=available+?, reserved=MAX(0,reserved-?), updated=?, "
           "status=CASE WHEN status='sold_out' THEN 'active' ELSE status END WHERE id=?",
           (o["qty"], o["qty"], now(), o["listing"]))
    db.run("UPDATE users SET fee_credit=fee_credit+?, transport_credit=transport_credit+? WHERE id=?",
           (o["fee_disc"], o["t_cs"], o["seller"]))
    db.run("UPDATE users SET transport_credit=transport_credit+? WHERE id=?", (o["t_cb"], o["buyer"]))
    if o["paid_at"]:
        wallet(o["buyer"], o["buyer_total"], "refund", o["id"], "বাতিল অর্ডারের টাকা ফেরত")
    if o["booking"]:
        db.update("bookings", o["booking"], status="cancelled", updated=now())
        booking_event(o["booking"], "cancelled", "অর্ডার বাতিল হয়েছে")
    db.update("orders", o["id"], status="cancelled", cancelled_at=now(), cancelled_by=by, reason=reason)
    books(o["id"])


def rate(u, oid, stars, text=None):
    o = get_order(oid, u)
    if o["status"] != "completed":
        fail(400, "অর্ডার সম্পূর্ণ হলে রেটিং দেওয়া যায়")
    if db.one('SELECT id FROM ratings WHERE order_id=? AND "from"=?', (oid, u["id"])):
        fail(409, "আগেই রেটিং দিয়েছেন")
    to = o["seller"] if u["id"] == o["buyer"] else o["buyer"]
    db.insert("ratings", {"id": nid("R"), "order_id": oid, "from": u["id"], "to": to, "stars": stars,
                          "text": text, "at": now()})
    notify(to, f"⭐ {who(u)} আপনাকে {bn(stars)} তারা দিয়েছেন।", "info", f"#/u/{to}")


# ---------------------------------------------------------------- transport bookings & truck management
BOOKING_FLOW = ["requested", "confirmed", "pickup_scheduled", "in_transit", "delivered"]
BOOKING_BN = {"awaiting_payment": "পেমেন্ট বাকি", "requested": "বুকিং অনুরোধ", "confirmed": "বুকিং নিশ্চিত",
              "pickup_scheduled": "মাল তোলার সময় ঠিক", "in_transit": "পথে আছে", "delivered": "পৌঁছে গেছে",
              "cancelled": "বাতিল"}


def booking_event(bid, status, note=None):
    db.insert("booking_events", {"id": nid("K"), "booking": bid, "status": status, "note": note, "at": now()})


def quote_for(u, src, dst, qty):
    if src not in PLACES or dst not in PLACES or qty < 100:
        fail(400, "জায়গা আর অন্তত ১০০ কেজি দিন")
    return transport_quote(src, dst, qty, is_plus(u), is_bulk(u["id"]))


def create_booking(u, src, src_addr, dst, dst_addr, crop, qty, date):
    u = user(u["id"])
    qd = quote_for(u, src, dst, qty)
    credit = min(u["transport_credit"] or 0, qd["total"] * CREDIT_MAX_SHARE)
    b = {"id": nid("B"), "uid": u["id"], "order_id": None, "pickup_place": src, "pickup_addr": src_addr,
         "drop_place": dst, "drop_addr": dst_addr, "crop": crop, "qty": qty, "vehicle": qd["vehicle"],
         "trucks_n": qd["trucks"], "km": qd["km"], "eta": qd["eta"], "fare": qd["fare"], "service": qd["service"],
         "commission": qd["commission"], "total": qd["total"], "offline": qd["offline"], "credit_used": round(credit),
         "status": "awaiting_payment", "truck": None, "pickup_time": None,
         "priority": 1 if (u["verified"] or is_plus(u)) else 0, "paid": 0, "created": now(), "updated": now(),
         "date": date}
    db.insert("bookings", b)
    db.run("UPDATE users SET transport_credit=transport_credit-? WHERE id=?", (round(credit), u["id"]))
    booking_event(b["id"], "awaiting_payment", "বুকিং তৈরি, পেমেন্ট বাকি")
    return b


def cancel_booking(u, bid):
    b = db.one("SELECT * FROM bookings WHERE id=?", (bid,))
    if not b or b["uid"] != u["id"]:
        fail(404, "বুকিং পাওয়া যায়নি")
    if b["order_id"]:
        fail(400, "এই ট্রাক একটি অর্ডারের সাথে যুক্ত। অর্ডার বাতিল করলে ট্রাকও বাতিল হবে।")
    if b["status"] not in ("awaiting_payment", "requested", "confirmed", "pickup_scheduled"):
        fail(400, "ট্রাক রওনা দেওয়ার পর বাতিল করা যায় না")
    if b["paid"]:
        wallet(u["id"], b["total"] - b["credit_used"], "refund", bid, "বাতিল বুকিংয়ের টাকা ফেরত")
    db.run("UPDATE users SET transport_credit=transport_credit+? WHERE id=?", (b["credit_used"], u["id"]))
    db.update("bookings", bid, status="cancelled", updated=now())
    if b["truck"] and not db.val("SELECT COUNT(*) FROM bookings WHERE truck=? AND status IN ('confirmed','pickup_scheduled','in_transit')", (b["truck"],)):
        db.update("trucks", b["truck"], status="available")
    booking_event(bid, "cancelled", "গ্রাহক বাতিল করেছেন")


def set_booking_status(bid, status, note=None, truck=None, pickup_time=None, actual_fare=None):
    b = db.one("SELECT * FROM bookings WHERE id=?", (bid,))
    if not b:
        fail(404, "বুকিং পাওয়া যায়নি")
    if b["status"] in ("cancelled", "delivered", "awaiting_payment"):
        fail(400, "এই বুকিং এখন বদলানো যাবে না")
    if status not in BOOKING_FLOW or BOOKING_FLOW.index(status) <= BOOKING_FLOW.index(b["status"]):
        fail(400, "পরের ধাপেই যাওয়া যাবে")
    if status != "confirmed" and not b["truck"]:
        fail(400, "আগে ট্রাক ঠিক করে বুকিং নিশ্চিত করুন")
    fields = {"status": status, "updated": now()}
    if status == "confirmed":
        t = db.one("SELECT * FROM trucks WHERE id=?", (truck,)) if truck else None
        if not t or t["status"] not in ("available", "booked"):
            fail(400, "চালু ট্রাক বাছুন (একই রুটের বুকিং একই ট্রাকে যেতে পারে)")
        load = truck_load(truck)
        if b["trucks_n"] and b["trucks_n"] > 1 and load:
            fail(400, "এই বুকিংয়ে একাধিক ট্রাক লাগে, তাই অন্য বুকিং থাকা ট্রাকে দেওয়া যাবে না")
        cap = VEHICLES[t["vehicle"]]["cap"]
        if (b["trucks_n"] or 1) == 1 and load + b["qty"] > cap:
            fail(400, f"ট্রাকে জায়গা নেই: ধারণক্ষমতা {bn(cap)} কেজি, আগেই বুক {bn(load)} কেজি, "
                      f"এই বুকিং {bn(b['qty'])} কেজি")
        fields["truck"] = truck
        if t["status"] == "available":
            db.update("trucks", truck, status="booked")
    if status == "pickup_scheduled":
        fields["pickup_time"] = pickup_time or "আগামীকাল সকাল ৮টা"
    if status == "in_transit":
        db.update("trucks", b["truck"], status="on_trip")
    if status == "delivered":
        fare = actual_fare or b["fare"]
        fields["actual_fare"] = fare
        fields["payout"] = round(fare * (1 - COMMISSION))
        db.run("UPDATE trucks SET trips=trips+1 WHERE id=?", (b["truck"],))
    db.update("bookings", bid, **fields)
    booking_event(bid, status, note)
    if status == "delivered":
        busy = db.val("SELECT COUNT(*) FROM bookings WHERE truck=? AND status IN ('confirmed','pickup_scheduled','in_transit')",
                      (b["truck"],))
        db.update("trucks", b["truck"], status="booked" if busy else "available")
    t = db.one("SELECT * FROM trucks WHERE id=?", (fields.get("truck") or b["truck"],))
    msg = {"confirmed": f"🚚 ট্রাক ঠিক হয়েছে: {t['company']}, চালক {t['driver']} ({t['number']})।",
           "pickup_scheduled": f"🕗 মাল তোলার সময়: {fields.get('pickup_time')}।",
           "in_transit": "🛣️ মাল ট্রাকে উঠেছে, পথে আছে।", "delivered": "📍 মাল গন্তব্যে পৌঁছে গেছে।"}[status]
    people = {b["uid"]}
    if b["order_id"]:
        o = get_order(b["order_id"])
        people = {o["buyer"], o["seller"]}
        if status == "in_transit" and o["status"] == "confirmed":
            db.update("orders", o["id"], status="handed_over", handover_at=now())
    for p in people:
        notify(p, f"{msg} ({mon(b['qty'])} মণ {crop_name(b['crop'])}, {place_name(b['pickup_place'])} → "
                  f"{place_name(b['drop_place'])})", "transport", f"#/booking/{bid}")
    if status == "delivered" and not b["order_id"]:
        points(b["uid"], 10, "transport", bid, "Reroute ট্রাক ব্যবহার")


def truck_load(tid):
    """Kilograms already assigned to a truck by bookings that have not been delivered or cancelled."""
    return db.val("SELECT COALESCE(SUM(qty),0) FROM bookings WHERE truck=? "
                  "AND status IN ('confirmed','pickup_scheduled','in_transit')", (tid,)) or 0


def add_truck(company, driver, phone, number, vehicle, place, areas):
    t = {"id": nid("T"), "company": company, "driver": driver, "phone": phone, "number": number, "vehicle": vehicle,
         "place": place, "areas": areas, "status": "available", "trips": 0}
    db.insert("trucks", t)
    return t


# ---------------------------------------------------------------- points, Plus, entries
def redeem(u, rid):
    u = user(u["id"])
    if rid not in REDEEM:
        fail(404, "এই পুরস্কার নেই")
    name, cost, field, value = REDEEM[rid]
    if u["pts"] < cost:
        fail(400, f"আরও {bn(cost - u['pts'])} পয়েন্ট দরকার")
    points(u["id"], -cost, "redeem", rid, name)
    db.run(f"UPDATE users SET {field}={field}+? WHERE id=?", (value, u["id"]))
    return {"reward": name, "value": value}


def cancel_plus(u):
    if not is_plus(u):
        fail(400, "প্লাস চালু নেই")
    db.run("UPDATE users SET plus_cancelled=1 WHERE id=?", (u["id"],))


def resume_plus(u):
    if not is_plus(u):
        fail(400, "মেয়াদ শেষ, আবার কিনতে হবে")
    db.run("UPDATE users SET plus_cancelled=0 WHERE id=?", (u["id"],))


def add_entry(u, kind, crop, qty, amount, note):
    if kind not in ("expense", "sale", "stock") or amount < 0:
        fail(400, "তথ্য ঠিক নেই")
    cost_basis = None
    if kind in ("sale", "stock"):
        if crop not in CROPS or qty <= 0:
            fail(400, "ফসল আর পরিমাণ দিন")
    if kind == "sale":
        free = unlisted(u["id"], crop)
        if qty > free:
            fail(400, f"বাজারের বাইরে বিক্রির মতো মজুদ আছে {mon(free)} মণ")
        cost_basis = stock_take(u["id"], crop, qty)
    if kind == "stock":
        stock_add(u["id"], crop, qty, (amount / qty) if amount else None)
    e = {"id": nid("X"), "uid": u["id"], "kind": kind, "crop": crop, "qty": qty, "amount": amount,
         "cost_basis": cost_basis, "note": note, "at": now(), "source": "user_reported"}
    db.insert("entries", e)
    return e


# ---------------------------------------------------------------- profit & loss
def order_pnl(o, uid):
    if uid == o["seller"]:
        cost = o["cost_basis"] * o["qty"] if o["cost_basis"] is not None else None
        transport = o["t_seller"] - o["t_cs"]
        fee = o["fee"] - o["fee_disc"]
        net = o["goods"] - transport - fee + (o["cashback"] or 0)
        return {"side": "seller", "revenue": o["goods"], "cost": cost, "transport": transport, "fee": fee,
                "cashback": o["cashback"] or 0, "net_before_cost": net,
                "profit": None if cost is None else net - cost}
    landed = o["goods"] + o["t_buyer"] - o["t_cb"]
    return {"side": "buyer", "goods": o["goods"], "transport": o["t_buyer"] - o["t_cb"], "landed": landed,
            "per_kg": landed / o["qty"]}


def pnl(uid):
    """All-time profit & loss for the "মজুদ ও হিসাব" page and the dashboard. Computed by Smart Hisab
    (app/hisab.py) so both pages always show the same numbers and use the same costing rules."""
    from app import hisab
    return hisab.legacy_pnl(uid)


# ---------------------------------------------------------------- housekeeping
def housekeeping(uid=None):
    t = now()
    for o in db.q("SELECT * FROM offers WHERE status IN ('pending','countered') AND expires<?", (t,)):
        db.update("offers", o["id"], status="expired", updated=t)
        offer_event(o["id"], "system", "expire", o["price"])
        for p in (o["buyer"], o["seller"]):
            notify(p, f"⌛ {mon(o['qty'])} মণ {crop_name(o['crop'])}-এর অফারের মেয়াদ শেষ।", "cancel", f"#/offer/{o['id']}")
    for o in db.q("SELECT * FROM orders WHERE status='awaiting_payment' AND created<?", (t - PAY_HOURS * HOUR,)):
        release_order(o, "system", "সময়মতো পেমেন্ট হয়নি")
        for p in (o["buyer"], o["seller"]):
            notify(p, f"⌛ পেমেন্ট না হওয়ায় {mon(o['qty'])} মণ {crop_name(o['crop'])}-এর অর্ডার বাতিল।", "cancel", f"#/order/{o['id']}")
    if uid:
        for l in db.q("SELECT * FROM listings WHERE uid=? AND status='active' AND available>0 AND alert_spoil=0", (uid,)):
            if days_left(l) <= 1:
                db.update("listings", l["id"], alert_spoil=1)
                notify(uid, f"🥀 আপনার {crop_name(l['crop'])} {bn(max(0, days_left(l)))} দিনের মধ্যে নষ্ট হতে শুরু করবে। "
                            "দাম একটু কমিয়ে \"জরুরি বিক্রি\" দিন।", "spoil", f"#/listing/{l['id']}")
