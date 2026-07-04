// SarkarSathi ADK — frontend logic
const API = ""; // same origin (Flask serves this page)

const el = (id) => document.getElementById(id);
const lang = () => document.querySelector('input[name="lang"]:checked').value;

const AGENTS = [
  "ADK Agent Orchestrator",
  "Eligibility Agent",
  "Scheme Recommendation Agent",
  "Explainability Agent",
  "Application Guide Agent",
  "Document Verification Agent",
  "Multilingual Response Agent",
];

let currentDocScheme = null;
let docModal = null;

// ---------------- init ----------------
document.addEventListener("DOMContentLoaded", () => {
  docModal = new bootstrap.Modal(el("docModal"));
  renderPipeline([]);
  loadHealth();

  el("profileForm").addEventListener("submit", (e) => {
    e.preventDefault();
    recommendFromForm();
  });
  el("askBtn").addEventListener("click", askAgents);
  el("sampleBtn").addEventListener("click", fillSample);
  el("voiceBtn").addEventListener("click", startVoice);
  el("docCheckBtn").addEventListener("click", runDocCheck);
});

async function loadHealth() {
  try {
    const r = await fetch(`${API}/api/health`);
    const d = await r.json();
    const badge = el("modeBadge");
    const map = { adk: ["ADK agents live", "text-bg-success"],
                  gemini: ["Gemini mode", "text-bg-primary"],
                  "offline-fallback": ["Offline demo mode", "text-bg-warning"] };
    const [label, cls] = map[d.mode] || ["ready", "text-bg-secondary"];
    badge.textContent = label;
    badge.className = `badge rounded-pill ${cls}`;
  } catch {
    el("modeBadge").textContent = "backend offline";
    el("modeBadge").className = "badge rounded-pill text-bg-danger";
  }
}

// ---------------- pipeline visualization ----------------
function renderPipeline(active) {
  const box = el("pipeline");
  box.innerHTML = "";
  AGENTS.forEach((name) => {
    const chip = document.createElement("span");
    chip.className = "agent-chip" + (active.includes(name) ? " active" : "");
    chip.innerHTML = `<span class="dot"></span>${name}`;
    box.appendChild(chip);
  });
}

async function animatePipeline() {
  const seq = [...AGENTS];
  for (let i = 0; i < seq.length; i++) {
    renderPipeline(seq.slice(0, i + 1));
    await new Promise((r) => setTimeout(r, 220));
  }
}

// ---------------- actions ----------------
function readProfile() {
  const f = el("profileForm");
  const num = (v) => (v ? parseInt(v, 10) : null);
  return {
    age: num(f.age.value),
    income: num(f.income.value),
    state: f.state.value.trim() || null,
    gender: f.gender.value || null,
    education: f.education.value || null,
    occupation: f.occupation.value || null,
    social_category: f.social_category.value || null,
    land_owner: f.land_owner.checked || null,
    disability: f.disability.checked || null,
    maternity: f.maternity.checked || null,
  };
}

async function recommendFromForm() {
  setBusy(true);
  animatePipeline();
  try {
    const res = await postJSON("/api/recommend", { profile: readProfile(), lang: lang() });
    render(res);
  } catch (e) { showError(e); }
  finally { setBusy(false); }
}

async function askAgents() {
  const message = el("freeText").value.trim();
  if (!message) { el("freeText").focus(); return; }
  setBusy(true);
  animatePipeline();
  try {
    // /api/agent runs the real ADK Orchestrator (falls back gracefully).
    // Send the Citizen Profile form too, so any filters selected there
    // (state, gender, income, etc.) are applied to the recommendation.
    const res = await postJSON("/api/agent", { message, profile: readProfile(), lang: lang() });
    render({
      explanation: res.reply,
      schemes: res.schemes,
      total_benefit_inr: res.total_benefit_inr,
      benefit_summary: null,
      mode: res.mode,
      profile: res.profile,
    });
    if (res.profile) reflectProfile(res.profile);
  } catch (e) { showError(e); }
  finally { setBusy(false); }
}

// ---------------- render ----------------
function render(res) {
  renderPipeline(AGENTS);

  const banner = el("benefitBanner");
  if (res.total_benefit_inr && res.schemes && res.schemes.length) {
    banner.classList.remove("d-none");
    banner.classList.add("d-flex");
    banner.innerHTML = `<i class="bi bi-cash-coin fs-4 me-3"></i>
      <div><strong>${res.schemes.length}</strong> scheme(s) matched · estimated combined annual benefit
      <span class="benefit-amount">₹${Number(res.total_benefit_inr).toLocaleString("en-IN")}</span></div>`;
  } else {
    banner.classList.add("d-none");
    banner.classList.remove("d-flex");
  }

  const exp = el("explanationCard");
  if (res.explanation) {
    exp.classList.remove("d-none");
    el("explanation").textContent = res.explanation;
  } else {
    exp.classList.add("d-none");
  }

  const wrap = el("schemes");
  wrap.innerHTML = "";
  (res.schemes || []).forEach((s) => wrap.appendChild(schemeCard(s)));
  el("placeholder").classList.add("d-none");
}

function schemeCard(s) {
  const col = document.createElement("div");
  col.className = "col-md-6";
  const reasons = (s.reasons || [])
    .filter((r) => r.startsWith("✓"))
    .map((r) => `<div class="reason pass">${r}</div>`)
    .join("");
  const docs = (s.documents || [])
    .map((d) => `<span class="badge text-bg-light border doc-pill">${d}</span>`)
    .join("");
  const steps = (s.steps || []).map((st) => `<li>${st}</li>`).join("");
  col.innerHTML = `
    <div class="card scheme-card shadow-sm">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start">
          <h6 class="fw-bold mb-1">${s.scheme_name}</h6>
          <span class="badge text-bg-primary level-badge">${s.level}</span>
        </div>
        <div class="text-muted small mb-2">${s.category} · ${s.state}</div>
        <p class="mb-2 small"><i class="bi bi-gift text-success me-1"></i>${s.benefit_text}
          <span class="benefit-amount">(≈ ₹${Number(s.benefit_annual_inr).toLocaleString("en-IN")}/yr)</span></p>
        <div class="mb-2">${reasons}</div>
        <details class="mb-2">
          <summary class="small text-primary">Application steps</summary>
          <ol class="step-list mt-2">${steps}</ol>
        </details>
        <div class="mb-2">${docs}</div>
        <div class="d-flex gap-2">
          <a href="${s.apply_url}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-primary flex-grow-1">
            <i class="bi bi-box-arrow-up-right me-1"></i>Apply</a>
          <button class="btn btn-sm btn-outline-secondary" onclick="openDoc('${s.id}')">
            <i class="bi bi-folder-check me-1"></i>Docs</button>
        </div>
      </div>
    </div>`;
  return col;
}

// ---------------- document readiness ----------------
window.openDoc = function (schemeId) {
  currentDocScheme = schemeId;
  el("docInput").value = "";
  el("docResult").innerHTML = "";
  docModal.show();
};

async function runDocCheck() {
  if (!currentDocScheme) return;
  const res = await postJSON("/api/documents/check", {
    scheme_id: currentDocScheme,
    uploaded: el("docInput").value,
    lang: lang(),
  });
  const missing = res.missing.map((d) => `<li>${d}</li>`).join("") || "<li>None 🎉</li>";
  el("docResult").innerHTML = `
    <div class="progress mb-2" style="height:22px;">
      <div class="progress-bar bg-success" style="width:${res.readiness_percent}%">${res.readiness_percent}%</div>
    </div>
    <p class="small mb-1"><strong>${res.note}</strong></p>
    <p class="small mb-1 text-success">Present: ${res.present.join(", ") || "—"}</p>
    <p class="small mb-0 text-danger">Still needed:</p>
    <ul class="small text-danger">${missing}</ul>`;
}

// ---------------- voice (Speech layer) ----------------
function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert("Voice input is not supported in this browser."); return; }
  const rec = new SR();
  rec.lang = lang() === "hi" ? "hi-IN" : "en-IN";
  rec.interimResults = false;
  const btn = el("voiceBtn");
  btn.classList.add("recording");
  rec.onresult = (e) => { el("freeText").value = e.results[0][0].transcript; };
  rec.onend = () => btn.classList.remove("recording");
  rec.onerror = () => btn.classList.remove("recording");
  rec.start();
}

// ---------------- helpers ----------------
function fillSample() {
  const f = el("profileForm");
  f.age.value = 19; f.income.value = 200000; f.state.value = "Uttar Pradesh";
  f.gender.value = "Female"; f.education.value = "UG"; f.occupation.value = "Student";
  f.social_category.value = ""; f.land_owner.checked = false;
  f.disability.checked = false; f.maternity.checked = false;
  el("freeText").value = "I am a 19-year-old girl from Uttar Pradesh pursuing B.Tech, family income ₹2 lakh.";
}

function reflectProfile(p) {
  const f = el("profileForm");
  if (p.age) f.age.value = p.age;
  if (p.income) f.income.value = p.income;
  if (p.state) f.state.value = p.state;
  if (p.gender) f.gender.value = p.gender;
  if (p.education) f.education.value = p.education;
  if (p.occupation) f.occupation.value = p.occupation;
  if (p.social_category) f.social_category.value = p.social_category;
  f.land_owner.checked = !!p.land_owner;
  f.disability.checked = !!p.disability;
  f.maternity.checked = !!p.maternity;
}

async function postJSON(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return r.json();
}

function setBusy(b) {
  el("spinner").classList.toggle("d-none", !b);
  if (b) {
    el("placeholder").classList.add("d-none");
    el("schemes").innerHTML = "";
    el("benefitBanner").classList.add("d-none");
    el("explanationCard").classList.add("d-none");
  }
}

function showError(e) {
  el("placeholder").classList.remove("d-none");
  el("placeholder").innerHTML =
    `<i class="bi bi-exclamation-triangle display-4 d-block mb-3 text-warning"></i>${e.message}`;
}
