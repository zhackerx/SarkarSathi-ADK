"""SarkarSathi ADK — Flask backend.

Serves the REST API (backed by the ADK agent engine) and the static frontend.

Endpoints
---------
GET  /                     -> frontend
GET  /api/health           -> engine status
GET  /api/schemes          -> full knowledge base
GET  /api/agents           -> the ADK agent catalog (for the UI diagram)
POST /api/recommend        -> structured profile -> eligible schemes + explanation
POST /api/chat             -> free text -> profile extraction -> recommendation
POST /api/agent            -> runs the real ADK Orchestrator (agentic showcase)
POST /api/documents/check  -> document readiness check
"""
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from agents.engine import get_engine
from config import FRONTEND_DIR, get_settings
from services.knowledge_base import load_schemes, schemes_by_id
from services.profile import UserProfile

settings = get_settings()
engine = get_engine()

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
CORS(app)

try:
    from agents.adk_agents import AGENT_CATALOG
except Exception:
    AGENT_CATALOG = [
        {"name": "ADK Agent Orchestrator", "role": "Coordinates the specialised agents."},
        {"name": "Eligibility Agent", "role": "Filters the knowledge base to eligible schemes."},
        {"name": "Scheme Recommendation Agent", "role": "Ranks schemes and estimates benefit."},
        {"name": "Explainability Agent", "role": "Explains why the citizen qualifies."},
        {"name": "Application Guide Agent", "role": "Provides step-by-step guidance."},
        {"name": "Document Verification Agent", "role": "Checks document readiness."},
        {"name": "Multilingual Response Agent", "role": "Delivers the answer in the citizen's language."},
    ]


# --------------------------------------------------------------------- #
# Frontend
# --------------------------------------------------------------------- #
@app.route("/")
def index():
    return send_from_directory(str(FRONTEND_DIR), "index.html")


# --------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------- #
@app.get("/api/health")
def health():
    return jsonify({"status": "ok", **engine.status()})


@app.get("/api/agents")
def agents():
    return jsonify({"agents": AGENT_CATALOG, **engine.status()})


@app.get("/api/schemes")
def schemes():
    return jsonify(load_schemes())


@app.post("/api/recommend")
def recommend():
    body = request.get_json(force=True, silent=True) or {}
    profile = UserProfile.from_dict(body.get("profile", {}))
    result = engine.recommend(profile, body.get("query"), body.get("lang", "en"))
    return jsonify(result)


@app.post("/api/chat")
def chat():
    body = request.get_json(force=True, silent=True) or {}
    message = (body.get("message") or "").strip()
    lang = body.get("lang", "en")
    if not message:
        return jsonify({"error": "message is required"}), 400
    profile = engine.extract_profile(message)
    result = engine.recommend(profile, message, lang)
    return jsonify(result)


@app.post("/api/agent")
def agent():
    """Run the real ADK Orchestrator (falls back to the pipeline without a key)."""
    body = request.get_json(force=True, silent=True) or {}
    message = (body.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400
    base_profile = UserProfile.from_dict(body.get("profile") or {})
    return jsonify(engine.run_orchestrator(message, body.get("lang", "en"), base_profile))


@app.post("/api/documents/check")
def documents_check():
    scheme_id, lang, uploaded_text = _read_document_request()
    scheme = schemes_by_id().get(scheme_id)
    return jsonify(engine.document_check(scheme, uploaded_text, lang))


def _read_document_request():
    """Accept either JSON (scheme_id, uploaded, lang) or multipart file uploads."""
    if request.content_type and "multipart/form-data" in request.content_type:
        scheme_id = request.form.get("scheme_id", "")
        lang = request.form.get("lang", "en")
        files = request.files.getlist("files")
        uploaded_text = " ".join(f.filename or "" for f in files)
        return scheme_id, lang, uploaded_text
    body = request.get_json(force=True, silent=True) or {}
    return body.get("scheme_id", ""), body.get("lang", "en"), body.get("uploaded", "")


if __name__ == "__main__":
    print(f"SarkarSathi ADK running in '{engine.status()['mode']}' mode "
          f"(model={settings.gemini_model}).")
    app.run(host="0.0.0.0", port=settings.flask_port, debug=settings.flask_debug)
