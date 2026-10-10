# Simulated vegetable wholesale market data (Bangladesh, prototype)

**SIMULATED DATA. Not real prices.** Every row has `data_source = simulated`.
Real daily vegetable prices per market are not openly available, so `ml/vegsim.py` generates a
realistic stand-in to build and demonstrate the AI advisor. In the pilot it will be replaced by
the Department of Agricultural Marketing (DAM) daily prices.

| | |
|---|---|
| Markets | রাজশাহী, চাঁপাইনবাবগঞ্জ, নওগাঁ, নাটোর (producing belt), বগুড়া (hub), ঢাকা কারওয়ান বাজার (consumer) |
| Crops | tomato, brinjal, chili, cucumber, carrot, onion, potato |
| Period | 2021-01-01 → generation date, daily (88,536 rows to 2026-10-09) |

## Columns
| column | meaning |
|---|---|
| date, market, market_type, crop | |
| price_tk_kg, price_min, price_max | wholesale modal / low / high price, Tk per kg |
| arrivals_ton, normal_arrivals_ton | produce that arrived today vs. a normal day |
| temperature_c, rainfall_mm, humidity_pct | daily weather |
| diesel_tk_l | diesel price (approx. Bangladesh history) |
| ramadan, pre_eid, eid_holiday | calendar flags |
| transport_disruption | blockade / curfew / flood day |
| glut_event | a harvest glut in this market |

## How it behaves (rules in `ml/vegsim.py`)
- Monthly price pattern per crop (e.g. tomato cheapest Dec–Mar, dearest in the monsoon).
- Price falls when arrivals exceed normal (producing markets: price ∝ (arrivals/normal)^-0.9).
- Harvest gluts: 3–7 days of 1.4–1.9× arrivals in one district, price crashes, neighbours dip.
- Bogura and Dhaka follow the belt with a one-day lag + transport cost (follows diesel) + trade margin.
- Weather: monthly means from the real *Food Commodity Price (OHLC) Dataset of Bangladesh*; heavy rain cuts arrivals.
- Ramadan / Eid demand, onion import shocks, transport disruptions, ~7% yearly inflation.
- Each day has its own random seed, so history never changes when newer days are added.
