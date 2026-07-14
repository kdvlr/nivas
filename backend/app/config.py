from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    tz: str = "America/New_York"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-latest"

    icloud_username: str = ""
    icloud_password: str = ""
    icloud_shopping_list: str = "Shopping"

    amazon_email: str = ""
    amazon_password: str = ""
    amazon_otp_secret: str = ""
    amazon_url: str = "amazon.com"

    data_dir: Path = Path("/data") if Path("/data").is_dir() else Path("./data")
    base_url: str = "http://localhost:8000"

    # PIN required to open the Setup screen ("" = no PIN). Reset by editing .env.
    setup_pin: str = ""

    @property
    def photos_dir(self) -> Path:
        # Use /photos if it exists and is a directory (like in Docker).
        # Otherwise, fall back to a photos folder under data_dir.
        p = Path("/photos")
        try:
            if p.exists() and p.is_dir():
                return p
        except Exception:
            pass
        return self.data_dir / "photos"

    @property
    def db_url(self) -> str:
        return f"sqlite:///{self.data_dir / 'dashboard.db'}"

    @property
    def google_client_secret_file(self) -> Path:
        return self.data_dir / "credentials" / "google_client_secret.json"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.data_dir.mkdir(parents=True, exist_ok=True)
    (s.data_dir / "credentials").mkdir(exist_ok=True)
    return s
