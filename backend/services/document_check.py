"""Document readiness check (the Document Verification Agent's tool).

For the MVP we match a scheme's required documents against text describing the
uploaded files (filenames / OCR text). In production this is backed by
Google Vision OCR or Gemini multimodal extraction.
"""
from typing import Dict, List


def check_documents(required: List[str], detected_text: str, lang: str = "en") -> Dict:
    detected_lower = (detected_text or "").lower()
    present, missing = [], []
    for doc in required:
        key = doc.split("(")[0].strip().lower()
        first_word = key.split()[0] if key.split() else key
        if first_word in detected_lower or key in detected_lower:
            present.append(doc)
        else:
            missing.append(doc)
    readiness = int(round(100 * len(present) / len(required))) if required else 0
    note = (
        f"तैयारी {readiness}% पूर्ण।" if lang == "hi"
        else f"Application readiness: {readiness}%."
    )
    return {
        "required": required,
        "present": present,
        "missing": missing,
        "readiness_percent": readiness,
        "note": note,
    }
