"""Loads the curated scheme knowledge base (JSON MVP -> Vertex/BigQuery later)."""
import json
from functools import lru_cache
from typing import Dict, List

from config import DATA_FILE


@lru_cache
def load_schemes() -> List[Dict]:
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def schemes_by_id() -> Dict[str, Dict]:
    return {s["id"]: s for s in load_schemes()}


def scheme_to_text(scheme: Dict) -> str:
    """Flatten a scheme into a text blob for embedding / retrieval."""
    e = scheme.get("eligibility", {})
    return (
        f"{scheme['scheme_name']} ({scheme['level']} scheme, {scheme['state']}). "
        f"Category: {scheme['category']}. "
        f"For age {e.get('min_age')}-{e.get('max_age')}, "
        f"income up to {e.get('income_limit')}, "
        f"gender {e.get('gender')}, education {e.get('education')}, "
        f"occupation {e.get('occupation')}, category {e.get('social_category')}. "
        f"Benefit: {scheme['benefit_text']}. "
        f"Documents: {', '.join(scheme['documents'])}."
    )
