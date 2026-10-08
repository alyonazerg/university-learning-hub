from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .main import settings

class Base(DeclarativeBase): pass
url = settings.database_url or "sqlite:///./university_learning_hub.db"
engine = create_engine(url, connect_args={"check_same_thread": False} if url.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
