"""Passwords, sessions, rate limits and sign-up OTP codes.

* Passwords are stored only as salted PBKDF2-SHA256 hashes.
* Sessions: the browser holds a random 256-bit token; the database keeps only its SHA-256, the user id and an
  expiry. Logging out deletes the row; changing or resetting a password deletes all of the user's rows.
* Rate limits are counted in the database (table rate_hits), so they hold across restarts and workers.
* Sign-up OTP: a pending registration is stored in the database with an HMAC of the 5-digit code (never the code
  itself), a 5-minute expiry, an attempt counter and a consumed flag. There is no SMS gateway yet: in demo mode
  the code is returned to the browser that started the sign-up and shown there as a labelled prototype code.
"""
import hashlib
import hmac
import json
import random
import secrets
import time

from app import db, settings

ITERATIONS = 200_000
DEMO_PASSWORD = "123456"          # seeded non-admin demo accounts, demo mode only (shown on the login page)
OTP_TTL = 5 * 60                  # seconds a code stays valid
OTP_MAX_TRIES = 5
OTP_MAX_RESENDS = 3
PENDING_KEEP = 24 * 3600          # pending sign-ups (hashed password, phone) are deleted after a day


def now_ms():
    return int(time.time() * 1000)


# ---------------------------------------------------------------- passwords
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return f"pbkdf2_sha256${ITERATIONS}${salt.hex()}${digest.hex()}"


def check_password(password: str, stored: str) -> bool:
    try:
        algo, iters, salt, digest = (stored or "").split("$")
        if algo != "pbkdf2_sha256":
            return False
        calc = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iters))
        return hmac.compare_digest(calc.hex(), digest)
    except ValueError:
        return False


def temp_password() -> str:
    """One-time password an admin gives the user by phone after verifying them (never logged or stored in plain text)."""
    alphabet = "abcdefghjkmnpqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


# ---------------------------------------------------------------- phone numbers
_BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")


def normalize_phone(raw) -> str:
    """Bangladeshi mobile number in the local 11-digit form 01XXXXXXXXX, or "" if it is not one.
    Accepts +880 / 880 / 0088 prefixes, spaces, dashes and Bangla digits."""
    d = "".join(ch for ch in str(raw or "").translate(_BN_DIGITS) if ch.isdigit())
    if d.startswith("00880"):
        d = d[4:]
    if d.startswith("880") and len(d) == 13:
        d = d[2:]
    return d if len(d) == 11 and d.startswith("01") else ""


# ---------------------------------------------------------------- sessions
def _token_id(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_session(uid: str) -> str:
    token = secrets.token_urlsafe(32)
    t = now_ms()
    with db.tx():
        if random.random() < 0.05:
            db.run("DELETE FROM auth_sessions WHERE expires<?", (t,))
        db.insert("auth_sessions", {"id": _token_id(token), "uid": uid, "created": t,
                                    "expires": t + int(settings.SESSION_DAYS * 86_400_000), "last_seen": t})
    return token


def session_uid(token):
    """The user id of a valid, unexpired session token, else None."""
    if not token or len(token) > 200:
        return None
    s = db.one("SELECT uid, expires FROM auth_sessions WHERE id=?", (_token_id(token),))
    if not s or s["expires"] < now_ms():
        return None
    return s["uid"]


def end_session(token):
    db.run("DELETE FROM auth_sessions WHERE id=?", (_token_id(token or ""),))


def end_all_sessions(uid, keep_token=None):
    if keep_token:
        db.run("DELETE FROM auth_sessions WHERE uid=? AND id<>?", (uid, _token_id(keep_token)))
    else:
        db.run("DELETE FROM auth_sessions WHERE uid=?", (uid,))


# ---------------------------------------------------------------- rate limits (database-backed sliding window)
def hits(key: str, window: int) -> int:
    return int(db.val("SELECT COUNT(*) FROM rate_hits WHERE key=? AND at>?", (key, now_ms() - window * 1000)) or 0)


def hit(key: str):
    """Record one event. Committed on its own, so it stays counted even if the request then fails."""
    t = now_ms()
    with db.tx():
        db.insert("rate_hits", {"key": key, "at": t})
        if random.random() < 0.02:
            db.run("DELETE FROM rate_hits WHERE at<?", (t - 86_400_000,))


def allow(key: str, limit: int, window: int) -> bool:
    """Count this call and say whether it is within `limit` calls per `window` seconds."""
    if hits(key, window) >= limit:
        return False
    hit(key)
    return True


# ---------------------------------------------------------------- sign-up OTP (stored in the database)
def _otp_hash(reg_id: str, otp: str) -> str:
    return hmac.new(settings.SECRET, f"{reg_id}:{otp}".encode(), hashlib.sha256).hexdigest()


def _new_code() -> str:
    return f"{secrets.randbelow(100000):05d}"


def start_otp(data: dict) -> tuple:
    """Hold a sign-up until its code is confirmed. Returns (reg_id, otp). One pending sign-up per phone."""
    t = now_ms()
    reg_id, otp = secrets.token_urlsafe(16), _new_code()
    with db.tx():
        db.run("DELETE FROM pending_registrations WHERE created<? OR phone=?", (t - PENDING_KEEP * 1000, data["phone"]))
        db.insert("pending_registrations", {"id": reg_id, "phone": data["phone"], "role": data["role"],
                                            "data": json.dumps(data, ensure_ascii=False), "otp_hash": _otp_hash(reg_id, otp),
                                            "expires": t + OTP_TTL * 1000, "attempts": 0, "resends": 0, "created": t,
                                            "consumed_at": None})
    return reg_id, otp


def resend_otp(reg_id: str):
    """New code for an existing, unused sign-up (also after expiry). Returns (otp, None) or (None, error)."""
    t = now_ms()
    with db.tx():
        p = db.one("SELECT * FROM pending_registrations WHERE id=?", (reg_id or "",))
        if not p or p["consumed_at"] or p["created"] < t - PENDING_KEEP * 1000:
            return None, "এই নিবন্ধন আর চালু নেই। আবার অ্যাকাউন্ট খুলুন বোতাম চাপুন।"
        if p["resends"] >= OTP_MAX_RESENDS:
            return None, "অনেকবার কোড চাওয়া হয়েছে। কিছুক্ষণ পরে আবার অ্যাকাউন্ট খুলুন।"
        otp = _new_code()
        db.run("UPDATE pending_registrations SET otp_hash=?, expires=?, attempts=0, resends=resends+1 WHERE id=?",
               (_otp_hash(reg_id, otp), t + OTP_TTL * 1000, reg_id))
    return otp, None


def check_otp(reg_id: str, otp: str):
    """Check a code and, if it matches, mark the sign-up as used — all in the caller's transaction.
    Returns (data, None) on success or (None, error). A wrong code increments the attempt counter."""
    p = db.one("SELECT * FROM pending_registrations WHERE id=?", (reg_id or "",))
    if not p or p["consumed_at"]:
        return None, "এই কোড আর ব্যবহার করা যাবে না। আবার অ্যাকাউন্ট খুলুন বোতাম চাপুন।"
    if p["expires"] < now_ms():
        return None, "কোডের মেয়াদ শেষ। \"আবার পাঠান\" চাপুন।"
    if p["attempts"] >= OTP_MAX_TRIES:
        return None, "অনেকবার ভুল কোড দেওয়া হয়েছে। \"আবার পাঠান\" চাপুন বা আবার শুরু করুন।"
    if not hmac.compare_digest(p["otp_hash"], _otp_hash(p["id"], (otp or "").strip())):
        db.run("UPDATE pending_registrations SET attempts=attempts+1 WHERE id=?", (p["id"],))
        left = OTP_MAX_TRIES - p["attempts"] - 1
        return None, f"কোড মেলেনি। আর {left} বার চেষ্টা করা যাবে।" if left else "কোড মেলেনি। \"আবার পাঠান\" চাপুন।"
    if not db.run("UPDATE pending_registrations SET consumed_at=? WHERE id=? AND consumed_at IS NULL", (now_ms(), p["id"])):
        return None, "এই কোড আর ব্যবহার করা যাবে না।"
    return json.loads(p["data"]), None
