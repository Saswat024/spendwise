from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongodb_uri: str
    jwt_secret: str
    llm_api_key: str
    llm_model: str = "openai/gpt-oss-120b"
    llm_base_url: str = "https://api.groq.com/openai/v1"
    frontend_origin: str = "*"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days


settings = Settings()
