"""Thin data-access layer for users."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User


def get_by_id(db: Session, user_id: str) -> User | None:
    return db.get(User, user_id)


def get_by_clerk_id(db: Session, clerk_user_id: str) -> User | None:
    return db.scalar(select(User).where(User.clerk_user_id == clerk_user_id))


def create(
    db: Session,
    *,
    name: str,
    user_id: str | None = None,
    email: str | None = None,
    avatar_url: str | None = None,
    clerk_user_id: str | None = None,
) -> User:
    user = User(
        id=user_id or f"usr_{uuid.uuid4().hex[:12]}",
        name=name,
        email=email,
        avatar_url=avatar_url,
        clerk_user_id=clerk_user_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_or_create(
    db: Session,
    *,
    user_id: str,
    name: str,
    email: str | None = None,
) -> User:
    """Idempotently ensure a user with the given id exists (used for the default user)."""
    user = get_by_id(db, user_id)
    if user is None:
        user = User(id=user_id, name=name, email=email)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
