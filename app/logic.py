"""
Business rules and pricing for Reroute Agro.
Every number a user sees (platform fee, truck fare, discounts) is computed here,
so the frontend, the API and the demo data always agree.
"""
import math

MON = 40                    # 1 মণ = 40 kg
MIN_ORDER_KG = 200          # wholesale only: minimum order is 5 মণ
DAY = 86_400_000
HOUR = 3_600_000

# ---- platform fee: charged once per sale, to the seller, deducted from the payout
FEE_RATE, FEE_MIN, FEE_MAX = 0.01, 10, 500

# ---- Reroute truck pricing
VEHICLES = {  # capacity kg, base Tk, Tk per km (our operating cost per trip)
    "pickup": {"n": "পিকআপ (১.৫ টন)", "cap": 1500, "base": 600, "km": 22},
    "mini": {"n": "মিনি ট্রাক (৩.৫ টন)", "cap": 3500, "base": 900, "km": 32},
    "truck": {"n": "ট্রাক (৭ টন)", "cap": 7000, "base": 1300, "km": 45},
}
FULL_LOAD = 0.7        # above 70% of capacity a load gets its own truck
POOL_FACTOR = 1.2      # shared truck: you pay your weight share + 20% for pooling
MIN_SHARE = 0.3        # ... but at least 30% of the trip
RETURN_LOAD = 0.85     # full trucks: return loads make our trip ~15% cheaper than open market
OFFLINE_MARKUP = 1.15  # open market: whole truck + broker + empty return trip
SERVICE = 0.08         # Reroute service charge on the fare, paid by the user
COMMISSION = 0.07      # Reroute commission on the fare, paid by the truck owner
PLUS_SERVICE_OFF = 0.25  # Plus members: 25% off the service charge
BULK_SERVICE_OFF = 0.20  # 5+ purchases in 30 days: 20% off the service charge
SPEED = 35             # km/h average on the highway

# ---- subscription, rewards, cashback
PLUS_PRICE, PLUS_DAYS = 999, 30
REDEEM = {  # id: (name, points, kind, Tk value)
    "transport": ("পরিবহন খরচে ৳১০০ ছাড়", 200, "transport_credit", 100),
    "fee": ("পরের বিক্রির প্ল্যাটফর্ম ফি-তে ৳১৫০ ছাড়", 300, "fee_credit", 150),
}
CREDIT_MAX_SHARE = 0.5      # a transport credit can cover at most half of a transport bill
CASHBACK, CASHBACK_MIN, CASHBACK_WEEK = 50, 20000, 3
CANCEL_PENALTY = 10         # points taken when an accepted deal is cancelled
OFFER_HOURS, PAY_HOURS = 48, 24

CROPS = {
    "tomato": ("টমেটো", 6), "brinjal": ("বেগুন", 5), "chili": ("কাঁচা মরিচ", 4),
    "cucumber": ("শসা", 5), "carrot": ("গাজর", 10), "onion": ("পেঁয়াজ", 20), "potato": ("আলু", 30),
}
PLACES = {
    "rajshahi": ("রাজশাহী", 24.37, 88.60), "natore": ("নাটোর", 24.42, 89.00),
    "naogaon": ("নওগাঁ", 24.80, 88.94), "chapai": ("চাঁপাইনবাবগঞ্জ", 24.60, 88.27),
    "bogura": ("বগুড়া", 24.85, 89.37), "dhaka": ("ঢাকা", 23.81, 90.41),
}
BN = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")


def bn(n, d=0):
    """Bangla digits with South-Asian grouping: 1,23,456"""
    neg = n < 0
    n = abs(round(float(n), d))
    whole, _, frac = f"{n:.{d}f}".partition(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        whole = ",".join(parts + [tail])
    frac = frac.rstrip("0")
    return ("-" if neg else "") + (whole + ("." + frac if frac else "")).translate(BN)


def tk(n): return "৳" + bn(n)
def crop_name(c): return CROPS[c][0]
def place_name(p): return PLACES[p][0]
def mon(kg): return bn(kg / MON, 1)


def km(a, b):
    if a == b:
        return 15.0
    _, la1, lo1 = PLACES[a]
    _, la2, lo2 = PLACES[b]
    dl, dn = math.radians(la2 - la1), math.radians(lo2 - lo1)
    h = math.sin(dl / 2) ** 2 + math.cos(math.radians(la1)) * math.cos(math.radians(la2)) * math.sin(dn / 2) ** 2
    return round(2 * 6371 * math.asin(math.sqrt(h)) * 1.35)   # road ≈ straight line × 1.35


def platform_fee(goods):
    return round(min(FEE_MAX, max(FEE_MIN, goods * FEE_RATE)))


def transport_quote(src, dst, kg, plus=False, bulk=False):
    """Reroute truck price for kg from src to dst, compared with hiring a truck in the open market."""
    k = km(src, dst)
    if kg > VEHICLES["truck"]["cap"]:
        vid, n = "truck", math.ceil(kg / VEHICLES["truck"]["cap"])
    else:
        vid, n = next(v for v in VEHICLES if VEHICLES[v]["cap"] >= kg), 1
    v = VEHICLES[vid]
    trip = v["base"] + v["km"] * k
    shared = n == 1 and kg < FULL_LOAD * v["cap"]
    fare = trip * max(kg / v["cap"], MIN_SHARE) * POOL_FACTOR if shared else trip * RETURN_LOAD * n
    off = PLUS_SERVICE_OFF if plus else BULK_SERVICE_OFF if bulk else 0
    service = fare * SERVICE * (1 - off)
    offline = trip * OFFLINE_MARKUP * n
    total = fare + service
    return {"vehicle": vid, "vehicle_name": v["n"], "trucks": n, "km": k, "shared": shared,
            "fare": round(fare), "service": round(service), "service_off": off,
            "commission": round(fare * COMMISSION), "total": round(total), "offline": round(offline),
            "saving": round(offline - total), "eta": round(k / SPEED + (5 if shared else 2), 1)}


def spoil_rate(k, days_left, temp=27.0):
    """Expected share lost on the road: hours × temperature (Q10 rule), worse for older produce."""
    p = 0.0025 * (k / SPEED + 3) * 2 ** ((temp - 20) / 10)
    if days_left <= 2:
        p *= 1.5
    return min(p, 0.25)
