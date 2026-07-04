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
    def run_orchestrator(self, message: str, lang: str = "en", base_profile: Optional[UserProfile] = None) -> Dict:
        profile = self.extract_profile(message)
        if base_profile is not None:
            # Explicit Citizen Profile form selections win over text-inferred fields.
            profile = profile.merged_with(base_profile)
        # Conversational / informational questions (e.g. "what is this?", "hi",
        # "who are you") are NOT scheme requests — answer them directly instead
        # of dumping every scheme and a combined benefit total.
        meta = self._meta_reply(message, profile, lang)
        if meta is not None:
            return {
                "reply": meta,
                "profile": profile.as_dict(),
                "schemes": [],
                "total_benefit_inr": 0,
                "used_adk": False,
                "mode": self.status()["mode"],
            }
        # General information questions (e.g. "tell me about the schemes") with no
        # personal details are informational, not a personalised eligibility check —
        # give an overview and DON'T show a personalised combined-benefit total.
        if self._is_general_info(message, profile):
            rec = self.recommend(profile, message, lang)
            return {
                "reply": self._overview_reply(rec["schemes"], lang),
                "profile": profile.as_dict(),
                "schemes": rec["schemes"],
                "total_benefit_inr": 0,
                "used_adk": False,
                "mode": rec["mode"],
                "general_info": True,
            }
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

    @staticmethod
    def _meta_reply(message: str, profile: UserProfile, lang: str) -> Optional[str]:
        """Return a friendly intro for greetings / 'what is this' style questions.

        Only triggers when the citizen gave no eligibility details, so genuine
        scheme requests (even short ones) still run the recommendation pipeline."""
        text = (message or "").strip().lower()
        if not text or profile.as_dict():
            return None

        # A message that mentions schemes/benefits is a real request, not small talk.
        scheme_words = ("scheme", "yojana", "योजना", "benefit", "लाभ", "eligible", "पात्र",
                        "scholarship", "pension", "loan", "subsidy", "apply", "money", "help me")
        if any(w in text for w in scheme_words):
            return None

        greetings = ("hi", "hii", "hello", "hey", "namaste", "namaskar", "नमस्ते", "नमस्कार", "हाय")
        about = ("what is this", "what's this", "whats this", "what is sarkarsathi", "who are you",
                 "what are you", "what r u", "who r u", "whats sarkarsathi", "what is your name",
                 "your name", "about you", "about this", "what is this app", "what is this website",
                 "what can you do", "what do you do", "what all can you", "how does this work",
                 "how do you work", "what is it", "tell me about you", "help",
                 "यह क्या है", "ये क्या है", "यह क्या हैं", "आप कौन", "आप क्या", "क्या कर सकते",
                 "कैसे काम", "आपका नाम")
        question_words = ("what", "who", "how", "why", "kya", "क्या", "कौन", "कैसे", "क्यों")
        assistant_refs = ("you", "u", "this", "it", "sarkarsathi", "app", "website", "आप", "यह", "ये", "इस")
        words = text.replace("?", "").split()
        looks_like_short_question = (
            text.endswith("?") or (words and words[0] in question_words)
        ) and len(words) <= 6 and any(ref in words for ref in assistant_refs)
        is_greeting = text in greetings or any(text.startswith(g + " ") for g in greetings)
        is_about = any(a in text for a in about) or looks_like_short_question
        if not (is_greeting or is_about):
            return None

        if lang == "hi":
            return (
                "नमस्ते! मैं SarkarSathi हूँ — भारत सरकार की कल्याणकारी योजनाओं के लिए आपका सहायक। "
                "मैं छात्रों, किसानों, महिलाओं, वरिष्ठ नागरिकों, उद्यमियों और आम नागरिकों को उनके लिए उपयुक्त "
                "योजनाएँ खोजने में मदद करता हूँ।\n\n"
                "बस अपने बारे में थोड़ा बताइए — जैसे: \"मैं उत्तर प्रदेश से 19 वर्षीय छात्रा हूँ, पारिवारिक आय ₹2 लाख\"। "
                "आप बाईं ओर दिए फ़ॉर्म में आयु, राज्य, आय, लिंग आदि भरकर भी योजनाएँ पा सकते हैं।"
            )
        return (
            "Hello! I'm SarkarSathi — your assistant for Indian government welfare schemes. "
            "I help students, farmers, women, senior citizens, entrepreneurs and the general "
            "public find the schemes they're eligible for and how to apply.\n\n"
            "Just tell me a little about yourself — for example: \"I'm a 19-year-old girl from "
            "Uttar Pradesh pursuing B.Tech, family income ₹2 lakh\". You can also fill the "
            "Citizen Profile form on the left (age, state, income, gender, occupation) to get "
            "matched instantly."
        )

    @staticmethod
    def _is_general_info(message: str, profile: UserProfile) -> bool:
        """True for general 'tell me about the schemes' questions.

        A personalised benefit estimate is only shown once the citizen gives a
        concrete identifier (age, income or state) or uses the profile form.
        A category/gender word alone (e.g. 'women schemes') stays an overview."""
        text = (message or "").strip().lower()
        scheme_words = ("scheme", "schemes", "yojana", "yojna", "yojanas",
                        "योजना", "योजनाओं", "योजनाएं", "योजनाएँ", "योजनाये")
        if not any(w in text for w in scheme_words):
            return False
        has_personal_detail = (
            profile.age is not None or profile.income is not None or profile.state is not None
        )
        return not has_personal_detail

    @staticmethod
    def _overview_reply(schemes: List[Dict], lang: str) -> str:
        """A general, non-personalised overview grouped by category."""
        groups: Dict[str, List[Dict]] = {}
        for s in schemes:
            groups.setdefault(s.get("category", "Other"), []).append(s)

        if lang == "hi":
            lines = ["ज़रूर! भारत सरकार की योजनाएँ इन श्रेणियों में उपलब्ध हैं:"]
            for cat, items in groups.items():
                names = ", ".join(x["scheme_name"] for x in items[:3])
                lines.append(f"\n📌 {cat} ({len(items)}): {names}" + (" आदि" if len(items) > 3 else ""))
            lines.append(
                "\nयह एक सामान्य सूची है। अपनी सटीक पात्रता और अनुमानित लाभ जानने के लिए कृपया अपनी आयु, "
                "राज्य, आय, लिंग या व्यवसाय बताएं — या बाईं ओर दिया फ़ॉर्म भरें।"
            )
            return "\n".join(lines)

        lines = ["Sure! Government schemes are available across these categories:"]
        for cat, items in groups.items():
            names = ", ".join(x["scheme_name"] for x in items[:3])
            lines.append(f"\n📌 {cat} ({len(items)}): {names}" + (" and more" if len(items) > 3 else ""))
        lines.append(
            "\nThis is a general list. To see which ones YOU qualify for and your estimated "
            "benefit, tell me your age, state, income, gender or occupation — or fill the "
            "Citizen Profile form on the left."
        )
        return "\n".join(lines)

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
                "आपकी वर्तमान जानकारी के लिए अभी कोई योजना नहीं मिली। कृपया राज्य, आयु, आय, "
                "लिंग या व्यवसाय जैसी थोड़ी और जानकारी जोड़ें ताकि मैं सही योजनाएँ सुझा सकूँ।"
                if lang == "hi"
                else "I couldn't match a scheme to the details given yet. Add a little more "
                "(state, age, income, gender or occupation) and I'll find the right schemes for you."
            )
        if not self.settings.gemini_enabled:
            return self._template_explanation(profile, schemes, lang)

        lang_name = "Hindi (Devanagari)" if lang == "hi" else "English"
        context = "\n".join(
            f"- {s['scheme_name']} ({s['level']}, {s['state']}) | benefit: {s['benefit_text']} | "
            f"why: {'; '.join(s.get('reasons', []))}"
            for s in schemes
        )
        prompt = (
            "You are SarkarSathi, a warm and knowledgeable assistant that helps every Indian "
            "citizen — students, farmers, women, senior citizens, entrepreneurs, persons with "
            "disability and the general public — understand the government welfare schemes they "
            "qualify for.\n"
            "Rules:\n- Use ONLY the schemes listed below. Do NOT invent schemes or eligibility.\n"
            "- Open with a short, friendly sentence acknowledging who the citizen is.\n"
            "- Group your answer by scheme category (e.g. Education, Farmers, Women, Health, "
            "Senior Citizens) when there is more than one.\n"
            "- Cite each scheme by its exact name and briefly state WHY the user qualifies "
            "using the provided reasons, plus the benefit amount.\n"
            "- End with one encouraging next-step line. Be concise. "
            f"Respond entirely in {lang_name}.\n\n"
            f"User profile: {profile.as_dict()}\n"
            f"User question: {query or 'Which schemes am I eligible for?'}\n\n"
            f"Eligible schemes (already verified by our eligibility engine):\n{context}\n\n"
            "Write the answer now."
        )
        try:
            return self._gemini_text(prompt).strip()
        except Exception as exc:  # pragma: no cover
            return f"{self._template_explanation(profile, schemes, lang)}\n\n(AI explanation offline: {exc})"

    @staticmethod
    def _template_explanation(profile: UserProfile, schemes: List[Dict], lang: str) -> str:
        """Warm, organised offline answer — grouped by category, useful to any citizen."""
        total = sum(int(s.get("benefit_annual_inr", 0)) for s in schemes)

        # Greeting tailored to who the citizen is.
        who: List[str] = []
        if profile.age is not None and profile.age >= 60:
            who.append("वरिष्ठ नागरिक" if lang == "hi" else "senior citizen")
        if profile.occupation:
            occ_hi = {"Student": "छात्र", "Farmer": "किसान", "Entrepreneur": "उद्यमी",
                      "Self-Employed": "स्वरोज़गार", "Unemployed": "रोज़गार की तलाश में"}
            who.append(occ_hi.get(profile.occupation, profile.occupation) if lang == "hi" else profile.occupation.lower())
        if profile.gender == "Female" and "किसान" not in who and "farmer" not in who:
            who.append("महिला" if lang == "hi" else "woman")

        # Group schemes by category.
        groups: Dict[str, List[Dict]] = {}
        for s in schemes:
            groups.setdefault(s.get("category", "Other"), []).append(s)

        lines: List[str] = []
        if lang == "hi":
            role = (" (" + ", ".join(who) + ")") if who else ""
            lines.append(f"नमस्ते! आपकी जानकारी{role} के आधार पर आप इन योजनाओं के लिए पात्र दिख रहे हैं:")
            for category, items in groups.items():
                lines.append(f"\n📌 {category}")
                for s in items:
                    lines.append(f"  • {s['scheme_name']} — {s['benefit_text']}")
            lines.append(f"\nकुल अनुमानित वार्षिक लाभ: ₹{total:,}।")
            lines.append("किसी भी योजना पर 'Apply' दबाकर आवेदन शुरू करें या 'Docs' से ज़रूरी दस्तावेज़ देखें।")
        else:
            role = (" (" + ", ".join(who) + ")") if who else ""
            lines.append(f"Hello! Based on your details{role}, you appear eligible for these schemes:")
            for category, items in groups.items():
                lines.append(f"\n📌 {category}")
                for s in items:
                    lines.append(f"  • {s['scheme_name']} — {s['benefit_text']}")
            lines.append(f"\nEstimated combined annual benefit: ₹{total:,}.")
            lines.append("Tap 'Apply' on any card to begin, or 'Docs' to see the documents you'll need.")
        return "\n".join(lines)

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
