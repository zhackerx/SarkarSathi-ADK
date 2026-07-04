"""ADK FunctionTools — thin wrappers over the deterministic service layer.

Each tool reads the citizen profile / working data from the ADK session state
(`tool_context.state`) and writes its results back, so the orchestrator and its
sub-agents can collaborate over shared state. The heavy lifting lives in
`services/`, guaranteeing verified (non-hallucinated) eligibility.
"""
from typing import List

from google.adk.tools import ToolContext

from services.benefit import benefit_summary, calculate_total_benefit
from services.document_check import check_documents
from services.eligibility_engine import filter_eligible
from services.knowledge_base import load_schemes, schemes_by_id
from services.profile import UserProfile
from services.rag import rank_schemes


def build_citizen_profile(
    tool_context: ToolContext,
    age: int = 0,
    state: str = "",
    income: int = 0,
    gender: str = "",
    education: str = "",
    occupation: str = "",
    social_category: str = "",
    land_owner: bool = False,
    disability: bool = False,
    maternity: bool = False,
) -> dict:
    """Build a structured citizen profile from extracted attributes and store it.

    Use 0 / empty string for unknown numeric / text fields. Returns the stored profile.
    """
    data = {
        "age": age or None,
        "state": state or None,
        "income": income or None,
        "gender": gender or None,
        "education": education or None,
        "occupation": occupation or None,
        "social_category": social_category or None,
        "land_owner": land_owner or None,
        "disability": disability or None,
        "maternity": maternity or None,
    }
    profile = UserProfile.from_dict(data)
    tool_context.state["profile"] = profile.as_dict()
    return {"profile": profile.as_dict()}


def find_eligible_schemes(tool_context: ToolContext) -> dict:
    """Filter the curated knowledge base to schemes the citizen qualifies for.

    Reads the profile from session state; stores the eligible schemes back.
    """
    profile = UserProfile.from_dict(tool_context.state.get("profile", {}))
    eligible = filter_eligible(profile, load_schemes())
    tool_context.state["eligible_schemes"] = eligible
    return {
        "count": len(eligible),
        "schemes": [
            {"id": s["id"], "name": s["scheme_name"], "reasons": s.get("reasons", [])}
            for s in eligible
        ],
    }


def recommend_schemes(tool_context: ToolContext, query: str = "") -> dict:
    """Rank the eligible schemes by relevance and compute the combined benefit.

    Stores the ranked list and total benefit in session state.
    """
    eligible = tool_context.state.get("eligible_schemes", [])
    ranked = rank_schemes(query, eligible)
    total = calculate_total_benefit(ranked)
    tool_context.state["ranked_schemes"] = ranked
    tool_context.state["total_benefit_inr"] = total
    return {
        "total_benefit_inr": total,
        "top_schemes": [
            {"name": s["scheme_name"], "benefit": s["benefit_text"]} for s in ranked[:5]
        ],
    }


def explain_eligibility(tool_context: ToolContext, scheme_id: str) -> dict:
    """Return the deterministic pass reasons explaining WHY the citizen qualifies."""
    scheme = schemes_by_id().get(scheme_id, {})
    return {"scheme": scheme.get("scheme_name", scheme_id), "reasons": scheme.get("reasons", []) or _reasons_from_state(tool_context, scheme_id)}


def _reasons_from_state(tool_context: ToolContext, scheme_id: str) -> List[str]:
    for s in tool_context.state.get("eligible_schemes", []):
        if s.get("id") == scheme_id:
            return s.get("reasons", [])
    return []


def get_application_guide(tool_context: ToolContext, scheme_id: str) -> dict:
    """Return the step-by-step application guide, official link and documents."""
    scheme = schemes_by_id().get(scheme_id, {})
    return {
        "scheme": scheme.get("scheme_name", scheme_id),
        "apply_url": scheme.get("apply_url", ""),
        "documents": scheme.get("documents", []),
        "steps": scheme.get("steps", []),
    }


def verify_documents(tool_context: ToolContext, scheme_id: str, uploaded_documents: str) -> dict:
    """Check which required documents are present vs missing for a scheme.

    `uploaded_documents` is a comma/space separated description of files the
    citizen has (in production this comes from Vision OCR / Gemini multimodal).
    """
    scheme = schemes_by_id().get(scheme_id, {})
    result = check_documents(scheme.get("documents", []), uploaded_documents)
    tool_context.state["document_check"] = result
    return result


def summarise_benefit(tool_context: ToolContext, lang: str = "en") -> dict:
    """Produce a plain-language summary of the total estimated annual benefit."""
    ranked = tool_context.state.get("ranked_schemes", [])
    return {"summary": benefit_summary(ranked, lang), "lang": lang}
