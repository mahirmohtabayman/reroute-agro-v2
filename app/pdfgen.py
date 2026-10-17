"""PDF invoices, receipts and reports with readable Bengali (fpdf2 + HarfBuzz text shaping, Noto Sans Bengali).

Generated on request from the preserved invoice snapshot, so the same invoice always prints the same; nothing is
written to disk (Render's disk is temporary).
"""
from pathlib import Path

from app.logic import bn

FONTS = Path(__file__).resolve().parent / "fonts"
BRAND = (23, 61, 50)
MUTED = (94, 108, 99)
LINE = (225, 231, 223)
SOFT = (238, 242, 234)
SIDE_BN = {"seller": "বিক্রেতার কপি", "buyer": "ক্রেতার কপি", "admin": "অফিস কপি"}


def money(x, d=2):
    x = float(x or 0)
    return ("−" if x < 0 else "") + "৳" + bn(abs(x), d if abs(x) % 1 else 0)


class Doc:
    def __init__(self, title, subtitle):
        from fpdf import FPDF                      # imported on demand: keeps server start-up light
        self.pdf = p = FPDF(format="A4", unit="mm")
        p.set_auto_page_break(True, margin=18)
        p.add_font("bn", "", str(FONTS / "NotoSansBengali-Regular.ttf"))
        p.add_font("bn", "B", str(FONTS / "NotoSansBengali-Bold.ttf"))
        p.set_text_shaping(True)
        p.set_title(title)
        p.set_creator("Reroute Agro")
        p.add_page()
        p.set_fill_color(*BRAND)
        p.rect(0, 0, 210, 26, "F")
        p.set_text_color(255, 255, 255)
        p.set_xy(12, 6)
        p.set_font("bn", "B", 16)
        p.cell(100, 8, "Reroute Agro")
        p.set_font("bn", "B", 13)
        p.set_xy(98, 6)
        p.cell(100, 8, title, align="R")
        p.set_font("bn", "", 9)
        p.set_xy(12, 14)
        p.cell(100, 6, "কৃষক ও পাইকারের পাইকারি বাজার")
        p.set_xy(98, 14)
        p.cell(100, 6, subtitle, align="R")
        p.set_text_color(28, 41, 34)
        p.set_y(32)

    def h(self, text, size=11):
        p = self.pdf
        p.ln(2)
        p.set_font("bn", "B", size)
        p.cell(0, 7, text, new_x="LMARGIN", new_y="NEXT")
        p.set_draw_color(*LINE)
        p.line(p.l_margin, p.get_y(), 210 - p.r_margin, p.get_y())
        p.ln(1.5)

    def kv(self, rows, w=55):
        p = self.pdf
        for k, v in rows:
            p.set_font("bn", "", 9.5)
            p.set_text_color(*MUTED)
            p.cell(w, 6.2, k)
            p.set_text_color(28, 41, 34)
            p.set_font("bn", "B", 9.5)
            p.multi_cell(0, 6.2, str(v), new_x="LMARGIN", new_y="NEXT")

    def two(self, left_title, left, right_title, right):
        p = self.pdf
        y = p.get_y()
        for i, (t, rows) in enumerate(((left_title, left), (right_title, right))):
            x = 12 + i * 96
            p.set_xy(x, y)
            p.set_font("bn", "B", 10)
            p.cell(90, 6, t)
            for j, r in enumerate(rows):
                p.set_xy(x, y + 6 + j * 5.4)
                p.set_font("bn", "B" if j == 0 else "", 9.5 if j == 0 else 8.8)
                p.cell(90, 5.4, r)
        p.set_y(y + 8 + max(len(left), len(right)) * 5.4)

    def table(self, head, rows, widths, align=None, total_rows=0):
        p = self.pdf
        align = align or ["L"] + ["R"] * (len(head) - 1)
        p.set_font("bn", "B", 9)
        p.set_fill_color(*SOFT)
        for h, w, a in zip(head, widths, align):
            p.cell(w, 7.5, h, border=0, align=a, fill=True)
        p.ln()
        for i, r in enumerate(rows):
            last = i >= len(rows) - total_rows
            p.set_font("bn", "B" if last else "", 9)
            if last:
                p.set_draw_color(*LINE)
                p.line(p.l_margin, p.get_y(), p.l_margin + sum(widths), p.get_y())
            for c, w, a in zip(r, widths, align):
                p.cell(w, 6.8, str(c), align=a)
            p.ln()

    def note(self, text, size=8.5):
        p = self.pdf
        p.ln(2)
        p.set_font("bn", "", size)
        p.set_text_color(*MUTED)
        p.multi_cell(0, 5, text, new_x="LMARGIN", new_y="NEXT")
        p.set_text_color(28, 41, 34)

    def bytes(self):
        return bytes(self.pdf.output())


def party_lines(x):
    name = x["biz"] if x["role"] == "paikar" and x.get("biz") else x["name"]
    lines = [name]
    if x["role"] == "paikar" and x.get("biz"):
        lines.append(x["name"])
    lines.append(", ".join(v for v in (x.get("area"), x.get("district")) if v))
    if x.get("market"):
        lines.append(f"বাজার: {x['market']}")
    return lines


def invoice_pdf(v):
    d = Doc("ইনভয়েস / INVOICE", f"{v['number']} · {SIDE_BN[v['side']]}")
    d.kv([("ইনভয়েস নম্বর", v["number"]), ("তারিখ", v["issued_date"]), ("অর্ডার", v["order_id"]),
          ("পেমেন্টের অবস্থা", v["status_bn"]), ("লেনদেনের অবস্থা", ORDER_BN.get(v["order_status"], v["order_status"] or "—")),
          ("ডেটার ধরন", "ডেমো লেনদেন" if v["data_class"] == "demo" else "প্ল্যাটফর্ম লেনদেন")])
    d.pdf.ln(2)
    d.two("বিক্রেতা", party_lines(v["seller"]), "ক্রেতা", party_lines(v["buyer"]))
    d.h("পণ্য")
    d.table(["পণ্য", "গ্রেড", "পরিমাণ", "দাম / কেজি", "মোট"],
            [[v["crop_bn"], v.get("grade") or "—", f"{bn(v['qty_kg'])} কেজি ({bn(v['qty_mon'], 2)} মণ)",
              money(v["unit_price"]), money(v["goods"])]], [58, 18, 50, 32, 28])
    d.h("ক্রেতার হিসাব")
    buyer_rows = [["মালের দাম", money(v["goods"])]]
    if v["transport"] == "reroute":
        buyer_rows.append(["Reroute ট্রাক ভাড়া (ক্রেতার ভাগ)", money(v["t_buyer"])])
        if v["t_cb"]:
            buyer_rows.append(["পরিবহন ক্রেডিট", money(-v["t_cb"])])
    else:
        buyer_rows.append(["পরিবহন", "ক্রেতা নিজে"])
    buyer_rows.append(["মোট পরিশোধযোগ্য", money(v["buyer_total"])])
    d.table(["বিবরণ", "টাকা"], buyer_rows, [146, 40], total_rows=1)
    d.h("বিক্রেতার হিসাব")
    seller_rows = [["মালের দাম", money(v["goods"])], ["প্ল্যাটফর্ম ফি (১%)", money(-(v["fee"] - v["fee_disc"]))]]
    if v["transport"] == "reroute" and v["t_seller"]:
        seller_rows.append(["Reroute ট্রাক ভাড়া (বিক্রেতার ভাগ)", money(-(v["t_seller"] - v["t_cs"]))])
    seller_rows.append(["বিক্রেতা পাবেন", money(v["payout"])])
    d.table(["বিবরণ", "টাকা"], seller_rows, [146, 40], total_rows=1)
    d.h("পেমেন্ট")
    d.kv([("পরিশোধ করা হয়েছে", money(v["paid"])), ("বাকি", money(v["outstanding"])),
          ("বিক্রেতার প্রাপ্তি", {"received": f"পেয়েছেন {money(v['payout_received'])}", "pending": "মাল বুঝে দিলে পাবেন",
                                  "not_due": "পেমেন্টের অপেক্ষা", "cancelled": "বাতিল"}[v["seller_settlement"]])])
    if v["receipts"]:
        d.table(["রসিদ", "তারিখ", "ধরন", "টাকা"],
                [[r["number"], r["date"], r["kind_bn"], money(r["amount"])] for r in v["receipts"]], [48, 30, 70, 38],
                ["L", "L", "L", "R"])
    for a in v["adjustments"]:
        d.note(f"সমন্বয় ({a['date']}): {'অর্ডার বাতিল' if a['kind'] == 'cancelled' else a['kind']} · {money(a['amount'])} · {a['note'] or ''}")
    d.note(v["payment_note"] + " এই ইনভয়েস Reroute Agro প্রোটোটাইপ থেকে তৈরি, কর-চালান নয়।")
    return d.bytes()


ORDER_BN = {"awaiting_payment": "পেমেন্টের অপেক্ষা", "confirmed": "নিশ্চিত", "handed_over": "মাল হস্তান্তর হয়েছে",
            "completed": "সম্পন্ন", "cancelled": "বাতিল"}


def receipt_pdf(r, owner_name):
    d = Doc("রসিদ / RECEIPT", r["number"])
    d.kv([("রসিদ নম্বর", r["number"]), ("তারিখ", r["date"]), ("ধরন", r["kind_bn"]), ("টাকা", money(r["amount"])),
          ("পদ্ধতি", r["method"] or "—"), ("রেফারেন্স", r["ref"] or "—"), ("ইনভয়েস", r["invoice_number"] or "—"),
          ("অ্যাকাউন্ট", owner_name), ("যাচাই", r["verification_bn"])])
    if r["note"]:
        d.note(r["note"], 9.5)
    d.note("সিমুলেটেড রসিদে কোনো আসল টাকা লেনদেন হয়নি। নিজে লেখা রসিদ ব্যবহারকারীর দেওয়া তথ্য, Reroute যাচাই করেনি।")
    return d.bytes()


def report_pdf(rep, user):
    d = Doc("হিসাবের রিপোর্ট", f"{rep['start'] or 'শুরু'} — {rep['end'] or 'আজ'}")
    name = user["biz"] if user["role"] == "paikar" and user.get("biz") else user["name"]
    p = rep["pnl"]
    d.kv([("অ্যাকাউন্ট", name), ("সময়", f"{rep['start'] or 'শুরু'} থেকে {rep['end'] or 'আজ'}")])
    d.h("লাভ-ক্ষতি")
    rows = [["বিক্রি (প্ল্যাটফর্ম)", money(p["revenue_platform"])], ["বিক্রি (নিজে লেখা)", money(p["revenue_external"])],
            ["ক্যাশব্যাক", money(p["other_income"])], ["বিক্রি হওয়া মালের খরচ", money(-p["cost_of_goods"])],
            ["খরচ", money(-p["total_expenses"])],
            ["লাভ / ক্ষতি", money(p["profit"]) if p["profit_complete"] else "হিসাব সম্পূর্ণ নয়"]]
    d.table(["বিবরণ", "টাকা"], rows, [146, 40], total_rows=1)
    if not p["profit_complete"]:
        d.note(p["profit_message"])
    if rep["sales"]:
        d.h("সময় অনুযায়ী বিক্রি")
        d.table(["সময়", "লেনদেন", "পরিমাণ (কেজি)", "বিক্রি"],
                [[r["period"], bn(r["count"]), bn(r["kg"]), money(r["revenue"])] for r in rep["sales"]], [60, 30, 46, 50])
    if rep["products"]:
        d.h("পণ্য অনুযায়ী বিক্রি")
        d.table(["ফসল", "পরিমাণ (কেজি)", "গড় দাম/কেজি", "বিক্রি"],
                [[r["crop_bn"], bn(r["kg"]), money(r["avg_price"]) if r["avg_price"] else "—", money(r["revenue"])]
                 for r in rep["products"]], [60, 40, 40, 46])
    if rep["expenses"]:
        d.h("খরচের খাত")
        d.table(["খাত", "প্ল্যাটফর্ম", "নিজে লেখা", "মোট"],
                [[r["label"], money(r["platform"]), money(r["user_reported"]), money(r["amount"])] for r in rep["expenses"]],
                [70, 38, 38, 40])
    d.h("পাওনা ও দেনা")
    d.kv([("মোট পাওনা (বাকি)", money(rep["dues"]["receivable"])), ("মোট দেনা (বাকি)", money(rep["dues"]["payable"])),
          ("মেয়াদ পেরোনো", bn(rep["dues"]["overdue"]))])
    d.note(rep["note"] + " " + p["method"])
    return d.bytes()
