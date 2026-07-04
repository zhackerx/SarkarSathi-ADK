"""Agent orchestration engine.

Two execution paths, both backed by the same verified service layer:

1. `recommend()` / `extract_profile()` — the reliable pipeline that powers the
   main API. Deterministic eligibility + RAG + benefit, with Gemini 2.5 Flash
   generating the grounded, multilingual explanation (Explainability +
   Multilingual Response agents). Degrades to templates without a key.

2. `run_orchestrator()` — executes the *real* ADK root agent (Orchestrator +
   6 sub-agents) through an ADK Runner, for the agentic showcase endpoint.

Everything falls back gracefully so the prototype always runs.
"""
from __future__ import annotations

import inspect
import json
import uuid
from typing import Dict, List, Optional

from config import get_settings
from services.benefit import benefit_summary, calculate_total_benefit
from services.eligibility_engine import filter_eligible
from services.knowledge_base import load_schemes
from services.profile import UserProfile, heuristic_profile
from services.rag import rank_schemes


class AgentEngine:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.adk_ready = self._probe_adk()

    # ------------------------------------------------------------------ #
    # Capability probing
    # ------------------------------------------------------------------ #
    def _probe_adk(self) -> bool:
        if not self.settings.gemini_enabled:
            return False
        try:
            from google.adk.runners import Runner  # noqa: F401
            from agents.adk_agents import root_agent

            return root_agent is not None
        except Exception:
            return False

    def status(self) -> Dict:
        return {
            "gemini_enabled": self.settings.gemini_enabled,
            "adk_ready": self.adk_ready,
            "model": self.settings.gemini_model,
            "mode": "adk" if self.adk_ready else ("gemini" if self.settings.gemini_enabled else "offline-fallback"),
        }

    # ------------------------------------------------------------------ #
    # Reliable pipeline (main API)
    # ------------------------------------------------------------------ #
    def recommend(self, profile: UserProfile, query: Optional[str], lang: str) -> Dict:
        all_schemes = load_schemes()
        eligible = filter_eligible(profile, all_schemes)  # Eligibility Agent's tool
        ranked = rank_schemes(query or self._profile_query(profile), eligible)  # Recommendation Agent
        total = calculate_total_benefit(ranked)
        summary = benefit_summary(ranked, lang)
        explanation = self._explain(profile, ranked, query, lang)  # Explainability + Multilingual
        return {
            "profile": profile.as_dict(),
            "schemes": [self._scheme_view(s) for s in ranked],
            "total_benefit_inr": total,
            "benefit_summary": summary,
            "explanation": explanation,
            "grounded": True,
            "mode": self.status()["mode"],
        }

    def extract_profile(self, message: str) -> UserProfile:
        """Citizen Profile Builder — LLM extraction with heuristic fallback."""
        if not self.settings.gemini_enabled:
            return heuristic_profile(message)
        prompt = (
            "Extract a structured citizen profile from the message below.\n"
            "Return ONLY valid JSON with these keys (use null when unknown):\n"
            'age (int), state (full Indian state name), income (annual INR int), '
            'gender ("Male"|"Female"), education ("School"|"UG"|"PG"|"Diploma"), '
            'occupation ("Student"|"Farmer"|"Entrepreneur"|"Unemployed"|"Self-Employed"), '
            'social_category ("SC"|"ST"|"OBC"|"General"), land_owner (bool), '
            "disability (bool), maternity (bool - true if pregnant or a new mother).\n\n"
            f'Message: "{message}"\nJSON:'
        )
        try:
            text = self._gemini_text(prompt).strip().strip("`")
            if text.lower().startswith("json"):
                text = text[4:].strip()
            data = json.loads(text)
            return UserProfile.from_dict(data)
        except Exception:
            return heuristic_profile(message)

    def document_check(self, scheme: Optional[Dict], uploaded_text: str, lang: str) -> Dict:
        from services.document_check import check_documents

        required = scheme["documents"] if scheme else []
        return check_documents(required, uploaded_text, lang)

    # ------------------------------------------------------------------ #
    # True ADK orchestration (agentic showcase)
    # ------------------------------------------------------------------ #
    def run_orchestrator(self, message: str, lang: str = "en") -> Dict:
        profile = self.extract_profile(message)
        if not self.adk_ready:
            rec = self.recommend(profile, message, lang)
            return {
                "reply": rec["explanation"],
                "profile": profile.as_dict(),
                "schemes": rec["schemes"],
                "total_benefit_inr": rec["total_benefit_inr"],
                "used_adk": False,
                "mode": rec["mode"],
            }
        try:
            reply = self._run_adk(message, lang)
            rec = self.recommend(profile, message, lang)  # structured cards for the UI
            return {
                "reply": reply or rec["explanation"],
                "profile": profile.as_dict(),
                "schemes": rec["schemes"],
                "total_benefit_inr": rec["total_benefit_inr"],
                "used_adk": True,
                "mode": "adk",
            }
        except Exception as exc:  # pragma: no cover - network dependent
            rec = self.recommend(profile, message, lang)
            return {
                "reply": rec["explanation"],
                "profile": profile.as_dict(),
                "schemes": rec["schemes"],
                "total_benefit_inr": rec["total_benefit_inr"],
                "used_adk": False,
                "mode": rec["mode"],
                "adk_error": str(exc),
            }

    def _run_adk(self, message: str, lang: str) -> str:
        from google.adk.runners import Runner
        from google.adk.sessions import InMemorySessionService
        from google.genai import types

        from agents.adk_agents import root_agent

        app_name, user_id = "sarkarsathi", "citizen"
        session_id = str(uuid.uuid4())
        session_service = InMemorySessionService()
        self._resolve(
            session_service.create_session(
                app_name=app_name, user_id=user_id, session_id=session_id, state={"lang": lang}
            )
        )
        runner = Runner(agent=root_agent, app_name=app_name, session_service=session_service)
        lang_hint = "Respond in Hindi (Devanagari)." if lang == "hi" else "Respond in English."
        content = types.Content(role="user", parts=[types.Part(text=f"{message}\n\n{lang_hint}")])

        final = ""
        for event in runner.run(user_id=user_id, session_id=session_id, new_message=content):
            if event.is_final_response() and event.content and event.content.parts:
                final = event.content.parts[0].text or final
        return (final or "").strip()

    @staticmethod
    def _resolve(value):
        """Await coroutines transparently (ADK create_session may be async)."""
        if inspect.isawaitable(value):
            import asyncio

            return asyncio.run(value)
        return value

    # ------------------------------------------------------------------ #
    # Gemini helpers (Explainability + Multilingual Response)
    # ------------------------------------------------------------------ #
    def _gemini_text(self, prompt: str) -> str:
        import google.generativeai as genai

        genai.configure(api_key=self.settings.google_api_key)
        model = genai.GenerativeModel(self.settings.gemini_model)
        resp = model.generate_content(prompt)
        return resp.text or ""

    def _explain(self, profile: UserProfile, schemes: List[Dict], query: Optional[str], lang: str) -> str:
        if not schemes:
            return (
                "आपकी वर्तमान प्रोफ़ाइल के लिए कोई योजना नहीं मिली। कृपया राज्य, आय या व्यवसाय जैसी अधिक जानकारी दें।"
                if lang == "hi"
                else "No matching schemes were found for your current profile. "
                "Try adding more details (state, income, occupation)."
            )
        if not self.settings.gemini_enabled:
            head = "आप निम्न योजनाओं के लिए पात्र हैं:" if lang == "hi" else "You appear eligible for:"
            body = "\n".join(f"• {s['scheme_name']} — {s['benefit_text']}" for s in schemes)
            return f"{head}\n{body}"

        lang_name = "Hindi (Devanagari)" if lang == "hi" else "English"
        context = "\n".join(
            f"- {s['scheme_name']} ({s['level']}, {s['state']}) | benefit: {s['benefit_text']} | "
            f"why: {'; '.join(s.get('reasons', []))}"
            for s in schemes
        )
        prompt = (
            "You are SarkarSathi, an expert assistant on Indian government welfare schemes.\n"
            "Rules:\n- Use ONLY the schemes listed below. Do NOT invent schemes or eligibility.\n"
            "- Cite each scheme by its exact name.\n- For each, briefly state WHY the user qualifies "
            "using the provided reasons.\n- Be warm, concise and encouraging. "
            f"Respond entirely in {lang_name}.\n\n"
            f"User profile: {profile.as_dict()}\n"
            f"User question: {query or 'Which schemes am I eligible for?'}\n\n"
            f"Eligible schemes (already verified by our eligibility engine):\n{context}\n\n"
            "Write the answer now."
        )
        try:
            return self._gemini_text(prompt).strip()
        except Exception as exc:  # pragma: no cover
            head = "आप निम्न योजनाओं के लिए पात्र हैं:" if lang == "hi" else "You appear eligible for:"
            body = "\n".join(f"• {s['scheme_name']} — {s['benefit_text']}" for s in schemes)
            return f"{head}\n{body}\n\n(Note: live AI explanation unavailable: {exc})"

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def _profile_query(p: UserProfile) -> str:
        parts: List[str] = []
        if p.age:
            parts.append(f"{p.age} year old")
        if p.gender:
            parts.append(p.gender)
        if p.occupation:
            parts.append(p.occupation)
        if p.education:
            parts.append(f"{p.education} student")
        if p.state:
            parts.append(f"from {p.state}")
        if p.income is not None:
            parts.append(f"income {p.income}")
        return "government schemes for " + " ".join(parts) if parts else "government welfare schemes"

    @staticmethod
    def _scheme_view(s: Dict) -> Dict:
        return {
            "id": s["id"],
            "scheme_name": s["scheme_name"],
            "level": s["level"],
            "state": s["state"],
            "category": s["category"],
            "benefit_text": s["benefit_text"],
            "benefit_annual_inr": s["benefit_annual_inr"],
            "documents": s["documents"],
            "apply_url": s["apply_url"],
            "steps": s["steps"],
            "reasons": s.get("reasons", []),
            "score": s.get("score", 0.0),
        }


_engine: Optional[AgentEngine] = None


def get_engine() -> AgentEngine:
    global _engine
    if _engine is None:
        _engine = AgentEngine()
    return _engine
