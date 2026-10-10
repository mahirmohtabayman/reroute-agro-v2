"""
Reroute Agro AI advisor (prototype trained on SIMULATED vegetable market data).

Every day the market simulator (ml/vegsim.py) produces data up to today, the trained model
(models/veg_model.joblib) forecasts each market's price 1–3 days ahead, and this module turns
the forecasts into plain advice:

* farmers   – which market and which day gives the most money in hand, which markets lose money,
              and where a glut is pushing prices down;
* paikars   – where good produce can be bought cheaply right now (Reroute listings and district
              markets), and whether prices are about to fall;
* everyone  – today's prices, tomorrow's direction and glut warnings for every market.

Money in hand = forecast price × kg − spoilage (road + waiting) − selling costs − Reroute 1% fee − truck fare.
It runs in a background thread, so the server starts at once.
"""
import json
import logging
import math
import threading
import time
from datetime import date
from pathlib import Path

import joblib
import numpy as np

from app.logic import bn, km, spoil_rate, transport_quote
from ml.vegfeatures import FEATS, HORIZONS, build, with_horizon
from ml.vegsim import MARKET_COST, MARKETS, MKT_IDS, STORAGE_LOSS, festival, simulate

log = logging.getLogger("reroute.veg")
ROOT = Path(__file__).resolve().parents[1]
FEE = 0.01
SHELF = {"tomato": 6, "brinjal": 5, "chili": 4, "cucumber": 5, "carrot": 10, "onion": 20, "potato": 30}


def travel_days(src, dst, kg):
    if src == dst:
        return 0
    return max(1, math.ceil(transport_quote(src, dst, kg)["eta"] / 24))


class VegAI:
    def __init__(self):
        self.state, self.ready, self.error = None, False, None
        try:
            b = joblib.load(ROOT / "models" / "veg_model.joblib")
            self.model, self.interval = b["model"], {int(k): v for k, v in b["interval"].items()}
        except Exception as exc:                      # still works without the model: "price stays the same"
            log.warning("veg model not loaded (%s)", exc)
            self.model, self.interval = None, {h: [0.9, 1.1] for h in HORIZONS}
        try:
            self.metrics = json.loads((ROOT / "models" / "veg_metrics.json").read_text())
        except Exception:
            self.metrics = {}
        threading.Thread(target=self._loop, daemon=True).start()

    # ------------------------------------------------------------ daily refresh
    def _loop(self):
        while True:
            try:
                if not self.ready or self.state["date"] != date.today().isoformat():
                    self.refresh()
            except Exception as exc:
                self.error = str(exc)
                log.exception("veg refresh failed")
            time.sleep(1800)

    def refresh(self):
        t0 = time.time()
        feat = build(simulate(date.today()))
        last = feat.date.max()
        latest = feat[feat.date == last]
        today, ratio, glut, temp, fc = {}, {}, {}, {}, {}
        for r in latest.itertuples():
            today.setdefault(r.market, {})[r.crop] = float(r.price_tk_kg)
            ratio.setdefault(r.market, {})[r.crop] = round(float(r.arr_ratio), 2)
            glut.setdefault(r.market, {})[r.crop] = int(r.glut)
            temp[r.market] = float(r.temp)
        for h in HORIZONS:
            x = with_horizon(latest, h)
            pred = self.model.predict(x[FEATS].fillna(0)) if self.model is not None else np.zeros(len(x))
            for (m, c, p), d in zip(x[["market", "crop", "price_tk_kg"]].itertuples(index=False), pred):
                fc.setdefault(m, {}).setdefault(c, [None] * len(HORIZONS))[h - 1] = round(float(p * math.exp(d)), 1)
        recent = feat[feat.date > last - np.timedelta64(31, "D")]
        rp = with_horizon(recent, 1)
        rp["pred"] = self.model.predict(rp[FEATS].fillna(0)) if self.model is not None else 0.0
        series = {}
        for (m, c), g in rp.groupby(["market", "crop"]):
            series.setdefault(m, {})[c] = {"dates": [d.strftime("%Y-%m-%d") for d in g.date],
                                           "price": [float(v) for v in g.price_tk_kg],
                                           "model": [round(float(p * math.exp(e)), 1) for p, e in zip(g.price_tk_kg, g.pred)]}
        self.state = {"date": last.strftime("%Y-%m-%d"), "today": today, "fc": fc, "ratio": ratio, "glut": glut,
                      "temp": temp, "disrupt": int(latest.disrupt.max()), "festival": festival(last.date()),
                      "series": series}
        self.ready, self.error = True, None
        log.info("veg AI ready for %s in %.1fs", self.state["date"], time.time() - t0)

    def price(self, m, crop, day):
        """Today (day 0) or the forecast for day 1–3."""
        return self.state["today"][m][crop] if day == 0 else self.state["fc"][m][crop][day - 1]

    def band(self, p, day):
        return (p, p) if day == 0 else (p * self.interval[day][0], p * self.interval[day][1])

    # ------------------------------------------------------------ market overview & glut warnings
    def overview(self, crop):
        s = self.state
        rows = []
        for m in MKT_IDS:
            now, f = s["today"][m][crop], s["fc"][m][crop]
            rows.append({"market": m, "name": MARKETS[m][0], "type": MARKETS[m][1], "today": now, "fc": f,
                         "change_1": round((f[0] / now - 1) * 100, 1), "change_3": round((f[2] / now - 1) * 100, 1),
                         "arrivals_pct": round((s["ratio"][m][crop] - 1) * 100), "glut": bool(s["glut"][m][crop])})
        warnings = []
        for r in rows:
            if r["glut"] or r["arrivals_pct"] >= 25:
                warnings.append(f"{r['name']} বাজারে আজ {crop_bn(crop)} আমদানি স্বাভাবিকের চেয়ে "
                                f"{bn(max(r['arrivals_pct'], 25))}% বেশি: দাম চাপে, এখানে না পাঠানোই ভালো")
            if r["change_3"] <= -8:
                warnings.append(f"{r['name']} বাজারে আগামী ৩ দিনে দাম প্রায় {bn(abs(round(r['change_3'])))}% কমতে পারে")
        if s["disrupt"]:
            warnings.append("পরিবহনে বাধা চলছে: ঢাকা ও বগুড়ায় মাল কম পৌঁছাচ্ছে")
        return {"date": s["date"], "crop": crop, "markets": rows, "warnings": warnings, "simulated": True}

    # ------------------------------------------------------------ farmer: where and when to sell
    def advice(self, src, crop, kg, days_left=None, cost=None, plus=False):
        s = self.state
        days_left = SHELF[crop] if days_left is None else days_left
        t = s["temp"].get(src, 27)
        options = []          # every (market, send-after-w-days) combination the forecast covers
        for m in MKT_IDS:
            travel = travel_days(src, m, kg)
            q = transport_quote(src, m, kg, plus) if m != src else None
            truck = q["total"] if q else round(0.3 * kg)
            k = km(src, m)
            mcost = MARKET_COST["local"] if m == src else MARKET_COST[MARKETS[m][1]]
            for w in range(0, 4):
                day = w + travel
                if day > 3 or days_left - w < 1:
                    continue
                p = self.price(m, crop, day)
                lo, hi = self.band(p, day)
                road = spoil_rate(k, days_left - w, t) if m != src else 0.01
                wait = STORAGE_LOSS[crop] * w
                kept = (1 - wait) * (1 - road)

                def net(price):
                    sold = price * kg * kept
                    return sold * (1 - FEE - mcost) - truck
                options.append({"market": m, "name": MARKETS[m][0], "type": MARKETS[m][1], "send_in_days": w,
                                "sell_day": day, "travel_days": travel, "km": k, "price_now": s["today"][m][crop],
                                "price": round(p, 1), "price_lo": round(lo, 1), "price_hi": round(hi, 1),
                                "gross": round(p * kg), "spoil_pct": round((1 - kept) * 100, 1),
                                "spoil_tk": round(p * kg * (1 - kept)), "fees_tk": round(p * kg * kept * (FEE + mcost)),
                                "truck": truck, "truck_offline": q["offline"] if q else None,
                                "vehicle": q["vehicle_name"] if q else "স্থানীয় ভ্যান",
                                "net": round(net(p)), "net_lo": round(net(lo)), "net_hi": round(net(hi))})
        local_now = next(o for o in options if o["market"] == src and o["send_in_days"] == 0)
        for o in options:
            o["vs_local"] = o["net"] - local_now["net"]
            if cost is not None:
                o["profit"] = round(o["net"] - cost * kg)
        # best plan per market (any day), ranked
        per_market = {}
        for o in options:
            if o["market"] not in per_market or o["net"] > per_market[o["market"]]["net"]:
                per_market[o["market"]] = o
        ranked = sorted(per_market.values(), key=lambda o: -o["net"])
        for o in ranked:
            o["reasons"] = self._reasons(o["market"], crop, o["sell_day"], o["price_now"], o["price"])
            o["status"] = ("loss" if cost is not None and o["profit"] < 0 else "best" if o is ranked[0] else
                           "better" if o["vs_local"] > 0 else "local" if o["market"] == src else "worse")
        grid = {m: {str(o["send_in_days"]): o["net"] for o in options if o["market"] == m} for m in MKT_IDS}
        best = ranked[0]
        return {"date": s["date"], "src": src, "crop": crop, "kg": kg, "days_left": days_left, "cost": cost,
                "best": best, "local_today": local_now, "markets": ranked, "grid": grid,
                "warnings": self.overview(crop)["warnings"], "metrics": self.metrics.get("market_choice"),
                "simulated": True}

    def _reasons(self, m, crop, day, now, p):
        s, out = self.state, []
        ratio = s["ratio"][m][crop]
        if s["glut"][m][crop]:
            out.append("এখানে এখন অনেক মাল উঠছে, দাম চাপে")
        elif ratio > 1.25:
            out.append(f"আজ আমদানি স্বাভাবিকের চেয়ে {bn(round((ratio - 1) * 100))}% বেশি")
        elif ratio < 0.8:
            out.append(f"আজ আমদানি স্বাভাবিকের চেয়ে {bn(round((1 - ratio) * 100))}% কম, দাম শক্ত")
        if day:
            ch = (p / now - 1) * 100
            if abs(ch) >= 2:
                out.append(f"বিক্রির দিন দাম {bn(round(abs(ch)))}% {'বাড়তে' if ch > 0 else 'কমতে'} পারে")
        if s["disrupt"] and m in ("dhaka", "bogura"):
            out.append("পরিবহনে বাধা, এখানে মাল কম পৌঁছাচ্ছে")
        f = s["festival"]
        if f["ramadan"] or f["eid_fitr"] or f["eid_adha_week"]:
            out.append("উৎসবের সময়, চাহিদা বেশি")
        return out

    # ------------------------------------------------------------ paikar: where to buy good produce cheaply
    def sources(self, buyer_place, crop, kg, listings, users, plus=False, exclude_uid=None):
        """Rank Reroute listings and district markets by margin when resold in the buyer's market tomorrow."""
        s = self.state
        sell_day = 1
        resale = self.price(buyer_place, crop, sell_day)
        resale_cost = MARKET_COST["consumer" if MARKETS[buyer_place][1] == "consumer" else "local"]
        out = []

        def landed(price, src, days_left):
            q = transport_quote(src, buyer_place, kg, plus) if src != buyer_place else None
            truck_half = (q["total"] / 2) if q else 0.3 * kg
            road = spoil_rate(km(src, buyer_place), days_left, s["temp"].get(src, 27)) if src != buyer_place else 0.01
            per_kg = (price * kg + truck_half) / (kg * (1 - road))
            return per_kg, q
        for l in listings:
            if l["crop"] != crop or l["status"] != "active" or l["uid"] == exclude_uid or l["available"] < l["moq"]:
                continue
            seller = users.get(l["uid"])
            if not seller:
                continue
            qty = max(l["moq"], min(kg, l["available"]))
            per_kg, q = landed(l["eff_price"], seller["place"], max(1, l["days_left"]))
            out.append({"kind": "listing", "listing": l["id"], "seller": seller["id"],
                        "seller_name": seller.get("biz") if seller["role"] == "paikar" else seller["name"],
                        "verified": bool(seller.get("verified")), "rating": seller.get("rating"), "grade": l["grade"],
                        "days_left": l["days_left"], "place": seller["place"], "price": l["eff_price"],
                        "available": l["available"], "qty": qty, "landed": round(per_kg, 1),
                        "margin_kg": round(resale * (1 - resale_cost) - per_kg, 1),
                        "vehicle": q["vehicle_name"] if q else "স্থানীয়"})
        for m in MKT_IDS:
            if m == buyer_place or MARKETS[m][1] == "consumer":
                continue
            per_kg, q = landed(s["today"][m][crop], m, SHELF[crop])
            out.append({"kind": "market", "place": m, "name": MARKETS[m][0], "price": s["today"][m][crop],
                        "landed": round(per_kg, 1), "margin_kg": round(resale * (1 - resale_cost) - per_kg, 1),
                        "glut": bool(s["glut"][m][crop]), "arrivals_pct": round((s["ratio"][m][crop] - 1) * 100),
                        "fc3": s["fc"][m][crop][2], "vehicle": q["vehicle_name"] if q else "স্থানীয়"})
        for o in out:
            o["margin_total"] = round(o["margin_kg"] * (o.get("qty") or kg))
            quality = 0
            if o["kind"] == "listing":
                quality = (2 if o["grade"] == "A" else 0) + (1 if o["verified"] else 0) + min(o["days_left"], 4) * 0.5
            o["score"] = o["margin_kg"] + quality
        out.sort(key=lambda o: -o["score"])
        timing = []
        for m in MKT_IDS:
            if MARKETS[m][1] == "consumer":
                continue
            now, f3 = s["today"][m][crop], s["fc"][m][crop][2]
            if f3 < now * 0.95:
                timing.append({"market": m, "name": MARKETS[m][0], "now": now, "fc3": f3,
                               "change_pct": round((f3 / now - 1) * 100, 1)})
        return {"date": s["date"], "crop": crop, "kg": kg, "buyer_place": buyer_place, "resale_price": resale,
                "resale_day": sell_day, "max_buy_8pct": round(resale * (1 - resale_cost) / 1.08, 1),
                "sources": out[:12], "cheaper_soon": timing, "warnings": self.overview(crop)["warnings"],
                "simulated": True}


def crop_bn(c):
    return {"tomato": "টমেটো", "brinjal": "বেগুন", "chili": "কাঁচা মরিচ", "cucumber": "শসা", "carrot": "গাজর",
            "onion": "পেঁয়াজ", "potato": "আলু"}[c]
