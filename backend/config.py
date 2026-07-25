"""Central configuration loaded from environment variables.

Authenticates to Gemini through Vertex AI using Application Default
Credentials (ADC) locally (`gcloud auth application-default login`) and the
Cloud Run service account in production. No API key is used.
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
    google_cloud_project: str = os.getenv("GOOGLE_CLOUD_PROJECT", "").strip()
    google_cloud_location: str = os.getenv("GOOGLE_CLOUD_LOCATION", "global").strip()
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "text-embedding-004")
    rag_top_k: int = int(os.getenv("RAG_TOP_K", "8"))
    use_vertex: bool = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "TRUE").upper() == "TRUE"

    flask_port: int = int(os.getenv("FLASK_PORT", "8080"))
    flask_debug: bool = os.getenv("FLASK_DEBUG", "1") == "1"

    @property
    def gemini_enabled(self) -> bool:
        """True once Vertex AI is configured with a project (ADC/IAM supply the credentials)."""
        return bool(self.use_vertex and self.google_cloud_project)

    def export_to_env(self) -> None:
        """Make sure the Gen AI SDK / ADK see Vertex AI mode, project and location."""
        os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "TRUE" if self.use_vertex else "FALSE")
        if self.google_cloud_project:
            os.environ.setdefault("GOOGLE_CLOUD_PROJECT", self.google_cloud_project)
        if self.google_cloud_location:
            os.environ.setdefault("GOOGLE_CLOUD_LOCATION", self.google_cloud_location)


@lru_cache
def get_settings() -> "Settings":
    s = Settings()
    s.export_to_env()
    return s
