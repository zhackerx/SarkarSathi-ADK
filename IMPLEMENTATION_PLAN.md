# Implementation Plan — SarkarSathi ADK

A phased, buildable plan for the ADK-based government-scheme assistant. Phases
1–5 are **implemented in this prototype**; Phases 6–8 are the production roadmap
that maps directly onto the architecture diagram.

---

## Phase 0 — Goals & scope

- **Problem:** Citizens miss welfare schemes they qualify for because eligibility
  is scattered, jargon-heavy and multilingual.
- **Solution:** An **agentic** assistant (Google ADK) that builds a citizen
  profile, finds verified eligible schemes, explains *why*, estimates benefit,
  guides application, checks documents, and replies in the citizen's language.
- **Principle:** Deterministic eligibility first (no hallucinations), LLM
  reasoning second.

---

## Phase 1 — Knowledge base (JSON MVP)  ✅

- Reuse the curated `data/schemes.json` (45 Central/State schemes).
- Each scheme has structured `eligibility`, `benefit_annual_inr`, `documents`,
  `apply_url`, `steps`.
- `services/knowledge_base.py` loads and flattens schemes for retrieval.
- **Future:** ingest official sources → **BigQuery**; embed → **Vertex AI Vector
  Search**.

---

## Phase 2 — Deterministic service layer  ✅

Verified, testable Python that the agents call as tools:

| Service | Responsibility |
| ------------------------- | ------------------------------------------- |
| `profile.py` | Citizen profile model + heuristic NL parser |
| `eligibility_engine.py` | Explainable pass/fail rules per scheme |
| `rag.py` | Embedding (Gemini) or keyword ranking |
| `benefit.py` | Combined annual benefit calculator |
| `document_check.py` | Required-vs-present document readiness |

---

## Phase 3 — ADK agent layer  ✅

`agents/adk_agents.py` defines the **root Orchestrator** + **six sub-agents**
(Gemini 2.5 Flash), one per box in the architecture diagram:

1. **ADK Agent Orchestrator** (`root_agent`) — builds the profile, delegates.
2. **Eligibility Agent** — `find_eligible_schemes`.
3. **Scheme Recommendation Agent** — `recommend_schemes`, `summarise_benefit`.
4. **Explainability Agent** — `explain_eligibility`.
5. **Application Guide Agent** — `get_application_guide`.
6. **Document Verification Agent** — `verify_documents`.
7. **Multilingual Response Agent** — localises the final answer.

`agents/tools.py` are ADK `FunctionTool`s that read/write shared session state
and wrap the Phase-2 services. `root_agent` is discoverable by `adk web`.

---

## Phase 4 — Orchestration engine + fallback  ✅

`agents/engine.py`:

- `recommend()` / `extract_profile()` — reliable pipeline for the main API.
- `run_orchestrator()` — executes the **real ADK Runner** over `root_agent`.
- **Graceful degradation:** if ADK or the API key is absent, the app runs in
  offline mode (deterministic engine + template responses) so demos never break.

---

## Phase 5 — Flask API + Bootstrap frontend  ✅

- `app.py` serves the REST API **and** the static UI.
- Frontend: profile form, free-text + **voice** (Web Speech API = Speech layer),
  EN/हिंदी toggle, **animated ADK agent pipeline**, scheme cards with reasons /
  steps / apply links, and a document-readiness modal.

---

## Phase 6 — Google Cloud services (production)

| Capability | Google service | Where it plugs in |
| ------------ | --------------------------- | --------------------------------------- |
| OCR | Vision API / Gemini multimodal | `document_check` → real extraction |
| Translation | Cloud Translation API | Multilingual Response Agent |
| Speech | Speech-to-Text API | replace browser Web Speech |
| Retrieval | Vertex AI Vector Search | `rag.py` embeddings backend |
| Storage | BigQuery + Cloud Storage | `knowledge_base.py` source |

Enable by uncommenting the client libraries in `requirements.txt` and wiring the
respective service in the matching module.

---

## Phase 7 — Deployment (Cloud Run)

```powershell
gcloud run deploy sarkarsathi-adk `
  --source backend `
  --region asia-south1 `
  --allow-unauthenticated `
  --set-env-vars GOOGLE_API_KEY=YOUR_KEY,GEMINI_MODEL=gemini-2.5-flash
```

Add a `Dockerfile` (python:3.12-slim → `pip install -r requirements.txt` →
`gunicorn app:app`). Store the key in **Secret Manager**.

---

## Phase 8 — Analytics (BigQuery + Looker)

- Log every request (profile snapshot, matched schemes, benefit) to BigQuery.
- Build a **Looker** dashboard: citizen insights, popular schemes, application
  trends, missing-document hotspots, regional analytics — matching the
  "Insights & Analytics" box in the diagram.

---

## Testing checklist

- [ ] `GET /api/health` returns a mode (`adk` / `gemini` / `offline-fallback`).
- [ ] Sample profile (19F, UP, UG student, ₹2L) returns education/women schemes.
- [ ] Farmer + land-owner returns PM-KISAN / KCC.
- [ ] Senior citizen (age 65, low income) returns IGNOAPS.
- [ ] Hindi toggle localises the explanation.
- [ ] Document check returns a readiness %.
