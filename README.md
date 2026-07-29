# SarkarSathi ADK 🇮🇳

> **Agentic** government-scheme assistant for Indian citizens, built on the
> **Google Agent Development Kit (ADK)**. An orchestrator coordinates specialised
> agents to identify welfare schemes a citizen may qualify for, explain why,
> show expected benefits, and guide the next steps with transparent reasoning.

This project is an **ADK re-implementation** of the reference SarkarSathi concept,
using a lightweight Flask backend, a responsive Bootstrap frontend, and a
service-driven agent layer that can run in either **offline demo mode** or the
**real Gemini / Vertex AI ADK pipeline**.

---

## ✨ What’s new in this build

The application has been expanded into a more polished, citizen-focused experience.
Recent work includes:

- A **mobile OTP login flow** with a demo authentication path for quick demos.
- A **Citizen Dashboard** that appears after successful login, with summary cards and quick actions.
- A **Dashboard** entry in the navigation for smooth switching between Home and Dashboard.
- A **Search for Schemes** shortcut that leads into the profile-based discovery experience.
- A **Past Conversations** page that is gated to logged-in users only.
- A **Document Readiness** modal for each scheme where users can upload supporting files and remove them after upload.
- Improved **dark-mode styling** for the document modal, forms, cards, and uploaded-file list.
- Results rendering that waits for the full ADK pipeline animation to complete before switching to the results page.
- Support for **multilingual UI**, **voice input**, and **responsive Bootstrap layouts**.

---

## 🧱 Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, JavaScript, Bootstrap |
| Backend | Flask |
| AI | Gemini 2.5 Flash |
| Agent Framework | Google ADK |
| Retrieval | JSON (MVP) → Vertex AI Vector Search (future) |
| Storage | JSON → BigQuery (future) |
| OCR | Google Vision API or Gemini multimodal (future) |
| Translation | Google Cloud Translation (future) |
| Speech | Browser Web Speech / STT (MVP) |
| Analytics | BigQuery + Looker (future) |

---

## 🏗️ Architecture

The current implementation follows a layered design:

- The frontend collects profile, text, voice, and document inputs.
- The Flask backend exposes the UI and REST endpoints.
- The ADK orchestrator runs a set of specialised agents over deterministic services.
- The services provide explainable eligibility, benefit, document, profile, and knowledge-base logic.

```text
+-------------------+      +------------------------------+
| Citizen / User   | ---> | Frontend (HTML / CSS / JS)  |
+-------------------+      +------------------------------+
                                      |
                                      v
                           +------------------------------+
                           | Flask Backend / REST API     |
                           +------------------------------+
                                      |
                +-------------------------+-------------------------+
                |                         |                         |
                v                         v                         v
      +-------------------+      +-------------------------+      +----------------------------+
      | Auth / Session    |      | Profile + Scheme Data  |      | ADK Orchestrator / Engine |
      +-------------------+      +-------------------------+      +----------------------------+
                                                                            |
                     +----------------------------------------------------------+
                     |                                                          |
                     v                                                          v
      +-------------------------+                         +------------------------------+
      | Eligibility Agent       |                         | Recommendation / Explainability |
      +-------------------------+                         +------------------------------+
      | Application Guide Agent |                         | Document Verification Agent    |
      +-------------------------+                         +------------------------------+
      | Multilingual Agent      |                         | Deterministic Services         |
      +-------------------------+                         +------------------------------+
                     |
                     v
        +--------------------------------------+
        | Output: eligible schemes, reasons,  |
        | benefit, steps, and readiness info  |
        +--------------------------------------+
```

The deterministic tools in backend/services guarantee explainable eligibility logic,
while the agents add reasoning, ranking, guidance, and localisation.

---

## 🚀 Quick start

### Run the frontend locally

The frontend is served directly by the Flask app, but you can also preview it from the project root with a simple static server.

```powershell
cd "SarkarSathi-ADK"
python -m http.server 8124 --directory frontend
```

Then open http://127.0.0.1:8124/index.html.

### Prerequisites

- Python 3.10–3.12
- A Google Cloud project with the Vertex AI API enabled
- Local auth via gcloud application-default login (no API key needed)

Without a configured project, the app still runs in **offline demo mode** with deterministic responses. With Vertex AI configured, it runs the **real ADK agents**.

### Run the backend

```powershell
cd "SarkarSathi-ADK\backend"
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env      # then edit .env with your GOOGLE_CLOUD_PROJECT
python app.py
```

Open http://localhost:8080 — the Flask server serves both the API and the UI.

### macOS / Linux (bash)

```bash
cd SarkarSathi-ADK/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then edit .env with your GOOGLE_CLOUD_PROJECT
python app.py
```

### Run with Docker

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

The file backend/agents/adk_agents.py exposes root_agent for ADK tooling.

---

## 🔌 API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/health | Engine + agent mode status |
| GET | /api/agents | The ADK agent catalog |
| GET | /api/schemes | Full scheme knowledge base |
| POST | /api/recommend | Structured profile → eligible schemes |
| POST | /api/chat | Free text → profile extraction → recommendation |
| POST | /api/agent | Runs the real ADK orchestrator |
| POST | /api/documents/check | Document readiness check |

Example:

```bash
curl -X POST http://localhost:8080/api/recommend -H "Content-Type: application/json" \
  -d '{"profile":{"age":19,"gender":"Female","state":"Uttar Pradesh","education":"UG","occupation":"Student","income":200000},"lang":"en"}'
```

---

## 📁 Project structure

```text
SarkarSathi-ADK/
├── README.md
├── IMPLEMENTATION_PLAN.md
├── Dockerfile
├── backend/
│   ├── app.py                     # Flask app + API + serves the frontend
│   ├── config.py                  # environment / settings
│   ├── requirements.txt
│   ├── .env.example
│   ├── data/schemes.json          # scheme knowledge base
│   ├── services/                  # deterministic domain logic
│   │   ├── profile.py             # profile model + heuristic parsing
│   │   ├── knowledge_base.py      # JSON loader / scheme access
│   │   ├── eligibility_engine.py  # explainable eligibility rules
│   │   ├── rag.py                 # retrieval layer (future Vertex AI use)
│   │   ├── benefit.py             # benefit calculation
│   │   └── document_check.py      # document readiness logic
│   └── agents/                    # Google ADK layer
│       ├── adk_agents.py          # six specialised agents + root orchestrator
│       ├── tools.py               # ADK FunctionTools over services
│       └── engine.py              # orchestration + graceful fallback
└── frontend/
    ├── index.html
    ├── css/style.css
    └── js/app.js
```

---

## 🧪 Demo script

1. Open the app and complete the demo OTP flow.
2. Review the **Citizen Dashboard** and quick actions.
3. Use **Search for Schemes** or **Ask the Agents** to trigger the pipeline.
4. Observe the agent pipeline and the results page appearing only after the full run completes.
5. Review the eligible schemes, the explanation panel, and the estimated benefit summary.
6. Toggle **हिंदी**, try voice input, and explore the multilingual experience.
7. Open the **Document Readiness** modal for a scheme, upload a file, and remove it again using the delete action.

---

## 🔐 Notes

- backend/data/schemes.json is **illustrative sample data**. For production,
  replace it with an ingestion pipeline over official Central/State sources and
  move retrieval to **Vertex AI Vector Search** and storage to **BigQuery**.
- Never commit your real API key. Use .env locally and Secret Manager in production.
