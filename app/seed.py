"""
Demo data. Everything after the user/truck rows is created through the same functions the app uses
(listing → offer → payment → truck → delivery), so stock, money, points and profit/loss always match.
All people and businesses are fictional.
"""
from app import db, services as S
from app.logic import DAY, HOUR

MIN = 60_000

USERS = [  # id, role, name, business, phone, district, area, verified, days on Reroute
    ("f1", "farmer", "রহিম উদ্দিন", None, "01711452318", "rajshahi", "পবা", 1, 60),
    ("f2", "farmer", "করিমা বেগম", None, "01819227640", "natore", "বাগাতিপাড়া", 1, 210),
    ("f3", "farmer", "আব্দুল জলিল", None, "01912660435", "chapai", "শিবগঞ্জ", 0, 90),
    ("f4", "farmer", "সুমন মিয়া", None, "01733109872", "naogaon", "মান্দা", 0, 45),
    ("f5", "farmer", "হালিমা খাতুন", None, "01624883120", "rajshahi", "গোদাগাড়ী", 1, 400),
    ("f6", "farmer", "মোস্তফা কামাল", None, "01552340981", "natore", "সিংড়া", 0, 120),
    ("f7", "farmer", "বাবুল হোসেন", None, "01798551203", "rajshahi", "পুঠিয়া", 1, 180),
    ("f8", "farmer", "জাহিদ হাসান", None, "01715903442", "bogura", "শিবগঞ্জ", 0, 30),
    ("f9", "farmer", "নাসরিন আক্তার", None, "01881204576", "natore", "লালপুর", 1, 250),
    ("p1", "paikar", "করিম আহমেদ", "করিম ট্রেডার্স", "01700112233", "dhaka", "কারওয়ান বাজার", 1, 300),
    ("p2", "paikar", "শফিকুল ইসলাম", "ঢাকা ফ্রেশ হাব", "01755667788", "dhaka", "কারওয়ান বাজার", 1, 420),
    ("p3", "paikar", "মিজানুর রহমান", "সততা আড়ত", "01822334455", "natore", "নাটোর সদর", 1, 160),
    ("p4", "paikar", "আনোয়ার হোসেন", "বগুড়া সবজি ঘর", "01911223344", "bogura", "মহাস্থান হাট", 1, 140),
    ("p5", "paikar", "বিল্লাল হোসেন", "মা আড়ত", "01677889900", "dhaka", "শ্যামবাজার", 0, 90),
    ("p6", "paikar", "রাশেদ খান", "যাত্রাবাড়ী পাইকারি", "01566778899", "dhaka", "যাত্রাবাড়ী", 0, 60),
    ("a1", "admin", "Reroute অপারেশন টিম", "Reroute Agro", "01300000000", "rajshahi", "অফিস", 1, 400),
]
TRUCKS = [  # company, driver, phone, number, vehicle, home district, service area
    ("Reroute ট্রাক ১", "কামাল হোসেন", "01711000111", "রাজশাহী-ট ১১-৪৫২৩", "mini", "rajshahi", "রাজশাহী, নাটোর, ঢাকা"),
    ("Reroute ট্রাক ২", "সেলিম রেজা", "01811000222", "নাটোর-ট ১১-২২১৪", "mini", "natore", "নাটোর, বগুড়া, ঢাকা"),
    ("Reroute ট্রাক ৩", "আজিজুল হক", "01911000333", "বগুড়া-ট ১২-৭৭৮১", "truck", "bogura", "বগুড়া, নওগাঁ, ঢাকা"),
    ("Reroute পিকআপ ৪", "রফিকুল ইসলাম", "01611000444", "নওগাঁ-ন ১১-৩৩০৯", "pickup", "naogaon", "নওগাঁ, রাজশাহী"),
    ("Reroute পিকআপ ৫", "হাসান আলী", "01511000555", "চাঁপাই-ন ১১-১০৫৬", "pickup", "chapai", "চাঁপাইনবাবগঞ্জ, রাজশাহী"),
    ("Reroute ট্রাক ৬", "মনির হোসেন", "01711000666", "ঢাকা মেট্রো-ট ২০-৯৯১২", "truck", "dhaka", "ঢাকা, উত্তরবঙ্গ রুট"),
    ("Reroute ট্রাক ৭", "জসিম উদ্দিন", "01811000777", "রাজশাহী-ট ১১-৮৮৪১", "truck", "rajshahi", "রাজশাহী বিভাগ, ঢাকা"),
]
TOMATO_Q = "লাল-পাকা, দৃঢ়, মাঝারি সাইজ। প্লাস্টিক ক্রেটে রাখা।"


def U(uid):
    return S.user(uid)


def at(days=0, hours=0, minutes=0):
    S._clock[0] = BASE - int(days * DAY) - int(hours * HOUR) - int(minutes * MIN)


def deal(listing, buyer, qty, price, transport="reroute", split="half", counter=None, method="bkash", finish=True,
         truck=None, rate=(5, 5), texts=("", "")):
    """A full trade: offer → (counter) → accept → pay → transport → handover → complete → ratings."""
    l = db.one("SELECT * FROM listings WHERE id=?", (listing,))
    o = S.make_offer(U(buyer), listing, qty, price, transport, split)
    if counter:
        S.respond_offer(U(l["uid"]), o["id"], "counter", counter)
        r = S.respond_offer(U(buyer), o["id"], "accept")
    else:
        r = S.respond_offer(U(l["uid"]), o["id"], "accept")
    order = r["order"]
    p = S.start_payment(U(buyer), "order", order["id"], method)
    if p["status"] == "failed":                       # e.g. not enough in the wallet: pay by bKash instead
        p = S.start_payment(U(buyer), "order", order["id"], "bkash")
    if p["status"] == "pending":
        S.confirm_payment(U(buyer), p["id"], "01700000000" if method != "card" else "4242424242424242", S.DEMO_PIN)
    if not finish:
        return order
    if transport == "reroute":
        b = order["booking"]
        S.set_booking_status(b, "confirmed", truck=truck)
        S.set_booking_status(b, "pickup_scheduled", pickup_time="সকাল ৭টা")
        S.handover(U(l["uid"]), order["id"])
        S.set_booking_status(b, "delivered", "গন্তব্যে পৌঁছেছে")
    else:
        S.handover(U(l["uid"]), order["id"])
    S.complete(U(buyer), order["id"])
    if rate:
        S.rate(U(buyer), order["id"], rate[0], texts[0] or None)
        S.rate(U(l["uid"]), order["id"], rate[1], texts[1] or None)
    return order


def seed():
    """(Re)build the demo. Accounts people registered themselves are kept (balances start fresh)."""
    global BASE
    try:
        kept = db.q("SELECT * FROM users WHERE id LIKE ?", ("U%",))
    except Exception:
        kept = []
    db.reset()
    BASE = db.now_ms()
    for k in kept:
        k.update(pts=0, wallet=0, fee_credit=0, transport_credit=0, plus_until=0, plus_cancelled=0)
        db.insert("users", k)
    for uid, role, name, biz, phone, place, area, verified, days in USERS:
        db.insert("users", {"id": uid, "role": role, "name": name, "biz": biz, "phone": phone, "place": place,
                            "area": area, "verified": verified, "joined": BASE - days * DAY})
    trucks = [S.add_truck(*t)["id"] for t in TRUCKS]
    T = dict(zip(["raj1", "nat2", "bog3", "nao4", "cha5", "dha6", "raj7"], trucks))

    # opening balances from activity before this demo period (clearly labelled)
    at(days=45)
    for uid, pts in {"f1": 150, "f2": 600, "f5": 1400, "f7": 420, "f9": 650, "p1": 300, "p2": 500}.items():
        S.points(uid, pts, "opening", None, "আগের লেনদেনের পয়েন্ট (ডেমো)")
    for uid, money in {"p1": 50000, "p2": 80000, "p3": 30000, "p4": 30000, "p5": 20000, "p6": 40000}.items():
        S.wallet(uid, money, "topup", None, "ওয়ালেটে টাকা যোগ (ডেমো)")

    # ---- history: completed trades
    at(days=40)
    l1 = S.create_listing(U("f1"), "tomato", 4000, 24, 400, "A", TOMATO_Q, 1, [], 12)
    at(days=39, hours=20)
    deal(l1["id"], "p3", 1600, 23, counter=23.5, truck=T["raj1"], texts=("মাল তাজা ছিল, ওজন ঠিক", "সাথে সাথে টাকা পেয়েছি"))
    at(days=37)
    deal(l1["id"], "p4", 1000, 24, transport="self", method="wallet", texts=("সময়মতো দিয়েছেন", "ভালো ব্যবহার"))
    at(days=36)
    S.update_listing(U("f1"), l1["id"], status="closed")
    S.add_entry(U("f1"), "sale", "tomato", 1400, 25200, "বাকি মাল স্থানীয় হাটে বিক্রি")
    at(days=30)
    S.add_entry(U("f1"), "expense", None, 0, 6000, "সার ও কীটনাশক")
    S.add_entry(U("f1"), "expense", None, 0, 4000, "শ্রমিকের মজুরি")

    at(days=22)
    l9 = S.create_listing(U("f9"), "onion", 3000, 36, 400, "A", "শুকনো, বড় দানা, বস্তায় রাখা", 2, [], 22)
    at(days=21, hours=18)
    deal(l9["id"], "p1", 1200, 36, truck=T["nat2"], texts=("পেঁয়াজ শুকনো আর ভালো", "টাকা ঠিক সময়ে পেয়েছি"))
    at(days=12)
    S.update_listing(U("f9"), l9["id"], status="closed")

    at(days=10)
    p = S.start_payment(U("p2"), "plus", None, "wallet")          # p2 is a Plus member

    at(days=7)
    b = S.create_booking(U("f5"), "rajshahi", "গোদাগাড়ী বাজার", "bogura", "মহাস্থান হাট", "chili", 600, "পরশু")
    S.start_payment(U("f5"), "booking", b["id"], "bkash")
    pid = db.val("SELECT id FROM payments WHERE ref=? AND status='pending'", (b["id"],))
    S.confirm_payment(U("f5"), pid, "01624883120", S.DEMO_PIN)
    for st in ("confirmed", "pickup_scheduled", "delivered"):
        at(days=6, hours={"confirmed": 20, "pickup_scheduled": 16, "delivered": 6}[st])
        S.set_booking_status(b["id"], st, truck=T["raj7"] if st == "confirmed" else None,
                             pickup_time="সকাল ৬টা" if st == "pickup_scheduled" else None)

    at(days=5)
    l2 = S.create_listing(U("f2"), "tomato", 2800, 27, 400, "A", TOMATO_Q, 1, [], 13)
    at(days=4, hours=20)
    deal(l2["id"], "p1", 2400, 26, method="nagad", truck=T["nat2"], texts=("খুব ভালো মানের টমেটো", "কথা রাখেন"))
    at(days=3)
    S.update_listing(U("f2"), l2["id"], status="closed")
    S.add_entry(U("f2"), "sale", "tomato", 400, 8800, "বাকি মাল স্থানীয় হাটে বিক্রি")
    S.add_entry(U("p1"), "sale", "tomato", 1000, 33000, "কারওয়ান বাজারে অন্য পাইকারের কাছে বিক্রি")
    S.add_entry(U("p1"), "expense", None, 0, 1500, "আড়তের শ্রমিক")
    at(days=2)
    lp1 = S.create_listing(U("p1"), "tomato", 800, 31, 200, "A", "নাটোরের টমেটো, ঢাকার গুদামে, বাছাই করা", 2)
    at(days=1, hours=10)
    deal(lp1["id"], "f4", 400, 31, transport="self", method="bkash", texts=("ঠিক মাল দিয়েছেন", "ভালো ক্রেতা"))

    # cancelled after acceptance (with reason)
    at(days=2, hours=5)
    lb = S.create_listing(U("f4"), "brinjal", 2000, 19, 400, "B", "তাজা বেগুন, কিছু ছোট সাইজ", 0, [], 9)
    o = S.make_offer(U("p3"), lb["id"], 800, 18)
    S.respond_offer(U("f4"), o["id"], "accept")
    at(days=2, hours=3)
    S.cancel_order(U("p3"), db.val("SELECT order_id FROM offers WHERE id=?", (o["id"],)), "আর লাগবে না")

    # ---- current activity
    at(days=1)
    lf1 = S.create_listing(U("f1"), "tomato", 5000, 26, 400, "A", TOMATO_Q + " গ্রেড A, ৫% এর কম নরম।", 0, [], 12)
    S.create_listing(U("f3"), "tomato", 1600, 24, 400, "B", "পাকা টমেটো, দ্রুত বিক্রি দরকার", 3, [], 11)
    lf5 = S.create_listing(U("f5"), "chili", 600, 40, 200, "A", "ঝাল বেশি, সবুজ, তাজা", 3, [], 25)
    lf6 = S.create_listing(U("f6"), "cucumber", 1600, 17, 400, "A", "সতেজ শসা, এক সাইজ", 1, [], 8)
    lf7 = S.create_listing(U("f7"), "tomato", 3000, 25, 400, "A", TOMATO_Q, 4, [], 12)
    lf8 = S.create_listing(U("f8"), "potato", 8000, 14, 1000, "A", "হিমাগার থেকে, বাছাই করা, ৫০ কেজির বস্তা", 2, [], 9)
    S.create_listing(U("f4"), "carrot", 1600, 22, 400, "A", "লাল, মিষ্টি গাজর, ধোয়া", 1, [], 10)
    lf9 = S.create_listing(U("f9"), "onion", 1800, 37, 400, "A", "শুকনো, বড় দানা", 1)
    l2b = S.create_listing(U("f2"), "tomato", 2400, 27, 400, "A", TOMATO_Q, 0, [], 13)
    S.make_urgent(U("f5"), lf5["id"])
    S.make_urgent(U("f7"), lf7["id"])

    at(hours=20)
    deal(lf6["id"], "p4", 800, 17, finish=False, method="bkash")            # paid, truck on the way
    o_tr = db.one("SELECT * FROM orders WHERE listing=? ORDER BY created DESC", (lf6["id"],))
    S.set_booking_status(o_tr["booking"], "confirmed", truck=T["nat2"])
    S.set_booking_status(o_tr["booking"], "pickup_scheduled", pickup_time="আজ ভোর ৫টা")
    at(hours=10)
    S.set_booking_status(o_tr["booking"], "in_transit", "মাল ট্রাকে উঠেছে")

    at(hours=8)
    deal(lf7["id"], "p2", 1200, 22.5, finish=False, method="card")            # paid, waiting for a truck
    at(hours=6)
    o8 = S.make_offer(U("p6"), lf8["id"], 4000, 14)                          # accepted, payment pending
    S.respond_offer(U("f8"), o8["id"], "accept")
    at(hours=5)
    b2 = S.create_booking(U("f6"), "natore", "সিংড়া বাজার", "bogura", "মহাস্থান হাট", "cucumber", 400, "আগামীকাল")
    S.start_payment(U("f6"), "booking", b2["id"], "wallet") if U("f6")["wallet"] >= b2["total"] else None
    pid = db.val("SELECT id FROM payments WHERE ref=? AND status='pending'", (b2["id"],))
    if not pid:
        pid = S.start_payment(U("f6"), "booking", b2["id"], "nagad")["id"]
    S.confirm_payment(U("f6"), pid, "01552340981", S.DEMO_PIN)

    at(hours=3)
    o_cnt = S.make_offer(U("p1"), l2b["id"], 1200, 25, note="নিয়মিত নেব, দাম একটু কম হলে ভালো")
    S.respond_offer(U("f2"), o_cnt["id"], "counter", 26.5)                   # counter: p1 must answer
    at(hours=2)
    S.make_offer(U("p5"), lf5["id"], 400, 34)                                # lower offer on urgent chili
    S.request_inspection(U("p1"), lf1["id"], "video", "আজ বিকেল ৪টা", "ক্রেটে রাখা অবস্থায় দেখতে চাই")
    at(minutes=40)
    S.make_offer(U("p2"), lf1["id"], 2000, 24, note="গ্রেড A হলে পুরো ৫০ মণ নেব")  # f1 must answer
    at(minutes=10)
    S.make_offer(U("p3"), lf9["id"], 600, 37, transport="self")
    S._clock[0] = None
    db.set_meta("seeded_at", BASE)
