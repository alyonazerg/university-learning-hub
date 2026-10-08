from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base
class Group(Base):
    __tablename__ = "groups"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    students: Mapped[list["Student"]] = relationship(back_populates="group")
class Student(Base):
    __tablename__ = "students"
    id: Mapped[int] = mapped_column(primary_key=True)
    telegram_user_id: Mapped[int] = mapped_column(unique=True, index=True)
    pseudonym: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    group_id: Mapped[int | None] = mapped_column(ForeignKey("groups.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    group: Mapped[Group | None] = relationship(back_populates="students")
    identity: Mapped["IdentityRegistry | None"] = relationship(back_populates="student", uselist=False)
class IdentityRegistry(Base):
    __tablename__ = "identity_registry"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), unique=True)
    legal_name: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    student: Mapped[Student] = relationship(back_populates="identity")
