import { GoogleGenerativeAI } from "@google/generative-ai";

// ---------- JSON repair helpers ----------
function tryParseJsonStrict(s: string) {
  return JSON.parse(s);
}

// Repairs common model errors: unescaped newlines in strings, smart quotes, trailing commas, BOM.
function repairJsonLoose(raw: string) {
  // Normalize curly quotes
  let s = raw.replace(/\u201C|\u201D|\u201E|\u201F/g, '"').replace(/\u2018|\u2019/g, "'");
  // Strip BOM
  s = s.replace(/^\uFEFF/, "");
  // Kill trailing commas like {"a":1,}
  s = s.replace(/,\s*([}\]])/g, "$1");

  // Escape literal newlines/tabs only when *inside* strings
  let out = "";
  let inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (!inStr) { if (ch === '"') inStr = true; out += ch; continue; }
    if (esc) { out += ch; esc = false; continue; }
    if (ch === "\\") { esc = true; out += ch; continue; }
    if (ch === '"') { inStr = false; out += ch; continue; }
    if (ch === "\n") { out += "\\n"; continue; }
    if (ch === "\r") { out += "\\r"; continue; }
    if (ch === "\t") { out += "\\t"; continue; }
    out += ch;
  }
  return out;
}
const BASE_PROMPT = `
You are a digital eye-health assistant that produces reports directly from the supplied quantitative and qualitative vision-screening dataset.

CRITICAL OUTPUT RULES
- Return ONE valid JSON object. No extra prose, comments, markdown, or code fences.
- Escape every newline, tab, and carriage-return inside JSON strings (\\n, \\t, \\r).
- Use the schema exactly as defined below—no additional or missing keys.
- When data is unavailable, respond with "not provided" or "insufficient data" instead of inventing values.

REQUIRED JSON SCHEMA
{
  "visual_theme": {
    "accentColor": "string HEX color (e.g. #6B8AFB)",
    "trafficLight": "green" | "yellow" | "red",
    "urgency": "no_action" | "routine_checkup" | "consult_soon" | "urgent",
    "summary": "concise plain-text sentence describing overall status"
  },
  "plain_text_document": "complete plain-text report mirroring the HTML content; headings in ALL CAPS, blank line between sections, bullets prefixed with '-'",
  "sections": [
    {
      "title": "1. Summary Overview",
      "blocks": ["HTML strings…"]
    },
    {
      "title": "2. Detailed Test Analysis",
      "blocks": ["HTML strings…"]
    },
    {
      "title": "3. Personalised Self-Care Guidance",
      "blocks": ["HTML strings…"]
    },
    {
      "title": "4. Medical Follow-Up",
      "blocks": ["HTML strings…"]
    },
    {
      "title": "5. Long-Term Improvement Plan",
      "blocks": ["HTML strings…"]
    },
    {
      "title": "6. Disclaimers",
      "blocks": ["HTML strings…"]
    }
  ],
  "key_findings": ["plain-text highlight strings…"]
}

CONTENT GUIDELINES
- HTML blocks: use semantic tags (section, h1, h2, h3, p, ul, li) with inline styles inspired by the AIris palette (purples/blues/soft gradients). HTML must be valid and self-contained.
- plain_text_document: identical narrative as the HTML blocks, rendered as plain text (no HTML/markdown). Heading format: ALL CAPS; bullet items prefixed with "-".
- key_findings: 3–6 concise strings capturing the most important takeaways.
- Tone: clinical, clear, empathetic. No emojis or informal language.
- Base each statement strictly on the dataset (scores, prior results, lifestyle, symptoms). If no prior measurement exists, write "no prior data for comparison".
- If a test was not completed, state “not completed” without speculating on causes.

SECTION EXPECTATIONS
1. Summary Overview — 2–3 short paragraphs covering overall score, risk level, trend, and key findings (acuity, color perception, macular/retinal health, general function).
2. Detailed Test Analysis — one HTML block per test present; include current score, interpretation, comparison to prior results where available, and data-backed explanations.
3. Personalised Self-Care Guidance — eye exercises (3–5 routines with frequency), lifestyle advice, and nutrition guidance tied to user data; include a sample day plan when nutrition info exists.
4. Medical Follow-Up — professional exam recommendation plus justified diagnostics (only if supported by data) with brief rationale.
5. Long-Term Improvement Plan — 3–6 month roadmap with retest cadence, habit metrics, and measurable targets based on current values.
6. Disclaimers — neutral reminder that the report is informational only and not a substitute for professional care.

VALIDATION CHECKLIST BEFORE RESPONDING
- Ensure trafficLight and urgency align with indicators in the dataset.
- Confirm JSON parses without modification (no trailing commas, NaN, Infinity).
- Verify plain_text_document mirrors the HTML content order and messaging.
`;

function createDatasetBlock(data: unknown): string {
  try {
    return JSON.stringify(data ?? {}, null, 2);
  } catch (error) {
    return "{}";
  }
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore
      }
    }

    const { prompt, userData } = body || {};
    if (!userData) {
      res.status(400).send("Missing userData payload");
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).send("Missing GEMINI_API_KEY environment variable");
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const datasetBlock = createDatasetBlock(userData);
    const additional = typeof prompt === "string" && prompt.trim().length > 0 ? `\n\nAdditional Guidance:\n${prompt.trim()}` : "";
    const finalPrompt = `${BASE_PROMPT}\n\n### DATASET\n${datasetBlock}${additional}`;

  const response = await model.generateContent({
  contents: [
    {
      role: "user",
      parts: [{ text: finalPrompt }],
    },
  ],
  generationConfig: {
    temperature: 0.2,
    topP: 0.9,
    topK: 32,
    maxOutputTokens: 6000,
    responseMimeType: "application/json", // ✅ ensures JSON-only output
  },
});

const raw = response.response.text();
// Grab the first JSON-looking block if anything extra slipped in
const firstBrace = raw.indexOf("{");
const lastBrace  = raw.lastIndexOf("}");
const candidate  = (firstBrace >= 0 && lastBrace > firstBrace) ? raw.slice(firstBrace, lastBrace + 1) : raw;

let jsonText = candidate;
let parsed: any;

try {
  parsed = tryParseJsonStrict(jsonText);
} catch {
  const repaired = repairJsonLoose(jsonText);
  try {
    parsed = tryParseJsonStrict(repaired);
    jsonText = repaired;
  } catch {
    // Bubble a readable error back to the client (prevents “Failed to fetch”)
    const preview = raw.slice(0, 400);
    throw new Error(`Model did not return valid JSON. Preview:\n${preview}`);
  }
}

// Return a stable minified JSON string so your frontend always gets valid JSON
const clean = JSON.stringify(parsed);
res.status(200).json({ text: clean, meta: { ok: true, len: clean.length } });

  } catch (err: any) {
    console.error("generate-report error:", err);
    res.status(500).send(err?.message || "Internal Server Error");
  }
}
