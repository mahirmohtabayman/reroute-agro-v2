"""
Reroute Agro AI advisor (prototype trained on SIMULATED vegetable market data).

Every day the market simulator (ml/vegsim.py) produces data up to today, the trained model
(models/veg_model.joblib) forecasts each market's price 1–3 days ahead, and this module turns
the forecasts into plain advice inside ONE "AI পরামর্শ" page:

* farmers   – today's price + 3-day forecast, a suggested selling price, which market and which day
              gives the most money in hand, and the expected profit / loss;
* paikars   – today's price + 3-day forecast, a suggested buying price, where good produce can be bought
              cheaply (Reroute listings and district markets), where to resell for the best net, and the
              expected profit / loss;
* trade check (Smart Trade Alert) – before an offer / acceptance / counter / new listing is sent, the exact
              money of THAT deal is worked out with deterministic arithmetic (no guessing by the model):
                farmer net  = sale − Reroute fee − farmer's truck share − production cost
                paikar net  = resale − spoilage − market commission − purchase − paikar's truck share
              The model only supplies the expected resale price; every other number is a known cost.

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

from app.logic import bn, km, platform_fee, spoil_rate, transport_quote
from ml.vegfeatures import FEATS, HORIZONS, build, with_horizon
from ml.vegsim import MARKET_COST, MARKETS, MKT_IDS, STORAGE_LOSS, festival, simulate

log = logging.getLogger("reroute.veg")
ROOT = Path(__file__).resolve().parents[1]
FEE = 0.01
SHELF = {"tomato": 6, "brinjal": 5, "chili": 4, "cucumber": 5, "carrot": 10, "onion": 20, "potato": 30}
LOCAL_VAN_TK_KG = 0.3          # carrying produce to the local haat (van / rickshaw), Tk per kg
TARGET_MARGIN = 0.08           # paikar: suggested buying price keeps ~8% margin
SPLIT_BUYER = {"buyer": 1.0, "half": 0.5, "seller": 0.0}


def travel_days(src, dst, kg):
    if src == dst:
        return 0
    return max(1, math.ceil(transport_quote(src, dst, kg)["eta"] / 24))


def half_step(x):
    """Round a Tk/kg price to the nearest 0.5."""
    return round(x * 2) / 2


def resale_cost(place):
    return MARKET_COST["consumer" if MARKETS[place][1] == "consumer" else "local"]


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
                         "fc_lo": [round(v * self.interval[i + 1][0], 1) for i, v in enumerate(f)],
                         "fc_hi": [round(v * self.interval[i + 1][1], 1) for i, v in enumerate(f)],
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

    # ------------------------------------------------------------ paikar resale arithmetic (one deal, one quantity)
    def resale_calc(self, src, dst, crop, kg, buy_price, transport_tk, days_left):
        """Buy kg at buy_price in src, carry to dst (transport_tk paid by the paikar), resell there.
        Net = resale − spoilage − market commission − purchase − transport. Nothing is counted twice:
        spoilage is taken off the resale quantity, commission only on what is actually sold."""
        s = self.state
        day = max(1, min(3, travel_days(src, dst, kg)))
        p = self.price(dst, crop, day)
        lo, hi = self.band(p, day)
        road = spoil_rate(km(src, dst), max(1, days_left), s["temp"].get(src, 27)) if src != dst else 0.01
        mcost = resale_cost(dst)
        purchase = buy_price * kg

        def calc(price):
            gross = price * kg
            spoil = gross * road
            comm = (gross - spoil) * mcost
            return gross, spoil, comm, gross - spoil - comm - purchase - transport_tk

        gross, spoil, comm, net = calc(p)
        net_lo, net_hi = calc(lo)[3], calc(hi)[3]
        breakeven = (gross - spoil - comm - transport_tk) / kg
        return {"src": src, "resale_market": dst, "resale_name": MARKETS[dst][0], "resale_day": day,
                "resale_price": round(p, 1), "resale_lo": round(lo, 1), "resale_hi": round(hi, 1),
                "kg": kg, "price": round(buy_price, 2), "purchase": round(purchase), "transport": round(transport_tk),
                "gross": round(gross), "spoil_pct": round(road * 100, 1), "spoil_tk": round(spoil),
                "commission_pct": round(mcost * 100), "commission": round(comm),
                "net": round(net), "net_lo": round(net_lo), "net_hi": round(net_hi),
                "breakeven": round(breakeven, 1), "target": round(breakeven / (1 + TARGET_MARGIN), 1)}

    # ------------------------------------------------------------ farmer: where and when to sell
    def advice(self, src, crop, kg, days_left=None, cost=None, plus=False):
        s = self.state
        days_left = SHELF[crop] if days_left is None else days_left
        t = s["temp"].get(src, 27)
        options = []          # every (market, send-after-w-days) combination the forecast covers
        for m in MKT_IDS:
            travel = travel_days(src, m, kg)
            q = transport_quote(src, m, kg, plus) if m != src else None
            truck = q["total"] if q else round(LOCAL_VAN_TK_KG * kg)
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
                o["cost_tk"] = round(cost * kg)
                o["profit"] = round(o["net"] - cost * kg)
                o["profit_lo"] = round(o["net_lo"] - cost * kg)
                o["profit_hi"] = round(o["net_hi"] - cost * kg)
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
                "suggest": self.suggest_sell(src, crop, kg, cost, plus),
                "warnings": self.overview(crop)["warnings"], "metrics": self.metrics.get("market_choice"),
                "simulated": True}

    def suggest_sell(self, src, crop, kg, cost=None, plus=False):
        """A fair asking price on Reroute: between what the local haat pays today and the most a paikar
        can pay (resale in his market − truck − spoilage − commission − 8% margin). Never below the floor."""
        s = self.state
        local = s["today"][src][crop]
        fc = s["fc"][src][crop]
        best_ceiling, best_market = None, None
        for m in MKT_IDS:
            if m == src:
                continue
            q = transport_quote(src, m, kg, plus)
            r = self.resale_calc(src, m, crop, kg, 0, q["total"] * SPLIT_BUYER["half"], SHELF[crop])
            if best_ceiling is None or r["target"] > best_ceiling:
                best_ceiling, best_market = r["target"], m
        local_hand = local * (1 - MARKET_COST["local"]) - LOCAL_VAN_TK_KG      # Tk/kg left after selling at the haat
        cost_floor = (cost / (1 - FEE)) if cost is not None else None
        floor = max(local_hand, cost_floor or 0)
        ceiling = best_ceiling if best_ceiling is not None else local
        suggested = local + 0.5 * (ceiling - local) if ceiling > local else local
        suggested = max(suggested, floor)
        trend_pct = round((fc[2] / local - 1) * 100, 1)
        return {"price": half_step(suggested), "floor": half_step(floor), "ceiling": round(ceiling, 1),
                "ceiling_market": best_market, "ceiling_name": MARKETS[best_market][0] if best_market else None,
                "local": round(local, 1), "local_hand": round(local_hand, 1),
                "cost_floor": round(cost_floor, 1) if cost_floor is not None else None,
                "fc": fc, "trend_pct": trend_pct,
                "trend": "up" if trend_pct >= 3 else "down" if trend_pct <= -3 else "flat"}

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
        """Rank Reroute listings and district markets by the net profit when resold in the buyer's market.
        Truck fare is counted as a 50/50 split (the platform default)."""
        s = self.state
        out = []
        for l in listings:
            if l["crop"] != crop or l["status"] != "active" or l["uid"] == exclude_uid or l["available"] < l["moq"]:
                continue
            seller = users.get(l["uid"])
            if not seller:
                continue
            qty = max(l["moq"], min(kg, l["available"]))
            src = seller["place"]
            q = transport_quote(src, buyer_place, qty, plus) if src != buyer_place else None
            truck = q["total"] * SPLIT_BUYER["half"] if q else LOCAL_VAN_TK_KG * qty
            r = self.resale_calc(src, buyer_place, crop, qty, l["eff_price"], truck, max(1, l["days_left"]))
            out.append({"kind": "listing", "listing": l["id"], "seller": seller["id"],
                        "seller_name": seller.get("biz") if seller["role"] == "paikar" else seller["name"],
                        "verified": bool(seller.get("verified")), "rating": seller.get("rating"), "grade": l["grade"],
                        "days_left": l["days_left"], "place": src, "price": l["eff_price"],
                        "available": l["available"], "qty": qty,
                        "landed": round((l["eff_price"] * qty + truck) / qty, 1),
                        "margin_total": r["net"], "margin_kg": round(r["net"] / qty, 1),
                        "breakeven": r["breakeven"], "target": r["target"], "calc": r,
                        "vehicle": q["vehicle_name"] if q else "স্থানীয়"})
        for m in MKT_IDS:
            if m == buyer_place or MARKETS[m][1] == "consumer":
                continue
            q = transport_quote(m, buyer_place, kg, plus)
            truck = q["total"]          # buying at a market: the paikar hires the whole truck himself
            price = s["today"][m][crop]
            r = self.resale_calc(m, buyer_place, crop, kg, price, truck, SHELF[crop])
            out.append({"kind": "market", "place": m, "name": MARKETS[m][0], "price": price, "qty": kg,
                        "landed": round((price * kg + truck) / kg, 1),
                        "margin_total": r["net"], "margin_kg": round(r["net"] / kg, 1),
                        "breakeven": r["breakeven"], "target": r["target"], "calc": r,
                        "glut": bool(s["glut"][m][crop]), "arrivals_pct": round((s["ratio"][m][crop] - 1) * 100),
                        "fc3": s["fc"][m][crop][2], "vehicle": q["vehicle_name"]})
        for o in out:
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
        top = out[0] if out else None
        resale = []
        if top:
            for m in MKT_IDS:
                if m == top["place"]:
                    continue
                q = transport_quote(top["place"], m, top["qty"], plus)
                truck = q["total"] * (SPLIT_BUYER["half"] if top["kind"] == "listing" else 1)
                r = self.resale_calc(top["place"], m, crop, top["qty"], top["price"], truck,
                                     max(1, top.get("days_left") or SHELF[crop]))
                resale.append({**r, "is_home": m == buyer_place})
            resale.sort(key=lambda r: -r["net"])
        res_price = self.price(buyer_place, crop, 1)
        return {"date": s["date"], "crop": crop, "kg": kg, "buyer_place": buyer_place, "resale_price": res_price,
                "resale_day": 1, "max_buy_8pct": round(res_price * (1 - resale_cost(buyer_place)) / 1.08, 1),
                "sources": out[:12], "cheaper_soon": timing, "resale_markets": resale,
                "suggest": ({"max_8pct": top["target"], "breakeven": top["breakeven"], "asked": top["price"],
                             "ok": top["price"] <= top["target"], "place": top["place"]} if top else None),
                "warnings": self.overview(crop)["warnings"], "simulated": True}

    # ------------------------------------------------------------ Smart Trade Alert: one exact deal
    def check_buy(self, src, dst, crop, kg, price, transport, split, days_left, plus=False, bulk=False):
        """Paikar side of a deal: is buying kg at price (Tk/kg) from src and reselling at dst profitable?"""
        q = transport_quote(src, dst, kg, plus, bulk) if src != dst else None
        if transport == "reroute":
            truck = q["total"] * SPLIT_BUYER.get(split, 0.5) if q else LOCAL_VAN_TK_KG * kg
            estimated = False
        else:   # self-arranged truck: open-market fare estimate, never Reroute charges
            truck = q["offline"] if q else LOCAL_VAN_TK_KG * kg
            estimated = True
        r = self.resale_calc(src, dst, crop, kg, price, truck, days_left)
        alt = None
        for m in MKT_IDS:
            if m in (dst, src):
                continue
            q2 = transport_quote(src, m, kg, plus, bulk)
            t2 = q2["total"] * SPLIT_BUYER.get(split, 0.5) if transport == "reroute" else q2["offline"]
            r2 = self.resale_calc(src, m, crop, kg, price, t2, days_left)
            if r2["net"] > r["net"] and (alt is None or r2["net"] > alt["net"]):
                alt = {"market": m, "name": r2["resale_name"], "net": r2["net"]}
        status = "loss" if r["net"] < 0 else "profit"
        return {**r, "side": "buyer", "status": status, "transport_mode": transport, "split": split,
                "transport_estimated": estimated, "truck_total": q["total"] if q else 0,
                "alt_market": alt, "risk_range": r["net_lo"] < 0 <= r["net"], "simulated": True}

    def check_sell(self, src, crop, kg, price, cost, transport_share, transport_known=True):
        """Farmer / seller side: money left after the Reroute fee, the seller's truck share and the
        production (or purchase) cost. Unknown cost → no profit figure, only money in hand."""
        s = self.state
        revenue = price * kg
        fee = platform_fee(revenue)
        hand = revenue - fee - transport_share
        local = s["today"][src][crop]
        local_hand = local * kg * (1 - MARKET_COST["local"]) - LOCAL_VAN_TK_KG * kg
        out = {"side": "seller", "kg": kg, "price": round(price, 2), "revenue": round(revenue), "fee": fee,
               "transport": round(transport_share), "transport_known": transport_known, "in_hand": round(hand),
               "cost_known": cost is not None, "cost_per_kg": cost, "cost_total": None, "profit": None,
               "breakeven": None, "local_price": round(local, 1), "local_hand": round(local_hand),
               "vs_local": round(hand - local_hand), "simulated": True}
        if cost is None:
            out["status"] = "unknown"
            return out
        cost_total = cost * kg
        profit = hand - cost_total
        p = (cost_total + transport_share) / kg
        for _ in range(4):                      # fee depends on the price (1%, min ৳10, max ৳500)
            p = (cost_total + transport_share + platform_fee(p * kg)) / kg
        out.update({"cost_total": round(cost_total), "profit": round(profit), "breakeven": round(p, 1),
                    "status": "loss" if profit < 0 else "profit"})
        return out


def crop_bn(c):
    return {"tomato": "টমেটো", "brinjal": "বেগুন", "chili": "কাঁচা মরিচ", "cucumber": "শসা", "carrot": "গাজর",
            "onion": "পেঁয়াজ", "potato": "আলু"}[c]
