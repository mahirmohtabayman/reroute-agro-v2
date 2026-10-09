"""
Live AI service.
Loads the trained price model once at startup and serves:
  * next-month price forecast for any market/product (live model.predict)
  * history + backtest series for the app's chart
  * monthly average temperature per district (used by the spoilage estimator)
If the saved model cannot be loaded (e.g. library version mismatch), it is
retrained on the spot, so the server always has a working model.
"""
import json
import logging

import joblib
import pandas as pd

from ml.features import (FEATS, METRICS_PATH, MODEL_PATH, PRODUCTS, SHOW, TEST_START,
                         build_features, load_raw)

log = logging.getLogger("reroute.ai")


class PriceAI:
    def __init__(self):
        self.df = build_features(load_raw())
        try:
            self.model = joblib.load(MODEL_PATH)
            self.model.predict(self.df.dropna(subset=FEATS)[FEATS].head(1))
            self.metrics = json.loads(METRICS_PATH.read_text())
            log.info("price model loaded from %s", MODEL_PATH)
        except Exception as exc:  # pragma: no cover - fallback path
            log.warning("could not load saved model (%s), retraining", exc)
            from ml.train import train_and_evaluate
            self.model, self.metrics = train_and_evaluate()

        self.latest_date = self.df["Date"].max()
        self.next_month = (self.latest_date + pd.offsets.MonthBegin(1)).strftime("%Y-%m")
        self.markets = sorted(self.df["Market"].unique().tolist())
        self.climate = self._climate()
        self.series = {key: {p: self._series(m, p) for p in PRODUCTS} for key, m in SHOW.items()}

    # ---------- live prediction ----------
    def predict(self, market: str, product: str):
        row = self.df[(self.df.Market == market) & (self.df.Product == product)
                      & (self.df.Date == self.latest_date)].dropna(subset=FEATS)
        if row.empty:
            return None
        now = float(row["Close"].iloc[0])
        change = float(self.model.predict(row[FEATS])[0])
        return {"market": market, "product": product, "month": self.next_month,
                "current": round(now, 2), "forecast": round(now * (1 + change), 2),
                "change_pct": round(change * 100, 2)}

    # ---------- chart data ----------
    def _series(self, market, product):
        s = self.df[(self.df.Market == market) & (self.df.Product == product)]
        hist = s.set_index("Date")["Close"].iloc[-24:]
        t = s[(s.Date >= TEST_START)].dropna(subset=FEATS)
        bt = t["Close"] * (1 + self.model.predict(t[FEATS]))
        bt_dates = (t["Date"] + pd.offsets.MonthBegin(1)).dt.strftime("%Y-%m")
        fc = self.predict(market, product)
        return {"dates": [d.strftime("%Y-%m") for d in hist.index],
                "close": [round(float(v), 2) for v in hist.values],
                "backtest": {d: round(float(v), 2) for d, v in zip(bt_dates, bt)},
                "forecast": {"month": fc["month"], "price": fc["forecast"]}}

    def _climate(self):
        out = {}
        for key, market in SHOW.items():
            m = self.df[(self.df.Market == market) & (self.df.Product == "rice")]
            out[key] = {int(k): round(float(v), 1)
                        for k, v in m.groupby(m["Date"].dt.month)["Temperature"].mean().items()}
        return out

    def temp(self, place: str, month: int) -> float:
        return self.climate.get(place, {}).get(month, 27.0)

    def summary(self):
        return {"metrics": self.metrics, "series": self.series, "climate": self.climate,
                "markets": self.markets,
                "source": "Food Commodity Price (OHLC) Dataset of Bangladesh, Mendeley Data"}
