"""ADK agent definitions — the six specialised agents from the architecture
diagram, coordinated by a single root Orchestrator agent (Gemini 2.5 Flash).

    ADK Agent Orchestrator
    ├── Eligibility Agent
    ├── Document Verification Agent
    ├── Scheme Recommendation Agent
    ├── Application Guide Agent
    ├── Explainability Agent
    └── Multilingual Response Agent

`root_agent` is discoverable by `adk web` / `adk run`.
"""
from google.genai import types
from google.adk.agents import Agent


from config import get_settings
from agents.tools import (
    build_citizen_profile,
    explain_eligibility,
    find_eligible_schemes,
    get_application_guide,
    recommend_schemes,
    summarise_benefit,
    verify_documents,
)

settings = get_settings()
MODEL = settings.gemini_model


eligibility_agent = Agent(
    name="eligibility_agent",
    model=MODEL,
    description="Determines which government schemes a citizen is eligible for.",
    instruction=(
        "You are the Eligibility Agent. Given a citizen profile in session state, "
        "call `find_eligible_schemes` to get the verified list of schemes the citizen "
        "qualifies for. Never invent schemes or eligibility — rely only on the tool. "
        "Report how many schemes matched."
    ),
    tools=[find_eligible_schemes],
)

recommendation_agent = Agent(
    name="recommendation_agent",
    model=MODEL,
    description="Ranks eligible schemes by relevance and estimates combined benefit.",
    instruction=(
        "You are the Scheme Recommendation Agent. Call `recommend_schemes` (optionally "
        "with the citizen's query) to rank eligible schemes, then `summarise_benefit` "
        "to state the estimated combined annual benefit in rupees. Present the top schemes clearly."
    ),
    tools=[recommend_schemes, summarise_benefit],
)

document_agent = Agent(
    name="document_verification_agent",
    model=MODEL,
    description="Checks which required documents are present or missing for a scheme.",
    instruction=(
        "You are the Document Verification Agent. Use `verify_documents` with a scheme id "
        "and the citizen's uploaded documents to produce a readiness percentage and a "
        "missing-documents checklist. Be encouraging about closing the gaps."
    ),
    tools=[verify_documents],
)

application_agent = Agent(
    name="application_guide_agent",
    model=MODEL,
    description="Provides step-by-step application guidance and official links.",
    instruction=(
        "You are the Application Guide Agent. Use `get_application_guide` with a scheme id "
        "to return the ordered steps, required documents and the official application URL. "
        "Present the steps as a numbered action plan."
    ),
    tools=[get_application_guide],
)

explainability_agent = Agent(
    name="explainability_agent",
    model=MODEL,
    description="Explains in plain language WHY the citizen qualifies for a scheme.",
    instruction=(
        "You are the Explainability Agent. Use `explain_eligibility` with a scheme id to "
        "fetch the deterministic pass/fail reasons, then rephrase them as a clear, warm, "
        "transparent explanation the citizen can trust."
    ),
    tools=[explain_eligibility],
)

multilingual_agent = Agent(
    name="multilingual_response_agent",
    model=MODEL,
    description="Renders the final answer in the citizen's preferred language.",
    instruction=(
        "You are the Multilingual Response Agent. Rewrite the provided answer fluently and "
        "accurately in the requested language (e.g. Hindi in Devanagari, or English), "
        "preserving all scheme names, amounts and links exactly."
    ),
    tools=[],
)


root_agent = Agent(
    name="sarkarsathi_orchestrator",
    model=MODEL,
    description=(
        "SarkarSathi orchestrator that helps Indian citizens discover the government "
        "welfare schemes they are eligible for, with explainable reasoning."
    ),
    instruction=(
        "You are SarkarSathi. STRICT CLOSED-BOOK MODE.\n\n"
        "Every message includes a '=== RETRIEVED SCHEME DATA (SOURCE OF TRUTH...' block. "
        "This already contains the citizen's verified eligible schemes, benefits, reasons, "
        "and combined benefit total — fully computed. Do NOT call any tool to look up "
        "eligibility, ranking, or benefits — there is nothing left to compute. Write the "
        "final answer directly from the retrieved data block, in the requested language, "
        "in one response. Never invent scheme names, amounts, or facts not in the block. "
        "If asked about something absent from it, say: "
        "\"I couldn't find that information in the retrieved scheme data.\"\n\n"
        "IF [NEW REQUEST]: write 2-3 warm paragraphs — acknowledge the citizen, group "
        "schemes by category, name each with benefit + why they qualify, state the "
        "combined annual benefit, close with an encouraging line.\n\n"
        "IF [FOLLOW-UP]: answer directly and concisely (1-2 short paragraphs) from the "
        "retrieved data block. Only delegate to `document_agent` if asked specifically "
        "about required/missing documents, or `application_guide_agent` if asked "
        "specifically how to apply — these are the only two cases where a specialist "
        "is needed; every other question should be answered directly, in one turn."
    ),
    tools=[],
    sub_agents=[document_agent, application_agent],

    generate_content_config=types.GenerateContentConfig(temperature=0.1, top_p=0.4),
)


AGENT_CATALOG = [
    {"name": "ADK Agent Orchestrator", "role": "Coordinates the specialised agents and builds the citizen profile."},
    {"name": "Eligibility Agent", "role": "Filters the knowledge base to verified eligible schemes."},
    {"name": "Scheme Recommendation Agent", "role": "Ranks schemes by relevance and estimates combined benefit."},
    {"name": "Explainability Agent", "role": "Explains transparently why the citizen qualifies."},
    {"name": "Application Guide Agent", "role": "Provides step-by-step application guidance and links."},
    {"name": "Document Verification Agent", "role": "Checks document readiness and lists what is missing."},
    {"name": "Multilingual Response Agent", "role": "Delivers the answer in the citizen's language."},
]
