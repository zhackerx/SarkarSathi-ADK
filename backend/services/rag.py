"""RAG retriever (the Scheme Recommendation Agent's ranking tool).

- Primary: Gemini/Vertex text embeddings + cosine similarity (in-memory).
- Fallback: keyword overlap scoring, so the demo works without embeddings.

JSON MVP now -> Vertex AI Vector Search in production.
"""
from typing import Dict, List

import numpy as np

from config import get_settings
from services.knowledge_base import scheme_to_text

settings = get_settings()

_embedding_cache: Dict[str, List[float]] = {}


def _embed(text: str):
    if not settings.gemini_enabled:
        return None
    if text in _embedding_cache:
        return _embedding_cache[text]
    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.google_api_key)
        result = genai.embed_content(
            model=f"models/{settings.embedding_model}", content=text
        )
        vec = result["embedding"]
        _embedding_cache[text] = vec
        return vec
    except Exception:
        return None


def _cosine(a, b) -> float:
    va, vb = np.array(a), np.array(b)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    return float(np.dot(va, vb) / denom) if denom else 0.0


def _keyword_score(query: str, scheme: Dict) -> float:
    q_tokens = {t for t in query.lower().split() if len(t) > 2}
    text = scheme_to_text(scheme).lower()
    if not q_tokens:
        return 0.0
    hits = sum(1 for t in q_tokens if t in text)
    return hits / len(q_tokens)


def rank_schemes(query: str, schemes: List[Dict], top_k: int | None = None) -> List[Dict]:
    """Return schemes sorted by relevance to `query`, annotated with `score`."""
    top_k = top_k or settings.rag_top_k
    if not schemes:
        return []

    query = query or "government welfare schemes"
    q_vec = _embed(query)

    scored: List[Dict] = []
    for scheme in schemes:
        if q_vec is not None:
            s_vec = _embed(scheme_to_text(scheme))
            score = _cosine(q_vec, s_vec) if s_vec is not None else _keyword_score(query, scheme)
        else:
            score = _keyword_score(query, scheme)
        enriched = dict(scheme)
        enriched["score"] = round(score, 4)
        scored.append(enriched)

    scored.sort(key=lambda s: s["score"], reverse=True)
    return scored[:top_k]
