from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_env: str = 'development'
    app_version: str = '0.1.0'
    database_url: str | None = None
    telegram_bot_token: str | None = None
    admin_token: str | None = None
    cors_origins: list[str] = ['http://localhost:8080', 'https://mooncampus.ru']
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

settings = Settings()
