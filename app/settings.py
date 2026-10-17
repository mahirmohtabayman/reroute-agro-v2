"""Runtime configuration, read once from environment variables (see .env.example).

APP_ENV           production | demo | development. Unset on Render (RENDER is set there) → production,
                  otherwise development.
ENABLE_DEMO_MODE  true/false (default TRUE: this is a hackathon prototype that judges use with demo accounts).
                  Set it to false for a real launch. Turns on the seeded demo accounts, one-click demo login for
                  non-admin demo accounts and the on-screen prototype OTP. Never seeds or resets a database
                  that already has data.
SECRET_KEY        required (≥ 32 characters) outside development. Used to hash sign-up OTP codes.

Production refuses to start with an unsafe configuration instead of silently falling back.
"""
import logging
import os
import secrets

log = logging.getLogger("reroute.settings")


def _flag(name, default=False):
    v = os.environ.get(name)
    return default if v is None else v.strip().lower() in ("1", "true", "yes", "on")


class ConfigError(RuntimeError):
    pass


APP_ENV = (os.environ.get("APP_ENV") or ("production" if os.environ.get("RENDER") else "development")).strip().lower()
if APP_ENV not in ("production", "demo", "development"):
    raise ConfigError(f"APP_ENV must be production, demo or development (got {APP_ENV!r})")
IS_PROD = APP_ENV == "production"
IS_DEV = APP_ENV == "development"
DEMO_MODE = _flag("ENABLE_DEMO_MODE", default=True)

_secret = os.environ.get("SECRET_KEY", "")
if len(_secret) < 32:
    if not IS_DEV:
        raise ConfigError("SECRET_KEY is missing or shorter than 32 characters. Set it in the Render dashboard "
                          "(Environment → Add Environment Variable), e.g. the output of: python -c \"import secrets; print(secrets.token_urlsafe(48))\"")
    _secret = secrets.token_urlsafe(48)
    log.warning("SECRET_KEY not set: using a random key for this development process")
SECRET = _secret.encode()

SESSION_DAYS = float(os.environ.get("SESSION_DAYS", "7"))
# comma-separated origins allowed to call the API from another site; the app itself is same-origin and needs none
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]
# number of reverse proxies in front of the app that append to X-Forwarded-For (Render: 1)
TRUSTED_PROXIES = int(os.environ.get("TRUSTED_PROXIES", "1" if os.environ.get("RENDER") else "0"))
# seeded demo admin (demo deployments only); without it the demo admin cannot log in
DEMO_ADMIN_PASSWORD = os.environ.get("DEMO_ADMIN_PASSWORD") or None
# re-seed an idle demo database every DEMO_TTL_HOURS (demo deployments only, off unless set)
DEMO_AUTO_REFRESH = APP_ENV == "demo" and DEMO_MODE and _flag("DEMO_AUTO_REFRESH")
DEMO_TTL_HOURS = int(os.environ.get("DEMO_TTL_HOURS", "12"))
MAX_BODY_BYTES = int(os.environ.get("MAX_BODY_BYTES", str(3 * 1024 * 1024)))

if DEMO_MODE and IS_PROD:
    log.warning("ENABLE_DEMO_MODE is on in production: demo accounts can log in. Use a separate demo deployment "
                "and database for hackathon demos.")
if DEMO_ADMIN_PASSWORD and len(DEMO_ADMIN_PASSWORD) < 10:
    raise ConfigError("DEMO_ADMIN_PASSWORD must be at least 10 characters")
