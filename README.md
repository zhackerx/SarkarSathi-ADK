# SarkarSathi ADK 🇮🇳

> **Agentic** government-scheme assistant for Indian citizens, built on the
> **Google Agent Development Kit (ADK)**. An orchestrator agent coordinates six
> specialised agents (Eligibility, Recommendation, Explainability, Application
> Guide, Document Verification, Multilingual Response) to tell a citizen which
> welfare schemes they qualify for — with transparent, verified reasoning.

This is an **ADK re-implementation** of the reference `SarkarSathi-AI` project,
using the requested stack:

| Layer | Technology |
| --------------- | --------------------------------------------- |
| Frontend | HTML, CSS, JavaScript, Bootstrap |
| Backend | Flask |
| AI | Gemini 2.5 Flash |
| Agent Framework | Google ADK |
| Retrieval | JSON (MVP) → Vertex AI Vector Search (Future) |
| Storage | JSON → BigQuery |
| OCR | Google Vision API (or Gemini Multimodal) |
| Translation | Google Cloud Translation |
| Speech | Speech-to-Text API (browser Web Speech in MVP)|
| Analytics | BigQuery + Looker |

---

## 🏗️ Architecture (matches the diagram)

```
Citizen (text / voice / Hindi)
        │
        ▼
Bootstrap Frontend ──► Flask Backend API
                            │
                     ADK Agent Orchestrator  (root_agent, Gemini 2.5 Flash)
        ┌───────────────┬───────────────┬───────────────┬───────────────┐
        ▼               ▼               ▼               ▼               ▼
  Eligibility     Scheme Recomm.   Explainability  Application      Document
    Agent           Agent             Agent        Guide Agent     Verification
        └───────────────┴──────► verified tools (services/) ◄───────┘
                            │
                    Multilingual Response Agent
                            │
        Eligible schemes · Why eligible · Benefit ₹ · Steps · Checklist
```

The **six agents map 1:1 to the boxes** in the architecture PNG. Deterministic
tools in `backend/services/` guarantee no hallucinated eligibility; the agents
add reasoning, ranking, guidance and localisation.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10–3.12
- (Optional) A **Gemini API key** — free at https://aistudio.google.com/apikey
  - Without a key the app still runs in **offline demo mode** (deterministic
    engine + template responses). With a key it runs the **real ADK agents**.

### Run

```powershell
cd "SarkarSathi-ADK\backend"
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env      # then edit .env and paste your GOOGLE_API_KEY
python app.py
```

Open **http://localhost:8080** — the Flask server serves both the API and the UI.

### Run the agents in the ADK dev UI (optional)

```powershell
cd "SarkarSathi-ADK\backend"
adk web            # then pick the "agents" app, or:
adk run agents
```

`agents/adk_agents.py` exposes `root_agent` for ADK tooling.

---

## 🔌 API

| Method | Path | Purpose |
| ------ | ----------------------- | ------------------------------------------------ |
| GET | `/api/health` | Engine + agent mode status |
| GET | `/api/agents` | The ADK agent catalog (drives the UI diagram) |
| GET | `/api/schemes` | Full scheme knowledge base |
| POST | `/api/recommend` | Structured profile → eligible schemes |
| POST | `/api/chat` | Free text → profile extraction → recommendation |
| POST | `/api/agent` | Runs the **real ADK Orchestrator** |
| POST | `/api/documents/check` | Document readiness check |

Example:

```bash
curl -X POST http://localhost:8080/api/recommend -H "Content-Type: application/json" \
  -d '{"profile":{"age":19,"gender":"Female","state":"Uttar Pradesh","education":"UG","occupation":"Student","income":200000},"lang":"en"}'
```

---

## 📁 Project structure

```
SarkarSathi-ADK/
├── README.md
├── IMPLEMENTATION_PLAN.md
├── backend/
│   ├── app.py                     # Flask app + API + serves frontend
│   ├── config.py                  # env / settings
│   ├── requirements.txt
│   ├── .env.example
│   ├── data/schemes.json          # 45-scheme knowledge base (shared with reference)
│   ├── services/                  # deterministic, verified domain logic
│   │   ├── profile.py             # profile model + heuristic parser
│   │   ├── knowledge_base.py      # JSON loader (→ BigQuery later)
│   │   ├── eligibility_engine.py  # explainable eligibility rules
│   │   ├── rag.py                 # embedding / keyword retrieval (→ Vertex)
│   │   ├── benefit.py             # benefit calculator
│   │   └── document_check.py      # document readiness
│   └── agents/                    # Google ADK layer
│       ├── adk_agents.py          # 6 sub-agents + root Orchestrator (root_agent)
│       ├── tools.py               # ADK FunctionTools over services/
│       └── engine.py              # orchestration + graceful fallback
└── frontend/                      # HTML + CSS + JS + Bootstrap
    ├── index.html
    ├── css/style.css
    └── js/app.js
```

---

## 🧪 Demo script (for judges)

1. Open the app → click **"Try sample"**.
2. Click **"Ask the Agents"** — watch the ADK agent pipeline light up.
3. Show the eligible schemes, the **✓ "Eligible because…"** reasons, and the
   **₹ estimated combined annual benefit** banner.
4. Toggle **हिंदी**, ask again by **voice** (mic button), show the localised answer.
5. Click **Docs** on a scheme → type a document you have → show readiness %.

---

## 🔐 Notes

- `backend/data/schemes.json` is **illustrative sample data**. For production,
  replace it with an ingestion pipeline over official Central/State sources and
  move retrieval to **Vertex AI Vector Search** and storage to **BigQuery**.
- Never commit your real API key. Use `.env` locally and Secret Manager in prod.
