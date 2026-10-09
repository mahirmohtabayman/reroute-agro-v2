"""
Reroute Agro: train the AI price forecaster
-------------------------------------------
Data : Food Commodity Price (OHLC) Dataset of Bangladesh (Mendeley Data)
       76 markets, 2007-2025, monthly prices + weather
Task : predict NEXT MONTH's price for every market and product
Check: train on 2008-2022, test on unseen 2023-2025, compare with a naive
       baseline ("next month = this month")
Out  : models/price_model.joblib  (used live by the FastAPI server)
       models/metrics.json

Run from the project root:  python -m ml.train
"""
import json

import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor

from ml.features import (FEATS, METRICS_PATH, MODEL_PARAMS, MODEL_PATH, PRODUCTS,
                         TEST_START, build_features, load_raw)


def train_and_evaluate():
    df = build_features(load_raw())
    data = df.dropna(subset=FEATS + ["target"])
    train = data[data["Date"] < TEST_START]
    test = data[data["Date"] >= TEST_START]

    model = HistGradientBoostingRegressor(**MODEL_PARAMS)
    model.fit(train[FEATS], train["target"])

    actual = test["Close"] * (1 + test["target"])
    pred = test["Close"] * (1 + model.predict(test[FEATS]))
    naive = test["Close"]
    mae_m = float(np.mean(np.abs(pred - actual)))
    mae_n = float(np.mean(np.abs(naive - actual)))
    moved = test["target"].abs() > 0.01
    dir_acc = float(np.mean(np.sign(model.predict(test.loc[moved, FEATS]))
                            == np.sign(test.loc[moved, "target"])) * 100)

    metrics = {
        "train_rows": int(len(train)), "test_rows": int(len(test)),
        "train_period": f"{train['Date'].min():%Y-%m} to {train['Date'].max():%Y-%m}",
        "test_period": f"{test['Date'].min():%Y-%m} to {test['Date'].max():%Y-%m}",
        "mae_model": round(mae_m, 3), "mae_naive": round(mae_n, 3),
        "mape_model": round(float(np.mean(np.abs(pred - actual) / actual) * 100), 2),
        "mape_naive": round(float(np.mean(np.abs(naive - actual) / actual) * 100), 2),
        "improvement_pct": round((1 - mae_m / mae_n) * 100, 1),
        "direction_accuracy_pct": round(dir_acc, 1),
        "markets": int(df["Market"].nunique()), "products": PRODUCTS,
    }
    return model, metrics


if __name__ == "__main__":
    model, metrics = train_and_evaluate()
    MODEL_PATH.parent.mkdir(exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2))
    print(json.dumps(metrics, indent=2))
    print("saved", MODEL_PATH)
