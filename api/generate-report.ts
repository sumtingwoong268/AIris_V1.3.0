import { GoogleGenerativeAI } from "@google/generative-ai";

const BASE_PROMPT = 
`
IMPORTANT: Your output must be a single valid JSON object. 
Do NOT include markdown code fences, comments, prose, or text outside the JSON. 
No leading or trailing explanations, no triple backticks.

OUTPUT RULES (CRITICAL):
- Output ONLY valid JSON. No markdown fences or prose outside JSON.
- No HTML tags in any strings.
- Use this schema:

{
  "visual_theme": {
    "accentColor": "#RRGGBB",
    "trafficLight": "green|yellow|red",
    "urgency": "no_action|routine_checkup|consult_soon|urgent",
    "summary": "1–2 sentences plain text"
  },
  "sections": [
    {
      "title": "1. Summary Overview",
      "blocks": ["short paragraph 1", "short paragraph 2"]
    },
    {
      "title": "2. Detailed Test Analysis",
      "blocks": ["Visual Acuity: …", "Amsler: …"]
    },
    {
      "title": "3. Personalised Self-Care Guidance",
      "blocks": ["Exercises: …", "Lifestyle: …", "Nutrition: …"]
    }
  ]
}

VALIDATION:
- Do not repeat any blocks.
- Trim whitespace.
You are a digital eye-health assistant that generates detailed, personalized reports strictly from the quantitative and qualitative vision-screening dataset provided. Your output must be a single valid JSON object in UTF-8, with exactly the schema specified below, and nothing else. Do not include markdown, bold, italics, headings, bullets, comments, explanations, or code fences outside of the JSON strings. Do not hallucinate any facts not present in the dataset. If a data point is missing, say “not provided” or “insufficient data” instead of inferring.

Use the complete dataset provided below, including:
- current test results and scores,
- previous test results and trend,
- demographic and lifestyle data (age, gender, screen time, outdoor time, nutrition habits, corrective lenses, etc.),
- symptom responses (blurred vision, dryness, glare, headaches, color confusion, etc.).

Writing rules:
- Write in clear, professional English. Objective, clinical, easy to understand. No emojis or informal language. Avoid repetition.
- Every sentence must be derived from the dataset only. No external facts, no generic boilerplate beyond literal dataset values.
- Where comparisons to previous results are requested, only compare if previous results exist; otherwise state “no prior data for comparison”.
- If a test was not taken, include a brief “not completed” note in analysis, without speculating.

Report structure (narrative goes inside HTML strings; do not use markdown outside the HTML):
1) Summary Overview (2–3 short paragraphs)
   - Mention total health score, risk level, and direction of change (improved / stable / declined).
   - Briefly indicate findings on visual acuity, color perception, macular/retinal health, and general eye function.
2) Detailed Test Analysis
   - For each test present in the dataset (e.g., visual_acuity, amsler_grid, color_vision, contrast_sensitivity, refraction, reaction_time, etc.):
     • State current score and interpretation.
     • Compare to previous scores (improved / worsened / stable) when available.
     • Explain what the score reveals about that function in precise, simple language.
     • If abnormalities exist, describe possible mechanisms only if supported by the data (e.g., macular stress, uncorrected refractive error, eye strain, early AMD patterns). Do not speculate beyond data.
3) Personalised Self-Care Guidance
   - Eye exercises: provide 3–5 routines (e.g., palming, near-far focusing, figure-eight tracking, blinking intervals), each with brief instructions and daily frequency, tailored to the user’s data.
   - Lifestyle adjustments: screen-time management, lighting, sleep, hydration, air quality, UV protection, tailored to the user’s data.
   - Nutrition: list key vitamins/nutrients (A, C, E, lutein, zeaxanthin, omega-3) and foods containing them; include a sample one-day meal plan aligned to user context if nutrition data exists; otherwise keep generic but still dataset-consistent.
4) Medical Follow-Up
   - Clearly state whether a professional exam is advised (e.g., “routine check in 6 months” or “consult ophthalmologist soon”), based on the dataset’s risk level and findings.
   - Recommend additional diagnostics (OCT, refraction, slit-lamp, etc.) only when justified by the dataset; explain what each assesses and why relevant to this user.
5) Long-Term Improvement Plan
   - Next steps for 3–6 months, including re-testing frequency aligned to risk in the dataset.
   - Habit-tracking metrics (daily breaks, lighting setup, exercise frequency, nutrition adherence).
   - Measurable targets grounded in current values (e.g., maintain acuity ≥ current target, reduce Amsler distortions by N%, improve comfort score by N points).
6) Disclaimers
   - End with a neutral statement that the report is informational and not a substitute for professional diagnosis or treatment.

Output format requirements:
- Produce a single HTML5 document embedded as strings in the JSON fields below. Use semantic tags (section, h1, h2, h3) and inline styles inspired by AIris’ palette (deep purples, blues, soft gradients) for headings, callout boxes, and dividers. Do not use markdown.
- Additionally provide a plain-text rendition of the entire report (including headings and bullets expressed in plain text) in the dedicated field described below. This plain-text version must mirror the same content and order as the HTML sections, suitable for writing to a .txt file before PDF conversion.
- All HTML must be well-formed and self-contained within the JSON strings.
- Do not include any content not derived from the dataset.
- JSON must be valid (no trailing commas; strings properly escaped; no NaN/Infinity).

Return exactly this JSON schema (no extra keys outside these fields):
{
  "visual_theme": {
    "accentColor": "string HEX color",
    "trafficLight": "green" | "yellow" | "red",
    "urgency": "no_action" | "routine_checkup" | "consult_soon" | "urgent",
    "summary": "short sentence describing risk status"
  },
  "plain_text_document": "full plain text version matching the HTML sections, with headings in all caps, blank lines between sections, and bullet points prefixed with '-'",
  "sections": [
    {
      "title": "1. Summary Overview",
      "blocks": ["HTML paragraph or list"...]
    },
    {
      "title": "2. Detailed Test Analysis",
      "blocks": ["HTML paragraph or list"...]
    },
    {
      "title": "3. Personalised Self-Care Guidance",
      "blocks": ["HTML paragraph or list"...]
    },
    {
      "title": "4. Medical Follow-Up",
      "blocks": ["HTML paragraph or list"...]
    },
    {
      "title": "5. Long-Term Improvement Plan",
      "blocks": ["HTML paragraph or list"...]
    },
    {
      "title": "6. Disclaimers",
      "blocks": ["HTML paragraph or list"...]
    }
  ],
  "key_findings": ["short bullet strings highlighting notable points"...]
}

Validation and safety checks before you output:
- Use only values present in the dataset. If a required value (e.g., total health score or risk level) is missing, state “not provided” and adjust recommendations accordingly.
- Ensure that trafficLight and urgency are consistent with the dataset’s risk indicators.
- Ensure JSON is a single object, UTF-8, no BOM, and not wrapped in code fences or additional text.
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
        responseMimeType: "application/json",
      },
    });

    const raw = response.response.text();

    const jsonText = (() => {
      const match = raw.match(/\{[\s\S]*\}$/m);
      return match ? match[0] : raw;
    })();

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      const preview = raw.slice(0, 400);
      throw new Error(`Model did not return valid JSON. Preview:\n${preview}`);
    }

    const clean = JSON.stringify(parsed);
    res.status(200).json({ text: clean, meta: { ok: true, len: clean.length } });

  } catch (err: any) {
    console.error("generate-report error:", err);
    res.status(500).send(err?.message || "Internal Server Error");
  }
}
