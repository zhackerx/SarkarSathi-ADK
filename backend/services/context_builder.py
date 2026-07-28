"""Flattens nested scheme JSON into a clean, LLM-readable grounding block.

This is the ONLY factual context the model is allowed to draw scheme
information from. Built fresh from the deterministic services every turn —
never assembled by the LLM, never left to conversation memory.
"""
from typing import Dict, List, Set

MAX_SCHEMES_IN_CONTEXT = 12  # keep prompts bounded on large eligible lists


def _flatten_scheme(s: Dict, tag: str = "ELIGIBLE") -> str:
    lines = [
        f"### {s['scheme_name']}  [{tag}]",
        f"- id: {s['id']}",
        f"- category: {s.get('category', 'Other')} | level: {s.get('level','')} | state: {s.get('state','')}",
        f"- benefit: {s.get('benefit_text','')} (₹{s.get('benefit_annual_inr', 0):,}/year)",
    ]
    reasons = s.get("reasons", [])
    if reasons:
        lines.append(f"- why eligible: {'; '.join(reasons)}")
    if tag == "NEAR-ELIGIBLE" and s.get("missing_criterion"):
        lines.append(f"- missing criterion: {s['missing_criterion']}")
    docs = s.get("documents", [])
    if docs:
        lines.append(f"- required documents: {', '.join(docs)}")
    steps = s.get("steps", [])
    if steps:
        lines.append("- application steps: " + " | ".join(f"{i+1}. {st}" for i, st in enumerate(steps)))
    if s.get("apply_url"):
        lines.append(f"- apply_url: {s['apply_url']}")
    return "\n".join(lines)


def build_grounding_context(
    eligible: List[Dict],
    near_eligible: List[Dict] | None = None,
    max_schemes: int = MAX_SCHEMES_IN_CONTEXT,
) -> str:
    """Build the single source-of-truth text block sent to the model."""
    near_eligible = near_eligible or []
    blocks: List[str] = []
    shown = 0
    for s in eligible:
        if shown >= max_schemes:
            blocks.append(f"...and {len(eligible) - shown} more eligible schemes not shown here.")
            break
        blocks.append(_flatten_scheme(s, "ELIGIBLE"))
        shown += 1
    if near_eligible:
        blocks.append("\n--- Schemes the citizen almost qualifies for ---")
        for s in near_eligible[:5]:
            blocks.append(_flatten_scheme(s, "NEAR-ELIGIBLE"))

    if not blocks:
        body = "(No schemes matched this citizen's current profile.)"
    else:
        body = "\n\n".join(blocks)

    return (
        "=== RETRIEVED SCHEME DATA (SOURCE OF TRUTH — DO NOT ADD SCHEMES NOT LISTED HERE) ===\n"
        f"{body}\n"
        "=== END OF RETRIEVED SCHEME DATA ==="
    )


def known_scheme_names(eligible, near_eligible=None):
    names = {s["scheme_name"] for s in eligible}
    names |= {s["scheme_name"] for s in (near_eligible or [])}
    # also treat known required documents as "grounded" terms, so mentioning
    # them (e.g. "Ration Card", "Aadhaar Card") doesn't false-positive the guard
    for s in eligible + (near_eligible or []):
        names |= set(s.get("documents", []))
    return names