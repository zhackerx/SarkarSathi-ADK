# SarkarSathi ADK 🇮🇳

> **Agentic** government-scheme assistant for Indian citizens, built on the
> **Google Agent Development Kit (ADK)**. An orchestrator agent coordinates six
> specialised agents (Eligibility, Recommendation, Explainability, Application
> Guide, Document Verification, Multilingual Response) to tell a citizen which
> welfare schemes they qualify for — with transparent, verified reasoning.

This is an **ADK re-implementation** of the reference `SarkarSathi-AI` project,
using the requested stack:

## ✨ Refined experience (recent updates)

The application has been refined into a more polished, citizen-focused experience with a dedicated dashboard that feels like a natural extension of the existing interface. Recent improvements include:

- A **Citizen Dashboard** that appears after successful login, providing a central place to review scheme activity.
- A **Dashboard** entry in the top navigation, with seamless **Home ↔ Dashboard** switching.
- A **Search for Schemes** quick action that connects directly to the existing profile/scheme discovery flow.
- Responsive summary cards for **Applied**, **Pending**, **Completed**, **Deadline Running**, and **Documents Missing**.
- Dedicated sections for **Saved Schemes**, **Your Schemes**, and **Suggested Schemes** tailored to the citizen profile.
- UI refinements that preserve the existing **Bootstrap layout**, **dark/light mode**, **language switching**, and **responsive behaviour**.

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

### Run the frontend locally

The frontend is served directly by the Flask app, but for quick local preview you can also open the static frontend files in a browser from the project root.

```powershell
cd "SarkarSathi-ADK"
python -m http.server 8124 --directory frontend
```

Then open http://127.0.0.1:8124/index.html.

### Prerequisites
- Python 3.10–3.12
- A Google Cloud project with the Vertex AI API enabled
- Local auth via `gcloud auth application-default login` (no API key needed)
  - Without a configured project the app still runs in **offline demo mode**
    (deterministic engine + template responses). With Vertex AI configured
    it runs the **real ADK agents**.

### Run

```powershell
cd "SarkarSathi-ADK\backend"
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env      # then edit .env with your GOOGLE_CLOUD_PROJECT
python app.py
```

Open **http://localhost:8080** — the Flask server serves both the API and the UI.

#### macOS / Linux (bash)

```bash
cd SarkarSathi-ADK/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then edit .env with your GOOGLE_CLOUD_PROJECT
python app.py
```

### Run with Docker (runs anywhere)

```bash
# from the project root (where the Dockerfile is)
docker build -t sarkarsathi-adk .
docker run -p 8080:8080 \
  -e GOOGLE_GENAI_USE_VERTEXAI=True -e GOOGLE_CLOUD_PROJECT=your-project-id \
  -v ~/.config/gcloud:/root/.config/gcloud sarkarsathi-adk
```

Then open http://localhost:8080. Omit the Vertex env vars to run in offline demo mode.

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

1. Open the app and log in with the demo OTP flow.
2. Observe the new **Citizen Dashboard** with activity summary cards and quick actions.
3. Click **"Search for Schemes"** to move into the profile-driven discovery flow.
4. Click **"Ask the Agents"** — watch the ADK agent pipeline light up.
5. Show the eligible schemes, the **✓ "Eligible because…"** reasons, and the
   **₹ estimated combined annual benefit** banner.
6. Toggle **हिंदी**, ask again by **voice** (mic button), show the localised answer.
7. Click **Docs** on a scheme → type a document you have → show readiness %.

---

## 🔐 Notes

- `backend/data/schemes.json` is **illustrative sample data**. For production,
  replace it with an ingestion pipeline over official Central/State sources and
  move retrieval to **Vertex AI Vector Search** and storage to **BigQuery**.
- Never commit your real API key. Use `.env` locally and Secret Manager in prod.
