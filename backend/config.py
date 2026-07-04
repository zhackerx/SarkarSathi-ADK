"""Central configuration loaded from environment variables.

Supports both GOOGLE_API_KEY (ADK / google-genai convention) and the legacy
GEMINI_API_KEY, so the same key works everywhere.
"""
import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "schemes.json"
FRONTEND_DIR = BASE_DIR.parent / "frontend"


class Settings:
    # Accept either variable name.
    google_api_key: str = (
        os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or ""
    ).strip()
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "text-embedding-004")
    rag_top_k: int = int(os.getenv("RAG_TOP_K", "8"))
    use_vertex: bool = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "FALSE").upper() == "TRUE"

    flask_port: int = int(os.getenv("FLASK_PORT", "8080"))
    flask_debug: bool = os.getenv("FLASK_DEBUG", "1") == "1"

    @property
    def gemini_enabled(self) -> bool:
        return bool(self.google_api_key) and self.google_api_key != "your_gemini_api_key_here"

    def export_to_env(self) -> None:
        """Make sure google-genai / ADK see the key under the name they expect."""
        if self.google_api_key:
            os.environ.setdefault("GOOGLE_API_KEY", self.google_api_key)
            os.environ.setdefault("GEMINI_API_KEY", self.google_api_key)
        os.environ.setdefault(
            "GOOGLE_GENAI_USE_VERTEXAI", "TRUE" if self.use_vertex else "FALSE"
        )


@lru_cache
def get_settings() -> "Settings":
    s = Settings()
    s.export_to_env()
    return s
