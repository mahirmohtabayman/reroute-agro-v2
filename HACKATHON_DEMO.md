# Hackathon Demo — 3 minutes

Run the demo on a **separate demo deployment** (`APP_ENV=demo`, `ENABLE_DEMO_MODE=true`, its own Neon database;
see DEPLOYMENT_GUIDE.md §4). Never demo on the production database.

## Before the session (5 minutes earlier)
1. Open the site once so Render wakes up (free tier sleeps).
2. Reset the demo data: log in as the demo admin (role "অপারেশন", phone `01300000000`, password =
   `DEMO_ADMIN_PASSWORD`) → footer button **ডেমো নতুন করে শুরু**.
3. Open these tabs in order:
   - Tab A: `/#/login` → farmer → **রহিম উদ্দিন** (one click)
   - Tab B (other browser profile / private window): `/#/login` → paikar → **ঢাকা ফ্রেশ হাব**
   - Tab C: `/#/impact`
4. Keep the phone mirror (or browser at 390 px) ready if you want to show mobile.

## Script

**0:00–0:30 — The problem.** Home page headline: *আপনার ফসল, সঠিক বাজার, ভালো সিদ্ধান্ত।*
"Farmers sell at the nearest haat on glut days while a market three hours away pays more. They don't know
which market leaves them more money after transport and spoilage, and trucks are booked one by one."

**0:30–1:00 — AI market recommendation (Tab A → AI পরামর্শ).**
- Type or say (Chrome, microphone allowed): *আমার ২০ মণ টমেটো কোন বাজারে বিক্রি করলে বেশি লাভ হবে?* →
  **বুঝে নিন** → it shows what it understood (crop, quantity, district) → **পরামর্শ দেখুন**.
- Point at the Smart Selling panel: decision (sell now / another market / wait / insufficient evidence),
  revenue, transport, other costs, **net proceeds**, profit only when production cost is entered, advantage
  over the alternative, *কেন এই বাজার?* reasons built from the numbers, spoilage risk.
- Open *ডেটার উৎস ও মডেল*: "Market prices are **simulated** for the prototype; the model is evaluated on a
  time-ordered back-test; this is decision support, not a guarantee."

**1:00–1:40 — List and negotiate.**
- Tab A: **এই দামে লিস্টিং দিন** (pre-filled price) → publish. Or use the existing listing.
- Tab B (paikar): Market → the listing → make an offer below the asking price. The Smart Trade Alert shows the
  deal's profit/loss before sending.
- Tab A: dashboard *আজকের কাজের কেন্দ্র* shows the new offer → open it → the deal timeline → **পাল্টা দাম**.
- Tab B: accept the counter.

**1:40–2:20 — Transport and simulated payment.**
- Transport cost split proposal → accept (Tab A).
- Tab B: pay with bKash, **PIN 12345**. Say clearly: "This is a **simulated** payment — no real money moves."
- Admin tab (optional): `/#/admin/pool` — two bookings on the same route and day share one truck; each pays its
  weight share; savings per booking are shown, with the estimated distance method.

**2:20–2:45 — Smart Hisab, invoice and voice.**
- Tab A: **স্মার্ট হিসাব** → *বিল/রসিদ*: the new order already has an invoice (`RA-2026-…`); open it → status
  comes from the simulated payment receipt → **PDF ডাউনলোড** / **প্রিন্ট** / **শেয়ার**.
- *হিসাব* tab: sales, costs, profit/loss. If a cost is missing it says *লাভের হিসাব সম্পূর্ণ নয়* instead of
  inventing a profit — "we never guess money".
- *আয়-ব্যয়*: add an outside sale or a labour cost → it is labelled *নিজে লেখা (যাচাই করা নয়)*.
- Press the green microphone button (bottom right) and say or type *আমার শেষ তিনটা বিল দেখাও* or
  *আমার কত টাকা পাওনা আছে?* — answers come only from this user's records; the assistant never makes a payment.

**2:45–3:00 — Impact and data.**
- Tab A dashboard: money in motion, wallet, profit/loss box.
- Tab C `/#/impact`: farmers, buyers, completed orders, volume, transport savings, simulated extra net
  proceeds, shared-truck share, spoilage-risk sales — **demo vs registered counts are separated** and every
  metric has *কীভাবে হিসাব* (how it is calculated).
- Data strategy (one sentence): "Every completed trade becomes a verified first-party price record; demo,
  manual and simulated data are labelled separately and never used for training — the admin can export only
  eligible real trades, without personal data."
- Close: "Real SMS OTP, real payment gateway and real daily market prices are the next steps."

## Fallback plan
| Problem | What to do |
|---|---|
| Render is asleep / slow | Open the site earlier; if still down, run locally: `APP_ENV=development ENABLE_DEMO_MODE=true DEMO_ADMIN_PASSWORD=… uvicorn app.main:app` and use `http://localhost:8000` |
| No internet at the venue | Local run above works fully offline (SQLite, local models); Google Fonts fall back to the bundled Kalpurush font |
| Microphone blocked / Firefox | Type the question in the same box (voice is optional) |
| PDF download blocked by the browser | Use **প্রিন্ট** on the invoice page (prints only the invoice) |
| AI says "AI প্রস্তুত হচ্ছে" | Wait ~10 s after a cold start; refresh |
| Demo data got messy | Admin footer button **ডেমো নতুন করে শুরু** (demo deployment only) |
| Everything fails | Screenshots in `docs/screenshots/` and the browser smoke test output (`tests/e2e/smoke.mjs`) |

## Demo accounts (demo deployments only)
| Role | Account | Login |
|---|---|---|
| Farmer | রহিম উদ্দিন, করিমা বেগম, হালিমা খাতুন | one click, or phone + `123456` |
| Paikar | করিম ট্রেডার্স, ঢাকা ফ্রেশ হাব, বগুড়া সবজি ঘর | one click, or phone + `123456` |
| Operations | `01300000000` | password = `DEMO_ADMIN_PASSWORD` (no one-click) |

All people, businesses and phone numbers in the demo data are fictional.
