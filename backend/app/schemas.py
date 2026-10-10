from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class TelegramAuthentication(BaseModel):
    model_config = ConfigDict(extra='forbid')
    telegram_data: dict[str, str] = Field(default_factory=dict)
    invitation_token: str = Field(min_length=32, max_length=64)
    init_data: str = Field(default='', max_length=16384)

class TelegramRegistration(TelegramAuthentication):
    pseudonym_token: str = Field(min_length=32, max_length=64)

class PseudonymView(BaseModel):
    pseudonym: str
    token: str
    expires_in: int

class StudentView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    public_id: str
    pseudonym: str
    group_id: int | None

class GroupCreate(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    course_id: Literal['speech', 'grammar'] = 'speech'
    name: str = Field(min_length=1, max_length=120)
