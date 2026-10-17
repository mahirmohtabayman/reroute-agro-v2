"""Smart Hisab API (/api/hisab/…) and the admin training-dataset API. Every endpoint is scoped to the signed-in
farmer or paikar: nobody can read another user's invoices, receipts, records, dues or documents."""
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel, Field

from app import dataset, db, hisab, pdfgen, services as S

router = APIRouter(prefix="/api", tags=["Smart Hisab"])
NO_STORE = {"Cache-Control": "private, no-store"}


def _user(x_token):
    from app.main import get_user          # imported here to avoid a circular import
    u = get_user(x_token)
    if not u:
        raise HTTPException(401, "আপনার সেশন শেষ হয়েছে, আবার লগ ইন করুন")
    return u


def _trader(x_token):
    u = _user(x_token)
    if u["role"] not in ("farmer", "paikar"):
        raise HTTPException(403, "স্মার্ট হিসাব কৃষক ও পাইকারের জন্য")
    return u


def _admin(x_token):
    u = _user(x_token)
    if u["role"] != "admin":
        raise HTTPException(403, "শুধু Reroute অপারেশন টিম")
    return u


def _pdf(data, name):
    return Response(data, media_type="application/pdf",
                    headers={**NO_STORE, "Content-Disposition": f'attachment; filename="{name}.pdf"'})


# ---------------------------------------------------------------- overview, invoices, receipts
@router.get("/hisab/overview")
def overview(period: str = "month", start: Optional[str] = None, end: Optional[str] = None,
             x_token: Optional[str] = Header(None)):
    u = _trader(x_token)
    hisab.sync_user(u["id"])
    return hisab.overview(u["id"], period, start, end)


@router.get("/hisab/invoices")
def invoices(q: Optional[str] = None, start: Optional[str] = None, end: Optional[str] = None,
             status: Optional[str] = None, x_token: Optional[str] = Header(None)):
    u = _trader(x_token)
    hisab.sync_user(u["id"])
    if status and status not in hisab.STATUS_BN:
        raise HTTPException(400, "অবস্থা ঠিক নেই")
    return hisab.list_invoices(u["id"], (q or "").strip()[:60] or None, start, end, status)


@router.post("/hisab/orders/{oid}/invoice")
def issue_invoice(oid: str, x_token: Optional[str] = Header(None)):
    """Issue (or return the already issued) invoice of an order. Repeating the call never creates a second one."""
    u = _user(x_token)
    with db.tx():
        o = S.get_order(oid, u)
        inv = hisab.sync_order(o)
    if not inv:
        raise HTTPException(400, "দাম ও পরিবহনের শর্ত চূড়ান্ত হলে ইনভয়েস তৈরি হবে")
    return hisab.invoice_view(inv, u["id"])


@router.get("/hisab/invoices/{inv_id}")
def invoice(inv_id: str, x_token: Optional[str] = Header(None)):
    u = _user(x_token)
    return hisab.invoice_view(hisab.get_invoice(inv_id, u), u["id"])


@router.get("/hisab/invoices/{inv_id}/pdf")
def invoice_pdf(inv_id: str, x_token: Optional[str] = Header(None)):
    u = _user(x_token)
    v = hisab.invoice_view(hisab.get_invoice(inv_id, u), u["id"])
    return _pdf(pdfgen.invoice_pdf(v), v["number"])


@router.get("/hisab/receipts")
def receipts(start: Optional[str] = None, end: Optional[str] = None, x_token: Optional[str] = Header(None)):
    u = _trader(x_token)
    hisab.sync_user(u["id"])
    rows = [hisab.receipt_view(r) for r in db.q("SELECT * FROM receipts WHERE uid=? ORDER BY at DESC", (u["id"],))]
    return [r for r in rows if hisab.in_range(r["date"], start, end)]


@router.get("/hisab/receipts/{rid}/pdf")
def receipt_pdf(rid: str, x_token: Optional[str] = Header(None)):
    u = _user(x_token)
    r = hisab.get_receipt(rid, u)
    owner = S.user(r["uid"])
    return _pdf(pdfgen.receipt_pdf(hisab.receipt_view(r), owner["biz"] or owner["name"]), r["number"])


# ---------------------------------------------------------------- manual records
class RecordIn(BaseModel):
    type: str = Field(max_length=30)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    date: str = Field(max_length=10)
    crop: Optional[str] = Field(None, max_length=20)
    qty_kg: Optional[float] = Field(None, gt=0)
    counterparty: Optional[str] = Field(None, max_length=80)
    description: Optional[str] = Field(None, max_length=200)
    document_id: Optional[str] = Field(None, max_length=40)
    due_id: Optional[str] = Field(None, max_length=40)
    confirm_duplicate: bool = False


@router.get("/hisab/records")
def records(start: Optional[str] = None, end: Optional[str] = None, x_token: Optional[str] = Header(None)):
    u = _trader(x_token)
    return hisab.list_records(u["id"], start, end)


@router.post("/hisab/records")
def add_record(body: RecordIn, x_token: Optional[str] = Header(None)):
    u = _trader(x_token)
    with db.tx():
        return hisab.add_record(u, body.type, body.amount, body.date, body.crop or None, body.qty_kg,
                                body.counterparty, body.description, body.document_id or None, body.due_id or None,
                                body.confirm_duplicate)


class ReasonIn(BaseModel):
    reason: str = Field(min_length=1, max_length=200)


@router.post("/hisab/records/{eid}/void")
def void_record(eid: str, body: ReasonIn, x_token: Optional[str] = Header(None)):
    u = _trader(x_token)
    with db.tx():
        return hisab.void_record(u, eid, body.reason)


# ---------------------------------------------------------------- dues
class DueIn(BaseModel):
    direction: str = Field(pattern="^(receivable|payable)$")
    counterparty: str = Field(min_length=1, max_length=80)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    due_date: Optional[str] = Field(None, max_length=10)
    description: Optional[str] = Field(None, max_length=200)


class DuePayIn(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    date: str = Field(max_length=10)
    note: Optional[str] = Field(None, max_length=200)


@router.get("/hisab/dues")
def dues(x_token: Optional[str] = Header(None)):
    u = _trader(x_token)
    return {"dues": hisab.list_dues(u["id"]), "summary": hisab.dues_summary(u["id"])}


@router.post("/hisab/dues")
def add_due(body: DueIn, x_token: Optional[str] = Header(None)):
    u = _trader(x_token)
    with db.tx():
        return hisab.create_due(u, body.direction, body.counterparty, body.amount, body.due_date or None, body.description)


@router.post("/hisab/dues/{due_id}/payments")
def pay_due(due_id: str, body: DuePayIn, x_token: Optional[str] = Header(None)):
    u = _trader(x_token)
    with db.tx():
        return hisab.pay_due(u, due_id, body.amount, body.date, body.note)


@router.post("/hisab/dues/{due_id}/void")
def void_due(due_id: str, body: ReasonIn, x_token: Optional[str] = Header(None)):
    u = _trader(x_token)
    with db.tx():
        return hisab.void_due(u, due_id, body.reason)


# ---------------------------------------------------------------- reports
@router.get("/hisab/report")
def report(period: str = "month", start: Optional[str] = None, end: Optional[str] = None, group: str = "day",
           format: str = "json", x_token: Optional[str] = Header(None)):
    u = _trader(x_token)
    hisab.sync_user(u["id"])
    rep = hisab.report(u["id"], period, start, end, group)
    name = f"reroute-hisab-{rep['start'] or 'all'}-{rep['end'] or 'all'}"
    if format == "csv":
        return Response(hisab.report_csv(rep, u), media_type="text/csv; charset=utf-8",
                        headers={**NO_STORE, "Content-Disposition": f'attachment; filename="{name}.csv"'})
    if format == "pdf":
        return _pdf(pdfgen.report_pdf(rep, u), name)
    return rep


# ---------------------------------------------------------------- receipt attachments (stored in the database)
class DocIn(BaseModel):
    data: str = Field(min_length=20, max_length=hisab.MAX_DOC_CHARS)


@router.post("/hisab/documents")
def upload(body: DocIn, x_token: Optional[str] = Header(None)):
    from app.main import decode_image
    u = _trader(x_token)
    with db.tx():
        return hisab.save_document(u, body.data, decode_image)


@router.get("/hisab/documents/{doc_id}")
def document(doc_id: str, x_token: Optional[str] = Header(None)):
    import base64
    u = _trader(x_token)
    d = db.one("SELECT * FROM documents WHERE id=? AND uid=?", (doc_id, u["id"]))
    if not d:
        raise HTTPException(404, "ফাইল পাওয়া যায়নি")
    return Response(base64.b64decode(d["data"].split(",", 1)[1]), media_type=d["mime"],
                    headers={**NO_STORE, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox"})


# ---------------------------------------------------------------- admin: first-party dataset
@router.get("/admin/dataset")
def dataset_summary(x_token: Optional[str] = Header(None)):
    _admin(x_token)
    dataset.backfill()
    return dataset.summary()


@router.get("/admin/dataset/training.csv")
def dataset_csv(x_token: Optional[str] = Header(None)):
    _admin(x_token)
    dataset.backfill()
    return Response(dataset.training_csv(), media_type="text/csv; charset=utf-8",
                    headers={**NO_STORE, "Content-Disposition": 'attachment; filename="reroute-training-eligible.csv"'})


# ---------------------------------------------------------------- Bangla assistant (read-only)
class AskIn(BaseModel):
    text: str = Field(min_length=1, max_length=300)


@router.post("/assistant/ask")
def ask(body: AskIn, x_token: Optional[str] = Header(None)):
    """Answer a typed or spoken question from the signed-in user's own records and the AI services.
    Read-only: it never creates orders, payments or records."""
    from app import assistant
    from app.ai_routes import VEG
    u = _trader(x_token)
    return assistant.answer(u, body.text, VEG)
