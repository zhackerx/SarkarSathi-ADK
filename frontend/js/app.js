// SarkarSathi ADK — frontend logic
const API = ""; // same origin (Flask serves this page)

const el = (id) => document.getElementById(id);
const lang = () => (el("langSelect") ? el("langSelect").value : "en");

// Supported languages: display name + speech locale (for voice input & guide).
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

// Step-by-step voice guide (spoken aloud + shown as large text).
// Reliable, hand-written text in English & Hindi; other languages use English.
const GUIDE = {
  en: {
    heading: "How to use SarkarSathi",
    intro: "Welcome to SarkarSathi. I help you find government schemes you can get. Here is how to use me by voice.",
    steps: [
      "Tap the round microphone button.",
      "Speak about yourself in one sentence — your age, your state, and your work.",
      "Wait a moment. I will show the schemes you may get and how much benefit.",
      "You can also type in the box, or fill the simple form below.",
    ],
    example: "Example — say: “I am a 65-year-old retired person from Bihar with a low income.”",
  },
  hi: {
    heading: "सरकारसाथी का उपयोग कैसे करें",
    intro: "सरकारसाथी में आपका स्वागत है। मैं आपको सरकारी योजनाएँ खोजने में मदद करता हूँ। इसे आवाज़ से इस तरह इस्तेमाल करें।",
    steps: [
      "गोल माइक बटन दबाएँ।",
      "एक वाक्य में अपने बारे में बताएँ — अपनी उम्र, अपना राज्य और अपना काम।",
      "थोड़ी देर रुकें। मैं आपके लिए उपलब्ध योजनाएँ और लाभ दिखाऊँगा।",
      "आप बॉक्स में लिख भी सकते हैं, या नीचे दिया सरल फ़ॉर्म भर सकते हैं।",
    ],
    example: "उदाहरण — कहें: “मैं बिहार से पैंसठ वर्ष का सेवानिवृत्त व्यक्ति हूँ, आय कम है।”",
  },
};

// ---------------- UI translations (interface text only) ----------------
// Field values that the engine needs (Male, UG, state names, etc.) stay English;
// only labels, headings, buttons, hints and placeholders are translated.
const I18N = {
  en: { langLabel: "Language", askTitle: "Ask in your own words", askBtn: "Ask the Agents", askPlaceholder: "e.g. I am a 65-year-old retired person from Bihar, or: I am a 19-year-old girl from Kanpur pursuing B.Tech", holdSpeak: "Hold & Speak", listening: "Listening… release to stop", guideBtn: "How to use — Listen & learn", citizenProfile: "Citizen Profile", trySample: "Try sample", age: "Age", income: "Annual income (₹)", state: "State", gender: "Gender", education: "Education", occupation: "Occupation", category: "Social category", land: "Owns land", disability: "Disability", maternity: "Pregnant / new mother", findSchemes: "Find my schemes", pipelineTitle: "ADK Agent Pipeline", aiTitle: "AI Decision Intelligence", placeholder: "Fill the profile or ask a question to discover the government schemes you qualify for.", working: "Agents are working on your request…", docTitle: "Document Readiness", docHelp: "Type the documents you already have (comma separated), e.g. Aadhaar, Income Certificate.", docCheck: "Check readiness", recommendedBecause: "Recommended because:", eligibilityMatch: "Eligibility Match", applicationSteps: "Application steps", printPdf: "Print / Save PDF", download: "Download", share: "Share", historyTitle: "Past questions", historySearchPh: "Search past questions…", historyEmpty: "Your recent questions will appear here.", ocrScanning: "Scanning documents…", reportTitle: "Citizen Summary — SarkarSathi", rpProfile: "Your profile", rpSchemes: "Eligible schemes", rpDocs: "Documents required", rpNextSteps: "Next steps", rpLinks: "Application links", stage1: "Analyzing your query…", stage2: "Searching eligible schemes…", stage3: "Checking documents…", stage4: "Preparing your response…", clearAll: "Clear all", deleteItem: "Delete" },
  hi: { langLabel: "भाषा", askTitle: "अपने शब्दों में पूछें", askBtn: "एजेंट्स से पूछें", askPlaceholder: "उदा. मैं बिहार से 65 वर्ष का सेवानिवृत्त व्यक्ति हूँ", holdSpeak: "दबाकर बोलें", listening: "सुन रहा हूँ… छोड़ें", guideBtn: "उपयोग कैसे करें — सुनें और सीखें", citizenProfile: "नागरिक प्रोफ़ाइल", trySample: "नमूना आज़माएँ", age: "आयु", income: "वार्षिक आय (₹)", state: "राज्य", gender: "लिंग", education: "शिक्षा", occupation: "व्यवसाय", category: "सामाजिक वर्ग", land: "भूमि है", disability: "दिव्यांगता", maternity: "गर्भवती / नई माँ", findSchemes: "मेरी योजनाएँ खोजें", pipelineTitle: "ADK एजेंट पाइपलाइन", aiTitle: "एआई निर्णय बुद्धिमत्ता", placeholder: "योजनाएँ जानने के लिए प्रोफ़ाइल भरें या प्रश्न पूछें।", working: "एजेंट्स आपके अनुरोध पर काम कर रहे हैं…", docTitle: "दस्तावेज़ तैयारी", docHelp: "आपके पास मौजूद दस्तावेज़ लिखें (कॉमा से अलग), जैसे आधार, आय प्रमाणपत्र।", docCheck: "तैयारी जाँचें", recommendedBecause: "अनुशंसित क्योंकि:", eligibilityMatch: "पात्रता मिलान", applicationSteps: "आवेदन के चरण", printPdf: "प्रिंट / PDF सहेजें", download: "डाउनलोड", share: "साझा करें", historyTitle: "पिछले प्रश्न", historySearchPh: "पिछले प्रश्न खोजें…", historyEmpty: "आपके हाल के प्रश्न यहाँ दिखेंगे।", ocrScanning: "दस्तावेज़ स्कैन हो रहे हैं…", reportTitle: "नागरिक सारांश — सरकारसाथी", rpProfile: "आपकी प्रोफ़ाइल", rpSchemes: "पात्र योजनाएँ", rpDocs: "आवश्यक दस्तावेज़", rpNextSteps: "अगले कदम", rpLinks: "आवेदन लिंक", stage1: "आपका प्रश्न समझ रहे हैं…", stage2: "पात्र योजनाएँ खोज रहे हैं…", stage3: "दस्तावेज़ जाँच रहे हैं…", stage4: "आपका उत्तर तैयार कर रहे हैं…", clearAll: "सभी हटाएँ", deleteItem: "हटाएँ" },
  bn: { langLabel: "ভাষা", askTitle: "নিজের ভাষায় জিজ্ঞাসা করুন", askBtn: "এজেন্টদের জিজ্ঞাসা করুন", askPlaceholder: "যেমন আমি বিহারের 65 বছর বয়সী অবসরপ্রাপ্ত ব্যক্তি", holdSpeak: "চেপে ধরে বলুন", listening: "শুনছি… ছেড়ে দিন", guideBtn: "কীভাবে ব্যবহার করবেন — শুনুন ও শিখুন", citizenProfile: "নাগরিক প্রোফাইল", trySample: "নমুনা দেখুন", age: "বয়স", income: "বার্ষিক আয় (₹)", state: "রাজ্য", gender: "লিঙ্গ", education: "শিক্ষা", occupation: "পেশা", category: "সামাজিক শ্রেণি", land: "জমি আছে", disability: "প্রতিবন্ধকতা", maternity: "গর্ভবতী / নতুন মা", findSchemes: "আমার প্রকল্প খুঁজুন", pipelineTitle: "ADK এজেন্ট পাইপলাইন", aiTitle: "এআই সিদ্ধান্ত বুদ্ধিমত্তা", placeholder: "প্রকল্প জানতে প্রোফাইল পূরণ করুন বা প্রশ্ন করুন।", working: "এজেন্টরা আপনার অনুরোধে কাজ করছে…", docTitle: "নথি প্রস্তুতি", docHelp: "আপনার কাছে থাকা নথিগুলি লিখুন (কমা দিয়ে আলাদা), যেমন আধার, আয় শংসাপত্র।", docCheck: "প্রস্তুতি যাচাই করুন" },
  ta: { langLabel: "மொழி", askTitle: "உங்கள் சொந்த வார்த்தைகளில் கேளுங்கள்", askBtn: "முகவர்களிடம் கேளுங்கள்", askPlaceholder: "எ.கா. நான் பீகாரைச் சேர்ந்த 65 வயது ஓய்வுபெற்றவர்", holdSpeak: "அழுத்திப் பேசுங்கள்", listening: "கேட்கிறேன்… விடுங்கள்", guideBtn: "எப்படி பயன்படுத்துவது — கேட்டு அறியுங்கள்", citizenProfile: "குடிமகன் சுயவிவரம்", trySample: "மாதிரியை முயற்சி செய்", age: "வயது", income: "ஆண்டு வருமானம் (₹)", state: "மாநிலம்", gender: "பாலினம்", education: "கல்வி", occupation: "தொழில்", category: "சமூகப் பிரிவு", land: "நிலம் உள்ளது", disability: "மாற்றுத்திறன்", maternity: "கர்ப்பிணி / புதிய தாய்", findSchemes: "எனது திட்டங்களைத் தேடு", pipelineTitle: "ADK முகவர் பைப்லைன்", aiTitle: "AI முடிவு நுண்ணறிவு", placeholder: "திட்டங்களை அறிய சுயவிவரத்தை நிரப்பவும் அல்லது கேளுங்கள்.", working: "முகவர்கள் உங்கள் கோரிக்கையில் வேலை செய்கிறார்கள்…", docTitle: "ஆவண தயார்நிலை", docHelp: "உங்களிடம் உள்ள ஆவணங்களை எழுதுங்கள் (கமாவால் பிரிக்கவும்), எ.கா. ஆதார், வருமானச் சான்று.", docCheck: "தயார்நிலையைச் சரிபார்க்கவும்" },
  te: { langLabel: "భాష", askTitle: "మీ స్వంత మాటల్లో అడగండి", askBtn: "ఏజెంట్లను అడగండి", askPlaceholder: "ఉదా. నేను బీహార్‌కు చెందిన 65 సంవత్సరాల విశ్రాంత వ్యక్తిని", holdSpeak: "నొక్కి మాట్లాడండి", listening: "వింటున్నాను… వదిలేయండి", guideBtn: "ఎలా ఉపయోగించాలి — విని నేర్చుకోండి", citizenProfile: "పౌర ప్రొఫైల్", trySample: "నమూనా ప్రయత్నించండి", age: "వయస్సు", income: "వార్షిక ఆదాయం (₹)", state: "రాష్ట్రం", gender: "లింగం", education: "విద్య", occupation: "వృత్తి", category: "సామాజిక వర్గం", land: "భూమి ఉంది", disability: "వికలాంగత్వం", maternity: "గర్భిణి / కొత్త తల్లి", findSchemes: "నా పథకాలను కనుగొనండి", pipelineTitle: "ADK ఏజెంట్ పైప్‌లైన్", aiTitle: "AI నిర్ణయ మేధస్సు", placeholder: "పథకాలు తెలుసుకోవడానికి ప్రొఫైల్ నింపండి లేదా ప్రశ్న అడగండి.", working: "ఏజెంట్లు మీ అభ్యర్థనపై పని చేస్తున్నారు…", docTitle: "పత్రాల సంసిద్ధత", docHelp: "మీ వద్ద ఉన్న పత్రాలను రాయండి (కామాతో వేరు చేయండి), ఉదా. ఆధార్, ఆదాయ ధృవీకరణ పత్రం.", docCheck: "సంసిద్ధతను తనిఖీ చేయండి" },
  mr: { langLabel: "भाषा", askTitle: "आपल्या शब्दांत विचारा", askBtn: "एजंट्सना विचारा", askPlaceholder: "उदा. मी बिहारमधील 65 वर्षांचा निवृत्त व्यक्ती आहे", holdSpeak: "दाबून बोला", listening: "ऐकत आहे… सोडा", guideBtn: "कसे वापरावे — ऐका आणि शिका", citizenProfile: "नागरिक प्रोफाइल", trySample: "नमुना पहा", age: "वय", income: "वार्षिक उत्पन्न (₹)", state: "राज्य", gender: "लिंग", education: "शिक्षण", occupation: "व्यवसाय", category: "सामाजिक वर्ग", land: "जमीन आहे", disability: "अपंगत्व", maternity: "गर्भवती / नवीन माता", findSchemes: "माझ्या योजना शोधा", pipelineTitle: "ADK एजंट पाइपलाइन", aiTitle: "एआय निर्णय बुद्धिमत्ता", placeholder: "योजना जाणून घेण्यासाठी प्रोफाइल भरा किंवा प्रश्न विचारा.", working: "एजंट्स आपल्या विनंतीवर काम करत आहेत…", docTitle: "कागदपत्र तयारी", docHelp: "तुमच्याकडे असलेली कागदपत्रे लिहा (स्वल्पविरामाने वेगळी), उदा. आधार, उत्पन्न प्रमाणपत्र.", docCheck: "तयारी तपासा" },
  kn: { langLabel: "ಭಾಷೆ", askTitle: "ನಿಮ್ಮ ಸ್ವಂತ ಪದಗಳಲ್ಲಿ ಕೇಳಿ", askBtn: "ಏಜೆಂಟ್‌ಗಳನ್ನು ಕೇಳಿ", askPlaceholder: "ಉದಾ. ನಾನು ಬಿಹಾರದ 65 ವರ್ಷದ ನಿವೃತ್ತ ವ್ಯಕ್ತಿ", holdSpeak: "ಒತ್ತಿ ಮಾತನಾಡಿ", listening: "ಕೇಳುತ್ತಿದ್ದೇನೆ… ಬಿಡಿ", guideBtn: "ಹೇಗೆ ಬಳಸುವುದು — ಕೇಳಿ ಕಲಿಯಿರಿ", citizenProfile: "ನಾಗರಿಕ ಪ್ರೊಫೈಲ್", trySample: "ಮಾದರಿ ಪ್ರಯತ್ನಿಸಿ", age: "ವಯಸ್ಸು", income: "ವಾರ್ಷಿಕ ಆದಾಯ (₹)", state: "ರಾಜ್ಯ", gender: "ಲಿಂಗ", education: "ಶಿಕ್ಷಣ", occupation: "ಉದ್ಯೋಗ", category: "ಸಾಮಾಜಿಕ ವರ್ಗ", land: "ಭೂಮಿ ಇದೆ", disability: "ಅಂಗವೈಕಲ್ಯ", maternity: "ಗರ್ಭಿಣಿ / ಹೊಸ ತಾಯಿ", findSchemes: "ನನ್ನ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಿ", pipelineTitle: "ADK ಏಜೆಂಟ್ ಪೈಪ್‌ಲೈನ್", aiTitle: "AI ನಿರ್ಧಾರ ಬುದ್ಧಿವಂತಿಕೆ", placeholder: "ಯೋಜನೆಗಳನ್ನು ತಿಳಿಯಲು ಪ್ರೊಫೈಲ್ ಭರ್ತಿ ಮಾಡಿ ಅಥವಾ ಪ್ರಶ್ನೆ ಕೇಳಿ.", working: "ಏಜೆಂಟ್‌ಗಳು ನಿಮ್ಮ ವಿನಂತಿಯಲ್ಲಿ ಕೆಲಸ ಮಾಡುತ್ತಿದ್ದಾರೆ…", docTitle: "ದಾಖಲೆ ಸಿದ್ಧತೆ", docHelp: "ನಿಮ್ಮ ಬಳಿ ಇರುವ ದಾಖಲೆಗಳನ್ನು ಬರೆಯಿರಿ (ಅಲ್ಪವಿರಾಮದಿಂದ ಬೇರ್ಪಡಿಸಿ), ಉದಾ. ಆಧಾರ್, ಆದಾಯ ಪ್ರಮಾಣಪತ್ರ.", docCheck: "ಸಿದ್ಧತೆ ಪರಿಶೀಲಿಸಿ" },
  gu: { langLabel: "ભાષા", askTitle: "તમારા શબ્દોમાં પૂછો", askBtn: "એજન્ટોને પૂછો", askPlaceholder: "દા.ત. હું બિહારનો 65 વર્ષનો નિવૃત્ત વ્યક્તિ છું", holdSpeak: "દબાવીને બોલો", listening: "સાંભળી રહ્યો છું… છોડો", guideBtn: "કેવી રીતે વાપરવું — સાંભળો અને શીખો", citizenProfile: "નાગરિક પ્રોફાઇલ", trySample: "નમૂનો અજમાવો", age: "ઉંમર", income: "વાર્ષિક આવક (₹)", state: "રાજ્ય", gender: "લિંગ", education: "શિક્ષણ", occupation: "વ્યવસાય", category: "સામાજિક વર્ગ", land: "જમીન છે", disability: "વિકલાંગતા", maternity: "ગર્ભવતી / નવી માતા", findSchemes: "મારી યોજનાઓ શોધો", pipelineTitle: "ADK એજન્ટ પાઇપલાઇન", aiTitle: "AI નિર્ણય બુદ્ધિમત્તા", placeholder: "યોજનાઓ જાણવા પ્રોફાઇલ ભરો અથવા પ્રશ્ન પૂછો.", working: "એજન્ટો તમારી વિનંતી પર કામ કરી રહ્યા છે…", docTitle: "દસ્તાવેજ તૈયારી", docHelp: "તમારી પાસે હોય તે દસ્તાવેજો લખો (અલ્પવિરામથી અલગ), દા.ત. આધાર, આવક પ્રમાણપત્ર.", docCheck: "તૈયારી તપાસો" },
  pa: { langLabel: "ਭਾਸ਼ਾ", askTitle: "ਆਪਣੇ ਸ਼ਬਦਾਂ ਵਿੱਚ ਪੁੱਛੋ", askBtn: "ਏਜੰਟਾਂ ਨੂੰ ਪੁੱਛੋ", askPlaceholder: "ਉਦਾ. ਮੈਂ ਬਿਹਾਰ ਦਾ 65 ਸਾਲ ਦਾ ਸੇਵਾਮੁਕਤ ਵਿਅਕਤੀ ਹਾਂ", holdSpeak: "ਦਬਾ ਕੇ ਬੋਲੋ", listening: "ਸੁਣ ਰਿਹਾ ਹਾਂ… ਛੱਡੋ", guideBtn: "ਕਿਵੇਂ ਵਰਤਣਾ ਹੈ — ਸੁਣੋ ਅਤੇ ਸਿੱਖੋ", citizenProfile: "ਨਾਗਰਿਕ ਪ੍ਰੋਫਾਈਲ", trySample: "ਨਮੂਨਾ ਅਜ਼ਮਾਓ", age: "ਉਮਰ", income: "ਸਾਲਾਨਾ ਆਮਦਨ (₹)", state: "ਰਾਜ", gender: "ਲਿੰਗ", education: "ਸਿੱਖਿਆ", occupation: "ਕਿੱਤਾ", category: "ਸਮਾਜਿਕ ਵਰਗ", land: "ਜ਼ਮੀਨ ਹੈ", disability: "ਅਪੰਗਤਾ", maternity: "ਗਰਭਵਤੀ / ਨਵੀਂ ਮਾਂ", findSchemes: "ਮੇਰੀਆਂ ਯੋਜਨਾਵਾਂ ਲੱਭੋ", pipelineTitle: "ADK ਏਜੰਟ ਪਾਈਪਲਾਈਨ", aiTitle: "AI ਫੈਸਲਾ ਬੁੱਧੀ", placeholder: "ਯੋਜਨਾਵਾਂ ਜਾਣਨ ਲਈ ਪ੍ਰੋਫਾਈਲ ਭਰੋ ਜਾਂ ਸਵਾਲ ਪੁੱਛੋ।", working: "ਏਜੰਟ ਤੁਹਾਡੀ ਬੇਨਤੀ 'ਤੇ ਕੰਮ ਕਰ ਰਹੇ ਹਨ…", docTitle: "ਦਸਤਾਵੇਜ਼ ਤਿਆਰੀ", docHelp: "ਤੁਹਾਡੇ ਕੋਲ ਮੌਜੂਦ ਦਸਤਾਵੇਜ਼ ਲਿਖੋ (ਕਾਮੇ ਨਾਲ ਵੱਖ), ਉਦਾ. ਆਧਾਰ, ਆਮਦਨ ਸਰਟੀਫਿਕੇਟ।", docCheck: "ਤਿਆਰੀ ਜਾਂਚੋ" },
  ml: { langLabel: "ഭാഷ", askTitle: "നിങ്ങളുടെ വാക്കുകളിൽ ചോദിക്കുക", askBtn: "ഏജന്റുമാരോട് ചോദിക്കുക", askPlaceholder: "ഉദാ. ഞാൻ ബീഹാറിൽ നിന്നുള്ള 65 വയസ്സുള്ള വിരമിച്ച വ്യക്തിയാണ്", holdSpeak: "അമർത്തി സംസാരിക്കുക", listening: "കേൾക്കുന്നു… വിടുക", guideBtn: "എങ്ങനെ ഉപയോഗിക്കാം — കേട്ട് പഠിക്കുക", citizenProfile: "പൗര പ്രൊഫൈൽ", trySample: "സാമ്പിൾ പരീക്ഷിക്കുക", age: "വയസ്സ്", income: "വാർഷിക വരുമാനം (₹)", state: "സംസ്ഥാനം", gender: "ലിംഗം", education: "വിദ്യാഭ്യാസം", occupation: "തൊഴിൽ", category: "സാമൂഹിക വിഭാഗം", land: "ഭൂമിയുണ്ട്", disability: "വൈകല്യം", maternity: "ഗർഭിണി / പുതിയ അമ്മ", findSchemes: "എന്റെ പദ്ധതികൾ കണ്ടെത്തുക", pipelineTitle: "ADK ഏജന്റ് പൈപ്പ്‌ലൈൻ", aiTitle: "AI തീരുമാന ബുദ്ധി", placeholder: "പദ്ധതികൾ അറിയാൻ പ്രൊഫൈൽ പൂരിപ്പിക്കുക അല്ലെങ്കിൽ ചോദ്യം ചോദിക്കുക.", working: "ഏജന്റുമാർ നിങ്ങളുടെ അഭ്യർത്ഥനയിൽ പ്രവർത്തിക്കുന്നു…", docTitle: "രേഖകളുടെ തയ്യാറെടുപ്പ്", docHelp: "നിങ്ങളുടെ കൈവശമുള്ള രേഖകൾ എഴുതുക (കോമ ഉപയോഗിച്ച് വേർതിരിക്കുക), ഉദാ. ആധാർ, വരുമാന സർട്ടിഫിക്കറ്റ്.", docCheck: "തയ്യാറെടുപ്പ് പരിശോധിക്കുക" },
  or: { langLabel: "ଭାଷା", askTitle: "ନିଜ ଭାଷାରେ ପଚାରନ୍ତୁ", askBtn: "ଏଜେଣ୍ଟମାନଙ୍କୁ ପଚାରନ୍ତୁ", askPlaceholder: "ଉଦା. ମୁଁ ବିହାରର 65 ବର୍ଷୀୟ ଅବସରପ୍ରାପ୍ତ ବ୍ୟକ୍ତି", holdSpeak: "ଦବାଇ କୁହନ୍ତୁ", listening: "ଶୁଣୁଛି… ଛାଡ଼ନ୍ତୁ", guideBtn: "କିପରି ବ୍ୟବହାର କରିବେ — ଶୁଣି ଶିଖନ୍ତୁ", citizenProfile: "ନାଗରିକ ପ୍ରୋଫାଇଲ୍", trySample: "ନମୁନା ଚେଷ୍ଟା କରନ୍ତୁ", age: "ବୟସ", income: "ବାର୍ଷିକ ଆୟ (₹)", state: "ରାଜ୍ୟ", gender: "ଲିଙ୍ଗ", education: "ଶିକ୍ଷା", occupation: "ବୃତ୍ତି", category: "ସାମାଜିକ ବର୍ଗ", land: "ଜମି ଅଛି", disability: "ଅକ୍ଷମତା", maternity: "ଗର୍ଭବତୀ / ନୂଆ ମା", findSchemes: "ମୋର ଯୋଜନା ଖୋଜନ୍ତୁ", pipelineTitle: "ADK ଏଜେଣ୍ଟ ପାଇପଲାଇନ୍", aiTitle: "AI ନିଷ୍ପତ୍ତି ବୁଦ୍ଧିମତ୍ତା", placeholder: "ଯୋଜନା ଜାଣିବାକୁ ପ୍ରୋଫାଇଲ୍ ପୂରଣ କରନ୍ତୁ କିମ୍ବା ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ।", working: "ଏଜେଣ୍ଟମାନେ ଆପଣଙ୍କ ଅନୁରୋଧରେ କାମ କରୁଛନ୍ତି…", docTitle: "ଦଲିଲ ପ୍ରସ୍ତୁତି", docHelp: "ଆପଣଙ୍କ ପାଖରେ ଥିବା ଦଲିଲ ଲେଖନ୍ତୁ (କମା ଦ୍ୱାରା ଅଲଗା), ଉଦା. ଆଧାର, ଆୟ ପ୍ରମାଣପତ୍ର।", docCheck: "ପ୍ରସ୍ତୁତି ଯାଞ୍ଚ କରନ୍ତୁ" },
};

function t(key) {
  const dict = I18N[lang()] || I18N.en;
  return dict[key] || I18N.en[key] || key;
}

// Apply translations to every element tagged with data-i18n / data-i18n-ph.
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
let recognition = null;   // active SpeechRecognition (hold-to-speak)
let recording = false;
let lastResult = null;    // last rendered result (for the report)
let lastQuery = "";       // last user question (for history)
let stageTimer = null;    // loading-stage cycler

// ---------------- init ----------------
document.addEventListener("DOMContentLoaded", () => {
  docModal = new bootstrap.Modal(el("docModal"));
  renderPipeline([]);
  loadHealth();
  initTheme();
  applyI18n();
  renderHistory();

  el("profileForm").addEventListener("submit", (e) => {
    e.preventDefault();
    recommendFromForm();
  });
  el("askBtn").addEventListener("click", askAgents);
  el("sampleBtn").addEventListener("click", fillSample);
  el("docCheckBtn").addEventListener("click", runDocCheck);
  el("guideBtn").addEventListener("click", toggleGuide);
  el("guideStopBtn").addEventListener("click", stopGuide);
  el("themeToggle").addEventListener("click", toggleTheme);
  el("printBtn").addEventListener("click", () => { buildReport(); window.print(); });
  el("downloadBtn").addEventListener("click", downloadReport);
  el("shareBtn").addEventListener("click", shareReport);
  el("historySearch").addEventListener("input", renderHistory);
  el("historyClear").addEventListener("click", clearHistory);
  initHoldToSpeak();
  // Translate the whole interface + refresh guide/history when the language changes.
  el("langSelect").addEventListener("change", () => {
    stopGuide();
    applyI18n();
    renderHistory();
    if (!el("voiceGuide").classList.contains("d-none")) renderGuide();
  });
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
  lastResult = res;

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

  // Show report actions when there's something worth keeping.
  const hasContent = (res.schemes && res.schemes.length) || res.explanation;
  el("reportActions").classList.toggle("d-none", !hasContent);

  if (hasContent) saveHistory(res);
}

function schemeCard(s) {
  const col = document.createElement("div");
  col.className = "col-md-6 col-xl-4";
  const reasonItems = (s.reasons || []).filter((r) => r.startsWith("✓"));
  const reasons = reasonItems.map((r) => `<div class="reason pass">${r}</div>`).join("");
  const recommended = reasonItems.length
    ? `<div class="recommended-title mt-1 mb-1"><i class="bi bi-patch-check-fill me-1"></i>${t("recommendedBecause")}</div>${reasons}`
    : "";
  const match = Number(s.match_percent != null ? s.match_percent : 100);
  const matchBar = `
    <div class="match-wrap">
      <div class="match-head"><span>${t("eligibilityMatch")}</span><span class="match-label">${match}%</span></div>
      <div class="match-bar"><div class="match-fill" style="width:${match}%"></div></div>
    </div>`;
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
        <div class="text-muted small mb-2"><i class="bi ${categoryIcon(s.category)} me-1"></i>${s.category} · ${s.state}</div>
        <p class="mb-2 small"><i class="bi bi-gift text-success me-1"></i>${s.benefit_text}
          <span class="benefit-amount">(≈ ₹${Number(s.benefit_annual_inr).toLocaleString("en-IN")}/yr)</span></p>
        <div class="mb-1">${recommended}</div>
        ${matchBar}
        <details class="mb-2 mt-2">
          <summary class="small text-primary">${t("applicationSteps")}</summary>
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

// Category → icon (better, contextual icons)
function categoryIcon(category) {
  const map = {
    Education: "bi-mortarboard-fill", Farmers: "bi-tractor", Startups: "bi-rocket-takeoff-fill",
    Women: "bi-gender-female", Health: "bi-heart-pulse-fill", "Senior Citizens": "bi-person-hearts",
    Housing: "bi-house-heart-fill", Employment: "bi-briefcase-fill", Energy: "bi-lightning-charge-fill",
  };
  return map[category] || "bi-award-fill";
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
  // Animated OCR-style progress bar while we check.
  const prog = el("docProgress");
  const bar = el("docProgressBar");
  el("docResult").innerHTML = "";
  prog.classList.remove("d-none");
  bar.style.width = "0%";
  let pct = 0;
  const timer = setInterval(() => { pct = Math.min(90, pct + 12); bar.style.width = pct + "%"; }, 120);
  try {
    const res = await postJSON("/api/documents/check", {
      scheme_id: currentDocScheme,
      uploaded: el("docInput").value,
      lang: lang(),
    });
    clearInterval(timer);
    bar.style.width = "100%";
    setTimeout(() => prog.classList.add("d-none"), 350);
    const missing = res.missing.map((d) => `<li>${d}</li>`).join("") || "<li>None 🎉</li>";
    el("docResult").innerHTML = `
      <div class="progress mb-2" style="height:22px;">
        <div class="progress-bar bg-success" style="width:${res.readiness_percent}%">${res.readiness_percent}%</div>
      </div>
      <p class="small mb-1"><strong>${res.note}</strong></p>
      <p class="small mb-1 text-success">Present: ${res.present.join(", ") || "—"}</p>
      <p class="small mb-0 text-danger">Still needed:</p>
      <ul class="small text-danger">${missing}</ul>`;
  } catch (e) {
    clearInterval(timer);
    prog.classList.add("d-none");
    el("docResult").innerHTML = `<p class="small text-danger mb-0">${e.message}</p>`;
  }
}

// ---------------- voice (Hold & Speak) ----------------
function setVoiceLabel(listening) {
  const label = el("voiceLabel");
  if (label) label.textContent = listening ? t("listening") : t("holdSpeak");
}

function initHoldToSpeak() {
  const btn = el("voiceBtn");
  const press = (e) => { e.preventDefault(); startHold(); };
  const release = (e) => { e.preventDefault(); stopHold(); };
  // Mouse (desktop) — press and hold
  btn.addEventListener("mousedown", press);
  btn.addEventListener("mouseup", release);
  btn.addEventListener("mouseleave", release);
  // Touch (mobile) — press and hold
  btn.addEventListener("touchstart", press, { passive: false });
  btn.addEventListener("touchend", release);
  btn.addEventListener("touchcancel", release);
  // Keyboard (accessibility) — hold Space/Enter
  btn.addEventListener("keydown", (e) => {
    if ((e.key === " " || e.key === "Enter") && !recording) { e.preventDefault(); startHold(); }
  });
  btn.addEventListener("keyup", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); stopHold(); }
  });
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
  try { recognition.start(); } catch (_) { /* already started */ }
}

function stopHold() {
  if (recognition) { try { recognition.stop(); } catch (_) {} }
}


// ---------------- voice guide (Text-to-Speech) ----------------
function guideContent() {
  // English & Hindi are hand-written; other languages fall back to English text
  // but are still spoken with the chosen language's voice where available.
  return GUIDE[lang()] || GUIDE.en;
}

function renderGuide() {
  const g = guideContent();
  el("guideHeading").textContent = g.heading;
  el("guideSteps").innerHTML = g.steps.map((s) => `<li>${s}</li>`).join("");
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
  if (!("speechSynthesis" in window)) return; // silently skip; text is still shown
  window.speechSynthesis.cancel();
  const g = guideContent();
  const text = [g.intro, ...g.steps, g.example].join(". ");
  const u = new SpeechSynthesisUtterance(text);
  u.lang = (LANGS[lang()] && LANGS[lang()].locale) || "en-IN";
  u.rate = 0.9; // slightly slower for clarity
  const btn = el("guideBtn");
  btn.classList.add("speaking");
  u.onend = () => btn.classList.remove("speaking");
  u.onerror = () => btn.classList.remove("speaking");
  window.speechSynthesis.speak(u);
}

function stopGuide() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  el("guideBtn").classList.remove("speaking");
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
  el("reportActions").classList.add("d-none");
  if (b) {
    el("placeholder").classList.add("d-none");
    el("schemes").innerHTML = "";
    el("benefitBanner").classList.add("d-none");
    // Typing indicator in the answer area
    el("explanationCard").classList.remove("d-none");
    el("explanation").innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
    startStages();
  } else {
    stopStages();
  }
}

// Cycle through friendly loading stages instead of a static "Loading…"
function startStages() {
  const stages = ["stage1", "stage2", "stage3", "stage4"];
  const p = el("spinner").querySelector("p");
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
  el("explanationCard").classList.add("d-none");
  el("reportActions").classList.add("d-none");
  el("placeholder").classList.remove("d-none");
  el("placeholder").innerHTML =
    `<i class="bi bi-exclamation-triangle display-4 d-block mb-3 text-warning"></i>${e.message}`;
}

// ---------------- dark mode ----------------
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
  const icon = el("themeToggle").querySelector("i");
  icon.className = theme === "dark" ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
}

// ---------------- history (search past conversations) ----------------
function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function loadHistoryStore() {
  try { return JSON.parse(localStorage.getItem("ss_history") || "[]"); } catch { return []; }
}
function saveHistory(res) {
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
  if (!list) return;
  const all = loadHistoryStore();
  el("historyClear").classList.toggle("d-none", all.length === 0);
  const term = (el("historySearch").value || "").trim().toLowerCase();
  let items = all;
  if (term) {
    items = items.filter((it) => {
      const names = (it.res.schemes || []).map((s) => s.scheme_name).join(" ");
      return (it.q + " " + names).toLowerCase().includes(term);
    });
  }
  list.innerHTML = "";
  empty.classList.toggle("d-none", items.length > 0);
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
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    div.querySelector(".h-del").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteHistory(it.id);
    });
    list.appendChild(div);
  });
}

// ---------------- downloadable / printable report ----------------
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
      ${esc(s.benefit_text)} — ≈ ₹${Number(s.benefit_annual_inr).toLocaleString("en-IN")}/yr<br>
      <em>${t("eligibilityMatch")}: ${s.match_percent != null ? s.match_percent : 100}%</em><br>
      ${(s.reasons || []).filter((r) => r.startsWith("✓")).map(esc).join("<br>")}
    </div>`).join("");
  const docs = [...new Set((res.schemes || []).flatMap((s) => s.documents || []))];
  const docsHtml = docs.length ? docs.map((d) => `<li>${esc(d)}</li>`).join("") : "<li>—</li>";
  const steps = (res.schemes && res.schemes[0] && res.schemes[0].steps) || [];
  const stepsHtml = steps.length ? steps.map((s) => `<li>${esc(s)}</li>`).join("") : "<li>—</li>";
  const linksHtml = (res.schemes || [])
    .map((s) => `<li>${esc(s.scheme_name)}: <a href="${esc(s.apply_url)}">${esc(s.apply_url)}</a></li>`)
    .join("") || "<li>—</li>";

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
    <style>body{font-family:system-ui,"Noto Sans","Noto Sans Devanagari",sans-serif;max-width:800px;margin:24px auto;padding:0 16px;color:#16233f;line-height:1.6}
    h1{color:#0b3d91}h3{color:#138808;margin-top:1.2rem;border-bottom:2px solid #eee;padding-bottom:4px}
    .rp-scheme{border:1px solid #ccc;border-radius:8px;padding:10px 14px;margin-bottom:10px}
    a{color:#0b3d91}</style></head><body>${inner}</body></html>`;
  const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "SarkarSathi-Report.html";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function shareReport() {
  if (!lastResult) return;
  const res = lastResult;
  const lines = [
    `${t("reportTitle")}`,
    res.explanation ? res.explanation : "",
    "",
    `${t("rpSchemes")}:`,
    ...(res.schemes || []).map((s) => `• ${s.scheme_name} — ≈ ₹${Number(s.benefit_annual_inr).toLocaleString("en-IN")}/yr (${s.match_percent != null ? s.match_percent : 100}%)`),
  ].filter(Boolean);
  const text = lines.join("\n");
  try {
    if (navigator.share) {
      await navigator.share({ title: t("reportTitle"), text });
    } else {
      await navigator.clipboard.writeText(text);
      alert("Copied summary to clipboard.");
    }
  } catch (_) { /* user cancelled */ }
}
