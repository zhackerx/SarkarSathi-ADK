"""Deterministic, explainable eligibility engine (the Eligibility Agent's tool).

Runs BEFORE any LLM reasoning. For each scheme it produces human-readable
pass/fail reasons, guaranteeing no hallucinated eligibility.
"""
from typing import Dict, List, Tuple

from services.profile import UserProfile


def _fmt_inr(value: int) -> str:
    return f"₹{value:,}"


def evaluate_scheme(profile: UserProfile, scheme: Dict) -> Tuple[bool, List[str]]:
    """Return (is_eligible, reasons). Missing profile fields are treated leniently
    so partial profiles still surface candidate schemes."""
    e = scheme.get("eligibility", {})
    reasons: List[str] = []
    eligible = True

    # Age
    if profile.age is not None:
        lo, hi = e.get("min_age", 0), e.get("max_age", 120)
        if lo <= profile.age <= hi:
            reasons.append(f"✓ Age {profile.age} within {lo}-{hi}")
        else:
            eligible = False
            reasons.append(f"✗ Age {profile.age} outside required {lo}-{hi}")

    # State
    scheme_state = scheme.get("state", "All")
    if profile.state and scheme_state != "All":
        if profile.state.strip().lower() == scheme_state.strip().lower():
            reasons.append(f"✓ Resident of {scheme_state}")
        else:
            eligible = False
            reasons.append(f"✗ Scheme limited to {scheme_state}")
    elif scheme_state == "All":
        reasons.append("✓ Available in all states")

    # Income
    if profile.income is not None:
        limit = e.get("income_limit")
        if limit is not None:
            if profile.income <= limit:
                reasons.append(f"✓ Income {_fmt_inr(profile.income)} ≤ limit {_fmt_inr(limit)}")
            else:
                eligible = False
                reasons.append(f"✗ Income {_fmt_inr(profile.income)} exceeds limit {_fmt_inr(limit)}")

    # Gender
    req_gender = e.get("gender", "Any")
    if profile.gender and req_gender not in ("Any", None):
        if profile.gender.strip().lower() == req_gender.strip().lower():
            reasons.append(f"✓ Gender requirement ({req_gender}) met")
        else:
            eligible = False
            reasons.append(f"✗ Scheme is for {req_gender} applicants")

    # Education
    req_edu = [x.lower() for x in e.get("education", [])]
    if profile.education and req_edu and "any" not in req_edu:
        if profile.education.strip().lower() in req_edu:
            reasons.append(f"✓ Education level ({profile.education}) matches")
        else:
            eligible = False
            reasons.append(f"✗ Requires education in {e.get('education')}")

    # Occupation
    req_occ = [x.lower() for x in e.get("occupation", [])]
    if profile.occupation and req_occ and "any" not in req_occ:
        if profile.occupation.strip().lower() in req_occ:
            reasons.append(f"✓ Occupation ({profile.occupation}) matches")
        else:
            eligible = False
            reasons.append(f"✗ Requires occupation in {e.get('occupation')}")

    # Social category (reserved schemes need an explicit matching category)
    req_cat = [x.lower() for x in e.get("social_category", [])]
    if req_cat and "any" not in req_cat:
        if profile.social_category and profile.social_category.strip().lower() in req_cat:
            reasons.append(f"✓ Category ({profile.social_category}) eligible")
        else:
            eligible = False
            reasons.append(f"✗ Reserved for {e.get('social_category')} category")

    # Land ownership (farmer schemes)
    if e.get("requires_land"):
        if profile.land_owner is True:
            reasons.append("✓ Owns agricultural land")
        elif profile.land_owner is False:
            eligible = False
            reasons.append("✗ Requires agricultural land ownership")

    # Disability-only schemes (opt-in)
    if e.get("disability_only"):
        if profile.disability is True:
            reasons.append("✓ Registered person with disability")
        else:
            eligible = False
            reasons.append("✗ Only for persons with disability")

    # Maternity schemes (opt-in)
    if e.get("requires_maternity"):
        if profile.maternity is True:
            reasons.append("✓ Pregnant woman / new mother")
        else:
            eligible = False
            reasons.append("✗ Only for pregnant women or new mothers")

    return eligible, reasons


def filter_eligible(profile: UserProfile, schemes: List[Dict]) -> List[Dict]:
    """Return schemes the user is eligible for, annotated with reasons."""
    results: List[Dict] = []
    for scheme in schemes:
        eligible, reasons = evaluate_scheme(profile, scheme)
        if eligible:
            enriched = dict(scheme)
            enriched["reasons"] = reasons
            enriched["match_percent"] = match_percent(profile, scheme)
            results.append(enriched)
    return results


def match_percent(profile: UserProfile, scheme: Dict) -> int:
    """Confidence score (65-100%) showing how strongly the profile corroborates
    an (already eligible) scheme. 100% when every restrictive criterion the
    scheme defines was positively verified from the profile."""
    e = scheme.get("eligibility", {})
    total = 0
    met = 0

    def check(is_restrictive: bool, is_met: bool) -> None:
        nonlocal total, met
        if is_restrictive:
            total += 1
            if is_met:
                met += 1

    check(e.get("min_age", 0) > 0 or e.get("max_age", 120) < 120,
          profile.age is not None and e.get("min_age", 0) <= profile.age <= e.get("max_age", 120))
    check(scheme.get("state", "All") != "All",
          bool(profile.state) and profile.state.strip().lower() == scheme.get("state", "").strip().lower())
    check(e.get("income_limit") is not None,
          profile.income is not None and e.get("income_limit") is not None and profile.income <= e["income_limit"])
    check(e.get("gender", "Any") not in ("Any", None),
          bool(profile.gender) and profile.gender.strip().lower() == str(e.get("gender", "")).strip().lower())
    edu = [x.lower() for x in e.get("education", [])]
    check(bool(edu) and "any" not in edu,
          bool(profile.education) and profile.education.strip().lower() in edu)
    occ = [x.lower() for x in e.get("occupation", [])]
    check(bool(occ) and "any" not in occ,
          bool(profile.occupation) and profile.occupation.strip().lower() in occ)
    cat = [x.lower() for x in e.get("social_category", [])]
    check(bool(cat) and "any" not in cat,
          bool(profile.social_category) and profile.social_category.strip().lower() in cat)
    check(bool(e.get("requires_land")), profile.land_owner is True)
    check(bool(e.get("disability_only")), profile.disability is True)
    check(bool(e.get("requires_maternity")), profile.maternity is True)

    if total == 0:
        return 100
    return max(65, round(100 - 35 * (total - met) / total))
