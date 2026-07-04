"""Estimated-benefit calculator (used by the Scheme Recommendation Agent)."""
from typing import Dict, List


def calculate_total_benefit(schemes: List[Dict]) -> int:
    return sum(int(s.get("benefit_annual_inr", 0)) for s in schemes)


def benefit_summary(schemes: List[Dict], lang: str = "en") -> str:
    total = calculate_total_benefit(schemes)
    count = len(schemes)
    if lang == "hi":
        if count == 0:
            return "आपकी प्रोफ़ाइल के अनुसार अभी कोई योजना नहीं मिली।"
        return (
            f"आप {count} योजनाओं के लिए पात्र प्रतीत होते हैं, "
            f"जिनका अनुमानित संयुक्त वार्षिक लाभ ₹{total:,} है।"
        )
    if count == 0:
        return "No matching schemes found for this profile yet."
    return (
        f"You appear eligible for {count} scheme(s) with an estimated "
        f"combined annual benefit of ₹{total:,}."
    )
