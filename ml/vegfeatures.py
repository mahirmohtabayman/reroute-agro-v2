"""Features for the vegetable price model (used by ml/train_veg.py and the live server app/veg_ai.py)."""
from datetime import timedelta

import numpy as np
import pandas as pd

from ml.vegsim import BELT, CROP_IDS, MKT_IDS, festival

HORIZONS = (1, 2, 3)
MTYPE = {"producer": 0, "hub": 1, "consumer": 2}
FEATS = ["market_id", "crop_id", "mtype", "doy_sin", "doy_cos", "month", "r1", "r3", "r7", "ma7", "ma28", "vol7",
         "arr_ratio", "arr_ratio_l1", "arr_chg", "temp", "rain", "rain3", "hum", "diesel", "disrupt",
         "glut", "belt_glut", "spread_dhaka", "spread_belt", "dhaka_arr_ratio", "ramadan", "pre_eid", "eid_holiday",
         "ramadan_h", "pre_eid_h", "eid_holiday_h", "horizon"]


def build(df):
    """One row per market × crop × day with features; targets y1..y3 = log(price in h days / price today)."""
    df = df.sort_values(["market", "crop", "date"]).copy()
    df["market_id"] = df["market"].map({m: i for i, m in enumerate(MKT_IDS)})
    df["crop_id"] = df["crop"].map({c: i for i, c in enumerate(CROP_IDS)})
    df["mtype"] = df["market_type"].map(MTYPE)
    doy = df["date"].dt.dayofyear
    df["doy_sin"], df["doy_cos"] = np.sin(2 * np.pi * doy / 365.25), np.cos(2 * np.pi * doy / 365.25)
    df["month"] = df["date"].dt.month
    g = df.groupby(["market", "crop"])
    lp = np.log(df["price_tk_kg"])
    df["lp"] = lp
    for k in (1, 3, 7):
        df[f"r{k}"] = lp - g["lp"].shift(k)
    df["ma7"] = lp - g["lp"].transform(lambda s: s.rolling(7, min_periods=3).mean())
    df["ma28"] = lp - g["lp"].transform(lambda s: s.rolling(28, min_periods=7).mean())
    df["vol7"] = g["r1"].transform(lambda s: s.rolling(7, min_periods=3).std())
    df["arr_ratio"] = df["arrivals_ton"] / df["normal_arrivals_ton"]
    df["arr_ratio_l1"] = g["arr_ratio"].shift(1)
    df["arr_chg"] = df["arr_ratio"] - df["arr_ratio_l1"]
    df["temp"], df["rain"], df["hum"] = df["temperature_c"], df["rainfall_mm"], df["humidity_pct"]
    df["rain3"] = g["rain"].transform(lambda s: s.rolling(3, min_periods=1).sum())
    df["diesel"], df["disrupt"], df["glut"] = df["diesel_tk_l"], df["transport_disruption"], df["glut_event"]
    # cross-market signals for the same crop and day
    day = df.groupby(["date", "crop"])
    dhaka = df[df.market == "dhaka"].set_index(["date", "crop"])
    belt = df[df.market.isin(BELT)].groupby(["date", "crop"])
    key = pd.MultiIndex.from_frame(df[["date", "crop"]])
    df["spread_dhaka"] = lp.values - np.log(dhaka["price_tk_kg"].reindex(key).values)
    df["spread_belt"] = lp.values - np.log(belt["price_tk_kg"].mean().reindex(key).values)
    df["belt_glut"] = belt["glut_event"].max().reindex(key).values
    df["dhaka_arr_ratio"] = (dhaka["arrivals_ton"] / dhaka["normal_arrivals_ton"]).reindex(key).values
    for h in HORIZONS:
        df[f"y{h}"] = g["lp"].shift(-h) - lp
    return df


def with_horizon(df, h):
    """Stack one horizon: calendar flags are known for the target day, so they are features too."""
    x = df.copy()
    x["horizon"] = h
    target_days = x["date"] + timedelta(days=h)
    flags = {d: festival(d.date()) for d in target_days.unique()}
    x["ramadan_h"] = target_days.map(lambda d: flags[d]["ramadan"])
    x["pre_eid_h"] = target_days.map(lambda d: int(flags[d]["eid_fitr"] or flags[d]["eid_adha_week"]))
    x["eid_holiday_h"] = target_days.map(lambda d: flags[d]["eid_holiday"])
    x["y"] = x[f"y{h}"]
    return x
