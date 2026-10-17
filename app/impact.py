"""Impact dashboard: platform value in numbers, with every metric's definition.

Operational metrics are counted from database records. Estimates are labelled as such and say what they assume.
Rows created by the seeded demo accounts (ids not starting with "U") are reported separately as demo data, so
demo activity is never presented as real-world impact.
"""
from app import db, pooling, settings
from app.logic import DAY, MON

WEEKS = 8


def _is_demo_order(o):
    return not str(o["buyer"]).startswith("U") and not str(o["seller"]).startswith("U")


def summary(days=0, veg_metrics=None, now=None):
    now = now or db.now_ms()
    since = now - days * DAY if days else 0
    users = db.q("SELECT role, id FROM users WHERE role IN ('farmer','paikar')")
    orders = db.q("SELECT * FROM orders WHERE status='completed' AND completed_at>=?", (since,))
    bookings = db.q("SELECT * FROM bookings WHERE status='delivered' AND updated>=?", (since,))

    def split(rows, fn=lambda r: 1, demo=_is_demo_order):
        d = sum(fn(r) for r in rows if demo(r))
        t = sum(fn(r) for r in rows)
        return {"total": round(t), "demo": round(d), "registered": round(t - d)}

    user_demo = lambda u: not str(u["id"]).startswith("U")
    booking_demo = lambda b: not str(b["uid"]).startswith("U")
    mc = (veg_metrics or {}).get("market_choice") or {}
    extra_per_kg = mc.get("avg_extra_tk_per_kg")
    farmer_kg = db.val("SELECT COALESCE(SUM(o.qty),0) FROM orders o JOIN users u ON u.id=o.seller "
                       "WHERE o.status='completed' AND o.completed_at>=? AND u.role='farmer'", (since,)) or 0
    urgent_kg = db.val("SELECT COALESCE(SUM(o.qty),0) FROM orders o JOIN listings l ON l.id=o.listing "
                       "WHERE o.status='completed' AND o.completed_at>=? AND l.urgent>0", (since,)) or 0

    metrics = {
        "farmers": {**split([u for u in users if u["role"] == "farmer"], demo=user_demo), "kind": "count",
                    "def_en": 'Number of farmer accounts (database).',
                "def": "কৃষক অ্যাকাউন্টের সংখ্যা (ডাটাবেস)।"},
        "buyers": {**split([u for u in users if u["role"] == "paikar"], demo=user_demo), "kind": "count",
                   "def_en": 'Number of paikar (wholesale buyer) accounts (database).',
                "def": "পাইকার অ্যাকাউন্টের সংখ্যা (ডাটাবেস)।"},
        "orders_completed": {**split(orders), "kind": "count",
                             "def_en": 'Completed orders: the buyer confirmed receipt and the seller was paid (database).',
                "def": "সম্পন্ন অর্ডার: ক্রেতা মাল বুঝে পেয়েছেন এবং বিক্রেতা টাকা পেয়েছেন (ডাটাবেস)।"},
        "volume_tk": {**split(orders, lambda o: o["goods"]), "kind": "money",
                      "def_en": 'Goods value of completed orders (price × quantity), excluding transport and fees (database). Payments are simulated.',
                "def": "সম্পন্ন অর্ডারের মালের মোট দাম (দাম × পরিমাণ), পরিবহন ও ফি ছাড়া (ডাটাবেস)। পেমেন্ট সিমুলেটেড।"},
        "volume_mon": {**split(orders, lambda o: o["qty"] / MON), "kind": "mon",
                       "def_en": 'Total quantity sold in completed orders, in maunds (database).',
                "def": "সম্পন্ন অর্ডারে বিক্রি হওয়া মোট পরিমাণ, মণে (ডাটাবেস)।"},
        "transport_savings_tk": {**split(bookings, lambda b: max(0, (b["offline"] or 0) - (b["total"] or 0)), booking_demo),
                                 "kind": "money", "estimate": True,
                                 "def_en": 'Estimate: for each delivered Reroute truck booking, the open-market cost of hiring a whole truck (trip cost × 1.15 for broker and empty return) minus the fare paid on Reroute. Distances are estimated.',
                "def": "আনুমানিক: প্রতিটি সম্পন্ন Reroute ট্রাক বুকিংয়ের জন্য খোলা বাজারে পুরো ট্রাক ভাড়ার হিসাব "
                                        "(ট্রিপ খরচ × ১.১৫, দালাল ও খালি ফেরা ধরে) − Reroute-এ দেওয়া ভাড়া। দূরত্ব আনুমানিক।"},
        "net_proceeds_gain_tk": {"total": round(extra_per_kg * farmer_kg) if extra_per_kg is not None else None,
                                 "kind": "money", "estimate": True, "simulated": True,
                                 "def_en": (f"Estimate on SIMULATED data: in the AI market-choice back-test, farmers kept on average Tk "
                                            f"{extra_per_kg}/kg more than at the local market; multiplied by the kg farmers sold. "
                                            "Not a measured gain.") if extra_per_kg is not None else "Model back-test not available.",
                                 "def": (f"আনুমানিক ও সিমুলেটেড: AI বাজার-বাছাইয়ের ব্যাক-টেস্টে স্থানীয় হাটের চেয়ে গড়ে কেজিতে "
                                         f"৳{extra_per_kg} বেশি হাতে থেকেছে (সিমুলেটেড ডেটা) × কৃষকের বিক্রি করা কেজি। "
                                         "বাস্তবে মাপা লাভ নয়।") if extra_per_kg is not None else "মডেলের ব্যাক-টেস্ট পাওয়া যায়নি।"},
        "shared_transport": {**pooling.participation(), "kind": "pct",
                             "def_en": 'Share of delivered truck bookings that travelled with at least one other booking on the same truck, route and day (database).',
                "def": "সম্পন্ন ট্রাক বুকিংয়ের মধ্যে কতগুলো অন্য বুকিংয়ের সাথে একই ট্রাক, রুট ও দিনে গেছে (ডাটাবেস)।"},
        "loss_reduction_mon": {"total": round(urgent_kg / MON, 1), "kind": "mon", "estimate": True,
                               "def_en": "Potential: quantity sold in time from listings marked 'urgent sale' because of spoilage risk (database). Whether it would otherwise have spoiled is not measured.",
                "def": "সম্ভাব্য: পচনের ঝুঁকিতে 'জরুরি বিক্রি' দেওয়া লিস্টিং থেকে সময়মতো বিক্রি হওয়া পরিমাণ (ডাটাবেস)। "
                                      "এগুলো বিক্রি না হলে নষ্ট হতো কিনা তা মাপা হয়নি।"},
    }
    trend = []
    for w in range(WEEKS - 1, -1, -1):
        a, b = now - (w + 1) * 7 * DAY, now - w * 7 * DAY
        rows = [o for o in db.q("SELECT goods, buyer, seller FROM orders WHERE status='completed' AND completed_at>=? "
                                "AND completed_at<?", (a, b))]
        trend.append({"week_start": a, "orders": len(rows), "volume_tk": round(sum(o["goods"] for o in rows)),
                      "demo_orders": sum(1 for o in rows if _is_demo_order(o))})
    return {"days": days, "metrics": metrics, "trend": trend, "demo_mode": settings.DEMO_MODE,
            "note_en": "Demo-account activity is shown separately; count only registered accounts as real impact. "
                       "All payments are simulated; no real money moved.",
            "note": "ডেমো অ্যাকাউন্টের লেনদেন আলাদা দেখানো হয়েছে; আসল প্রভাব হিসেবে শুধু নিবন্ধিত অ্যাকাউন্টের সংখ্যা ধরুন। "
                    "সব পেমেন্ট সিমুলেটেড, কোনো আসল টাকা লেনদেন হয়নি।"}
