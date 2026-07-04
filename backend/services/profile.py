"""Citizen profile model + heuristic natural-language parser.

The structured profile mirrors the fields used by the eligibility engine.
`heuristic_profile` is the offline fallback used when Gemini/ADK is unavailable;
the ADK Profile Builder agent produces the same shape when a key is configured.
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Optional


@dataclass
class UserProfile:
    age: Optional[int] = None
    state: Optional[str] = None
    income: Optional[int] = None  # annual family income in INR
    gender: Optional[str] = None  # Male | Female | Any
    education: Optional[str] = None  # School | UG | PG | Diploma | Any
    occupation: Optional[str] = None  # Student | Farmer | Entrepreneur | ...
    social_category: Optional[str] = None  # SC | ST | OBC | General | Any
    land_owner: Optional[bool] = None
    disability: Optional[bool] = None
    maternity: Optional[bool] = None  # pregnant woman / new mother

    def as_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}

    @classmethod
    def from_dict(cls, data: dict) -> "UserProfile":
        allowed = {f for f in cls.__dataclass_fields__}  # type: ignore[attr-defined]
        return cls(**{k: v for k, v in (data or {}).items() if k in allowed and v is not None})

    def merged_with(self, override: "UserProfile") -> "UserProfile":
        """Return a new profile where non-None fields of `override` take precedence.

        Used to let explicit Citizen Profile form selections (the override)
        win over fields inferred from free text, so the chosen filters always
        apply (e.g. Gender = Female must exclude male-only schemes)."""
        merged = asdict(self)
        for key, value in asdict(override).items():
            if value is not None:
                merged[key] = value
        return UserProfile(**merged)


_STATES = [
    "uttar pradesh", "bihar", "maharashtra", "karnataka", "kerala", "tamil nadu",
    "rajasthan", "gujarat", "punjab", "haryana", "delhi", "west bengal",
    "madhya pradesh", "telangana", "andhra pradesh", "odisha", "assam",
]


def heuristic_profile(message: str) -> UserProfile:
    """Small rule-based parser used when the LLM profile agent is unavailable."""
    msg = (message or "").lower()
    p = UserProfile()

    m = re.search(r"(\d{1,3})\s*(?:year|yr|yrs|saal|साल|वर्ष)", msg)
    if m:
        p.age = int(m.group(1))

    lakh = re.search(r"(\d+(?:\.\d+)?)\s*lakh", msg)
    if lakh:
        p.income = int(float(lakh.group(1)) * 100000)
    else:
        rupees = re.search(r"(?:income|₹|rs\.?)\s*([\d,]{4,})", msg)
        if rupees:
            p.income = int(rupees.group(1).replace(",", ""))

    if any(w in msg for w in ["student", "b.tech", "btech", "bsc", "b.sc", "college", "छात्र"]):
        p.occupation, p.education = "Student", "UG"
    if any(w in msg for w in ["farmer", "किसान", "kisan", "kheti", "खेती"]):
        p.occupation = "Farmer"
    if any(w in msg for w in ["entrepreneur", "business", "startup", "shop", "व्यवसाय", "उद्यमी", "दुकान"]):
        p.occupation = "Entrepreneur"
    if any(w in msg for w in ["self employed", "self-employed", "freelanc", "स्वरोज़गार", "स्वरोजगार"]):
        p.occupation = "Self-Employed"
    if any(w in msg for w in ["unemployed", "jobless", "no job", "looking for work", "बेरोज़गार", "बेरोजगार"]):
        p.occupation = "Unemployed"
    if any(w in msg for w in ["girl", "woman", "female", "महिला", "लड़की", "daughter", "widow", "विधवा",
                              "housewife", "homemaker", "गृहिणी", "बेटी", "mahila"]):
        p.gender = "Female"
    elif any(w in msg for w in [" man ", "male", "boy", "पुरुष", "लड़का", "बेटा"]):
        p.gender = "Male"
    if any(w in msg for w in ["pregnant", "expecting", "new mother", "गर्भवती", "प्रसूत"]):
        p.maternity, p.gender = True, "Female"
    if any(w in msg for w in ["disabled", "disability", "divyang", "दिव्यांग", "handicap", "विकलांग"]):
        p.disability = True
    if any(w in msg for w in ["own land", "land owner", "farmland", "खेत", "जमीन", "ज़मीन"]):
        p.land_owner = True
    # Senior citizens: infer a qualifying age when only descriptive words are given.
    if p.age is None and any(
        w in msg for w in ["senior citizen", "old age", "elderly", "retired", "pensioner",
                            "वरिष्ठ नागरिक", "बुज़ुर्ग", "बुजुर्ग", "वृद्ध", "पेंशन"]
    ):
        p.age = 65
    for cat in ["sc", "st", "obc", "general"]:
        if re.search(rf"\b{cat}\b", msg):
            p.social_category = cat.upper()
            break

    for st in _STATES:
        if st in msg:
            p.state = st.title()
            break
    if p.state is None and re.search(r"\bup\b", msg):
        p.state = "Uttar Pradesh"
    return p
