"""Agent package.

Exposes `root_agent` for `adk web` / `adk run` when google-adk is installed.
Import is guarded so the Flask app still runs (in fallback mode) without ADK.
"""
try:  # pragma: no cover - depends on optional dependency
    from .adk_agents import root_agent  # noqa: F401
except Exception:  # ADK not installed / no API key at import time
    root_agent = None
