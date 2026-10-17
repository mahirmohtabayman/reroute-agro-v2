# Bangla / English localisation

The interface is written in Bangla. English mode translates what is on screen, in the browser, at three levels:

1. **Sentence catalogue** — `web/1b_i18n_catalog.js`, one `["বাংলা", "English"]` pair per line.
   `{}` stands for a value inside the sentence (a number, name, crop, date); `{#}` for a number with an optional
   unit, when it sits next to a name. Values are translated on their own, names stay as written. Use `{1}`,
   `{0}` in the English text when English needs a different order.
2. **Phrases** — `I18N_UI_FIXES` / `I18N_PHRASES` in `web/1_i18n.js` and page files (older, still used).
3. **Words** — `I18N_WORDS`, used only when the whole text can be translated; otherwise the text stays in
   its original language, so a sentence is never half Bangla and half English.

A `MutationObserver` translates new nodes, changed text and changed `aria-label`/`title`/`placeholder`/`alt`
attributes, so modals, toasts and live updates follow the selected language. Elements with
`data-i18n-skip` (for example the language button, phone numbers, the user's own assistant questions) are
never translated.

## Adding or changing interface text
1. Write the Bangla text in the page code as usual.
2. Add the English sentence to `web/1b_i18n_catalog.js` (exact text, with `{}` for values).
3. Server messages (`HTTPException`, `fail`, `notify` in `app/*.py`) must also be in the catalogue —
   `tests/test_i18n.py` fails if one is missing.
4. `python build.py`, then check the page in both languages.

## Terminology
| English | বাংলা |
|---|---|
| Dashboard | ড্যাশবোর্ড |
| Marketplace / Market | বাজার |
| My Listings | আমার লিস্টিং |
| Offers & Orders | অফার ও অর্ডার |
| Transportation | পরিবহন |
| Stock & Accounts | মজুদ ও হিসাব |
| Smart Hisab | স্মার্ট হিসাব |
| AI Advisor | এআই পরামর্শ |
| Points & Wallet | পয়েন্ট ও ওয়ালেট |
| Wallet Balance | ওয়ালেট ব্যালেন্স |
| Total Sales | মোট বিক্রয় |
| Total Expenses | মোট খরচ |
| Net Profit | নিট লাভ |
| Receivable / Payable | পাওনা / দেনা |
| Invoice / Receipt | ইনভয়েস (বিল) / রসিদ |
| Wholesaler | পাইকার |

Not translated on purpose: people's and business names, upazila/market names typed by users, truck numbers,
user notes, invoice/receipt numbers, OTP codes, the brand "Reroute Agro". Invoice, receipt and report PDFs and
the admin dataset CSV are Bangla only.
