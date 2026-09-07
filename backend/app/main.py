"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth as auth_routes
from app.api import rooms as room_routes
from app.config import get_settings
from app.database import SessionLocal, init_db
from app.schemas import HealthResponse
from app.services import user_service
from app.ws import signaling as signaling_routes

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    with SessionLocal() as db:
        user_service.ensure_default_user(db)  # mock/default user mode (PRD §6)
    yield


app = FastAPI(
    title=f"{settings.app_name} API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_prefix = "/api/v1"
app.include_router(auth_routes.router, prefix=f"{api_prefix}/auth", tags=["auth"])
app.include_router(room_routes.router, prefix=f"{api_prefix}/rooms", tags=["rooms"])
app.include_router(signaling_routes.router)


@app.get(f"{api_prefix}/health", response_model=HealthResponse, tags=["system"])
def health():
    return HealthResponse(status="ok", app=settings.app_name)
