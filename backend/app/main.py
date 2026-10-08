from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    app_version: str = "0.1.0"
    database_url: str | None = None
    telegram_bot_token: str | None = None
    admin_token: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
app = FastAPI(title="University Learning Hub API", version=settings.app_version)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:8080"], allow_methods=["POST", "GET"], allow_headers=["*"])

from .db import Base, SessionLocal, engine
from .models import Group, IdentityRegistry, Student
from .schemas import GroupCreate, StudentView, TelegramRegistration
Base.metadata.create_all(bind=engine)
def db():
    session = SessionLocal()
    try: yield session
    finally: session.close()


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "version": settings.app_version}

@app.post("/auth/telegram/register", response_model=StudentView, status_code=201)
def register(payload: TelegramRegistration, session=Depends(db)):
    if settings.telegram_bot_token:
        from .auth import verify_telegram_login
        if not verify_telegram_login(payload.telegram_data, settings.telegram_bot_token): raise HTTPException(401, "Invalid Telegram authentication")
    if session.query(Student).filter_by(telegram_user_id=payload.telegram_user_id).first(): raise HTTPException(409, "Telegram account is already registered")
    if session.query(Student).filter_by(pseudonym=payload.pseudonym).first(): raise HTTPException(409, "Pseudonym is already taken")
    student = Student(telegram_user_id=payload.telegram_user_id, pseudonym=payload.pseudonym); session.add(student); session.flush()
    session.add(IdentityRegistry(student_id=student.id, legal_name=payload.legal_name)); session.commit(); session.refresh(student)
    return student

@app.post("/groups", status_code=201)
def create_group(payload: GroupCreate, x_admin_token: str | None = Header(default=None), session=Depends(db)):
    if not settings.admin_token or x_admin_token != settings.admin_token: raise HTTPException(403, "Admin access required")
    if session.query(Group).filter_by(name=payload.name).first(): raise HTTPException(409, "Group already exists")
    group = Group(name=payload.name); session.add(group); session.commit(); session.refresh(group); return {"id": group.id, "name": group.name}

@app.get("/admin/identity-registry")
def identity_registry(x_admin_token: str | None = Header(default=None), session=Depends(db)):
    if not settings.admin_token or x_admin_token != settings.admin_token: raise HTTPException(403, "Admin access required")
    return [{"student_id": i.student_id, "legal_name": i.legal_name} for i in session.query(IdentityRegistry).all()]
