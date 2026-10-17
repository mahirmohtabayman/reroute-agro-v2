"""Management commands (run from the project folder, with the same environment variables as the server):

  python -m app.manage status                 database type, applied migrations, user counts
  python -m app.manage migrate                apply pending migrations (the server also does this on start)
  python -m app.manage create-admin --phone 01XXXXXXXXX --name "Ops Team"
                                              create an operations (admin) account; the password is asked for,
                                              or read from ADMIN_PASSWORD
  python -m app.manage seed-demo --yes        rebuild demo data; refused unless ENABLE_DEMO_MODE=true and
                                              APP_ENV is demo or development
"""
import argparse
import getpass
import os
import sys

from app import auth, db, settings


def status(_):
    print(f"APP_ENV={settings.APP_ENV}  demo mode={'on' if settings.DEMO_MODE else 'off'}  "
          f"database={'PostgreSQL' if db.PG else 'SQLite ' + str(db.DB_PATH)}")
    db.migrate()
    print("migrations:", ", ".join(r["id"] for r in db.q("SELECT id FROM schema_migrations ORDER BY id")))
    for r in db.q("SELECT role, COUNT(*) n, SUM(CASE WHEN id LIKE 'U%' THEN 1 ELSE 0 END) registered "
                  "FROM users GROUP BY role ORDER BY role"):
        print(f"  {r['role']:<7} {r['n']:>5} accounts ({r['registered'] or 0} registered, the rest seeded demo)")


def migrate(_):
    db.migrate()
    print("migrations up to date")


def create_admin(a):
    phone = auth.normalize_phone(a.phone)
    if not phone:
        sys.exit("phone must be an 11-digit Bangladeshi mobile number (01XXXXXXXXX)")
    db.migrate()
    if db.one("SELECT id FROM users WHERE phone=?", (phone,)):
        sys.exit("an account with this phone number already exists")
    pw = os.environ.get("ADMIN_PASSWORD") or getpass.getpass("New admin password (min 10 characters): ")
    if len(pw) < 10:
        sys.exit("password must be at least 10 characters")
    from app import services as S
    uid = S.nid("U")
    with db.tx():
        db.insert("users", {"id": uid, "role": "admin", "name": a.name, "biz": "Reroute Agro", "phone": phone,
                            "place": a.place, "area": "অফিস", "verified": 1, "joined": db.now_ms(),
                            "pw_hash": auth.hash_password(pw)})
    print(f"admin {uid} created; log in with role 'অপারেশন', phone {phone}")


def seed_demo(a):
    if not a.yes:
        sys.exit("this deletes all demo data and trades; add --yes to confirm")
    from app import seed
    db.migrate()
    seed.seed()
    print("demo data rebuilt")


def main(argv=None):
    p = argparse.ArgumentParser(prog="python -m app.manage")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status").set_defaults(fn=status)
    sub.add_parser("migrate").set_defaults(fn=migrate)
    c = sub.add_parser("create-admin")
    c.add_argument("--phone", required=True)
    c.add_argument("--name", default="Reroute অপারেশন টিম")
    c.add_argument("--place", default="rajshahi")
    c.set_defaults(fn=create_admin)
    s = sub.add_parser("seed-demo")
    s.add_argument("--yes", action="store_true")
    s.set_defaults(fn=seed_demo)
    a = p.parse_args(argv)
    a.fn(a)


if __name__ == "__main__":
    main()
