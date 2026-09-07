"""Standalone database seeder.

Usage (from the backend directory):
    python seed_db.py

Creates all tables and the mock/default user. The application also does this
automatically on startup; this script exists for explicit setup/re-seeding.
"""

from app.database import SessionLocal, init_db
from app.services import user_service


def main() -> None:
    init_db()
    with SessionLocal() as db:
        user = user_service.ensure_default_user(db)
    print(f"Database initialized. Default user ready: {user.id} ({user.name})")


if __name__ == "__main__":
    main()
