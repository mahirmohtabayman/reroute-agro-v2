"""
Train the vegetable price model on the SIMULATED dataset and test it on months it has not seen.

Model : one gradient-boosting model predicts the price change 1, 2 and 3 days ahead for every
        market × crop (horizon is a feature).
Tests : 1) price error vs. a naive "price stays the same" forecast
        2) market choice: a farmer in the belt with 25 মণ follows the AI's "where to send" advice
           (forecast price at arrival − Reroute truck fare − expected spoilage − 1% fee).
           We compare what he really would have earned with selling at his local market.
Out   : models/veg_model.joblib, models/veg_metrics.json
Run   : python -m ml.vegsim && python -m ml.train_veg
"""
import json
import math
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from app.logic import km, spoil_rate, transport_quote
from ml.vegfeatures import FEATS, HORIZONS, build, with_horizon
from ml.vegsim import BELT, MARKET_COST, MARKETS, MKT_IDS, OUT as DATA

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "models" / "veg_model.joblib"
METRICS = ROOT / "models" / "veg_metrics.json"
TEST_START = "2025-07-01"
PARAMS = dict(max_iter=350, learning_rate=0.06, max_depth=7, min_samples_leaf=80, l2_regularization=1.0,
              random_state=42)
FEE = 0.01


def arrival_day(src, dst, kg):
    if src == dst:
        return 0
    return min(3, max(1, math.ceil(transport_quote(src, dst, kg)["eta"] / 24)))


def train(df):
    feat = build(df)
    stack = pd.concat([with_horizon(feat, h) for h in HORIZONS]).dropna(subset=FEATS + ["y"])
    tr = stack[stack.date < TEST_START]
    te = stack[stack.date >= TEST_START]
    model = HistGradientBoostingRegressor(**PARAMS).fit(tr[FEATS], tr["y"])
    te = te.assign(pred=model.predict(te[FEATS]))
    return model, feat, te


def evaluate(model, feat, te):
    out = {"rows_train": int((feat.date < TEST_START).sum()), "test_period": f"{TEST_START} → {feat.date.max():%Y-%m-%d}",
           "data": "simulated", "horizons": {}}
    for h in HORIZONS:
        x = te[te.horizon == h]
        actual = np.exp(x["y"])
        mape_m = float(np.mean(np.abs(np.exp(x["pred"]) - actual) / actual) * 100)
        mape_n = float(np.mean(np.abs(1 - actual) / actual) * 100)
        moved = x["y"].abs() > 0.03
        dir_acc = float(np.mean(np.sign(x.loc[moved, "pred"]) == np.sign(x.loc[moved, "y"])) * 100)
        out["horizons"][h] = {"mape_model": round(mape_m, 2), "mape_naive": round(mape_n, 2),
                              "direction_accuracy": round(dir_acc, 1)}
    # interval: spread of relative errors per horizon (10th–90th percentile)
    rel = te.assign(e=np.exp(te["y"] - te["pred"]))
    out["interval"] = {str(h): [round(float(rel[rel.horizon == h].e.quantile(.1)), 3),
                                round(float(rel[rel.horizon == h].e.quantile(.9)), 3)] for h in HORIZONS}
    out["market_choice"] = market_choice_backtest(feat, te)
    return out


def market_choice_backtest(feat, te, kg=1000):
    """Each test day, each belt farmer, each crop: send where the AI says vs. sell locally."""
    price = feat.set_index(["date", "market", "crop"])["price_tk_kg"]
    temp = feat.set_index(["date", "market", "crop"])["temp"]
    pred = te.set_index(["date", "market", "crop", "horizon"])["pred"]
    dates = sorted(te.date.unique())[:-3]
    gains, vs_dhaka, picks_best, losses_avoided, n = [], [], 0, 0, 0
    q = {(s, d): transport_quote(s, d, kg) for s in BELT for d in MKT_IDS}
    for day in dates[::2]:                         # every second day keeps the test quick
        for src in BELT:
            for crop in feat.crop.unique():
                try:
                    today = price[(day, src, crop)]
                    t = temp[(day, src, crop)]
                except KeyError:
                    continue
                ai, real = {}, {}
                for m in MKT_IDS:
                    h = arrival_day(src, m, kg)
                    k = km(src, m)
                    spoil = spoil_rate(k, 4, t)
                    tr = q[(src, m)]["total"] if m != src else 0.3 * kg
                    if h == 0:
                        p_ai = today
                    else:
                        try:
                            p_ai = today * math.exp(pred[(day, m, crop, h)] + math.log(price[(day, m, crop)] / today))
                        except KeyError:
                            continue
                    try:
                        p_real = price[(day + pd.Timedelta(days=h), m, crop)]
                    except KeyError:
                        continue
                    cost = MARKET_COST["local"] if m == src else MARKET_COST[MARKETS[m][1]]
                    net = lambda p: p * kg * (1 - spoil) * (1 - FEE - cost) - tr
                    ai[m], real[m] = net(p_ai), net(p_real)
                if src not in real or len(real) < 3:
                    continue
                choice = max(ai, key=ai.get)
                best = max(real, key=real.get)
                n += 1
                gains.append((real[choice] - real[src]) / kg)
                if "dhaka" in real:
                    vs_dhaka.append((real[choice] - real["dhaka"]) / kg)
                picks_best += choice == best
                losses_avoided += real[choice] >= real[src] - 0.25 * kg   # not more than 25 paisa/kg below local
    g = np.array(gains)
    return {"cases": n, "avg_extra_tk_per_kg": round(float(g.mean()), 2),
            "avg_extra_tk_per_mon": round(float(g.mean() * 40), 0),
            "share_better_or_equal_than_local": round(float((g >= 0).mean() * 100), 1),
            "picked_true_best_market": round(picks_best / n * 100, 1),
            "not_worse_than_local": round(losses_avoided / n * 100, 1),
            "avg_extra_vs_always_dhaka_tk_per_kg": round(float(np.mean(vs_dhaka)), 2)}


if __name__ == "__main__":
    df = pd.read_csv(DATA, parse_dates=["date"])
    model, feat, te = train(df)
    m = evaluate(model, feat, te)
    MODEL.parent.mkdir(exist_ok=True)
    joblib.dump({"model": model, "feats": FEATS, "interval": m["interval"]}, MODEL, compress=3)
    METRICS.write_text(json.dumps(m, indent=2, ensure_ascii=False))
    print(json.dumps(m, indent=2, ensure_ascii=False))
