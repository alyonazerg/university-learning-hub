from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_env: str = 'development'
    app_version: str = '0.1.0'
    database_url: str | None = None
    telegram_bot_token: str | None = None
    admin_token: str | None = None
    cors_origins: list[str] = ['http://localhost:8080', 'https://mooncampus.ru']
    revision_ai_api_key: str | None = None
    revision_audio_ai_enabled: bool = False
    revision_audio_ai_api_key: str | None = None
    revision_audio_transcription_model: str = 'gpt-4o-transcribe-diarize'
    revision_audio_individual_model: str = 'whisper-1'
    revision_ai_model: str = 'gpt-4.1-mini'
    revision_ai_base_url: str = 'https://api.openai.com/v1'
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

settings = Settings()
