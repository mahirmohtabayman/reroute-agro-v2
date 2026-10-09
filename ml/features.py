"""Feature engineering shared by training (ml/train.py) and the live API (app/ai.py)."""
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "bd_food_prices_ohlc.csv"
MODEL_PATH = ROOT / "models" / "price_model.joblib"
METRICS_PATH = ROOT / "models" / "metrics.json"
TEST_START = "2023-01-01"

FEATS = ["ret1", "ret3", "ret12", "ma3", "ma12", "range", "month", "product_id", "region_id",
         "nat_ret1", "Temperature", "Rainfall", "Humidity", "WindSpeed"]

# best settings found on a 2021-2022 validation window
MODEL_PARAMS = dict(max_iter=300, learning_rate=0.03, max_depth=4,
                    min_samples_leaf=200, l2_regularization=5.0, random_state=42)

# markets shown in the app: Rajshahi belt + Dhaka
SHOW = {"rajshahi": "Rajshahi Sadar", "bogura": "Bogra Sadar", "natore": "Natore Sadar",
        "naogaon": "Naogaon Sadar", "chapai": "Nawabgonj Sadar", "dhaka": "Dhaka Sadar"}
PRODUCTS = ["rice", "lentils", "oil", "wheat_flour"]


def load_raw(path=RAW):
    df = pd.read_csv(path)
    df["Date"] = pd.to_datetime(df["Date"], format="%d/%m/%Y")
    return df.sort_values(["Market", "Product", "Date"]).reset_index(drop=True)


def build_features(df):
    df = df.copy()
    g = df.groupby(["Market", "Product"])["Close"]
    for k in (1, 3, 12):
        df[f"lag{k}"] = g.shift(k)
    df["ret1"] = df["Close"] / df["lag1"] - 1
    df["ret3"] = df["Close"] / df["lag3"] - 1
    df["ret12"] = df["Close"] / df["lag12"] - 1
    df["ma3"] = g.transform(lambda s: s.rolling(3).mean()) / df["Close"] - 1
    df["ma12"] = g.transform(lambda s: s.rolling(12).mean()) / df["Close"] - 1
    df["range"] = (df["High"] - df["Low"]) / df["Close"]
    df["month"] = df["Date"].dt.month
    df["product_id"] = df["Product"].astype("category").cat.codes
    df["region_id"] = df["Region"].astype("category").cat.codes
    df["nat_ret1"] = df.groupby(["Product", "Date"])["ret1"].transform("mean")  # country-wide move
    df["target"] = g.shift(-1) / df["Close"] - 1                                # next month % change
    return df
