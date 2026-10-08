from pydantic import BaseModel, Field
class TelegramRegistration(BaseModel):
    telegram_user_id: int = Field(gt=0)
    pseudonym: str = Field(min_length=3, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    legal_name: str = Field(min_length=1, max_length=200)
    telegram_data: dict[str, str] = Field(default_factory=dict)
class StudentView(BaseModel):
    id: int; pseudonym: str; group_id: int | None
class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
