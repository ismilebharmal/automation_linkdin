from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"
    gemini_image_model: str = "gemini-2.5-flash-image"
    # auto | gemini | pollinations | openai
    image_backend: str = "auto"

    openai_api_key: str = ""
    news_api_key: str = ""
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    def resolved_image_backend(self) -> str:
        b = (self.image_backend or "auto").strip().lower()
        if b in ("gemini", "pollinations", "openai"):
            return b
        if self.gemini_api_key.strip():
            return "gemini"
        if self.openai_api_key.strip():
            return "openai"
        return "pollinations"


def get_settings() -> Settings:
    return Settings()


def cors_origin_list(settings: Settings) -> list[str]:
    return [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
