"""
Reroute Agro: simulated vegetable wholesale market dataset (Rajshahi belt + Bogura + Dhaka)
=========================================================================================
SIMULATED DATA. Real daily vegetable prices per market are not openly available, so this
generator builds a realistic stand-in for the prototype. It encodes how these markets behave:

* Seasons: each crop's price follows a monthly pattern (e.g. tomato is cheapest in the winter
  harvest, Dec–Mar, and dearest in the monsoon; chili spikes when rain damages fields).
* Supply drives price: when more produce arrives than usual, the price falls
  (price ∝ (arrivals / normal)^-0.9 in producing districts).
* Harvest gluts: a few times each season a producing district is flooded with one crop for
  3–7 days and its price crashes, while other markets stay higher. This is the problem
  Reroute Agro solves.
* Markets are linked: Bogura (hub) and Dhaka (consumer) prices follow the producing belt with
  a one-day lag, plus transport cost (which follows the diesel price) and a trade margin.
* Weather: monthly temperature, rainfall and humidity are taken from the real
  Food Commodity Price (OHLC) Dataset of Bangladesh for these districts; heavy rain cuts
  arrivals for a day or two.
* Calendar: Ramadan, Eid-ul-Fitr and Eid-ul-Adha change demand; transport disruptions
  (blockades, curfews, floods) make Dhaka dearer and the belt cheaper because goods cannot move;
  onion import shocks push onion prices up for weeks; prices rise ~7% a year.

Every day uses its own random seed, so history never changes when newer days are added.
Run:  python -m ml.vegsim      → data/simulated/veg_prices_bd_sim.csv
"""
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

SEED = 2026
START = date(2021, 1, 1)
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "simulated" / "veg_prices_bd_sim.csv"

MARKETS = {  # id: (name, type, price offset, volume scale, km to Dhaka)
    "rajshahi": ("রাজশাহী", "producer", 1.00, 1.2, 262),
    "chapai": ("চাঁপাইনবাবগঞ্জ", "producer", 0.97, 0.7, 300),
    "naogaon": ("নওগাঁ", "producer", 1.01, 0.8, 232),
    "natore": ("নাটোর", "producer", 1.03, 0.9, 214),
    "bogura": ("বগুড়া", "hub", 1.00, 1.6, 196),
    "dhaka": ("ঢাকা (কারওয়ান বাজার)", "consumer", 1.00, 4.0, 0),
}
BELT = ["rajshahi", "chapai", "naogaon", "natore"]
CROPS = {  # monthly wholesale price in the producing belt, Tk/kg at 2021 prices (Jan..Dec); base tons/day
    "tomato":   ([14, 12, 13, 18, 28, 40, 55, 62, 60, 48, 30, 18], 80),
    "brinjal":  ([20, 18, 20, 26, 30, 34, 38, 40, 36, 30, 24, 22], 60),
    "chili":    ([45, 40, 45, 55, 70, 95, 120, 110, 90, 70, 55, 50], 15),
    "cucumber": ([28, 24, 20, 18, 20, 26, 30, 34, 36, 32, 30, 30], 40),
    "carrot":   ([18, 16, 18, 30, 45, 55, 60, 60, 55, 45, 30, 22], 30),
    "onion":    ([32, 30, 28, 26, 30, 36, 40, 44, 48, 50, 45, 38], 70),
    "potato":   ([16, 12, 11, 12, 14, 17, 20, 22, 24, 26, 24, 20], 200),
}
GLUT_MONTHS = {"tomato": [12, 1, 2, 3], "brinjal": [11, 12, 1, 2], "cucumber": [3, 4, 5],
               "carrot": [12, 1, 2], "potato": [2, 3]}
DHAKA_MARGIN = {"onion": 1.12, "potato": 1.12}
# selling costs at the destination besides Reroute's 1% fee: trader margin, commission, labour, tolls
MARKET_COST = {"local": 0.04, "producer": 0.05, "hub": 0.06, "consumer": 0.08}
# produce lost per day while waiting to sell (no cold storage)
STORAGE_LOSS = {"tomato": 0.04, "brinjal": 0.03, "chili": 0.05, "cucumber": 0.04, "carrot": 0.02,
                "onion": 0.005, "potato": 0.003}  # storable crops: thinner margin; others 1.18

# real monthly climate (mean of 2007–2025) from the Food Commodity Price (OHLC) Dataset of Bangladesh
CLIMATE = {
    "belt": {"T": [18.4, 21.5, 26.2, 29.5, 29.8, 30.4, 30.0, 30.1, 29.9, 27.8, 23.8, 19.7],
             "R": [13.7, 18.2, 27.3, 66.5, 149.1, 179.6, 236.1, 213.2, 193.6, 106.6, 10.9, 10.6],
             "H": [80.9, 74.8, 68.3, 70.7, 77.7, 82.5, 85.5, 85.4, 86.0, 83.8, 79.4, 81.7]},
    "bogura": {"T": [19.0, 22.0, 26.0, 28.4, 28.9, 29.6, 29.7, 29.7, 29.7, 28.2, 24.8, 20.5],
               "R": [15.1, 23.4, 28.8, 71.4, 216.3, 282.7, 270.7, 272.3, 219.7, 128.9, 8.9, 9.9],
               "H": [78.4, 70.5, 66.9, 71.7, 76.2, 81.2, 82.6, 82.7, 82.9, 80.3, 74.6, 78.9]},
    "dhaka": {"T": [20.3, 23.3, 27.3, 29.4, 29.6, 29.8, 29.6, 29.7, 29.7, 28.5, 25.2, 21.4],
              "R": [15.8, 30.2, 40.9, 120.8, 207.6, 321.8, 356.7, 304.6, 206.6, 172.2, 26.5, 26.1],
              "H": [69.9, 61.5, 59.9, 67.6, 73.1, 78.5, 79.8, 79.9, 79.6, 75.6, 69.4, 72.7]},
}
# approximate Bangladesh calendar (start of Ramadan, Eid-ul-Fitr, Eid-ul-Adha)
FESTIVALS = {
    2021: ("2021-04-14", "2021-05-14", "2021-07-21"), 2022: ("2022-04-03", "2022-05-03", "2022-07-10"),
    2023: ("2023-03-24", "2023-04-22", "2023-06-29"), 2024: ("2024-03-12", "2024-04-11", "2024-06-17"),
    2025: ("2025-03-02", "2025-03-31", "2025-06-07"), 2026: ("2026-02-19", "2026-03-20", "2026-05-27"),
    2027: ("2027-02-08", "2027-03-10", "2027-05-17"),
}
DIESEL = [("2021-01-01", 65), ("2021-11-04", 80), ("2022-08-06", 114), ("2022-08-29", 109),
          ("2024-03-01", 108), ("2024-10-01", 105), ("2025-03-01", 104)]  # approx. Tk/litre
DISRUPTIONS = [("2023-10-29", "2023-12-10", 0.5), ("2024-07-19", "2024-08-06", 0.8)]  # (start, end, share of days)
ONION_SHOCKS = [("2023-06-05", 0.40, 30), ("2023-12-08", 0.90, 45), ("2025-09-20", 0.30, 25)]  # (date, jump, decay days)
CROP_IDS = list(CROPS)
MKT_IDS = list(MARKETS)


def _d(s):
    return date.fromisoformat(s)


def seasonal(values, d):
    """Smooth value for a day from 12 mid-month anchor values (cyclic)."""
    x = (d.month - 1) + (d.day - 0.5) / 30.5 - 0.5
    i = int(np.floor(x)) % 12
    f = x - np.floor(x)
    f = (1 - np.cos(np.pi * f)) / 2
    return values[i] * (1 - f) + values[(i + 1) % 12] * f


def festival(d):
    out = {"ramadan": 0, "eid_fitr": 0, "eid_adha_week": 0, "eid_holiday": 0}
    for y in (d.year - 1, d.year, d.year + 1):
        if y not in FESTIVALS:
            continue
        ram, fitr, adha = map(_d, FESTIVALS[y])
        if ram <= d < fitr:
            out["ramadan"] = 1
        if fitr - timedelta(days=3) <= d < fitr:
            out["eid_fitr"] = 1
        if adha - timedelta(days=7) <= d < adha:
            out["eid_adha_week"] = 1
        if d in (fitr, fitr + timedelta(days=1), adha, adha + timedelta(days=1)):
            out["eid_holiday"] = 1
    return out


def diesel(d):
    v = DIESEL[0][1]
    for s, p in DIESEL:
        if d >= _d(s):
            v = p
    return v


def events_for_year(year):
    """Gluts and random one-day disruptions for a year (seeded by year: never depends on the end date)."""
    rng = np.random.default_rng([SEED, year, 7])
    gluts = []
    for crop, months in GLUT_MONTHS.items():
        for m in BELT:
            for _ in range(rng.integers(1, 4)):
                month = int(rng.choice(months))
                y = year if not (month == 12 and months[0] == 12 and False) else year
                start = date(y, month, int(rng.integers(1, 25)))
                gluts.append((m, crop, start, start + timedelta(days=int(rng.integers(3, 8))), float(rng.uniform(1.4, 1.9))))
    singles = [date(year, int(rng.integers(1, 13)), int(rng.integers(1, 28))) for _ in range(rng.integers(3, 6))]
    return gluts, singles


def simulate(end=None):
    end = end or date.today()
    days = (end - START).days + 1
    n_m, n_c = len(MKT_IDS), len(CROP_IDS)
    e_supply = np.zeros((n_m, n_c))
    e_price = np.zeros((n_m, n_c))
    e_temp = np.zeros(n_m)
    rain_yday = np.zeros(n_m)
    prev_belt = None
    year_events = {}
    disrupt_days = set()
    for s, e, share in DISRUPTIONS:
        rng = np.random.default_rng([SEED, _d(s).toordinal()])
        d = _d(s)
        while d <= _d(e):
            if rng.random() < share:
                disrupt_days.add(d)
            d += timedelta(days=1)
    rows = []
    for t in range(days):
        d = START + timedelta(days=t)
        if d.year not in year_events:
            year_events[d.year] = events_for_year(d.year)
            disrupt_days.update(year_events[d.year][1])
        gluts = year_events[d.year][0]
        rng = np.random.default_rng([SEED, t])
        years = t / 365.25
        infl = 1.07 ** years
        fest = festival(d)
        dsl = diesel(d)
        disrupt = d in disrupt_days
        # ---- weather per market
        temp = np.zeros(n_m)
        rain = np.zeros(n_m)
        hum = np.zeros(n_m)
        e_temp = 0.7 * e_temp + rng.normal(0, 0.9, n_m)
        for i, m in enumerate(MKT_IDS):
            cl = CLIMATE["dhaka" if m == "dhaka" else "bogura" if m == "bogura" else "belt"]
            temp[i] = seasonal(cl["T"], d) + e_temp[i] + (0.4 if m == "chapai" else 0)
            month_mm = seasonal(cl["R"], d)
            p_rain = min(0.85, month_mm / 12 / 30.5)
            if rng.random() < p_rain:
                rain[i] = rng.gamma(0.9, 12 / 0.9)
            hum[i] = min(99, seasonal(cl["H"], d) + rng.normal(0, 3) + (6 if rain[i] > 5 else 0))
        heavy = (rain > 40) | (rain_yday > 40)
        # ---- supply (arrivals)
        e_supply = 0.85 * e_supply + rng.normal(0, 0.08, (n_m, n_c))
        e_price = 0.75 * e_price + rng.normal(0, 0.035, (n_m, n_c))
        arrivals = np.zeros((n_m, n_c))
        expected = np.zeros((n_m, n_c))
        glut_flag = np.zeros((n_m, n_c), dtype=int)
        for j, c in enumerate(CROP_IDS):
            prof, base_t = CROPS[c]
            pm = np.mean(prof)
            season_supply = (pm / seasonal(prof, d)) ** 1.1
            for i, m in enumerate(MKT_IDS):
                exp_v = base_t * MARKETS[m][3] * season_supply
                mult = np.exp(e_supply[i, j])
                for gm, gc, gs, ge, gx in gluts:
                    if gm == m and gc == c and gs <= d <= ge:
                        mult *= gx
                        glut_flag[i, j] = 1
                if heavy[i]:
                    mult *= 0.75
                if fest["eid_holiday"]:
                    mult *= 0.35
                if disrupt and m in ("dhaka", "bogura"):
                    mult *= 0.6 if m == "dhaka" else 0.8
                expected[i, j] = exp_v
                arrivals[i, j] = exp_v * mult
        # ---- prices
        price = np.zeros((n_m, n_c))
        for j, c in enumerate(CROP_IDS):
            prof, _ = CROPS[c]
            base = seasonal(prof, d) * infl
            fm = 1.0
            if fest["ramadan"]:
                fm *= {"brinjal": 1.25, "cucumber": 1.35, "chili": 1.15, "onion": 1.12, "tomato": 1.08}.get(c, 1.0)
            if fest["eid_adha_week"]:
                fm *= {"onion": 1.20, "chili": 1.30}.get(c, 1.0)
            if fest["eid_fitr"]:
                fm *= {"onion": 1.08, "chili": 1.10}.get(c, 1.0)
            if c == "onion":
                for s, jump, decay in ONION_SHOCKS:
                    k = (d - _d(s)).days
                    if 0 <= k < 3 * decay:
                        fm *= 1 + jump * np.exp(-k / decay) * min(1, (k + 1) / 5)
            for i, m in enumerate(MKT_IDS):
                if MARKETS[m][1] == "producer":
                    p = base * MARKETS[m][2] * (arrivals[i, j] / expected[i, j]) ** -0.9 * fm * np.exp(e_price[i, j])
                    if disrupt:
                        p *= 0.88
                    price[i, j] = p
            # spillover: a glut anywhere in the belt pulls the other belt markets down a little
            belt_idx = [MKT_IDS.index(m) for m in BELT]
            if glut_flag[belt_idx, j].any():
                for i in belt_idx:
                    if not glut_flag[i, j]:
                        price[i, j] *= 0.95
            ref = prev_belt[:, j] if prev_belt is not None else price[belt_idx, j]
            w = arrivals[belt_idx, j] / arrivals[belt_idx, j].sum()
            belt_ref = float(np.sum(ref * w))
            for m in ("bogura", "dhaka"):
                i = MKT_IDS.index(m)
                km = 100 if m == "bogura" else MARKETS["rajshahi"][4]
                tcost = (0.5 + 0.011 * km) * dsl / 80
                if m == "bogura":
                    p = (belt_ref * 1.04 + tcost) * (arrivals[i, j] / expected[i, j]) ** -0.4
                    if disrupt:
                        p *= 1.05
                else:
                    p = (belt_ref * DHAKA_MARGIN.get(c, 1.18) + tcost) * (arrivals[i, j] / expected[i, j]) ** -0.35
                    if disrupt:
                        p *= 1.25
                price[i, j] = p * fm ** 0.5 * np.exp(0.6 * e_price[i, j])
        prev_belt = price[[MKT_IDS.index(m) for m in BELT], :].copy()
        rain_yday = rain
        spread = rng.uniform(0.06, 0.15, (n_m, n_c))
        for i, m in enumerate(MKT_IDS):
            for j, c in enumerate(CROP_IDS):
                modal = round(price[i, j] * 2) / 2
                rows.append((d.isoformat(), m, MARKETS[m][1], c, modal,
                             round(modal * (1 - spread[i, j]) * 2) / 2, round(modal * (1 + spread[i, j]) * 2) / 2,
                             round(arrivals[i, j], 1), round(expected[i, j], 1), round(temp[i], 1), round(rain[i], 1),
                             round(hum[i]), dsl, fest["ramadan"], fest["eid_fitr"] or fest["eid_adha_week"],
                             fest["eid_holiday"], int(disrupt), int(glut_flag[i, j])))
    cols = ["date", "market", "market_type", "crop", "price_tk_kg", "price_min", "price_max", "arrivals_ton",
            "normal_arrivals_ton", "temperature_c", "rainfall_mm", "humidity_pct", "diesel_tk_l", "ramadan",
            "pre_eid", "eid_holiday", "transport_disruption", "glut_event"]
    df = pd.DataFrame(rows, columns=cols)
    df["date"] = pd.to_datetime(df["date"])
    return df


if __name__ == "__main__":
    import sys
    end = date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else date.today()
    df = simulate(end)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    df.assign(data_source="simulated").to_csv(OUT, index=False, date_format="%Y-%m-%d")
    print(f"{len(df):,} rows, {df.date.min():%Y-%m-%d} → {df.date.max():%Y-%m-%d}  →  {OUT}")
