"""Current-user resolution (PRD §8).

    get_current_user()
           │
           ├── Clerk configured + Bearer token → verified Clerk user
           │
           └── otherwise → X-User-Id header (if valid) or default mock user

The rest of the application only ever sees an internal `User` object.
"""

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security.utils import get_authorization_scheme_param
from jwt import PyJWKClient
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.repositories import users as users_repo
from app.services import user_service

settings = get_settings()


class ClerkNotConfiguredError(Exception):
    pass


def clerk_configured() -> bool:
    return bool(settings.clerk_secret_key and settings.clerk_issuer)


def verify_clerk_token(token: str) -> dict:
    """Verify a Clerk session JWT against the instance's JWKS endpoint."""
    if not clerk_configured():
        raise ClerkNotConfiguredError()
    jwks_client = PyJWKClient(f"{settings.clerk_issuer.rstrip('/')}/.well-known/jwks.json")
    signing_key = jwks_client.get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        issuer=settings.clerk_issuer,
        options={"verify_aud": False},  # Clerk session tokens have no audience claim
    )


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    # Bonus path: Clerk session token (only active when credentials are configured).
    if clerk_configured():
        authorization = request.headers.get("Authorization")
        scheme, token = get_authorization_scheme_param(authorization or "")
        if scheme.lower() == "bearer" and token:
            try:
                claims = verify_clerk_token(token)
            except Exception as exc:  # invalid/expired token or JWKS failure
                raise HTTPException(status_code=401, detail="Invalid Clerk session token") from exc
            return user_service.upsert_clerk_user(db, claims)

    # Mock-user path: a valid X-User-Id header, otherwise the default user.
    header_user_id = request.headers.get("X-User-Id")
    if header_user_id:
        user = users_repo.get_by_id(db, header_user_id)
        if user is None:
            raise HTTPException(status_code=401, detail="Unknown user")
        return user

    return user_service.ensure_default_user(db)
