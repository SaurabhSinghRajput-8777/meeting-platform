from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import clerk_configured, get_current_user
from app.database import get_db
from app.models import User
from app.schemas import GuestRequest, MeResponse, UserOut
from app.services import user_service

router = APIRouter()


@router.get("/me", response_model=MeResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return MeResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        avatar_url=current_user.avatar_url,
        is_default=user_service.is_default_user(current_user.id),
        clerk_enabled=clerk_configured(),
    )


@router.post("/guest", response_model=UserOut, status_code=201)
def create_guest(body: GuestRequest, db: Session = Depends(get_db)):
    """Create a lightweight guest identity so multiple browsers can act as
    distinct participants in mock-user mode (no login required)."""
    user = user_service.create_guest_user(db, body.name)
    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        avatar_url=user.avatar_url,
        is_default=user_service.is_default_user(user.id),
    )
