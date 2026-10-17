"""Passwords and sign-up OTP codes.

Passwords are stored only as salted PBKDF2-SHA256 hashes. The OTP is a demo: there is no SMS gateway yet,
so the code is returned to the browser and shown on screen. When a real gateway is added, send the code by
SMS in start_otp() and stop returning it.
"""
import hashlib
import hmac
import secrets
import threading
import time

ITERATIONS = 200_000
DEMO_PASSWORD = "123456"          # password of the seeded demo accounts (shown on the login page)
OTP_TTL = 5 * 60                  # seconds a code stays valid
OTP_MAX_TRIES = 5

_pending = {}                     # reg_id -> {"otp", "expires", "tries", "data"}
_lock = threading.Lock()


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


def start_otp(data: dict) -> tuple:
    """Hold a sign-up until its code is confirmed. Returns (reg_id, otp)."""
    now = time.time()
    reg_id, otp = secrets.token_urlsafe(16), f"{secrets.randbelow(100000):05d}"
    with _lock:
        for k in [k for k, v in _pending.items() if v["expires"] < now]:
            del _pending[k]
        # one pending sign-up per phone number
        for k in [k for k, v in _pending.items() if v["data"]["phone"] == data["phone"]]:
            del _pending[k]
        _pending[reg_id] = {"otp": otp, "expires": now + OTP_TTL, "tries": 0, "data": data}
    return reg_id, otp


def check_otp(reg_id: str, otp: str):
    """Returns (data, None) on success or (None, error message)."""
    with _lock:
        p = _pending.get(reg_id)
        if not p or p["expires"] < time.time():
            _pending.pop(reg_id, None)
            return None, "কোডের মেয়াদ শেষ। আবার অ্যাকাউন্ট খুলুন বোতাম চাপুন।"
        if p["tries"] >= OTP_MAX_TRIES:
            del _pending[reg_id]
            return None, "অনেকবার ভুল কোড দেওয়া হয়েছে। আবার শুরু করুন।"
        if not hmac.compare_digest(p["otp"], (otp or "").strip()):
            p["tries"] += 1
            return None, f"কোড মেলেনি। আর {OTP_MAX_TRIES - p['tries']} বার চেষ্টা করা যাবে।"
        del _pending[reg_id]
        return p["data"], None
