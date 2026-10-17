"""Smart Selling Advisor: decision, explanation, spoilage risk and Bangla question parsing.

Built on top of VegAI.advice() (app/veg_ai.py), which already prices every (market × send-after-N-days)
option with deterministic arithmetic around the price forecast:

    revenue      = forecast price × kg that arrives (after road and waiting losses)
    other costs  = market commission + Reroute 1% fee (on revenue)
    net proceeds = revenue − other costs − transport
    profit       = net proceeds − production cost × kg     (only when the farmer gives a production cost)

This module only decides between those options and explains the decision with the same numbers. The market data
behind the forecast is SIMULATED (ml/vegsim.py) and every response says so.

Decision rules (in order):
  insufficient_evidence  the forecast model is not loaded, or the market data is more than 2 days old
  wait                   the best "send later" option beats the best "send today" option even with its
                         PESSIMISTIC forecast (lower interval bound), and the produce still has ≥ 2 days of shelf
                         life left on arrival and its spoilage risk is not High
  other_market           the best "send today" market is not the local one and nets at least
                         max(৳300, 3 % of the local net) more than selling locally today
  sell_now               otherwise (sell locally today, or in the best market today if that is the local one)
"""
import re
from datetime import date

from app.logic import CROPS, PLACES, SPEED, bn, spoil_rate, tk

# ---------------------------------------------------------------- spoilage risk (prototype rule set)
# Shelf life is CROPS[crop][1]: typical days a crop stays saleable without cold storage. These are prototype
# reference values for the demo, not validated agronomic figures. Thresholds below are configurable.
RISK_RULES = {
    "high_remaining_days": 1,     # less than this many days of shelf life left on arrival → High
    "medium_remaining_days": 2,   # less than this → Medium
    "high_loss_pct": 8.0,         # expected weight/quality loss on the way and while waiting ≥ this → High
    "medium_loss_pct": 4.0,       # ≥ this → Medium
    "cool_storage_factor": 0.5,   # assumption: shaded/cool storage halves the loss rate (not measured)
}
RISK_BN = {"low": "কম", "medium": "মাঝারি", "high": "বেশি"}
RISK_LIMITATION = ("প্রোটোটাইপ নিয়ম: ফসল তাজা থাকার দিন ও তাপমাত্রা অনুযায়ী আনুমানিক হিসাব। "
                   "এটি যাচাই করা মেশিন লার্নিং মডেল নয়; আসল সংরক্ষণ অবস্থা, প্যাকিং ও মালের মান অনুযায়ী ঝুঁকি আলাদা হতে পারে।")


def risk_level(remaining_days, loss_pct):
    r = RISK_RULES
    if remaining_days < r["high_remaining_days"] or loss_pct >= r["high_loss_pct"]:
        return "high"
    if remaining_days < r["medium_remaining_days"] or loss_pct >= r["medium_loss_pct"]:
        return "medium"
    return "low"


def spoilage_risk(crop, days_left, travel_hours, wait_days=0, temp=27.0, storage="ambient"):
    """Low/Medium/High post-harvest risk for one plan (send after wait_days, travel_hours on the road)."""
    shelf = CROPS[crop][1]
    from ml.vegsim import STORAGE_LOSS
    factor = RISK_RULES["cool_storage_factor"] if storage == "cool" else 1.0
    wait_loss = STORAGE_LOSS[crop] * wait_days * factor
    road_loss = spoil_rate(travel_hours * SPEED, days_left - wait_days, temp) * factor if travel_hours else 0.0
    loss_pct = round((1 - (1 - wait_loss) * (1 - road_loss)) * 100, 1)
    remaining = round(days_left - wait_days - travel_hours / 24, 1)
    level = risk_level(remaining, loss_pct)
    reasons = [f"রওনা দেওয়ার সময় আর প্রায় {bn(days_left - wait_days)} দিন তাজা থাকবে "
               f"({CROPS[crop][0]} সাধারণত {bn(shelf)} দিন ভালো থাকে)"]
    if travel_hours:
        reasons.append(f"পথে প্রায় {bn(round(travel_hours))} ঘণ্টা, তাপমাত্রা প্রায় {bn(round(temp))}°সে")
    if wait_days:
        reasons.append(f"{bn(wait_days)} দিন অপেক্ষায় ওজন ও মান কমে প্রায় {bn(round(wait_loss * 100, 1))}%")
    reasons.append(f"মোট আনুমানিক ক্ষতি {bn(loss_pct, 1)}%, পৌঁছানোর পর তাজা থাকবে প্রায় {bn(max(remaining, 0), 1)} দিন")
    action = {"low": "স্বাভাবিকভাবে পাঠানো যায়।",
              "medium": "দেরি না করে পাঠান, ছায়ায় ও বাতাস চলাচলের জায়গায় রাখুন, কাছের বাজারও বিবেচনা করুন।",
              "high": "আজই কাছের বাজারে বেচুন বা জরুরি বিক্রি দিন; দূরের বাজারে পাঠানো বা অপেক্ষা করা ঝুঁকিপূর্ণ।"}[level]
    return {"level": level, "level_bn": RISK_BN[level], "loss_pct": loss_pct, "remaining_days": remaining,
            "reasons": reasons, "action": action, "limitation": RISK_LIMITATION, "rules": RISK_RULES,
            "storage": storage, "prototype_rules": True}


# ---------------------------------------------------------------- the decision
MIN_ADVANTAGE_TK, MIN_ADVANTAGE_SHARE = 300, 0.03
DECISION_BN = {"sell_now": "এখনই বিক্রি করুন", "wait": "কিছুদিন অপেক্ষা করার কথা ভাবুন",
               "other_market": "অন্য বাজারে বিক্রির কথা ভাবুন", "insufficient_evidence": "যথেষ্ট তথ্য নেই"}
SEND_BN = ["আজ", "কাল", "পরশু", "৩ দিন পরে"]


def money(o, kg, cost):
    """Revenue / costs / net proceeds / profit of one option, kept strictly separate."""
    revenue = o["gross"] - o["spoil_tk"]
    out = {"price": o["price"], "price_lo": o["price_lo"], "price_hi": o["price_hi"], "gross": o["gross"],
           "spoilage": o["spoil_tk"], "spoil_pct": o["spoil_pct"], "revenue": revenue,
           "other_costs": o["fees_tk"], "transport": o["truck"], "net_proceeds": o["net"],
           "net_lo": o["net_lo"], "net_hi": o["net_hi"], "production_cost": None, "profit": None}
    if cost is not None:
        out["production_cost"] = round(cost * kg)
        out["profit"] = o["net"] - out["production_cost"]
    return out


def _risk_for(o, adv, temp):
    hours = 0 if o["market"] == adv["src"] else o["km"] / SPEED      # selling locally: no truck journey
    return spoilage_risk(adv["crop"], adv["days_left"], hours, o["send_in_days"], temp)


def decide(adv, model_loaded=True, today=None, temp=27.0):
    """Turn VegAI.advice() output into one recommendation with reasons. Never invents numbers: every figure in
    the result comes from adv."""
    kg, crop, src, cost = adv["kg"], adv["crop"], adv["src"], adv["cost"]
    opts = adv["options"]
    local_now = adv["local_today"]
    data_date = date.fromisoformat(adv["date"])
    stale_days = ((today or date.today()) - data_date).days
    now_opts = [o for o in opts if o["send_in_days"] == 0]
    later_opts = [o for o in opts if o["send_in_days"] > 0]
    best_now = max(now_opts, key=lambda o: o["net"])
    best_later = max(later_opts, key=lambda o: o["net"]) if later_opts else None

    evidence = []
    if not model_loaded:
        evidence.append("দামের পূর্বাভাস মডেল লোড হয়নি")
    if stale_days > 2:
        evidence.append(f"বাজারদরের তথ্য {bn(stale_days)} দিনের পুরনো")

    later_risk = _risk_for(best_later, adv, temp) if best_later else None
    if evidence:
        code, rec = "insufficient_evidence", local_now
    elif (best_later and best_later["net_lo"] > best_now["net"]
          and adv["days_left"] - best_later["send_in_days"] - best_later["travel_days"] >= 2
          and later_risk["level"] != "high"):
        code, rec = "wait", best_later
    elif best_now["market"] != src and best_now["net"] - local_now["net"] >= max(MIN_ADVANTAGE_TK, MIN_ADVANTAGE_SHARE * abs(local_now["net"])):
        code, rec = "other_market", best_now
    else:
        code, rec = "sell_now", best_now if best_now["market"] == src else local_now

    # the alternative we compare against: selling locally today, unless that IS the recommendation
    others = [o for o in now_opts if o["market"] != src]
    alt = local_now if rec is not local_now else max(others, key=lambda o: o["net"]) if others else rec
    rec_money, alt_money = money(rec, kg, cost), money(alt, kg, cost)
    advantage = rec["net"] - alt["net"]
    certain = rec["net_lo"] > alt["net"] if advantage > 0 else None

    why = explain(code, rec, alt, rec_money, alt_money, adv, best_later)
    risk = _risk_for(rec, adv, temp)
    risks = []
    if risk["level"] != "low":
        risks.append(f"পচনের ঝুঁকি {risk['level_bn']}: {risk['action']}")
    if advantage > 0 and not certain:
        risks.append("লাভের পার্থক্য পূর্বাভাসের অনিশ্চয়তার মধ্যে পড়ে, তাই নিশ্চিত নয়")
    if cost is not None and all((o["net"] - cost * kg) < 0 for o in opts):
        risks.append("এই উৎপাদন খরচে কোনো বাজারেই লাভ হচ্ছে না")
    if any(w for w in adv.get("warnings", []) if rec["name"] in w):
        risks.append(f"{rec['name']} বাজারে আজ সতর্কবার্তা আছে")
    if cost is None:
        risks.append("উৎপাদন খরচ দেওয়া হয়নি, তাই লাভ নয়, শুধু 'হাতে থাকবে' (নিট আয়) দেখানো হচ্ছে")

    return {
        "decision": code, "decision_bn": DECISION_BN[code], "evidence_gaps": evidence,
        "market": rec["market"], "market_name": rec["name"], "send_in_days": rec["send_in_days"],
        "send_bn": SEND_BN[rec["send_in_days"]], "sell_day": rec["sell_day"],
        "money": rec_money, "alternative": {"market": alt["market"], "market_name": alt["name"],
                                            "send_in_days": alt["send_in_days"], "money": alt_money},
        "advantage": advantage, "advantage_certain": certain, "why": why, "risks": risks, "spoilage": risk,
        "terms": {"revenue": "বিক্রির টাকা (পচন বাদে যা পৌঁছায় তার দাম)", "other_costs": "বাজার কমিশন + Reroute ১% ফি",
                  "net_proceeds": "হাতে থাকবে = বিক্রির টাকা − অন্যান্য খরচ − পরিবহন",
                  "profit": "লাভ = হাতে থাকবে − উৎপাদন খরচ (খরচ জানা থাকলে)"},
    }


def explain(code, rec, alt, rm, am, adv, best_later):
    """Plain-Bangla reasons generated only from the calculation inputs."""
    kg = adv["kg"]
    out = []
    if code == "insufficient_evidence":
        out.append("পূর্বাভাসের ভিত্তি দুর্বল, তাই অন্য বাজার বা অপেক্ষার পরামর্শ দেওয়া হচ্ছে না; আজকের স্থানীয় দর দেখানো হলো।")
        return out
    dp = rec["price"] - alt["price"]
    if abs(dp) >= 0.1:
        out.append(f"{rec['name']}-এ {'বিক্রির দিনের পূর্বাভাসিত ' if rec['sell_day'] else ''}দাম {tk(rec['price'])}/কেজি, "
                   f"{alt['name']} ({SEND_BN[alt['send_in_days']]})-এ {tk(alt['price'])}/কেজি: কেজিতে {tk(abs(dp))} "
                   f"{'বেশি' if dp > 0 else 'কম'}।")
    d_rev, d_trans = rm["revenue"] - am["revenue"], rm["transport"] - am["transport"]
    d_other = (rm["other_costs"] - am["other_costs"])
    if code == "other_market":
        out.append(f"বাড়তি বিক্রি প্রায় {tk(d_rev)}, বাড়তি পরিবহন খরচ {tk(d_trans)} আর কমিশন-ফি {tk(d_other)}: "
                   f"সব বাদ দিয়েও হাতে প্রায় {tk(rec['net'] - alt['net'])} বেশি থাকে।")
    elif code == "wait":
        out.append(f"{SEND_BN[rec['send_in_days']]} পাঠালে পূর্বাভাসের সবচেয়ে খারাপ অনুমানেও হাতে থাকে {tk(rec['net_lo'])}, "
                   f"যা আজ পাঠানোর সেরা হিসাবের ({tk(alt['net'])}) চেয়ে বেশি।")
        out.append(f"অপেক্ষার সময় পচন ও ওজন কমা ধরা হয়েছে: প্রায় {bn(rec['spoil_pct'], 1)}%।")
    else:
        if alt["net"] < rec["net"]:
            out.append(f"{alt['name']}-এ পাঠালে বাড়তি দাম পরিবহন ({tk(am['transport'])}) ও পচনের খরচ পুরোপুরি পোষায় না: "
                       f"হাতে থাকে {tk(alt['net'])}, এখানে {tk(rec['net'])}।")
        if best_later and best_later["net"] > rec["net"] and best_later["net_lo"] <= rec["net"]:
            out.append(f"অপেক্ষা করলে দাম বাড়তে পারে (আনুমানিক {tk(best_later['net'])}), কিন্তু পূর্বাভাসের খারাপ দিকে "
                       f"{tk(best_later['net_lo'])} হতে পারে, তাই ঝুঁকি নেওয়ার মতো প্রমাণ নেই।")
    out.append(f"{bn(kg / 40, 1)} মণের হিসাব: বিক্রির টাকা {tk(rm['revenue'])} − অন্যান্য খরচ {tk(rm['other_costs'])} − "
               f"পরিবহন {tk(rm['transport'])} = হাতে থাকবে {tk(rm['net_proceeds'])}"
               + (f"; উৎপাদন খরচ {tk(rm['production_cost'])} বাদে লাভ {tk(rm['profit'])}।" if rm["profit"] is not None else "।"))
    out += rec.get("reasons", [])
    return out


def provenance(veg, adv):
    m = veg.metrics or {}
    h = m.get("horizons", {})
    return {
        "data": "simulated", "data_bn": "সিমুলেটেড ডেমো বাজারদর, আসল সরকারি দৈনিক দর নয়",
        "data_date": adv["date"], "forecast_horizon_days": [1, 2, 3],
        "model": type(veg.model).__name__ if veg.model is not None else None,
        "model_bn": "গ্রেডিয়েন্ট বুস্টিং রিগ্রেশন (HistGradientBoosting), দামের দৈনিক পরিবর্তন পূর্বাভাস" if veg.model is not None else "মডেল লোড হয়নি",
        "backtest": {k: {"mape_model": v["mape_model"], "mape_naive": v["mape_naive"]} for k, v in h.items()},
        "backtest_note": f"সময়ক্রম অনুযায়ী ব্যাক-টেস্ট ({m.get('test_period', '?')}), সিমুলেটেড ডেটায়: বাস্তব নির্ভুলতা নয়।",
        "interval_note": "দামের সীমা ব্যাক-টেস্টের ভুলের বিস্তার থেকে নেওয়া (প্রায় ৮০% ক্ষেত্রে এর মধ্যে থাকে)।",
    }


# ---------------------------------------------------------------- Bangla questions ("আমার ২০ মণ টমেটো কোন বাজারে…")
CROP_WORDS = {
    "tomato": ["টমেটো", "টমাটো", "tomato"], "brinjal": ["বেগুন", "brinjal", "eggplant"],
    "chili": ["কাঁচা মরিচ", "কাচা মরিচ", "মরিচ", "chili", "chilli"], "cucumber": ["শসা", "শশা", "cucumber"],
    "carrot": ["গাজর", "carrot"], "onion": ["পেঁয়াজ", "পিঁয়াজ", "পেয়াজ", "পিয়াজ", "onion"], "potato": ["আলু", "potato"],
}
PLACE_WORDS = {k: [v[0], k] for k, v in PLACES.items()}
PLACE_WORDS["chapai"] += ["চাঁপাই", "চাপাই"]
PLACE_WORDS["bogura"] += ["বগুরা", "bogra"]
NUM_WORDS = {"এক": 1, "দুই": 2, "তিন": 3, "চার": 4, "পাঁচ": 5, "ছয়": 6, "সাত": 7, "আট": 8, "নয়": 9, "দশ": 10,
             "পনেরো": 15, "পনের": 15, "বিশ": 20, "পঁচিশ": 25, "ত্রিশ": 30, "তিরিশ": 30, "চল্লিশ": 40, "পঞ্চাশ": 50,
             "ষাট": 60, "সত্তর": 70, "আশি": 80, "নব্বই": 90, "একশ": 100, "একশো": 100, "দুইশ": 200, "দুশো": 200}
UNIT_KG = {"মণ": 40, "মন": 40, "mon": 40, "maund": 40, "কেজি": 1, "kg": 1, "টন": 1000, "ton": 1000}
_BN = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
SELL_WORDS = ["বিক্রি", "বেচ", "বেচব", "বেচতে", "লাভ", "কোন বাজার", "কোথায়", "sell", "profit"]
BUY_WORDS = ["কিনব", "কিনতে", "কেনা", "কিনি", "buy", "purchase"]


def parse_query(text):
    """Extract crop, quantity, place and intent from a Bangla or English question. Never guesses a missing
    value: anything not found is listed in "missing" so the app can ask for it."""
    raw = (text or "").strip()[:300]
    t = raw.translate(_BN).lower()
    crop = next((c for c, words in CROP_WORDS.items() for w in words if w.lower() in t), None)
    place = next((p for p, words in PLACE_WORDS.items() for w in words if w.lower() in t), None)
    qty_kg, qty_text = None, None
    units = "|".join(sorted(map(re.escape, UNIT_KG), key=len, reverse=True))
    m = re.search(rf"(\d+(?:\.\d+)?)\s*({units})", t)
    if m:
        qty_kg, qty_text = float(m.group(1)) * UNIT_KG[m.group(2)], m.group(0)
    else:
        words = "|".join(sorted(map(re.escape, NUM_WORDS), key=len, reverse=True))
        m = re.search(rf"({words})\s*({units})", t)
        if m:
            qty_kg, qty_text = NUM_WORDS[m.group(1)] * UNIT_KG[m.group(2)], m.group(0)
    buy = any(w in t for w in BUY_WORDS)
    sell = any(w in t for w in SELL_WORDS)
    intent = "buy" if buy and not sell else "sell" if sell or crop else None
    missing = [k for k, v in (("crop", crop), ("qty", qty_kg), ("intent", intent)) if v is None]
    return {"text": raw, "crop": crop, "crop_bn": CROPS[crop][0] if crop else None, "qty_kg": qty_kg,
            "qty_text": qty_text, "place": place, "place_bn": PLACES[place][0] if place else None,
            "intent": intent, "missing": missing}
