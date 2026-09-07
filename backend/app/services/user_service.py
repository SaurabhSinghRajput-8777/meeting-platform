"""User identity service.

This is the single place that knows how application users are resolved.
The rest of the app works with internal `User` objects and never talks to
Clerk directly (PRD §8: mock user abstraction).
"""

from sqlalchemy.orm import Session

from app.config import get_settings
from app.repositories import users as users_repo

settings = get_settings()


def ensure_default_user(db: Session):
    """Idempotently create the deterministic mock/default user."""
    return users_repo.get_or_create(
        db,
        user_id=settings.default_user_id,
        name=settings.default_user_name,
        email=settings.default_user_email,
    )


def is_default_user(user_id: str) -> bool:
    return user_id == settings.default_user_id


def create_guest_user(db: Session, name: str):
    """Create a distinct lightweight identity (used for multi-participant demos
    in mock-user mode, e.g. a second browser that renames itself in the lobby)."""
    return users_repo.create(db, name=name.strip())


def upsert_clerk_user(db: Session, claims: dict):
    """Map a verified Clerk identity to an application user record (bonus path)."""
    clerk_user_id = claims.get("sub")
    if not clerk_user_id:
        raise ValueError("Clerk token is missing the 'sub' claim")

    user = users_repo.get_by_clerk_id(db, clerk_user_id)
    name = claims.get("name") or claims.get("username") or "Clerk User"
    email = None
    email_claim = claims.get("email_address") or claims.get("primary_email_address_id")
    if claims.get("email"):
        email = claims["email"]
    elif isinstance(email_claim, str) and "@" in email_claim:
        email = email_claim

    if user is None:
        user = users_repo.create(
            db,
            name=name,
            email=email,
            avatar_url=claims.get("image_url") or claims.get("picture"),
            clerk_user_id=clerk_user_id,
        )
    else:
        user.name = name or user.name
        if email:
            user.email = email
        db.commit()
        db.refresh(user)
    return user
