"""Smart truck pooling: put compatible shipments on one truck and share the trip cost transparently.

Compatible = same pickup district, same destination district, same pickup day, same handling class, and the
combined load fits one truck (7 t). Bookings that already need several trucks are never pooled.

Costs (operator's trip cost from app/logic.py VEHICLES, no service charge):
    trip cost(vehicle, km)   = base + per-km × km
    standalone cost          = trip cost of the smallest vehicle that carries this booking alone
    shared cost (allocated)  = trip cost of the smallest vehicle that carries the whole group × this booking's
                               share of the group's weight
    savings                  = standalone cost − shared cost
Distances are ESTIMATES: straight-line distance between district centres × 1.35 (app/logic.km). No maps or
routing API is used. Handling classes are a prototype rule, not a cold-chain standard.
"""
from datetime import datetime, timedelta, timezone

from app import db
from app.logic import PLACES, VEHICLES, km

BD_TZ = timezone(timedelta(hours=6))
HANDLING = {"tomato": "delicate", "chili": "delicate", "cucumber": "delicate", "brinjal": "delicate",
            "carrot": "robust", "onion": "robust", "potato": "robust"}
HANDLING_BN = {"delicate": "নরম ফসল (ক্রেটে, উপরে চাপ ছাড়া)", "robust": "শক্ত ফসল (বস্তায়)"}
DAY_OFFSET = {"আজ": 0, "আগামীকাল": 1, "পরশু": 2}
OPEN = ("requested",)                              # paid, waiting for a truck
ON_TRUCK = ("confirmed", "pickup_scheduled")       # truck assigned, not yet loaded
MAX_KG = VEHICLES["truck"]["cap"]
METHOD_BN = ("ভাগাভাগি: পুরো ট্রিপের খরচ ওজনের অনুপাতে ভাগ। দূরত্ব আনুমানিক (জেলা কেন্দ্রের সরলরেখা দূরত্ব × ১.৩৫), "
             "ম্যাপ বা রুটিং সেবা ব্যবহার হয়নি।")


def pickup_day(b):
    created = datetime.fromtimestamp(b["created"] / 1000, BD_TZ).date()
    return (created + timedelta(days=DAY_OFFSET.get(b["date"], 1))).isoformat()


def vehicle_for(kg):
    return next(v for v in VEHICLES if VEHICLES[v]["cap"] >= kg)


def trip_cost(vehicle, distance):
    v = VEHICLES[vehicle]
    return round(v["base"] + v["km"] * distance)


def standalone(b):
    return trip_cost(vehicle_for(b["qty"]), km(b["pickup_place"], b["drop_place"]))


def key(b):
    return (b["pickup_place"], b["drop_place"], pickup_day(b), HANDLING[b["crop"]])


def compatible(a, b):
    return key(a) == key(b) and a["qty"] + b["qty"] <= MAX_KG


def pack(bookings):
    """First-fit decreasing into trucks of MAX_KG: list of groups (each a list of bookings)."""
    groups = []
    for b in sorted(bookings, key=lambda x: -x["qty"]):
        g = next((g for g in groups if sum(x["qty"] for x in g) + b["qty"] <= MAX_KG), None)
        (g.append(b) if g is not None else groups.append([b]))
    return groups


def allocate(group):
    """Shared cost per booking by weight, with each booking's standalone cost and savings."""
    total = sum(b["qty"] for b in group)
    distance = km(group[0]["pickup_place"], group[0]["drop_place"])
    vehicle = vehicle_for(total)
    trip = trip_cost(vehicle, distance)
    rows, used = [], 0
    for i, b in enumerate(group):
        share = trip - used if i == len(group) - 1 else round(trip * b["qty"] / total)   # shares add up exactly
        used += share
        alone = standalone(b)
        rows.append({"booking": b["id"], "qty": b["qty"], "crop": b["crop"], "share_pct": round(b["qty"] / total * 100, 1),
                     "standalone_cost": alone, "shared_cost": share, "savings": alone - share})
    return {"vehicle": vehicle, "vehicle_name": VEHICLES[vehicle]["n"], "capacity": VEHICLES[vehicle]["cap"],
            "km": distance, "km_estimated": True, "trip_cost": trip, "total_kg": total, "members": rows,
            "standalone_total": sum(r["standalone_cost"] for r in rows), "shared_total": trip,
            "savings_total": sum(r["savings"] for r in rows), "method": METHOD_BN}


def truck_rows():
    rows = []
    for t in db.q("SELECT * FROM trucks ORDER BY place, id"):
        load = db.val("SELECT COALESCE(SUM(qty),0) FROM bookings WHERE truck=? AND status IN "
                      "('confirmed','pickup_scheduled','in_transit')", (t["id"],)) or 0
        cap = VEHICLES[t["vehicle"]]["cap"]
        rows.append({"id": t["id"], "company": t["company"], "number": t["number"], "vehicle": t["vehicle"],
                     "vehicle_name": VEHICLES[t["vehicle"]]["n"], "place": t["place"], "status": t["status"],
                     "capacity": cap, "reserved": load, "free": max(0, cap - load)})
    return rows


def suggest_truck(group, trucks, open_on_truck):
    """A truck for the group: first one already going the same way on the same day with room (joins its trip),
    else an available truck at the pickup district that fits, else any available truck that fits."""
    need, k = sum(b["qty"] for b in group), key(group[0])
    for t in trucks:
        same = [b for b in open_on_truck if b["truck"] == t["id"]]
        if same and all(key(b) == k for b in same) and t["free"] >= need and t["status"] != "maintenance":
            return {**t, "joins_trip": True}
    for t in sorted(trucks, key=lambda t: (t["place"] != group[0]["pickup_place"], t["capacity"])):
        if t["status"] == "available" and t["free"] >= need:
            return {**t, "joins_trip": False}
    return None


def suggestions():
    """Admin pooling dashboard data."""
    waiting = [b for b in db.q("SELECT * FROM bookings WHERE status='requested' AND paid=1 ORDER BY created")
               if (b["trucks_n"] or 1) == 1 and b["qty"] <= MAX_KG and b["crop"] in HANDLING]
    on_truck = db.q("SELECT * FROM bookings WHERE status IN ('confirmed','pickup_scheduled') AND truck IS NOT NULL")
    trucks = truck_rows()
    by_key = {}
    for b in waiting:
        by_key.setdefault(key(b), []).append(b)
    groups = []
    for k, items in by_key.items():
        for g in pack(items):
            joinable = suggest_truck(g, trucks, on_truck)
            if len(g) < 2 and not (joinable and joinable["joins_trip"]):
                continue                    # nothing to share with
            a = allocate(g)
            groups.append({"route": f"{PLACES[k[0]][0]} → {PLACES[k[1]][0]}", "pickup_place": k[0], "drop_place": k[1],
                           "day": k[2], "handling": k[3], "handling_bn": HANDLING_BN[k[3]], "bookings": [b["id"] for b in g],
                           "truck": joinable, **a})
    groups.sort(key=lambda g: -g["savings_total"])
    return {"groups": groups, "trucks": trucks, "waiting": len(waiting),
            "participation": participation(), "method": METHOD_BN}


def for_user(uid):
    """For a farmer/paikar: how many other open bookings could share each of their waiting bookings, and the
    estimated saving. No other user's details are revealed."""
    mine = db.q("SELECT * FROM bookings WHERE uid=? AND status='requested' AND paid=1", (uid,))
    others = [b for b in db.q("SELECT * FROM bookings WHERE status='requested' AND paid=1 AND uid<>?", (uid,))
              if (b["trucks_n"] or 1) == 1 and b["crop"] in HANDLING]
    out = []
    for b in mine:
        if (b["trucks_n"] or 1) != 1 or b["crop"] not in HANDLING:
            continue
        mates = [o for o in others if compatible(b, o)]
        g = next((g for g in pack([b] + mates) if b in g), [b])
        a = allocate(g) if len(g) > 1 else None
        me = next((r for r in a["members"] if r["booking"] == b["id"]), None) if a else None
        out.append({"booking": b["id"], "compatible": len(g) - 1, "day": pickup_day(b),
                    "standalone_cost": standalone(b), "shared_cost": me["shared_cost"] if me else None,
                    "savings": me["savings"] if me else 0, "method": METHOD_BN})
    return out


def participation():
    """Share of delivered single-truck bookings that travelled with at least one other booking."""
    done = db.q("SELECT id, truck, qty, created, pickup_place, drop_place, date, crop FROM bookings "
                "WHERE status='delivered' AND truck IS NOT NULL")
    if not done:
        return {"delivered": 0, "shared": 0, "pct": None}
    trips = {}
    for b in done:
        trips.setdefault((b["truck"], b["pickup_place"], b["drop_place"], pickup_day(b)), []).append(b)
    shared = sum(len(v) for v in trips.values() if len(v) > 1)
    return {"delivered": len(done), "shared": shared, "pct": round(shared / len(done) * 100, 1)}

