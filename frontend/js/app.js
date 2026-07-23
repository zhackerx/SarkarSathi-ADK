// SarkarSathi ADK — frontend logic (v2 with auth, routing, OTP, ranked results, bookmarks)
const API = ""; // same origin (Flask serves this page)

const el = (id) => document.getElementById(id);
const lang = () => (el("langSelect") ? el("langSelect").value : "en");

function bindEvent(id, eventName, handler) {
  const node = el(id);
  if (!node) return false;
  node.addEventListener(eventName, handler);
  return true;
}

// ============================================================
// AUTH MODULE
// ============================================================
const DEMO_OTP = "123456";
let pendingMobile = "";

function getAuth() {
  try { return JSON.parse(localStorage.getItem("ss_auth") || "null"); } catch { return null; }
}
function setAuth(data) { localStorage.setItem("ss_auth", JSON.stringify(data)); }
function clearAuth() { localStorage.removeItem("ss_auth"); }
function isLoggedIn() { const a = getAuth(); return !!(a && a.loggedIn); }

function handleLogout() {
  clearAuth();
  updateNavbar();
  showPage("page-home");
}

function handleLogoClick() {
  showPage(isLoggedIn() ? "page-main" : "page-home");
}

// ============================================================
// PAGE ROUTING
// ============================================================
function showPage(pageId) {
  document.querySelectorAll(".ss-page").forEach((p) => p.classList.add("d-none"));
  const page = el(pageId);
  if (page) { page.classList.remove("d-none"); window.scrollTo(0, 0); }
  updateNavbar();
  // Show mode badge only on main/results pages
  const mb = el("modeBadge");
  if (mb) mb.classList.toggle("d-none", pageId !== "page-main" && pageId !== "page-results");
}

function updateNavbar() {
  const loggedIn = isLoggedIn();
  const auth = getAuth();
  const loginBtn = el("navLoginBtn");
  const userInfo = el("navUserInfo");
  if (loginBtn) loginBtn.classList.toggle("d-none", loggedIn);
  if (userInfo) userInfo.classList.toggle("d-none", !loggedIn);
  if (loggedIn && auth) {
    const mt = el("navMobileText");
    if (mt) mt.textContent = auth.name || "+91 " + auth.mobile;
  }
}

// ============================================================
// OTP MODULE
// ============================================================
function handleSendOTP() {
  const input = el("mobileInput");
  const errEl = el("mobileError");
  const mobile = (input ? input.value.trim() : "");
  if (!/^\d{10}$/.test(mobile)) {
    if (errEl) { errEl.textContent = "Please enter a valid 10-digit mobile number."; errEl.classList.remove("d-none"); }
    if (input) input.focus();
    return;
  }
  if (errEl) errEl.classList.add("d-none");
  pendingMobile = mobile;
  const disp = el("otpMobileDisplay");
  if (disp) disp.textContent = "+91 " + mobile;
  // Clear OTP inputs
  document.querySelectorAll(".otp-digit").forEach((inp) => { inp.value = ""; inp.classList.remove("is-invalid"); });
  const otpErr = el("otpError");
  if (otpErr) otpErr.classList.add("d-none");
  showPage("page-otp");
  setTimeout(() => {
    const first = document.querySelector(".otp-digit");
    if (first) first.focus();
  }, 100);
}

function handleVerifyOTP() {
  const digits = Array.from(document.querySelectorAll(".otp-digit")).map((i) => i.value.trim());
  const otp = digits.join("");
  const otpErr = el("otpError");
  if (otp.length < 6) {
    if (otpErr) { otpErr.textContent = "Please enter all 6 digits."; otpErr.classList.remove("d-none"); }
    return;
  }
  if (otp !== DEMO_OTP) {
    if (otpErr) { otpErr.textContent = "Incorrect OTP. Demo OTP is 123456."; otpErr.classList.remove("d-none"); }
    document.querySelectorAll(".otp-digit").forEach((i) => i.classList.add("is-invalid"));
    return;
  }
  if (otpErr) otpErr.classList.add("d-none");
  setAuth({ mobile: pendingMobile, loggedIn: false, loginTime: Date.now() });
  showPage("page-name-setup");
  setTimeout(() => {
    const nameInp = el("nameInput");
    if (nameInp) nameInp.focus();
  }, 100);
}

function handleContinueName() {
  const nameInp = el("nameInput");
  const nameErr = el("nameError");
  if (!nameInp) return;
  const name = nameInp.value.trim();
  if (!name) {
    if (nameErr) { nameErr.textContent = "Please enter your name."; nameErr.classList.remove("d-none"); }
    return;
  }
  if (nameErr) nameErr.classList.add("d-none");
  const auth = getAuth();
  if (!auth) return;
  auth.name = name;
  auth.loggedIn = true;
  setAuth(auth);
  updateNavbar();
  showPage("page-main");
  updateWelcome();
  renderPipeline([]);
  loadHealth();
}

function initOtpInputs() {
  const inputs = document.querySelectorAll(".otp-digit");
  inputs.forEach((inp, idx) => {
    inp.addEventListener("input", (e) => {
      inp.classList.remove("is-invalid");
      const val = e.target.value.replace(/[^0-9]/g, "");
      inp.value = val.slice(-1); // keep last digit only
      if (val && idx < inputs.length - 1) inputs[idx + 1].focus();
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !inp.value && idx > 0) inputs[idx - 1].focus();
      if (e.key === "Enter") handleVerifyOTP();
    });
    // Handle paste of full OTP
    inp.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData("text").replace(/[^0-9]/g, "");
      inputs.forEach((box, i) => { box.value = pasted[i] || ""; });
      if (pasted.length >= 6) inputs[5].focus();
    });
  });
}

function updateWelcome() {
  const auth = getAuth();
  const wn = el("welcomeName");
  if (wn && auth) wn.textContent = auth.name || "+91 " + auth.mobile;
}

// ============================================================
// BOOKMARKS MODULE
// ============================================================
function getBookmarks() {
  try { return JSON.parse(localStorage.getItem("ss_bookmarks") || "[]"); } catch { return []; }
}
function saveBookmarks(bm) { localStorage.setItem("ss_bookmarks", JSON.stringify(bm)); }
function isBookmarked(id) { return getBookmarks().some((b) => b.id === id); }
function toggleBookmark(scheme) {
  let bm = getBookmarks();
  if (isBookmarked(scheme.id)) {
    bm = bm.filter((b) => b.id !== scheme.id);
  } else {
    bm.unshift(scheme);
    if (bm.length > 50) bm = bm.slice(0, 50);
  }
  saveBookmarks(bm);
  return isBookmarked(scheme.id);
}

// Global scheme map so bookmark/doc buttons can find scheme by id
let schemeMap = {};

// ============================================================
// ESCAPE HELPERS
// ============================================================
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeInlineBullets(raw) {
  const hasRealBulletLines = /(^|\n)[ \t]*[*-][ \t]+\S/.test(raw);
  if (hasRealBulletLines) return raw;
  let text = raw;
  text = text.replace(/(\*\*[^*]+\*\*) \* (?=\*\*)/g, (_, headingBold) => {
    const headingText = headingBold.replace(/\*\*/g, "").trim();
    return `\n\n### ${headingText}\n* `;
  });
  text = text.replace(/ \* (?=\S)/g, "\n* ");
  return text;
}

function renderMarkdown(raw) {
  const lines = escapeHtml(normalizeInlineBullets(raw)).split("\n");
  let html = "";
  let inList = false;
  let paragraph = [];
  const flushParagraph = () => {
    if (paragraph.length) { html += `<p>${paragraph.join(" ")}</p>`; paragraph = []; }
  };
  const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
  const inline = (s) =>
    s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
     .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^(\s*)[*-]\s+(.*)$/);
    if (heading) { flushParagraph(); closeList(); const level = Math.min(heading[1].length + 2, 6); html += `<h${level}>${inline(heading[2])}</h${level}>`; }
    else if (bullet) { flushParagraph(); if (!inList) { html += "<ul>"; inList = true; } html += `<li>${inline(bullet[2])}</li>`; }
    else if (line.trim() === "") { flushParagraph(); closeList(); }
    else { closeList(); paragraph.push(inline(line.trim())); }
  }
  flushParagraph();
  closeList();
  return html;
}

// ============================================================
// I18N
// ============================================================
const LANGS = {
  en: { name: "English", locale: "en-IN" },
  hi: { name: "हिंदी", locale: "hi-IN" },
  bn: { name: "বাংলা", locale: "bn-IN" },
  ta: { name: "தமிழ்", locale: "ta-IN" },
  te: { name: "తెలుగు", locale: "te-IN" },
  mr: { name: "मराठी", locale: "mr-IN" },
  kn: { name: "ಕನ್ನಡ", locale: "kn-IN" },
  gu: { name: "ગુજરાતી", locale: "gu-IN" },
  pa: { name: "ਪੰਜਾਬੀ", locale: "pa-IN" },
  ml: { name: "മലയാളം", locale: "ml-IN" },
  or: { name: "ଓଡ଼ିଆ", locale: "or-IN" },
};

const GUIDE = {
  en: { heading: "How to use SarkarSathi", intro: "Welcome to SarkarSathi. I help you find government schemes you can get. Here is how to use me by voice.", steps: ["Tap the round microphone button.", "Speak about yourself in one sentence — your age, your state, and your work.", "Wait a moment. I will show the schemes you may get and how much benefit.", "You can also type in the box, or fill the simple form below."], example: "Example — say: \"I am a 65-year-old retired person from Bihar with a low income.\"" },
  hi: { heading: "सरकारसाथी का उपयोग कैसे करें", intro: "सरकारसाथी में आपका स्वागत है।", steps: ["गोल माइक बटन दबाएँ।", "एक वाक्य में अपने बारे में बताएँ।", "थोड़ी देर रुकें।", "आप बॉक्स में लिख भी सकते हैं।"], example: "उदाहरण — कहें: \"मैं बिहार से पैंसठ वर्ष का सेवानिवृत्त व्यक्ति हूँ।\"" },
  bn: { heading: "সরকারসাথী কীভাবে ব্যবহার করবেন", intro: "সরকারসাথীতে আপনাকে স্বাগতম।", steps: ["গোল মাইক্রোফোন বাটনে ট্যাপ করুন।", "এক বাক্যে নিজের কথা বলুন।", "কিছুক্ষণ অপেক্ষা করুন।", "বক্সে লিখতেও পারেন।"], example: "উদাহরণ — বলুন: \"আমি বিহারের ৬৫ বছর বয়সী অবসরপ্রাপ্ত ব্যক্তি।\"" },
  ta: { heading: "சர்க்கார்சாதியை எப்படி பயன்படுத்துவது", intro: "சர்க்கார்சாதிக்கு வரவேற்கிறோம்.", steps: ["மைக்ரோஃபோன் பொட்டனைத் தட்டவும்.", "உங்களைப் பற்றி ஒரு வாக்கியத்தில் பேசுங்கள்.", "சிறிது நேரம் காத்திருங்கள்.", "பெட்டியில் தட்டச்சு செய்யலாம்."], example: "எடுத்துக்காட்டு — சொல்லுங்கள்: \"நான் பீகாரைச் சேர்ந்த 65 வயது ஓய்வுபெற்றவர்.\"" },
  te: { heading: "సర్కార్‌సాథీని ఎలా ఉపయోగించాలి", intro: "సర్కార్‌సాథీకి స్వాగతం.", steps: ["మైక్రోఫోన్ బటన్‌ను నొక్కండి.", "మీ గురించి ఒక వాక్యంలో చెప్పండి.", "కొంచెం సేపు వేచి ఉండండి.", "బాక్స్‌లో టైప్ చేయవచ్చు."], example: "ఉదాహరణ — ఇలా చెప్పండి: \"నేను బీహార్‌కు చెందిన 65 సంవత్సరాల విశ్రాంత వ్యక్తిని.\"" },
  mr: { heading: "सरकारसाथी कसे वापरावे", intro: "सरकारसाथीमध्ये आपले स्वागत आहे.", steps: ["गोल माइक बटण दाबा.", "एका वाक्यात स्वतःबद्दल सांगा.", "थोडा वेळ थांबा.", "बॉक्समध्ये टाइप देखील करू शकता."], example: "उदाहरण — असे म्हणा: \"मी बिहारमधील ६५ वर्षांचा निवृत्त व्यक्ती आहे.\"" },
  kn: { heading: "ಸರ್ಕಾರ್‌ಸಾಥಿಯನ್ನು ಹೇಗೆ ಬಳಸುವುದು", intro: "ಸರ್ಕಾರ್‌ಸಾಥಿಗೆ ಸ್ವಾಗತ.", steps: ["ಮೈಕ್ರೊಫೋನ್ ಬಟನ್ ಒತ್ತಿರಿ.", "ನಿಮ್ಮ ಬಗ್ಗೆ ಒಂದು ವಾಕ್ಯದಲ್ಲಿ ಹೇಳಿ.", "ಸ್ವಲ್ಪ ಕಾಯಿರಿ.", "ಬಾಕ್ಸ್‌ನಲ್ಲಿ ಟೈಪ್ ಮಾಡಬಹುದು."], example: "ಉದಾಹರಣೆ — ಹೀಗೆ ಹೇಳಿ: \"ನಾನು ಬಿಹಾರದ 65 ವರ್ಷದ ನಿವೃತ್ತ ವ್ಯಕ್ತಿ.\"" },
  gu: { heading: "સરકારસાથીનો ઉપયોગ", intro: "સરકારસાથીમાં સ્વાગત.", steps: ["ગોળ માઇક્રોફોન બટન દબાવો.", "એક વાક્યમાં તમારા વિશે કહો.", "થોડી વાર રાહ જુઓ.", "બોક્સમાં ટાઇપ કરી શકો."], example: "ઉદાહરણ — કહો: \"હું બિહારનો 65 વર્ષનો નિવૃત્ત છું.\"" },
  pa: { heading: "ਸਰਕਾਰਸਾਥੀ ਦਾ ਉਪਯੋਗ", intro: "ਸਰਕਾਰਸਾਥੀ ਵਿੱਚ ਸਵਾਗਤ.", steps: ["ਗੋਲ ਮਾਈਕ੍ਰੋਫ਼ੋਨ ਬਟਨ ਦਬਾਓ।", "ਇੱਕ ਵਾਕ ਵਿੱਚ ਆਪਣੇ ਬਾਰੇ ਦੱਸੋ।", "ਥੋੜ੍ਹੀ ਦੇਰ ਉਡੀਕ ਕਰੋ।", "ਬਾਕਸ ਵਿੱਚ ਟਾਈਪ ਕਰ ਸਕਦੇ ਹੋ।"], example: "ਉਦਾਹਰਨ — ਕਹੋ: \"ਮੈਂ ਬਿਹਾਰ ਦਾ 65 ਸਾਲ ਦਾ ਸੇਵਾਮੁਕਤ ਵਿਅਕਤੀ ਹਾਂ।\"" },
  ml: { heading: "സർക്കാർസാഥി ഉപയോഗം", intro: "സർക്കാർസാഥിയിലേക്ക് സ്വാഗതം.", steps: ["മൈക്രോഫോൺ ബട്ടൺ അമർത്തുക.", "ഒരു വാക്യത്തിൽ നിങ്ങളെക്കുറിച്ച് പറയുക.", "ഒരു നിമിഷം കാത്തിരിക്കുക.", "ബോക്സിൽ ടൈപ്പ് ചെയ്യാം."], example: "ഉദാഹരണം — ഇങ്ങനെ പറയുക: \"ഞാൻ ബീഹാറിലെ 65 വയസ്സുള്ള വിരമിച്ച വ്യക്തി.\"" },
  or: { heading: "ସରକାରସାଥୀ ବ୍ୟବହାର", intro: "ସରକାରସାଥୀକୁ ସ୍ୱାଗତ।", steps: ["ଗୋଲାକାର ମାଇକ୍ରୋଫୋନ୍ ବଟନ୍‌ ଟାପ୍ କରନ୍ତୁ।", "ଏକ ବାକ୍ୟରେ ନିଜ ବିଷୟ କୁହନ୍ତୁ।", "ଟିକିଏ ଅପେକ୍ଷା କରନ୍ତୁ।", "ବକ୍ସରେ ଟାଇପ୍ ମଧ୍ୟ କରିପାରିବେ।"], example: "ଉଦାହରଣ — କୁହନ୍ତୁ: \"ମୁଁ ବିହାରର 65 ବର୍ଷ ଅବସରପ୍ରାପ୍ତ ବ୍ୟକ୍ତି।\"" },
};

const I18N = {
  en: { langLabel: "Language", askTitle: "Ask in your own words", askBtn: "Ask the Agents", askPlaceholder: "e.g. I am a 65-year-old retired person from Bihar, or: I am a 19-year-old girl from Kanpur pursuing B.Tech", holdSpeak: "Hold & Speak", listening: "Listening… release to stop", guideBtn: "How to use — Listen & learn", citizenProfile: "Citizen Profile", trySample: "Try sample", age: "Age", income: "Annual income (₹)", state: "State", gender: "Gender", education: "Education", occupation: "Occupation", category: "Social category", land: "Owns land", disability: "Disability", maternity: "Pregnant / new mother", findSchemes: "Find my schemes", pipelineTitle: "ADK Agent Pipeline", aiTitle: "AI Decision Intelligence", placeholder: "Fill the profile or ask a question to discover the government schemes you qualify for.", working: "Agents are working on your request…", docTitle: "Document Readiness", docHelp: "Type the documents you already have (comma separated), e.g. Aadhaar, Income Certificate.", docCheck: "Check readiness", recommendedBecause: "Recommended because:", eligibilityMatch: "Eligibility Match", applicationSteps: "Application steps", printPdf: "Print / Save PDF", download: "Download", share: "Share", historyTitle: "Past questions", historySearchPh: "Search past questions…", historyEmpty: "Your recent questions will appear here.", ocrScanning: "Scanning documents…", reportTitle: "Citizen Summary — SarkarSathi", rpProfile: "Your profile", rpSchemes: "Eligible schemes", rpDocs: "Documents required", rpNextSteps: "Next steps", rpLinks: "Application links", stage1: "Analyzing your query…", stage2: "Searching eligible schemes…", stage3: "Checking documents…", stage4: "Preparing your response…", clearAll: "Clear all", deleteItem: "Delete", viewSchemes: "View Schemes" },
  hi: { langLabel: "भाषा", askTitle: "अपने शब्दों में पूछें", askBtn: "एजेंट्स से पूछें", askPlaceholder: "उदा. मैं बिहार से 65 वर्ष का सेवानिवृत्त व्यक्ति हूँ", holdSpeak: "दबाकर बोलें", listening: "सुन रहा हूँ… छोड़ें", guideBtn: "उपयोग कैसे करें — सुनें और सीखें", citizenProfile: "नागरिक प्रोफ़ाइल", trySample: "नमूना आज़माएँ", age: "आयु", income: "वार्षिक आय (₹)", state: "राज्य", gender: "लिंग", education: "शिक्षा", occupation: "व्यवसाय", category: "सामाजिक वर्ग", land: "भूमि है", disability: "दिव्यांगता", maternity: "गर्भवती / नई माँ", findSchemes: "मेरी योजनाएँ खोजें", pipelineTitle: "ADK एजेंट पाइपलाइन", aiTitle: "एआई निर्णय बुद्धिमत्ता", placeholder: "योजनाएँ जानने के लिए प्रोफ़ाइल भरें।", working: "एजेंट्स काम कर रहे हैं…", docTitle: "दस्तावेज़ तैयारी", docHelp: "आपके पास मौजूद दस्तावेज़ लिखें।", docCheck: "तैयारी जाँचें", recommendedBecause: "अनुशंसित क्योंकि:", eligibilityMatch: "पात्रता मिलान", applicationSteps: "आवेदन के चरण", printPdf: "प्रिंट / PDF", download: "डाउनलोड", share: "साझा करें", historyTitle: "पिछले प्रश्न", historySearchPh: "खोजें…", historyEmpty: "हाल के प्रश्न यहाँ दिखेंगे।", ocrScanning: "स्कैन हो रहा है…", reportTitle: "नागरिक सारांश — सरकारसाथी", rpProfile: "आपकी प्रोफ़ाइल", rpSchemes: "पात्र योजनाएँ", rpDocs: "आवश्यक दस्तावेज़", rpNextSteps: "अगले कदम", rpLinks: "लिंक", stage1: "प्रश्न समझ रहे हैं…", stage2: "योजनाएँ खोज रहे हैं…", stage3: "दस्तावेज़ जाँच रहे हैं…", stage4: "उत्तर तैयार कर रहे हैं…", clearAll: "सभी हटाएँ", deleteItem: "हटाएँ", viewSchemes: "योजनाएँ देखें" },
  bn: { langLabel: "ভাষা", askTitle: "নিজের ভাষায় জিজ্ঞাসা করুন", askBtn: "এজেন্টদের জিজ্ঞাসা করুন", askPlaceholder: "যেমন: আমি বিহারের ৬৫ বছর বয়সী অবসরপ্রাপ্ত ব্যক্তি", holdSpeak: "চেপে ধরে বলুন", listening: "শুনছি… ছাড়লে থামবে", guideBtn: "কীভাবে ব্যবহার করবেন — শুনুন ও শিখুন", citizenProfile: "নাগরিক প্রোফাইল", trySample: "নমুনা চেষ্টা করুন", age: "বয়স", income: "বার্ষিক আয় (₹)", state: "রাজ্য", gender: "লিঙ্গ", education: "শিক্ষা", occupation: "পেশা", category: "সামাজিক শ্রেণি", land: "জমির মালিক", disability: "প্রতিবন্ধিতা", maternity: "গর্ভবতী / নতুন মা", findSchemes: "আমার স্কিম খুঁজুন", pipelineTitle: "ADK এজেন্ট পাইপলাইন", aiTitle: "এআই সিদ্ধান্ত বিশ্লেষণ", placeholder: "প্রোফাইল পূরণ করুন বা প্রশ্ন করুন, আপনার উপযুক্ত সরকারি স্কিম জানতে।", working: "এজেন্টরা আপনার অনুরোধে কাজ করছে…", docTitle: "নথির প্রস্তুতি", docHelp: "আপনার কাছে থাকা নথির নাম লিখুন।", docCheck: "প্রস্তুতি পরীক্ষা", recommendedBecause: "প্রস্তাবিত কারণ:", eligibilityMatch: "যোগ্যতার মিল", applicationSteps: "আবেদনের ধাপ", printPdf: "প্রিন্ট / PDF", download: "ডাউনলোড", share: "শেয়ার", historyTitle: "আগের প্রশ্ন", historySearchPh: "আগের প্রশ্ন খুঁজুন…", historyEmpty: "আপনার সাম্প্রতিক প্রশ্নগুলি এখানে দেখা যাবে।", ocrScanning: "নথি স্ক্যান হচ্ছে…", reportTitle: "নাগরিক সারাংশ — সরকারসাথী", rpProfile: "আপনার প্রোফাইল", rpSchemes: "যোগ্য স্কিম", rpDocs: "প্রয়োজনীয় নথি", rpNextSteps: "পরবর্তী ধাপ", rpLinks: "আবেদনের লিঙ্ক", stage1: "আপনার প্রশ্ন বিশ্লেষণ করা হচ্ছে…", stage2: "যোগ্য স্কিম খোঁজা হচ্ছে…", stage3: "নথি যাচাই করা হচ্ছে…", stage4: "আপনার উত্তর প্রস্তুত করা হচ্ছে…", clearAll: "সব মুছুন", deleteItem: "মুছুন", viewSchemes: "স্কিম দেখুন" },
  ta: { langLabel: "மொழி", askTitle: "உங்கள் சொற்களில் கேளுங்கள்", askBtn: "ஏஜென்ட்களிடம் கேளுங்கள்", askPlaceholder: "உதா: நான் பீகாரைச் சேர்ந்த 65 வயது ஓய்வுபெற்றவர்", holdSpeak: "அழுத்தி பேசுங்கள்", listening: "கேட்கிறேன்… விடுங்கள் நிற்கும்", guideBtn: "எப்படி பயன்படுத்துவது — கேட்டு கற்றுக்கொள்ளுங்கள்", citizenProfile: "குடிமகன் சுயவிவரம்", trySample: "மாதிரி முயற்சி", age: "வயது", income: "வருடாந்திர வருமானம் (₹)", state: "மாநிலம்", gender: "பாலினம்", education: "கல்வி", occupation: "தொழில்", category: "சமூக வகை", land: "நிலம் உள்ளது", disability: "ஊனமுற்ற நிலை", maternity: "கர்ப்பிணி / புதிய தாய்", findSchemes: "எனக்கான திட்டங்களை காண்க", pipelineTitle: "ADK ஏஜென்ட் தொடர்", aiTitle: "ஏஐ முடிவு பகுப்பாய்வு", placeholder: "உங்கள் சுயவிவரத்தை நிரப்பவும் அல்லது கேள்வி கேட்கவும்.", working: "ஏஜென்ட்கள் உங்கள் கோரிக்கையில் பணிபுரிகின்றனர்…", docTitle: "ஆவண தயார் நிலை", docHelp: "உங்களிடம் உள்ள ஆவணங்களை எழுதுங்கள்.", docCheck: "தயார்நிலை சரிபார்", recommendedBecause: "பரிந்துரைக்கப்பட்ட காரணம்:", eligibilityMatch: "தகுதி பொருத்தம்", applicationSteps: "விண்ணப்ப படிகள்", printPdf: "அச்சிடு / PDF", download: "பதிவிறக்கு", share: "பகிர்", historyTitle: "முந்தைய கேள்விகள்", historySearchPh: "முந்தைய கேள்விகளை தேடுங்கள்…", historyEmpty: "உங்கள் சமீபத்திய கேள்விகள் இங்கே தோன்றும்.", ocrScanning: "ஆவணங்கள் ஸ்கேன் செய்யப்படுகிறது…", reportTitle: "குடிமகன் சுருக்கம் — சர்க்கார்சாத்தி", rpProfile: "உங்கள் சுயவிவரம்", rpSchemes: "தகுதியான திட்டங்கள்", rpDocs: "தேவையான ஆவணங்கள்", rpNextSteps: "அடுத்த படிகள்", rpLinks: "விண்ணப்ப இணைப்புகள்", stage1: "உங்கள் கேள்வி பகுப்பாய்வு செய்யப்படுகிறது…", stage2: "தகுதியான திட்டங்கள் தேடப்படுகிறது…", stage3: "ஆவணங்கள் சரிபார்க்கப்படுகிறது…", stage4: "உங்கள் பதில் தயாராகிறது…", clearAll: "அனைத்தையும் அழி", deleteItem: "அழி", viewSchemes: "திட்டங்களைப் பாருங்கள்" },
  te: { langLabel: "భాష", askTitle: "మీ మాటల్లో అడగండి", askBtn: "ఏజెంట్లను అడగండి", askPlaceholder: "ఉదా: నేను బీహార్‌కు చెందిన 65 ఏళ్ల విరమణ పొందిన వ్యక్తిని", holdSpeak: "నొక్కి మాట్లాడండి", listening: "వింటున్నాను… వదిలితే ఆగుతుంది", guideBtn: "ఎలా ఉపయోగించాలి — వినండి & నేర్చుకోండి", citizenProfile: "పౌర ప్రొఫైల్", trySample: "నమూనా ప్రయత్నించండి", age: "వయస్సు", income: "వార్షిక ఆదాయం (₹)", state: "రాష్ట్రం", gender: "లింగం", education: "విద్య", occupation: "వృత్తి", category: "సామాజిక వర్గం", land: "భూమి యజమాని", disability: "వికలాంగత", maternity: "గర్భిణి / కొత్త తల్లి", findSchemes: "నా పథకాలు కనుగొనండి", pipelineTitle: "ADK ఏజెంట్ పైప్‌లైన్", aiTitle: "ఏఐ నిర్ణయ విశ్లేషణ", placeholder: "ప్రొఫైల్ నింపండి లేదా ప్రశ్న అడిగి మీకు సరిపోయే పథకాలు తెలుసుకోండి.", working: "ఏజెంట్లు మీ అభ్యర్థనపై పని చేస్తున్నారు…", docTitle: "పత్రాల సిద్ధత", docHelp: "మీ దగ్గర ఉన్న పత్రాలను టైప్ చేయండి.", docCheck: "సిద్ధత తనిఖీ", recommendedBecause: "సిఫార్సు చేసిన కారణం:", eligibilityMatch: "అర్హత సరిపోలిక", applicationSteps: "దరఖాస్తు దశలు", printPdf: "ప్రింట్ / PDF", download: "డౌన్‌లోడ్", share: "పంచుకోండి", historyTitle: "గత ప్రశ్నలు", historySearchPh: "గత ప్రశ్నలను వెతకండి…", historyEmpty: "మీ తాజా ప్రశ్నలు ఇక్కడ కనిపిస్తాయి.", ocrScanning: "పత్రాలు స్కాన్ అవుతున్నాయి…", reportTitle: "పౌర సారాంశం — సర్కార్‌సాథీ", rpProfile: "మీ ప్రొఫైల్", rpSchemes: "అర్హత కలిగిన పథకాలు", rpDocs: "అవసరమైన పత్రాలు", rpNextSteps: "తదుపరి దశలు", rpLinks: "దరఖాస్తు లింకులు", stage1: "మీ ప్రశ్నను విశ్లేషిస్తున్నాం…", stage2: "అర్హత కలిగిన పథకాలను వెతుకుతున్నాం…", stage3: "పత్రాలను తనిఖీ చేస్తున్నాం…", stage4: "మీ సమాధానాన్ని సిద్ధం చేస్తున్నాం…", clearAll: "అన్నీ తొలగించు", deleteItem: "తొలగించు", viewSchemes: "పథకాలను చూడండి" },
  mr: { langLabel: "भाषा", askTitle: "तुमच्या शब्दांत विचारा", askBtn: "एजंटना विचारा", askPlaceholder: "उदा. मी बिहारमधील ६५ वर्षांचा निवृत्त व्यक्ती आहे", holdSpeak: "दाबून बोला", listening: "ऐकत आहे… सोडा थांबेल", guideBtn: "कसे वापरावे — ऐका आणि शिका", citizenProfile: "नागरिक प्रोफाइल", trySample: "नमुना वापरा", age: "वय", income: "वार्षिक उत्पन्न (₹)", state: "राज्य", gender: "लिंग", education: "शिक्षण", occupation: "व्यवसाय", category: "सामाजिक वर्ग", land: "जमीन आहे", disability: "अपंगत्व", maternity: "गर्भवती / नवीन आई", findSchemes: "माझ्या योजना शोधा", pipelineTitle: "ADK एजंट पाइपलाइन", aiTitle: "एआय निर्णय विश्लेषण", placeholder: "प्रोफाइल भरा किंवा प्रश्न विचारा आणि पात्र योजना शोधा.", working: "एजंट्स तुमच्या विनंतीवर काम करत आहेत…", docTitle: "दस्तऐवज तयारी", docHelp: "तुमच्याकडे असलेले दस्तऐवज लिहा.", docCheck: "तयारी तपासा", recommendedBecause: "शिफारस कारण:", eligibilityMatch: "पात्रता जुळणी", applicationSteps: "अर्ज चरण", printPdf: "प्रिंट / PDF", download: "डाउनलोड", share: "शेअर", historyTitle: "मागील प्रश्न", historySearchPh: "मागील प्रश्न शोधा…", historyEmpty: "तुमचे अलीकडील प्रश्न येथे दिसतील.", ocrScanning: "दस्तऐवज स्कॅन होत आहेत…", reportTitle: "नागरिक सारांश — सरकारसाथी", rpProfile: "तुमचे प्रोफाइल", rpSchemes: "पात्र योजना", rpDocs: "आवश्यक दस्तऐवज", rpNextSteps: "पुढील पावले", rpLinks: "अर्ज दुवे", stage1: "तुमचा प्रश्न विश्लेषित करत आहोत…", stage2: "पात्र योजना शोधत आहोत…", stage3: "दस्तऐवज तपासत आहोत…", stage4: "तुमचे उत्तर तयार करत आहोत…", clearAll: "सर्व हटवा", deleteItem: "हटवा", viewSchemes: "योजना पहा" },
  kn: { langLabel: "ಭಾಷೆ", askTitle: "ನಿಮ್ಮ ಮಾತಿನಲ್ಲಿ ಕೇಳಿ", askBtn: "ಏಜೆಂಟ್‌ಗಳನ್ನು ಕೇಳಿ", askPlaceholder: "ಉದಾ: ನಾನು ಬಿಹಾರದ 65 ವರ್ಷದ ನಿವೃತ್ತ ವ್ಯಕ್ತಿ", holdSpeak: "ಒತ್ತಿ ಮಾತನಾಡಿ", listening: "ಕೇಳುತ್ತೇನೆ… ಬಿಡಿದರೆ ನಿಲ್ಲುತ್ತದೆ", guideBtn: "ಹೇಗೆ ಬಳಸುವುದು — ಕೇಳಿ ಮತ್ತು ಕಲಿಯಿರಿ", citizenProfile: "ನಾಗರಿಕ ಪ್ರೊಫೈಲ್", trySample: "ಮಾದರಿ ಪ್ರಯತ್ನಿಸಿ", age: "ವಯಸ್ಸು", income: "ವಾರ್ಷಿಕ ಆದಾಯ (₹)", state: "ರಾಜ್ಯ", gender: "ಲಿಂಗ", education: "ಶಿಕ್ಷಣ", occupation: "ಉದ್ಯೋಗ", category: "ಸಾಮಾಜಿಕ ವರ್ಗ", land: "ಭೂಮಿ ಇದೆ", disability: "ಅಂಗವೈಕಲ್ಯ", maternity: "ಗರ್ಭಿಣಿ / ಹೊಸ ತಾಯಿ", findSchemes: "ನನ್ನ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಿ", pipelineTitle: "ADK ಏಜೆಂಟ್ ಪೈಪ್‌ಲೈನ್", aiTitle: "ಎಐ ನಿರ್ಧಾರ ವಿಶ್ಲೇಷಣೆ", placeholder: "ಪ್ರೊಫೈಲ್ ಭರ್ತಿ ಮಾಡಿ ಅಥವಾ ಪ್ರಶ್ನೆ ಕೇಳಿ, ನಿಮಗೆ ತಕ್ಕ ಯೋಜನೆಗಳನ್ನು ಕಂಡುಹಿಡಿಯಿರಿ.", working: "ಏಜೆಂಟ್‌ಗಳು ನಿಮ್ಮ ವಿನಂತಿಯ ಮೇಲೆ ಕೆಲಸ ಮಾಡುತ್ತಿದ್ದಾರೆ…", docTitle: "ದಾಖಲೆ ಸಿದ್ಧತೆ", docHelp: "ನಿಮ್ಮ ಬಳಿ ಇರುವ ದಾಖಲೆಗಳನ್ನು ಬರೆಯಿರಿ.", docCheck: "ಸಿದ್ಧತೆ ಪರಿಶೀಲನೆ", recommendedBecause: "ಶಿಫಾರಸು ಮಾಡಿದ ಕಾರಣ:", eligibilityMatch: "ಅರ್ಹತಾ ಹೊಂದಾಣಿಕೆ", applicationSteps: "ಅರ್ಜಿಯ ಹಂತಗಳು", printPdf: "ಮುದ್ರಿಸಿ / PDF", download: "ಡೌನ್‌ಲೋಡ್", share: "ಹಂಚಿಕೆ", historyTitle: "ಹಿಂದಿನ ಪ್ರಶ್ನೆಗಳು", historySearchPh: "ಹಿಂದಿನ ಪ್ರಶ್ನೆಗಳನ್ನು ಹುಡುಕಿ…", historyEmpty: "ನಿಮ್ಮ ಇತ್ತೀಚಿನ ಪ್ರಶ್ನೆಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.", ocrScanning: "ದಾಖಲೆಗಳನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಲಾಗುತ್ತಿದೆ…", reportTitle: "ನಾಗರಿಕ ಸಾರಾಂಶ — ಸರ್ಕಾರ್‌ಸಾಥಿ", rpProfile: "ನಿಮ್ಮ ಪ್ರೊಫೈಲ್", rpSchemes: "ಅರ್ಹ ಯೋಜನೆಗಳು", rpDocs: "ಅಗತ್ಯ ದಾಖಲೆಗಳು", rpNextSteps: "ಮುಂದಿನ ಹಂತಗಳು", rpLinks: "ಅರ್ಜಿಯ ಕೊಂಡಿಗಳು", stage1: "ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ…", stage2: "ಅರ್ಹ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ…", stage3: "ದಾಖಲೆಗಳನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…", stage4: "ನಿಮ್ಮ ಉತ್ತರವನ್ನು ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ…", clearAll: "ಎಲ್ಲವನ್ನೂ ತೆರವುಗೊಳಿಸಿ", deleteItem: "ಅಳಿಸಿ", viewSchemes: "ಯೋಜನೆಗಳನ್ನು ನೋಡಿ" },
  gu: { langLabel: "ભાષા", askTitle: "તમારા શબ્દોમાં પૂછો", askBtn: "એજન્ટ્સને પૂછો", askPlaceholder: "દા.ત. હું બિહારનો 65 વર્ષનો નિવૃત્ત છું", holdSpeak: "દબાવીને બોલો", listening: "સાંભળી રહ્યો છું… છોડો તો બંધ", guideBtn: "કેવી રીતે ઉપયોગ કરવો — સાંભળો અને શીખો", citizenProfile: "નાગરિક પ્રોફાઇલ", trySample: "નમૂનો અજમાવો", age: "ઉંમર", income: "વાર્ષિક આવક (₹)", state: "રાજ્ય", gender: "લિંગ", education: "શિક્ષણ", occupation: "વ્યવસાય", category: "સામાજિક વર્ગ", land: "જમીન છે", disability: "અક્ષમતા", maternity: "ગર્ભવતી / નવી માતા", findSchemes: "મારી યોજનાઓ શોધો", pipelineTitle: "ADK એજન્ટ પાઇપલાઇન", aiTitle: "એઆઇ નિર્ણય વિશ્લેષણ", placeholder: "પ્રોફાઇલ ભરો અથવા પ્રશ્ન પૂછો અને યોગ્ય યોજનાઓ શોધો.", working: "એજન્ટ્સ તમારી વિનંતિ પર કામ કરી રહ્યા છે…", docTitle: "દસ્તાવેજ તૈયારી", docHelp: "તમારા પાસેના દસ્તાવેજો લખો.", docCheck: "તૈયારી તપાસો", recommendedBecause: "ભલામણનું કારણ:", eligibilityMatch: "પાત્રતા મેળ", applicationSteps: "અરજીના પગલાં", printPdf: "પ્રિન્ટ / PDF", download: "ડાઉનલોડ", share: "શેર", historyTitle: "ભૂતકાળના પ્રશ્નો", historySearchPh: "ભૂતકાળના પ્રશ્નો શોધો…", historyEmpty: "તમારા તાજેતરના પ્રશ્નો અહીં દેખાશે.", ocrScanning: "દસ્તાવેજો સ્કેન થઈ રહ્યા છે…", reportTitle: "નાગરિક સારાંશ — સરકારસાથી", rpProfile: "તમારી પ્રોફાઇલ", rpSchemes: "પાત્ર યોજનાઓ", rpDocs: "જરૂરી દસ્તાવેજો", rpNextSteps: "આગલા પગલાં", rpLinks: "અરજી લિંક્સ", stage1: "તમારો પ્રશ્ન વિશ્લેષણ થઈ રહ્યો છે…", stage2: "પાત્ર યોજનાઓ શોધાઈ રહી છે…", stage3: "દસ્તાવેજો ચકાસાઈ રહ્યા છે…", stage4: "તમારો જવાબ તૈયાર થઈ રહ્યો છે…", clearAll: "બધું સાફ કરો", deleteItem: "કાઢી નાખો", viewSchemes: "યોજનાઓ જુઓ" },
  pa: { langLabel: "ਭਾਸ਼ਾ", askTitle: "ਆਪਣੇ ਸ਼ਬਦਾਂ ਵਿੱਚ ਪੁੱਛੋ", askBtn: "ਏਜੰਟਾਂ ਨੂੰ ਪੁੱਛੋ", askPlaceholder: "ਉਦਾਹਰਨ: ਮੈਂ ਬਿਹਾਰ ਦਾ 65 ਸਾਲਾਂ ਦਾ ਰਿਟਾਇਰਡ ਵਿਅਕਤੀ ਹਾਂ", holdSpeak: "ਦਬਾ ਕੇ ਬੋਲੋ", listening: "ਸੁਣ ਰਿਹਾ ਹਾਂ… ਛੱਡੋ ਤਾਂ ਰੁਕੇਗਾ", guideBtn: "ਕਿਵੇਂ ਵਰਤਣਾ — ਸੁਣੋ ਅਤੇ ਸਿੱਖੋ", citizenProfile: "ਨਾਗਰਿਕ ਪ੍ਰੋਫਾਈਲ", trySample: "ਨਮੂਨਾ ਅਜ਼ਮਾਓ", age: "ਉਮਰ", income: "ਸਾਲਾਨਾ ਆਮਦਨ (₹)", state: "ਰਾਜ", gender: "ਲਿੰਗ", education: "ਸਿੱਖਿਆ", occupation: "ਪੇਸ਼ਾ", category: "ਸਮਾਜਿਕ ਵਰਗ", land: "ਜ਼ਮੀਨ ਹੈ", disability: "ਅਪੰਗਤਾ", maternity: "ਗਰਭਵਤੀ / ਨਵੀਂ ਮਾਂ", findSchemes: "ਮੇਰੀਆਂ ਯੋਜਨਾਵਾਂ ਲੱਭੋ", pipelineTitle: "ADK ਏਜੰਟ ਪਾਈਪਲਾਈਨ", aiTitle: "ਏਆਈ ਫੈਸਲਾ ਵਿਸ਼ਲੇਸ਼ਣ", placeholder: "ਪ੍ਰੋਫਾਈਲ ਭਰੋ ਜਾਂ ਸਵਾਲ ਪੁੱਛੋ ਅਤੇ ਯੋਗ ਯੋਜਨਾਵਾਂ ਲੱਭੋ।", working: "ਏਜੰਟ ਤੁਹਾਡੀ ਬੇਨਤੀ 'ਤੇ ਕੰਮ ਕਰ ਰਹੇ ਹਨ…", docTitle: "ਦਸਤਾਵੇਜ਼ ਤਿਆਰੀ", docHelp: "ਤੁਹਾਡੇ ਕੋਲ ਮੌਜੂਦ ਦਸਤਾਵੇਜ਼ ਲਿਖੋ।", docCheck: "ਤਿਆਰੀ ਚੈੱਕ ਕਰੋ", recommendedBecause: "ਸਿਫ਼ਾਰਸ਼ ਦਾ ਕਾਰਨ:", eligibilityMatch: "ਯੋਗਤਾ ਮੇਲ", applicationSteps: "ਅਰਜ਼ੀ ਦੇ ਪੜਾਅ", printPdf: "ਪ੍ਰਿੰਟ / PDF", download: "ਡਾਊਨਲੋਡ", share: "ਸ਼ੇਅਰ", historyTitle: "ਪਿਛਲੇ ਸਵਾਲ", historySearchPh: "ਪਿਛਲੇ ਸਵਾਲ ਖੋਜੋ…", historyEmpty: "ਤੁਹਾਡੇ ਹਾਲੀਆ ਸਵਾਲ ਇੱਥੇ ਦਿਖਣਗੇ।", ocrScanning: "ਦਸਤਾਵੇਜ਼ ਸਕੈਨ ਹੋ ਰਹੇ ਹਨ…", reportTitle: "ਨਾਗਰਿਕ ਸੰਖੇਪ — ਸਰਕਾਰਸਾਥੀ", rpProfile: "ਤੁਹਾਡੀ ਪ੍ਰੋਫਾਈਲ", rpSchemes: "ਯੋਗ ਯੋਜਨਾਵਾਂ", rpDocs: "ਲੋੜੀਂਦੇ ਦਸਤਾਵੇਜ਼", rpNextSteps: "ਅਗਲੇ ਕਦਮ", rpLinks: "ਅਰਜ਼ੀ ਲਿੰਕ", stage1: "ਤੁਹਾਡੇ ਸਵਾਲ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਹੋ ਰਿਹਾ ਹੈ…", stage2: "ਯੋਗ ਯੋਜਨਾਵਾਂ ਲੱਭੀਆਂ ਜਾ ਰਹੀਆਂ ਹਨ…", stage3: "ਦਸਤਾਵੇਜ਼ ਜਾਂਚੇ ਜਾ ਰਹੇ ਹਨ…", stage4: "ਤੁਹਾਡਾ ਜਵਾਬ ਤਿਆਰ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ…", clearAll: "ਸਭ ਸਾਫ ਕਰੋ", deleteItem: "ਮਿਟਾਓ", viewSchemes: "ਯੋਜਨਾਵਾਂ ਵੇਖੋ" },
  ml: { langLabel: "ഭാഷ", askTitle: "നിങ്ങളുടെ വാക്കുകളിൽ ചോദിക്കുക", askBtn: "ഏജന്റുകളോട് ചോദിക്കുക", askPlaceholder: "ഉദാ: ഞാൻ ബീഹാറിലെ 65 വയസ്സുള്ള വിരമിച്ച വ്യക്തിയാണ്", holdSpeak: "അമർത്തി സംസാരിക്കുക", listening: "കേൾക്കുന്നു… വിട്ടാൽ നിർത്തും", guideBtn: "എങ്ങനെ ഉപയോഗിക്കാം — കേൾക്കൂ, പഠിക്കൂ", citizenProfile: "പൗരൻ പ്രൊഫൈൽ", trySample: "സാമ്പിൾ പരീക്ഷിക്കുക", age: "പ്രായം", income: "വാർഷിക വരുമാനം (₹)", state: "സംസ്ഥാനം", gender: "ലിംഗം", education: "വിദ്യാഭ്യാസം", occupation: "തൊഴിൽ", category: "സാമൂഹിക വിഭാഗം", land: "ഭൂമി സ്വന്തമുണ്ട്", disability: "വൈകല്യം", maternity: "ഗർഭിണി / പുതിയ അമ്മ", findSchemes: "എന്റെ പദ്ധതികൾ കണ്ടെത്തുക", pipelineTitle: "ADK ഏജന്റ് പൈപ്പ്‌ലൈൻ", aiTitle: "എഐ തീരുമാന വിശകലനം", placeholder: "പ്രൊഫൈൽ പൂരിപ്പിക്കുകയോ ചോദ്യം ചോദിക്കുകയോ ചെയ്ത് അനുയോജ്യമായ പദ്ധതികൾ കണ്ടെത്തുക.", working: "ഏജന്റുകൾ നിങ്ങളുടെ അഭ്യർത്ഥനയിൽ പ്രവർത്തിക്കുന്നു…", docTitle: "രേഖാസജ്ജത", docHelp: "നിങ്ങൾക്കുള്ള രേഖകൾ എഴുതുക.", docCheck: "സജ്ജത പരിശോധിക്കുക", recommendedBecause: "ശുപാർശ ചെയ്ത കാരണം:", eligibilityMatch: "അർഹത പൊരുത്തം", applicationSteps: "അപേക്ഷാ ഘട്ടങ്ങൾ", printPdf: "പ്രിന്റ് / PDF", download: "ഡൗൺലോഡ്", share: "പങ്കിടുക", historyTitle: "മുൻ ചോദ്യങ്ങൾ", historySearchPh: "മുൻ ചോദ്യങ്ങൾ തിരയുക…", historyEmpty: "നിങ്ങളുടെ സമീപകാല ചോദ്യങ്ങൾ ഇവിടെ കാണിക്കും.", ocrScanning: "രേഖകൾ സ്കാൻ ചെയ്യുന്നു…", reportTitle: "പൗരൻ സംഗ്രഹം — സർക്കാർസാഥി", rpProfile: "നിങ്ങളുടെ പ്രൊഫൈൽ", rpSchemes: "അർഹമായ പദ്ധതികൾ", rpDocs: "ആവശ്യമായ രേഖകൾ", rpNextSteps: "അടുത്ത ഘട്ടങ്ങൾ", rpLinks: "അപേക്ഷ ലിങ്കുകൾ", stage1: "നിങ്ങളുടെ ചോദ്യത്തെ വിശകലനം ചെയ്യുന്നു…", stage2: "അർഹമായ പദ്ധതികൾ തിരയുന്നു…", stage3: "രേഖകൾ പരിശോധിക്കുന്നു…", stage4: "നിങ്ങളുടെ മറുപടി തയ്യാറാക്കുന്നു…", clearAll: "എല്ലാം നീക്കുക", deleteItem: "നീക്കുക", viewSchemes: "പദ്ധതികൾ കാണുക" },
  or: { langLabel: "ଭାଷା", askTitle: "ଆପଣଙ୍କ ଶବ୍ଦରେ ପଚାରନ୍ତୁ", askBtn: "ଏଜେଣ୍ଟଙ୍କୁ ପଚାରନ୍ତୁ", askPlaceholder: "ଉଦା: ମୁଁ ବିହାରର 65 ବର୍ଷର ଅବସରପ୍ରାପ୍ତ ବ୍ୟକ୍ତି", holdSpeak: "ଦବାଇ କହନ୍ତୁ", listening: "ଶୁଣୁଛି… ଛାଡିଲେ ଥାମିବ", guideBtn: "କିପରି ବ୍ୟବହାର କରିବେ — ଶୁଣନ୍ତୁ ଏବଂ ଶିଖନ୍ତୁ", citizenProfile: "ନାଗରିକ ପ୍ରୋଫାଇଲ୍", trySample: "ନମୁନା ଚେଷ୍ଟା କରନ୍ତୁ", age: "ବୟସ", income: "ବାର୍ଷିକ ଆୟ (₹)", state: "ରାଜ୍ୟ", gender: "ଲିଙ୍ଗ", education: "ଶିକ୍ଷା", occupation: "ପେଶା", category: "ସାମାଜିକ ବର୍ଗ", land: "ଜମି ଅଛି", disability: "ଅସମର୍ଥତା", maternity: "ଗର୍ଭବତୀ / ନୂତନ ମା'", findSchemes: "ମୋର ଯୋଜନା ଖୋଜନ୍ତୁ", pipelineTitle: "ADK ଏଜେଣ୍ଟ ପାଇପ୍ଲାଇନ୍", aiTitle: "ଏଆଇ ନିଷ୍ପତ୍ତି ବିଶ୍ଳେଷଣ", placeholder: "ପ୍ରୋଫାଇଲ୍ ଭରନ୍ତୁ କିମ୍ବା ପ୍ରଶ୍ନ କରନ୍ତୁ ଏବଂ ଯୋଗ୍ୟ ଯୋଜନା ଜାଣନ୍ତୁ।", working: "ଏଜେଣ୍ଟମାନେ ଆପଣଙ୍କ ଅନୁରୋଧରେ କାମ କରୁଛନ୍ତି…", docTitle: "ଦଳିଲ ପ୍ରସ୍ତୁତି", docHelp: "ଆପଣଙ୍କ ପାଖରେ ଥିବା ଦଳିଲ ଲେଖନ୍ତୁ।", docCheck: "ପ୍ରସ୍ତୁତି ଯାଞ୍ଚ", recommendedBecause: "ସୁପାରିଶ କାରଣ:", eligibilityMatch: "ଯୋଗ୍ୟତା ମେଳ", applicationSteps: "ଆବେଦନ ପଦକ୍ଷେପ", printPdf: "ପ୍ରିଣ୍ଟ / PDF", download: "ଡାଉନଲୋଡ୍", share: "ସେୟାର", historyTitle: "ପୂର୍ବ ପ୍ରଶ୍ନ", historySearchPh: "ପୂର୍ବ ପ୍ରଶ୍ନ ଖୋଜନ୍ତୁ…", historyEmpty: "ଆପଣଙ୍କ ସମ୍ପ୍ରତିକ ପ୍ରଶ୍ନଗୁଡ଼ିକ ଏଠାରେ ଦେଖାଯିବ।", ocrScanning: "ଦଳିଲ ସ୍କାନ୍ ହେଉଛି…", reportTitle: "ନାଗରିକ ସାରାଂଶ — ସରକାରସାଥୀ", rpProfile: "ଆପଣଙ୍କ ପ୍ରୋଫାଇଲ୍", rpSchemes: "ଯୋଗ୍ୟ ଯୋଜନା", rpDocs: "ଆବଶ୍ୟକ ଦଳିଲ", rpNextSteps: "ପରବର୍ତ୍ତୀ ପଦକ୍ଷେପ", rpLinks: "ଆବେଦନ ଲିଙ୍କ", stage1: "ଆପଣଙ୍କ ପ୍ରଶ୍ନ ବିଶ୍ଳେଷଣ ହେଉଛି…", stage2: "ଯୋଗ୍ୟ ଯୋଜନା ଖୋଜାଯାଉଛି…", stage3: "ଦଳିଲ ଯାଞ୍ଚ ହେଉଛି…", stage4: "ଆପଣଙ୍କ ଉତ୍ତର ପ୍ରସ୍ତୁତ ହେଉଛି…", clearAll: "ସବୁ ସଫା କରନ୍ତୁ", deleteItem: "ଡିଲିଟ୍", viewSchemes: "ଯୋଜନା ଦେଖନ୍ତୁ" },
};

function t(key) {
  const dict = I18N[lang()] || I18N.en;
  return dict[key] || I18N.en[key] || key;
}

function applyI18n() {
  document.documentElement.lang = lang();
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((node) => {
    node.setAttribute("placeholder", t(node.getAttribute("data-i18n-ph")));
  });
  if (!recording) setVoiceLabel(false);
}

// ============================================================
// AGENT PIPELINE
// ============================================================
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
let recognition = null;
let recording = false;
let lastResult = null;
let lastQuery = "";
let stageTimer = null;

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  docModal = new bootstrap.Modal(el("docModal"));
  initTheme();
  applyI18n();

  // Routing: show appropriate page
  if (isLoggedIn()) {
    showPage("page-main");
    updateWelcome();
    renderPipeline([]);
    loadHealth();
    renderHistory();
  } else {
    showPage("page-home");
  }

  // OTP event listeners
  bindEvent("sendOtpBtn", "click", handleSendOTP);
  bindEvent("verifyOtpBtn", "click", handleVerifyOTP);
  bindEvent("resendOtpLink", "click", (e) => {
    e.preventDefault();
    if (pendingMobile) {
      document.querySelectorAll(".otp-digit").forEach((i) => { i.value = ""; i.classList.remove("is-invalid"); });
      const otpErr = el("otpError");
      if (otpErr) otpErr.classList.add("d-none");
      const first = document.querySelector(".otp-digit");
      if (first) first.focus();
      // Show resend feedback
      const link = el("resendOtpLink");
      if (link) { link.textContent = "OTP resent! (Demo: 123456)"; setTimeout(() => { link.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i>Resend OTP'; }, 3000); }
    }
  });
  initOtpInputs();

  // Name setup handler
  const continueNameBtn = el("continueNameBtn");
  if (continueNameBtn) continueNameBtn.addEventListener("click", handleContinueName);

  // Profile form
  bindEvent("profileForm", "submit", (e) => {
    e.preventDefault();
    recommendFromForm();
  });

  // Ask button
  bindEvent("askBtn", "click", askAgents);
  bindEvent("sampleBtn", "click", fillSample);
  bindEvent("docCheckBtn", "click", runDocCheck);
  bindEvent("docUploadBtn", "click", handleDocUpload);
  bindEvent("docReadyBtn", "click", () => {
    const schemeFiles = getUploadedDocs()[currentDocScheme] || [];
    if (schemeFiles.length > 0) {
      el("docResult").innerHTML = `<div class="alert alert-success py-2 mb-0"><i class="bi bi-check-circle-fill me-2"></i>Document readiness confirmed! You have ${schemeFiles.length} file(s) ready.</div>`;
      setTimeout(() => { docModal.hide(); }, 2000);
    } else {
      alert("Please upload at least one document first");
    }
  });
  bindEvent("guideBtn", "click", toggleGuide);
  bindEvent("guideStopBtn", "click", stopGuide);
  bindEvent("themeToggle", "click", toggleTheme);

  // Results page report buttons
  bindEvent("printBtnR", "click", () => { buildReport(); window.print(); });
  bindEvent("downloadBtnR", "click", downloadReport);
  bindEvent("shareBtnR", "click", shareReport);

  bindEvent("historySearch", "input", renderHistory);
  bindEvent("historyClear", "click", clearHistory);

  initHoldToSpeak();

  bindEvent("langSelect", "change", () => {
    stopGuide();
    applyI18n();
    renderHistory();
    if (el("voiceGuide") && !el("voiceGuide").classList.contains("d-none")) renderGuide();
  });
});

// ============================================================
// HEALTH / PIPELINE
// ============================================================
async function loadHealth() {
  try {
    const r = await fetch(`${API}/api/health`);
    const d = await r.json();
    const badge = el("modeBadge");
    if (!badge) return;
    const map = {
      adk: ["ADK agents live", "text-bg-success"],
      gemini: ["Gemini mode", "text-bg-primary"],
      "offline-fallback": ["Offline demo", "text-bg-warning"],
    };
    const [label, cls] = map[d.mode] || ["ready", "text-bg-secondary"];
    badge.textContent = label;
    badge.className = `badge rounded-pill ${cls}`;
    badge.classList.remove("d-none");
  } catch {
    const badge = el("modeBadge");
    if (badge) { badge.textContent = "backend offline"; badge.className = "badge rounded-pill text-bg-danger"; }
  }
}

function renderPipeline(active) {
  const box = el("pipeline");
  if (!box) return;
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

// ============================================================
// ACTIONS
// ============================================================
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
  lastQuery = t("citizenProfile");
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
  lastQuery = message;
  setBusy(true);
  animatePipeline();
  try {
    const res = await postJSON("/api/agent", { message, profile: readProfile(), lang: lang() });
    render({
      explanation: res.reply,
      schemes: res.schemes,
      near_eligible_schemes: res.near_eligible_schemes || [],
      total_benefit_inr: res.total_benefit_inr,
      benefit_summary: null,
      mode: res.mode,
      profile: res.profile,
    });
    if (res.profile) reflectProfile(res.profile);
  } catch (e) { showError(e); }
  finally { setBusy(false); }
}

// ============================================================
// BENEFIT SCORE (ranking)
// ============================================================
const MAX_BENEFIT_INR = 600000;

function computeBenefitScore(scheme) {
  const benefitNorm = Math.min((scheme.benefit_annual_inr || 0) / MAX_BENEFIT_INR, 1);
  const matchNorm = (scheme.match_percent != null ? scheme.match_percent : 100) / 100;
  // 70% weight on financial benefit, 30% on eligibility match
  return Math.round(benefitNorm * 70 + matchNorm * 30);
}

// ============================================================
// RENDER — main entry point
// ============================================================
function render(res) {
  renderPipeline(AGENTS);
  lastResult = res;

  // Populate scheme map for bookmark/doc buttons
  schemeMap = {};
  (res.schemes || []).forEach((s) => { schemeMap[s.id] = s; });
  (res.near_eligible_schemes || []).forEach((s) => { schemeMap[s.id] = s; });

  // Navigate to results page
  showPage("page-results");

  // Show "last results" button on main page
  const vlr = el("viewLastResultsBtn");
  if (vlr) vlr.classList.remove("d-none");

  // Results meta
  const meta = el("resultsMeta");
  if (meta && res.schemes && res.schemes.length) {
    meta.innerHTML = `
      <span class="badge bg-success rounded-pill me-1">${res.schemes.length} eligible</span>
      ${res.near_eligible_schemes && res.near_eligible_schemes.length ? `<span class="badge bg-warning text-dark rounded-pill me-1">${res.near_eligible_schemes.length} near-eligible</span>` : ""}
      ${res.total_benefit_inr ? `<span class="text-success fw-bold ms-1">Est. ₹${Number(res.total_benefit_inr).toLocaleString("en-IN")}/yr total benefit</span>` : ""}`;
  }

  // AI Explanation
  const explWrap = el("resultsExplanationWrap");
  if (res.explanation) {
    explWrap.classList.remove("d-none");
    el("resultsExplanation").innerHTML = renderMarkdown(res.explanation);
  } else {
    explWrap.classList.add("d-none");
  }

  const schemes = res.schemes || [];
  const nearSchemes = res.near_eligible_schemes || [];

  // Section 1: Top 3
  renderTopSchemes(schemes);

  // Section 2: Eligible
  renderEligibleSection(schemes);

  // Section 3: Nearly eligible
  renderNearlySection(nearSchemes);

  // Section 4: Bookmarked
  renderSavedSection();

  if (res.profile) saveHistory(res);
}

// ============================================================
// SECTION 1: TOP 3 RANKED SCHEMES
// ============================================================
const RANK_CONFIG = [
  { medal: "🥇", label: "Rank 1 – Best Benefits", cls: "rank-gold", desc: "Highest overall value — best recommendation for your profile" },
  { medal: "🥈", label: "Rank 2 – Very Good Benefits", cls: "rank-silver", desc: "Strong benefits and high suitability" },
  { medal: "🥉", label: "Rank 3 – Good Benefits", cls: "rank-bronze", desc: "Valuable scheme with solid benefit score" },
];

function renderTopSchemes(schemes) {
  const section = el("topSchemesSection");
  const container = el("topSchemeCards");
  const badge = el("topSchemesBadge");
  container.innerHTML = "";

  if (!schemes.length) {
    section.classList.add("d-none");
    return;
  }
  section.classList.remove("d-none");

  const sorted = [...schemes].sort((a, b) => computeBenefitScore(b) - computeBenefitScore(a));
  const top3 = sorted.slice(0, Math.min(3, sorted.length));
  if (badge) badge.textContent = `Top ${top3.length}`;

  top3.forEach((scheme, idx) => {
    const cfg = RANK_CONFIG[idx];
    const score = computeBenefitScore(scheme);
    const passReasons = (scheme.reasons || []).filter((r) => r.startsWith("\u2713"));
    const whyText = passReasons.length > 0
      ? `This scheme is ranked #${idx + 1} because: ${passReasons.slice(0, 3).map((r) => r.slice(2).trim()).join("; ")}, and provides ₹${Number(scheme.benefit_annual_inr).toLocaleString("en-IN")}/yr in ${scheme.category.toLowerCase()} benefits.`
      : `This scheme is ranked #${idx + 1} for its high benefit value of ₹${Number(scheme.benefit_annual_inr).toLocaleString("en-IN")}/yr in the ${scheme.category} category.`;

    const bmIcon = isBookmarked(scheme.id) ? "bi-bookmark-fill" : "bi-bookmark";
    const bmLabel = isBookmarked(scheme.id) ? "Saved" : "Save";

    const col = document.createElement("div");
    col.className = "col-md-4";
    col.innerHTML = `
      <div class="top-scheme-card ${cfg.cls} h-100 d-flex flex-column">
        <div class="rank-header">
          <span class="rank-medal">${cfg.medal}</span>
          <div>
            <div class="rank-label fw-bold">${escapeHtml(cfg.label)}</div>
            <div class="rank-desc small opacity-75">${escapeHtml(cfg.desc)}</div>
          </div>
        </div>
        <div class="score-ring-wrap">
          <div class="score-ring">
            <svg viewBox="0 0 56 56" class="score-svg">
              <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="5"/>
              <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" stroke-width="5"
                stroke-dasharray="${Math.round(score * 1.508)} 150.8" stroke-linecap="round" transform="rotate(-90 28 28)"/>
            </svg>
            <div class="score-inner"><span class="score-num">${score}</span><span class="score-denom">/100</span></div>
          </div>
          <div class="ms-3 flex-grow-1">
            <div class="fw-bold" style="font-size:0.78rem;opacity:0.75;">BENEFIT SCORE</div>
            <div class="fw-bold mt-1">₹${Number(scheme.benefit_annual_inr).toLocaleString("en-IN")}/yr</div>
          </div>
        </div>
        <h5 class="scheme-name fw-bold mt-3">${escapeHtml(scheme.scheme_name)}</h5>
        <div class="scheme-meta small mb-2">
          <i class="bi ${categoryIcon(scheme.category)} me-1"></i>${escapeHtml(scheme.category)} · ${escapeHtml(scheme.state)}
          <span class="ms-2 badge bg-white bg-opacity-25">${escapeHtml(scheme.level)}</span>
        </div>
        <p class="key-benefit small mb-3"><i class="bi bi-gift-fill me-1"></i>${escapeHtml(scheme.benefit_text)}</p>
        <div class="why-box mb-3">
          <div class="why-title small fw-bold mb-1"><i class="bi bi-patch-check-fill me-1"></i>Why Recommended</div>
          <div class="why-text small fst-italic">"${escapeHtml(whyText)}"</div>
        </div>
        <div class="d-flex align-items-center gap-2 mb-3">
          <span class="match-pill">${scheme.match_percent != null ? scheme.match_percent : 100}% Match</span>
        </div>
        <div class="mt-auto d-flex flex-column gap-2">
          <a href="${escapeHtml(scheme.apply_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-light fw-bold w-100">
            <i class="bi bi-box-arrow-up-right me-1"></i>View Details &amp; Apply
          </a>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-light flex-grow-1 bm-btn" data-scheme-id="${escapeHtml(scheme.id)}" onclick="handleBookmarkClick(this)">
              <i class="bi ${bmIcon} me-1"></i>${bmLabel}
            </button>
            <button class="btn btn-sm btn-outline-light" onclick="openDoc('${escapeHtml(scheme.id)}')">
              <i class="bi bi-folder-check"></i>
            </button>
          </div>
        </div>
      </div>`;
    container.appendChild(col);
  });
}

// ============================================================
// SECTION 2: ELIGIBLE SCHEMES
// ============================================================
function renderEligibleSection(schemes) {
  const container = el("eligibleCards");
  const empty = el("eligibleEmpty");
  const badge = el("eligibleBadge");
  container.innerHTML = "";

  if (badge) badge.textContent = `${schemes.length} scheme${schemes.length !== 1 ? "s" : ""}`;

  if (!schemes.length) {
    empty.classList.remove("d-none");
    return;
  }
  empty.classList.add("d-none");
  schemes.forEach((s) => {
    const col = document.createElement("div");
    col.className = "col-md-6 col-xl-4";
    col.appendChild(schemeCard(s));
    container.appendChild(col);
  });
}

// ============================================================
// SECTION 3: NEARLY ELIGIBLE
// ============================================================
function renderNearlySection(nearSchemes) {
  const section = el("nearlySection");
  const container = el("nearlyCards");
  const badge = el("nearlyBadge");
  container.innerHTML = "";

  if (!nearSchemes.length) {
    section.classList.add("d-none");
    return;
  }
  section.classList.remove("d-none");
  if (badge) badge.textContent = `${nearSchemes.length} scheme${nearSchemes.length !== 1 ? "s" : ""}`;

  nearSchemes.forEach((s) => {
    const missing = s.missing_criterion || (s.reasons || []).find((r) => r.startsWith("\u2717")) || "";
    const missingText = missing.startsWith("\u2717") ? missing.slice(2).trim() : missing;
    const passCount = (s.reasons || []).filter((r) => r.startsWith("\u2713")).length;
    const totalCount = (s.reasons || []).length;
    const col = document.createElement("div");
    col.className = "col-md-6";
    col.innerHTML = `
      <div class="card nearly-card shadow-sm h-100">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
            <h6 class="fw-bold mb-0">${escapeHtml(s.scheme_name)}</h6>
            <span class="badge bg-warning text-dark rounded-pill flex-shrink-0">${s.match_percent}% Match</span>
          </div>
          <div class="text-muted small mb-2">
            <i class="bi ${categoryIcon(s.category)} me-1"></i>${escapeHtml(s.category)} · ${escapeHtml(s.state)}
          </div>
          <p class="small mb-2"><i class="bi bi-gift me-1 text-success"></i>${escapeHtml(s.benefit_text)}
            <span class="benefit-amount">(≈ ₹${Number(s.benefit_annual_inr).toLocaleString("en-IN")}/yr)</span>
          </p>
          <div class="missing-box alert alert-warning py-2 px-3 mb-2 small">
            <strong><i class="bi bi-x-circle-fill me-1"></i>Missing Requirement:</strong> ${escapeHtml(missingText)}
          </div>
          <div class="small text-muted mb-3">
            <i class="bi bi-info-circle me-1"></i>
            You satisfy <strong>${passCount}</strong> out of <strong>${totalCount}</strong> eligibility criteria.
            Only this one requirement is not met.
          </div>
          <div class="d-flex gap-2">
            <a href="${escapeHtml(s.apply_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-warning flex-grow-1">
              <i class="bi bi-box-arrow-up-right me-1"></i>Learn More
            </a>
            <button class="btn btn-sm btn-outline-secondary bm-btn" data-scheme-id="${escapeHtml(s.id)}" onclick="handleBookmarkClick(this)">
              <i class="bi ${isBookmarked(s.id) ? "bi-bookmark-fill" : "bi-bookmark"}"></i>
            </button>
          </div>
        </div>
      </div>`;
    container.appendChild(col);
  });
}

// ============================================================
// SECTION 4: SAVED / BOOKMARKED
// ============================================================
function renderSavedSection() {
  const container = el("savedCards");
  const empty = el("savedEmpty");
  const badge = el("savedBadge");
  container.innerHTML = "";
  const bookmarks = getBookmarks();

  if (badge) badge.textContent = `${bookmarks.length} saved`;

  if (!bookmarks.length) {
    empty.classList.remove("d-none");
    return;
  }
  empty.classList.add("d-none");
  bookmarks.forEach((s) => {
    const col = document.createElement("div");
    col.className = "col-md-6 col-xl-4";
    col.appendChild(schemeCard(s));
    container.appendChild(col);
  });
}

// ============================================================
// SCHEME CARD (eligible / bookmarked)
// ============================================================
function schemeCard(s) {
  const col = document.createElement("div");
  col.className = "card scheme-card shadow-sm h-100";
  const reasonItems = (s.reasons || []).filter((r) => r.startsWith("\u2713"));
  const reasons = reasonItems.map((r) => `<div class="reason pass">${escapeHtml(r)}</div>`).join("");
  const recommended = reasonItems.length
    ? `<div class="recommended-title mt-1 mb-1"><i class="bi bi-patch-check-fill me-1"></i>${t("recommendedBecause")}</div>${reasons}`
    : "";
  const match = Number(s.match_percent != null ? s.match_percent : 100);
  const matchBar = `
    <div class="match-wrap">
      <div class="match-head"><span>${t("eligibilityMatch")}</span><span class="match-label">${match}%</span></div>
      <div class="match-bar"><div class="match-fill" style="width:${match}%"></div></div>
    </div>`;
  const docs = (s.documents || []).map((d) => `<span class="badge text-bg-light border doc-pill">${escapeHtml(d)}</span>`).join("");
  const steps = (s.steps || []).map((st) => `<li>${escapeHtml(st)}</li>`).join("");
  const bmIcon = isBookmarked(s.id) ? "bi-bookmark-fill" : "bi-bookmark";
  const bmLabel = isBookmarked(s.id) ? "Saved" : "Save";
  col.innerHTML = `
    <div class="card-body d-flex flex-column">
      <div class="d-flex justify-content-between align-items-start">
        <h6 class="fw-bold mb-1">${escapeHtml(s.scheme_name)}</h6>
        <span class="badge text-bg-primary level-badge">${escapeHtml(s.level)}</span>
      </div>
      <div class="text-muted small mb-2"><i class="bi ${categoryIcon(s.category)} me-1"></i>${escapeHtml(s.category)} · ${escapeHtml(s.state)}</div>
      <p class="mb-2 small"><i class="bi bi-gift text-success me-1"></i>${escapeHtml(s.benefit_text)}
        <span class="benefit-amount">(≈ ₹${Number(s.benefit_annual_inr).toLocaleString("en-IN")}/yr)</span></p>
      <div class="mb-1">${recommended}</div>
      ${matchBar}
      <details class="mb-2 mt-2">
        <summary class="small text-primary">${t("applicationSteps")}</summary>
        <ol class="step-list mt-2">${steps}</ol>
      </details>
      <div class="mb-2">${docs}</div>
      <div class="d-flex gap-2 mt-auto">
        <a href="${escapeHtml(s.apply_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-primary flex-grow-1" title="Go to official scheme website to apply">
          <i class="bi bi-box-arrow-up-right me-1"></i>Apply
        </a>
        <button class="btn btn-sm btn-outline-secondary bm-btn" data-scheme-id="${escapeHtml(s.id)}" onclick="handleBookmarkClick(this)" title="${bmLabel} this scheme for later reference">
          <i class="bi ${bmIcon}"></i>
        </button>
        <button class="btn btn-sm btn-outline-secondary" onclick="openDoc('${escapeHtml(s.id)}')" title="View required documents and checklist">
          <i class="bi bi-folder-check"></i>
        </button>
      </div>
    </div>`;
  return col;
}

// ============================================================
// BOOKMARK CLICK HANDLER
// ============================================================
window.handleBookmarkClick = function(btn) {
  const schemeId = btn.getAttribute("data-scheme-id");
  const scheme = schemeMap[schemeId];
  if (!scheme) return;
  const nowBookmarked = toggleBookmark(scheme);
  // Update all bookmark buttons for this scheme
  document.querySelectorAll(`.bm-btn[data-scheme-id="${schemeId}"]`).forEach((b) => {
    const icon = b.querySelector("i");
    if (icon) icon.className = nowBookmarked ? "bi bi-bookmark-fill me-1" : "bi bi-bookmark me-1";
    // Update label if present
    const txt = b.childNodes[b.childNodes.length - 1];
    if (txt && txt.nodeType === 3) txt.textContent = nowBookmarked ? "Saved" : "Save";
    if (!icon) return; // icon-only button
    // Fix icon-only (no label)
    if (b.querySelectorAll("i").length === 1 && b.children.length === 1) {
      icon.className = nowBookmarked ? "bi bi-bookmark-fill" : "bi bi-bookmark";
    }
  });
  // Refresh saved section
  renderSavedSection();
};

function categoryIcon(category) {
  const map = {
    Education: "bi-mortarboard-fill", Farmers: "bi-tractor", Startups: "bi-rocket-takeoff-fill",
    Women: "bi-gender-female", Health: "bi-heart-pulse-fill", "Senior Citizens": "bi-person-hearts",
    Housing: "bi-house-heart-fill", Employment: "bi-briefcase-fill", Energy: "bi-lightning-charge-fill",
  };
  return map[category] || "bi-award-fill";
}

// ============================================================
// DOCUMENT UPLOAD & READINESS
// ============================================================
function getUploadedDocs() {
  try { return JSON.parse(localStorage.getItem("ss_uploaded_docs") || "{}"); } catch { return {}; }
}

function saveUploadedDocs(docs) { localStorage.setItem("ss_uploaded_docs", JSON.stringify(docs)); }

function addUploadedDoc(schemeId, file) {
  const docs = getUploadedDocs();
  if (!docs[schemeId]) docs[schemeId] = [];
  docs[schemeId].unshift({
    name: file.name,
    size: file.size,
    type: file.type,
    uploadTime: Date.now(),
    id: Math.random().toString(36).substr(2, 9)
  });
  if (docs[schemeId].length > 20) docs[schemeId] = docs[schemeId].slice(0, 20);
  saveUploadedDocs(docs);
}

function removeUploadedDoc(schemeId, docId) {
  const docs = getUploadedDocs();
  if (docs[schemeId]) {
    docs[schemeId] = docs[schemeId].filter(d => d.id !== docId);
  }
  saveUploadedDocs(docs);
}

function displayUploadedFiles(schemeId) {
  const docs = getUploadedDocs();
  const schemeFiles = docs[schemeId] || [];
  const list = el("uploadedFilesList");
  const noFiles = el("noFilesText");
  
  if (!list) return;
  
  if (schemeFiles.length === 0) {
    list.innerHTML = "";
    if (noFiles) noFiles.classList.remove("d-none");
    return;
  }
  
  if (noFiles) noFiles.classList.add("d-none");
  list.innerHTML = schemeFiles.map(doc => {
    const date = new Date(doc.uploadTime).toLocaleDateString();
    const sizeKB = (doc.size / 1024).toFixed(1);
    return `
      <div class="list-group-item d-flex justify-content-between align-items-center py-2">
        <div>
          <div class="small fw-500"><i class="bi bi-file-earmark me-1"></i>${escapeHtml(doc.name)}</div>
          <div class="text-muted small">${sizeKB} KB · ${date}</div>
        </div>
        <button class="btn btn-sm btn-outline-danger" onclick="removeUploadedDoc('${schemeId}', '${doc.id}'); displayUploadedFiles('${schemeId}')" title="Delete this file">
          <i class="bi bi-trash"></i>
        </button>
      </div>`;
  }).join("");
}

window.openDoc = function(schemeId) {
  currentDocScheme = schemeId;
  const scheme = schemeMap[schemeId];
  
  // Display required documents
  const docList = el("docRequiredList");
  if (docList && scheme && scheme.documents) {
    docList.innerHTML = (scheme.documents || []).map(d => 
      `<div class="list-group-item py-1"><i class="bi bi-file-pdf me-2 text-danger"></i>${escapeHtml(d)}</div>`
    ).join("") || `<p class="text-muted small mb-0">No specific documents listed</p>`;
  }
  
  // Display uploaded files for this scheme
  displayUploadedFiles(schemeId);
  
  el("docFileInput").value = "";
  el("docResult").innerHTML = "";
  docModal.show();
};

// Handle file upload
window.handleDocUpload = function() {
  if (!currentDocScheme) return;
  
  const input = el("docFileInput");
  const file = input.files[0];
  if (!file) return;
  
  // Validate file type
  const allowed = ["application/pdf", "image/jpeg", "image/png"];
  if (!allowed.includes(file.type)) {
    alert("Only PDF and image files (JPG, PNG) are supported");
    return;
  }
  
  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    alert("File size must be less than 5MB");
    return;
  }
  
  // Add to uploaded docs
  addUploadedDoc(currentDocScheme, file);
  displayUploadedFiles(currentDocScheme);
  
  // Show success message
  const result = el("docResult");
  if (result) {
    result.innerHTML = `<div class="alert alert-success py-2 mb-0"><i class="bi bi-check-circle me-2"></i>File uploaded: ${escapeHtml(file.name)}</div>`;
    setTimeout(() => { result.innerHTML = ""; }, 3000);
  }
  
  input.value = "";
};

window.removeUploadedDoc = function(schemeId, docId) {
  removeUploadedDoc(schemeId, docId);
};

async function runDocCheck() {
  if (!currentDocScheme) return;
  const prog = el("docProgress");
  const bar = el("docProgressBar");
  el("docResult").innerHTML = "";
  const uploadedNames = (getUploadedDocs()[currentDocScheme] || []).map((d) => d.name);
  if (!uploadedNames.length) {
    el("docResult").innerHTML = '<p class="small text-danger mb-0">Please upload at least one document first.</p>';
    return;
  }
  prog.classList.remove("d-none");
  bar.style.width = "0%";
  let pct = 0;
  const timer = setInterval(() => { pct = Math.min(90, pct + 12); bar.style.width = pct + "%"; }, 120);
  try {
    const res = await postJSON("/api/documents/check", {
      scheme_id: currentDocScheme,
      uploaded: uploadedNames.join(", "),
      lang: lang(),
    });
    clearInterval(timer);
    bar.style.width = "100%";
    setTimeout(() => prog.classList.add("d-none"), 350);
    const missing = res.missing.map((d) => `<li>${escapeHtml(d)}</li>`).join("") || "<li>None 🎉</li>";
    el("docResult").innerHTML = `
      <div class="progress mb-2" style="height:22px;">
        <div class="progress-bar bg-success" style="width:${res.readiness_percent}%">${res.readiness_percent}%</div>
      </div>
      <p class="small mb-1"><strong>${escapeHtml(res.note)}</strong></p>
      <p class="small mb-1 text-success">Present: ${escapeHtml((res.present || []).join(", ") || "—")}</p>
      <p class="small mb-0 text-danger">Still needed:</p>
      <ul class="small text-danger">${missing}</ul>`;
  } catch (e) {
    clearInterval(timer);
    prog.classList.add("d-none");
    el("docResult").innerHTML = `<p class="small text-danger mb-0">${escapeHtml(e.message)}</p>`;
  }
}

// ============================================================
// VOICE (Hold & Speak)
// ============================================================
function setVoiceLabel(listening) {
  const label = el("voiceLabel");
  if (label) label.textContent = listening ? t("listening") : t("holdSpeak");
}

function initHoldToSpeak() {
  const btn = el("voiceBtn");
  if (!btn) return;
  const press = (e) => { e.preventDefault(); startHold(); };
  const release = (e) => { e.preventDefault(); stopHold(); };
  btn.addEventListener("mousedown", press);
  btn.addEventListener("mouseup", release);
  btn.addEventListener("mouseleave", release);
  btn.addEventListener("touchstart", press, { passive: false });
  btn.addEventListener("touchend", release);
  btn.addEventListener("touchcancel", release);
  btn.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !recording) { e.preventDefault(); startHold(); } });
  btn.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); stopHold(); } });
}

function startHold() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert("Voice input is not supported in this browser. Please use Chrome or Edge."); return; }
  if (recording) return;
  recognition = new SR();
  recognition.lang = (LANGS[lang()] && LANGS[lang()].locale) || "en-IN";
  recognition.continuous = true;
  recognition.interimResults = true;
  let finalText = "";
  el("freeText").value = "";
  recognition.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const chunk = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += chunk + " ";
      else interim += chunk;
    }
    el("freeText").value = (finalText + interim).trim();
  };
  recognition.onerror = () => {};
  recognition.onend = () => {
    recording = false;
    recognition = null;
    el("voiceBtn").classList.remove("recording");
    setVoiceLabel(false);
  };
  recording = true;
  el("voiceBtn").classList.add("recording");
  setVoiceLabel(true);
  try { recognition.start(); } catch (_) {}
}

function stopHold() {
  if (recognition) { try { recognition.stop(); } catch (_) {} }
}

// ============================================================
// VOICE GUIDE (Text-to-Speech)
// ============================================================
function guideContent() { return GUIDE[lang()] || GUIDE.en; }

function renderGuide() {
  const g = guideContent();
  el("guideHeading").textContent = g.heading;
  el("guideSteps").innerHTML = g.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("");
  el("guideExample").textContent = g.example;
}

function toggleGuide() {
  const box = el("voiceGuide");
  const opening = box.classList.contains("d-none");
  if (opening) {
    renderGuide();
    box.classList.remove("d-none");
    el("guideBtn").setAttribute("aria-expanded", "true");
    speakGuide();
  } else {
    stopGuide();
    box.classList.add("d-none");
    el("guideBtn").setAttribute("aria-expanded", "false");
  }
}

function speakGuide() {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const g = guideContent();
  const text = [g.intro, ...g.steps, g.example].join(". ");
  const u = new SpeechSynthesisUtterance(text);
  u.lang = (LANGS[lang()] && LANGS[lang()].locale) || "en-IN";
  u.rate = 0.9;
  const btn = el("guideBtn");
  btn.classList.add("speaking");
  u.onend = () => btn.classList.remove("speaking");
  u.onerror = () => btn.classList.remove("speaking");
  window.speechSynthesis.speak(u);
}

function stopGuide() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  const btn = el("guideBtn");
  if (btn) btn.classList.remove("speaking");
}

// ============================================================
// HELPERS
// ============================================================
function fillSample() {
  const f = el("profileForm");
  f.age.value = 19; f.income.value = 200000; f.state.value = "Uttar Pradesh";
  f.gender.value = "Female"; f.education.value = "UG"; f.occupation.value = "Student";
  f.social_category.value = ""; f.land_owner.checked = false;
  f.disability.checked = false; f.maternity.checked = false;
  el("freeText").value = "I am a 19-year-old girl from Uttar Pradesh pursuing B.Tech, family income Rs 2 lakh.";
}

function reflectProfile(p) {
  const f = el("profileForm");
  if (!f) return;
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
  const spinner = el("spinner");
  if (spinner) spinner.classList.toggle("d-none", !b);
  const placeholder = el("placeholder");
  if (b) {
    if (placeholder) placeholder.classList.add("d-none");
    startStages();
  } else {
    stopStages();
  }
}

function startStages() {
  const stages = ["stage1", "stage2", "stage3", "stage4"];
  const spinner = el("spinner");
  if (!spinner) return;
  const p = spinner.querySelector("p");
  if (!p) return;
  let i = 0;
  const show = () => {
    p.textContent = t(stages[Math.min(i, stages.length - 1)]);
    p.classList.remove("stage-line"); void p.offsetWidth; p.classList.add("stage-line");
    i++;
  };
  show();
  stageTimer = setInterval(() => { if (i < stages.length) show(); }, 900);
}
function stopStages() { if (stageTimer) { clearInterval(stageTimer); stageTimer = null; } }

function showError(e) {
  setBusy(false);
  const placeholder = el("placeholder");
  if (placeholder) {
    placeholder.classList.remove("d-none");
    placeholder.innerHTML = `<i class="bi bi-exclamation-triangle display-4 d-block mb-3 text-warning"></i>${escapeHtml(e.message)}`;
  }
}

// ============================================================
// DARK MODE
// ============================================================
function initTheme() {
  const saved = localStorage.getItem("ss_theme") || "light";
  applyTheme(saved);
}
function toggleTheme() {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  localStorage.setItem("ss_theme", next);
  applyTheme(next);
}
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const icon = el("themeToggle") && el("themeToggle").querySelector("i");
  if (icon) icon.className = theme === "dark" ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
}

// ============================================================
// HISTORY
// ============================================================
function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function loadHistoryStore() {
  try { return JSON.parse(localStorage.getItem("ss_history") || "[]"); } catch { return []; }
}
function saveHistory(res) {
  if (!res || !res.schemes) return;
  const store = loadHistoryStore();
  const entry = {
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    q: lastQuery || t("citizenProfile"),
    ts: Date.now(),
    lang: lang(),
    count: (res.schemes || []).length,
    res,
  };
  store.unshift(entry);
  localStorage.setItem("ss_history", JSON.stringify(store.slice(0, 20)));
  renderHistory();
}
function deleteHistory(id) {
  const store = loadHistoryStore().filter((it) => it.id !== id);
  localStorage.setItem("ss_history", JSON.stringify(store));
  renderHistory();
}
function clearHistory() {
  localStorage.removeItem("ss_history");
  renderHistory();
}
function renderHistory() {
  const list = el("historyList");
  const empty = el("historyEmpty");
  const clearBtn = el("historyClear");
  if (!list) return;
  const all = loadHistoryStore();
  if (clearBtn) clearBtn.classList.toggle("d-none", all.length === 0);
  const searchEl = el("historySearch");
  const term = (searchEl ? searchEl.value : "").trim().toLowerCase();
  let items = all;
  if (term) {
    items = items.filter((it) => {
      const names = (it.res.schemes || []).map((s) => s.scheme_name).join(" ");
      return (it.q + " " + names).toLowerCase().includes(term);
    });
  }
  list.innerHTML = "";
  if (empty) empty.classList.toggle("d-none", items.length > 0);
  items.forEach((it) => {
    const div = document.createElement("div");
    div.className = "history-item d-flex justify-content-between align-items-start gap-2";
    const when = new Date(it.ts).toLocaleString();
    div.innerHTML = `
      <div class="h-open flex-grow-1">
        <div class="h-q">${esc(it.q)}</div>
        <div class="h-meta"><i class="bi bi-clock me-1"></i>${esc(when)} · ${it.count} scheme(s)</div>
      </div>
      <button class="btn btn-sm btn-link text-danger p-0 h-del" title="${t("deleteItem")}" aria-label="${t("deleteItem")}">
        <i class="bi bi-trash"></i>
      </button>`;
    div.querySelector(".h-open").addEventListener("click", () => {
      render(it.res);
      if (it.res.profile) reflectProfile(it.res.profile);
    });
    div.querySelector(".h-del").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteHistory(it.id);
    });
    list.appendChild(div);
  });
}

// ============================================================
// REPORT (Print / Download)
// ============================================================
function buildReport() {
  if (!lastResult) return "";
  const res = lastResult;
  const p = res.profile || {};
  const profileRows = Object.keys(p).length
    ? Object.entries(p).map(([k, v]) => `<li><strong>${esc(k)}:</strong> ${esc(v)}</li>`).join("")
    : "<li>—</li>";
  const schemesHtml = (res.schemes || []).map((s) => `
    <div class="rp-scheme">
      <strong>${esc(s.scheme_name)}</strong> (${esc(s.level)} · ${esc(s.category)})<br>
      ${esc(s.benefit_text)} — approx Rs${Number(s.benefit_annual_inr).toLocaleString("en-IN")}/yr<br>
      <em>${t("eligibilityMatch")}: ${s.match_percent != null ? s.match_percent : 100}%</em><br>
      ${(s.reasons || []).filter((r) => r.startsWith("\u2713")).map(esc).join("<br>")}
    </div>`).join("");
  const docs = [...new Set((res.schemes || []).flatMap((s) => s.documents || []))];
  const docsHtml = docs.length ? docs.map((d) => `<li>${esc(d)}</li>`).join("") : "<li>—</li>";
  const steps = (res.schemes && res.schemes[0] && res.schemes[0].steps) || [];
  const stepsHtml = steps.length ? steps.map((s) => `<li>${esc(s)}</li>`).join("") : "<li>—</li>";
  const linksHtml = (res.schemes || []).map((s) => `<li>${esc(s.scheme_name)}: <a href="${esc(s.apply_url)}">${esc(s.apply_url)}</a></li>`).join("") || "<li>—</li>";
  const html = `
    <h1>🇮🇳 ${t("reportTitle")}</h1>
    <p>${esc(new Date().toLocaleString())}</p>
    ${res.explanation ? `<p>${esc(res.explanation)}</p>` : ""}
    <h3>${t("rpProfile")}</h3><ul>${profileRows}</ul>
    <h3>${t("rpSchemes")} (${(res.schemes || []).length})</h3>${schemesHtml || "<p>—</p>"}
    <h3>${t("rpDocs")}</h3><ul>${docsHtml}</ul>
    <h3>${t("rpNextSteps")}</h3><ol>${stepsHtml}</ol>
    <h3>${t("rpLinks")}</h3><ul>${linksHtml}</ul>`;
  el("reportArea").innerHTML = html;
  return html;
}

function downloadReport() {
  const inner = buildReport();
  if (!inner) return;
  const doc = `<!DOCTYPE html><html lang="${lang()}"><head><meta charset="UTF-8">
    <title>${t("reportTitle")}</title>
    <style>body{font-family:system-ui,sans-serif;max-width:800px;margin:24px auto;padding:0 16px;color:#16233f;line-height:1.6}
    h1{color:#0b3d91}h3{color:#138808;margin-top:1.2rem;border-bottom:2px solid #eee;padding-bottom:4px}
    .rp-scheme{border:1px solid #ccc;border-radius:8px;padding:10px 14px;margin-bottom:10px}
    a{color:#0b3d91}</style></head><body>${inner}</body></html>`;
  const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "SarkarSathi-Report.html";
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function shareReport() {
  if (!lastResult) return;
  const res = lastResult;
  const lines = [t("reportTitle"), res.explanation ? res.explanation.slice(0, 200) + "…" : "", "", ...(res.schemes || []).slice(0, 5).map((s) => `• ${s.scheme_name}: ${s.benefit_text}`)];
  const text = lines.filter(Boolean).join("\n");
  try {
    if (navigator.share) {
      await navigator.share({ title: t("reportTitle"), text });
      return;
    }
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      alert("Summary copied to clipboard!");
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(ta);
    if (copied) {
      alert("Summary copied to clipboard!");
    } else {
      alert("Unable to auto-copy. Please copy manually:\n\n" + text);
    }
  } catch {
    alert("Unable to share right now. Please try again.");
  }
}