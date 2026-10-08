from fastapi import FastAPI
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    app_version: str = "0.1.0"
    database_url: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
app = FastAPI(title="University Learning Hub API", version=settings.app_version)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "version": settings.app_version}
