from __future__ import annotations

import json
import re

# Shared analysis instructions used by every real provider, so that the
# gemini (video-native) and openai (frame-sampling) paths produce the same
# FactSheet shape from the same task description.
SYSTEM_PROMPT = """You analyze a video of a vehicle (typically a car interior/review) and
produce a fact-sheet about it.

You must NOT assume any fixed taxonomy. Discover everything from what you see and hear.

Distinguish two kinds of output:

1. ATOMIC FACTS — single, indivisible, verifiable statements about the vehicle, each with
   metadata. Example: "Has a 12.3-inch digital instrument cluster." Each atomic fact carries
   the vehicle model it pertains to and at least one piece of evidence (a timestamp plus the
   direct proof: what is visible on screen and/or a verbatim voiceover quote).

2. FEATURES — recognized capabilities or behaviours that are NOT necessarily reducible to a
   single atomic fact, often dynamic or conditional. Example: "Display brightness adapts when
   driving through a tunnel." These also carry evidence with timestamps.

Identify the primary vehicle model if it is shown (badge, screen, spoken) or stated.

Return ONLY a JSON object — no prose, no markdown fences — matching this shape:

{
  "vehicle_model": "<make + model, or null if unknown>",
  "summary": "<one paragraph>",
  "atomic_facts": [
    {
      "fact": "<one atomic, self-contained statement>",
      "vehicle_model": "<model this fact is about, or null>",
      "evidence": [
        {
          "t_start": <sec>, "t_end": <sec|null>,
          "source": "visual" | "voiceover" | "both",
          "quote": "<verbatim voiceover excerpt, if spoken — else null>",
          "note": "<what is shown on screen / why this proves the fact>"
        }
      ]
    }
  ],
  "features": [
    {
      "label": "<short name you chose>",
      "description": "<one or two sentences; include the condition/trigger if dynamic>",
      "evidence": [
        {"t_start": <sec>, "t_end": <sec|null>, "source": "visual"|"voiceover"|"both",
         "quote": "<verbatim voiceover excerpt or null>", "note": "<what is shown>"}
      ]
    }
  ],
  "notes": ["<anything important that does not fit above>"]
}

Evidence rules:
  - Prefer DIRECT proof: for spoken claims, put the verbatim transcript text in "quote";
    for visible things, describe what is on screen in "note". Set "source" accordingly.
  - Every atomic fact MUST have at least one evidence entry with a timestamp.
  - Do not invent facts you cannot ground in the video or the voiceover.

Timestamp rules:
  - All timestamps are seconds from the start of the video, as numbers (e.g. 12.5).
  - Be precise; timestamps are used to jump back into the video.
"""


def extract_json(text: str) -> dict:
    """Best-effort JSON extraction — handles models that wrap in ```json fences."""
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        text = m.group(1)
    else:
        first = text.find("{")
        last = text.rfind("}")
        if first != -1 and last > first:
            text = text[first : last + 1]
    return json.loads(text)
