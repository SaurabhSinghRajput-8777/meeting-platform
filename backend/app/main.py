"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth as auth_routes
from app.api import rooms as room_routes
from app.config import get_settings
from app.database import SessionLocal, init_db
import json
from app.schemas import HealthResponse, IceConfigResponse, IceServerOut
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


@app.get(f"{api_prefix}/config/ice", response_model=IceConfigResponse, tags=["system"])
def get_ice_config():
    if settings.ice_servers_json:
        try:
            parsed = json.loads(settings.ice_servers_json)
            if isinstance(parsed, list):
                return IceConfigResponse(ice_servers=[IceServerOut(**item) for item in parsed])
        except Exception:
            pass

    servers: list[IceServerOut] = [
        IceServerOut(
            urls=[
                settings.stun_server,
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
            ]
        )
    ]
    if settings.turn_server:
        turn_entry = IceServerOut(
            urls=[u.strip() for u in settings.turn_server.split(",") if u.strip()],
            username=settings.turn_username,
            credential=settings.turn_credential,
        )
        servers.append(turn_entry)

    return IceConfigResponse(ice_servers=servers)

