"""Bangla assistant: deterministic intent rules over the signed-in user's own records and the existing AI services.

Speech → text happens in the browser; this module only receives text. Supported questions (examples):
  আমার এই মাসে কত টাকার বিক্রি হয়েছে?      → sales in a period (Smart Hisab P&L)
  আমার কত টাকা পাওনা আছে? / দেনা কত?        → receivables / payables (dues)
  এই মাসে আমার লাভ কত?                        → profit, or "missing cost information"
  আমার শেষ তিনটা বিল দেখাও।                    → latest invoices
  আমার কয়টা অর্ডার পেন্ডিং?                   → open orders and offers waiting for a reply
  আমার ২০ মণ টমেটো কোন বাজারে বিক্রি করলে ভালো হবে? → Smart Selling Advisor (simulated market data)
  আজ আলুর বাজারদর কত?                        → today's simulated market price
It never changes anything: no orders, payments or records are created from a question.
"""
import re

from app import advisor as ADVISOR, db, hisab
from app.logic import CROPS, PLACES, bn

_BN = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
COUNT_WORDS = {"এক": 1, "একটা": 1, "দুই": 2, "দুটা": 2, "দুইটা": 2, "তিন": 3, "তিনটা": 3, "চার": 4, "চারটা": 4,
               "পাঁচ": 5, "পাঁচটা": 5, "ছয়": 6, "সাত": 7, "আট": 8, "নয়": 9, "দশ": 10}
PERIOD_BN = {"today": "আজ", "week": "এই সপ্তাহে", "month": "এই মাসে", "last_month": "গত মাসে", "year": "এই বছরে",
             "all": "এ পর্যন্ত"}
EXAMPLES = ["আমার এই মাসে কত টাকার বিক্রি হয়েছে?", "আমার কত টাকা পাওনা আছে?", "এই মাসে আমার লাভ কত?",
            "আমার শেষ তিনটা বিল দেখাও", "আমার কয়টা অর্ডার পেন্ডিং?", "আমার ২০ মণ টমেটো কোন বাজারে বিক্রি করলে ভালো হবে?",
            "আজ আলুর বাজারদর কত?"]


def tk(x, d=0):
    return ("−" if x < 0 else "") + "৳" + bn(abs(x), d)


def has(t, *words):
    return any(w in t for w in words)


def period_of(t, default="month"):
    if has(t, "আজ", "today"):
        return "today"
    if has(t, "গত মাস", "last month"):
        return "last_month"
    if has(t, "সপ্তাহ", "week"):
        return "week"
    if has(t, "বছর", "year"):
        return "year"
    if has(t, "মাস", "month"):
        return "month"
    if has(t, "মোট", "সব মিলিয়ে", "এ পর্যন্ত", "এখন পর্যন্ত", "total"):
        return "all"
    return default


def bounds(period):
    if period == "last_month":
        from datetime import date, timedelta
        first = date.fromisoformat(hisab.today()).replace(day=1)
        last_prev = first - timedelta(days=1)
        return last_prev.replace(day=1).isoformat(), last_prev.isoformat()
    return hisab.period_bounds(period)


def count_of(t, default=3):
    m = re.search(r"(\d+)\s*(টা|টি|টো)?\s*(বিল|ইনভয়েস|রসিদ|invoice|bill)", t)
    if m:
        return max(1, min(10, int(m.group(1))))
    for w, n in sorted(COUNT_WORDS.items(), key=lambda kv: -len(kv[0])):
        if re.search(rf"{w}\s*(টা|টি)?\s*(বিল|ইনভয়েস|রসিদ)", t):
            return n
    return default


def detect(text):
    t = (text or "").translate(_BN).lower().strip()
    q = ADVISOR.parse_query(text)
    if q["crop"] and has(t, "বাজারে", "কোথায়", "কোন বাজার", "market") and has(t, "বিক্রি", "বেচ", "sell", "ভালো হবে", "লাভ"):
        return "best_market", q
    if q["crop"] and has(t, "দর", "দাম", "price", "rate"):
        return "market_price", q
    if has(t, "বিল", "ইনভয়েস", "invoice", "bill", "রসিদ"):
        return "bills", q
    if has(t, "অর্ডার", "order") and has(t, "পেন্ডিং", "pending", "বাকি", "চলমান", "কয়টা", "কতগুলো", "কটা", "how many"):
        return "pending_orders", q
    if has(t, "দেনা", "দিতে হবে", "দিতে বাকি", "payable", "i owe"):
        return "payables", q
    if has(t, "পাওনা", "পাব", "পাবো", "receivable", "owed"):
        return "receivables", q
    if has(t, "লাভ", "লোকসান", "ক্ষতি", "profit", "loss"):
        return "profit", q
    if has(t, "বিক্রি", "বেচা", "sales", "sold"):
        return "sales", q
    return "help", q


def answer(u, text, veg=None):
    intent, q = detect(text)
    t = (text or "").translate(_BN).lower()
    uid = u["id"]
    out = {"intent": intent, "question": (text or "")[:300], "items": [], "links": [], "simulated": False,
           "missing": [], "text": ""}

    if intent in ("sales", "profit"):
        period = period_of(t)
        s, e = bounds(period)
        hisab.sync_user(uid)
        p = hisab.pnl(uid, s, e)
        when = PERIOD_BN[period]
        if intent == "sales":
            if not p["revenue"]:
                out["text"] = f"{when} আপনার কোনো বিক্রি হিসাবে নেই।"
            else:
                out["text"] = (f"{when} আপনার মোট বিক্রয় {tk(p['revenue'])}: প্ল্যাটফর্মে {tk(p['revenue_platform'])}, "
                               f"নিজে লেখা {tk(p['revenue_external'])}। এটা বিক্রির মোট দাম, হাতে পাওয়া টাকা নয়।")
        elif p["profit_complete"]:
            word = "লাভ" if p["profit"] >= 0 else "লোকসান"
            out["text"] = (f"{when} আপনার আনুমানিক {word} {tk(abs(p['profit']))} (বিক্রি {tk(p['revenue'])}, "
                           f"বিক্রি হওয়া মালের খরচ {tk(p['cost_of_goods'])}, অন্য খরচ {tk(p['total_expenses'])})।")
        else:
            out["text"] = (f"{hisab.PROFIT_MISSING} {when} বিক্রি {tk(p['revenue'])}, লেখা খরচ {tk(p['total_expenses'])}। "
                           "স্মার্ট হিসাবে উৎপাদন বা কেনার খরচ লিখলে লাভ দেখাতে পারব।")
        out["links"].append({"label": "স্মার্ট হিসাব খুলুন", "href": "#/hisab"})

    elif intent in ("receivables", "payables"):
        direction = "receivable" if intent == "receivables" else "payable"
        rows = [d for d in hisab.list_dues(uid) if d["direction"] == direction and d["outstanding"] > 0]
        total = sum(d["outstanding"] for d in rows)
        word = "পাওনা" if direction == "receivable" else "দেনা"
        if not rows:
            out["text"] = f"এখন আপনার কোনো {word} হিসাবে নেই।"
        else:
            out["text"] = f"আপনার মোট {word} {tk(total)}, {bn(len(rows))}টি হিসাবে।"
            out["items"] = [f"{d['counterparty']}: {tk(d['outstanding'])} ({d['status_bn']})" for d in rows[:5]]
        out["links"].append({"label": "পাওনা-দেনা দেখুন", "href": "#/hisab/entries"})

    elif intent == "bills":
        hisab.sync_user(uid)
        n = count_of(t)
        invs = hisab.list_invoices(uid)[:n]
        if not invs:
            out["text"] = "আপনার এখনো কোনো ইনভয়েস তৈরি হয়নি।"
        else:
            out["text"] = f"আপনার শেষ {bn(len(invs))}টি ইনভয়েস:"
            for i in invs:
                amount = i["payout"] if i["side"] == "seller" else i["buyer_total"]
                out["items"].append(f"{i['number']} · {i['issued_date']} · {i['crop_bn']} {bn(i['qty_kg'])} কেজি · "
                                    f"{tk(amount)} · {i['status_bn']}")
                out["links"].append({"label": i["number"], "href": f"#/hisab/invoice/{i['id']}"})

    elif intent == "pending_orders":
        orders = db.q("SELECT status FROM orders WHERE (buyer=? OR seller=?) AND status IN "
                      "('awaiting_payment','confirmed','handed_over')", (uid, uid))
        offers = db.val("SELECT COUNT(*) FROM offers WHERE status IN ('pending','countered') AND "
                        "((waiting='seller' AND seller=?) OR (waiting='buyer' AND buyer=?))", (uid, uid)) or 0
        by = {}
        for o in orders:
            by[o["status"]] = by.get(o["status"], 0) + 1
        if not orders and not offers:
            out["text"] = "এখন আপনার কোনো চলমান অর্ডার বা উত্তরের অপেক্ষায় অফার নেই।"
        else:
            out["text"] = f"আপনার চলমান অর্ডার {bn(len(orders))}টি" + (f", আর {bn(offers)}টি অফারে আপনার উত্তর দরকার।" if offers else "।")
            names = {"awaiting_payment": "পেমেন্টের অপেক্ষায়", "confirmed": "নিশ্চিত, মাল পাঠানো বাকি",
                     "handed_over": "পথে / বুঝে নেওয়া বাকি"}
            out["items"] = [f"{names[k]}: {bn(v)}টি" for k, v in by.items()]
        out["links"].append({"label": "অফার ও অর্ডার", "href": "#/deals"})

    elif intent in ("best_market", "market_price"):
        out["simulated"] = True
        if veg is None or not veg.ready:
            out["text"] = "এআই এখনো প্রস্তুত হচ্ছে, কয়েক সেকেন্ড পরে আবার জিজ্ঞেস করুন।"
            return out
        crop = q["crop"]
        place = q["place"] or (u["place"] if u["place"] in PLACES else "rajshahi")
        if intent == "market_price":
            today = veg.state["today"]
            mine = today[place][crop]
            best = max(today, key=lambda m: today[m][crop])
            out["text"] = (f"আজ {PLACES[place][0]}-এ {CROPS[crop][0]}-এর আনুমানিক দর কেজিপ্রতি {tk(mine, 1)}। "
                           f"সবচেয়ে বেশি {PLACES[best][0] if best in PLACES else best}-এ {tk(today[best][crop], 1)}। "
                           f"(সিমুলেটেড ডেমো বাজারদর, {veg.state['date']})")
            out["links"].append({"label": "এআই পরামর্শ", "href": "#/advisor"})
        else:
            if not q["qty_kg"]:
                out["missing"] = ["qty"]
                out["text"] = f"কত মণ বা কেজি {CROPS[crop][0]}, সেটা বললে হিসাব করতে পারব। যেমন: \"২০ মণ {CROPS[crop][0]}\""
                return out
            kg = min(100_000, max(40, q["qty_kg"]))
            adv = veg.advice(place, crop, kg)
            r = ADVISOR.decide(adv, veg.model is not None, temp=veg.state["temp"].get(place, 27.0))
            m = r["money"]
            out["text"] = (f"{r['decision_bn']}: {r['market_name']} বাজারে {r['send_bn']} পাঠালে আনুমানিক দাম কেজিপ্রতি "
                           f"{tk(m['price'], 1)}, খরচ বাদে হাতে থাকবে প্রায় {tk(m['net_proceeds'])}"
                           + (f", স্থানীয় বিকল্পের চেয়ে {tk(r['advantage'])} বেশি" if r["advantage"] > 0 else "")
                           + "। এটি সিমুলেটেড বাজারদরের উপর অনুমান, নিশ্চিত নয়।")
            out["items"] = r["why"][:3]
            out["links"].append({"label": "পুরো হিসাব দেখুন", "href": "#/advisor"})
    else:
        out["text"] = "দুঃখিত, প্রশ্নটা বুঝতে পারিনি। এভাবে জিজ্ঞেস করতে পারেন:"
        out["items"] = EXAMPLES
    return out
