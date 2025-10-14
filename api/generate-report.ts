import { GoogleGenerativeAI } from "@google/generative-ai";

type TrafficLight = "green" | "yellow" | "red";
type UrgencyLevel = "no_action" | "routine_checkup" | "consult_soon" | "urgent";

type CareLevelDetails = {
  score: number | null;
  trafficLight: TrafficLight;
  urgency: UrgencyLevel;
  label: string;
  summary: string;
};

type SectionContent = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  htmlBullets?: string[];
};

const ACCENT_BY_TRAFFIC: Record<TrafficLight, string> = {
  green: "#22C55E",
  yellow: "#F59E0B",
  red: "#EF4444",
};

const TEST_LABELS: Record<string, string> = {
  ishihara: "Ishihara Color Test",
  visual_acuity: "Visual Acuity Test",
  acuity: "Visual Acuity Test",
  amsler: "Amsler Grid Test",
  reading_stress: "Reading Stress Test",
};

const capitalizeWords = (value: string) =>
  value
    .split(" ")
    .map((segment) => (segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : segment))
    .join(" ");

const friendlyTestName = (id: string) => {
  const known = TEST_LABELS[id];
  if (known) return known;
  return capitalizeWords(id.replace(/[_-]/g, " "));
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const formatPercent = (value: number | null): string => {
  if (value === null) return "not provided";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}%` : `${rounded.toFixed(1)}%`;
};

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const determineCareLevel = (stats: any): CareLevelDetails => {
  const baseline = toNumber(stats?.care_baseline_score);
  const overall = toNumber(stats?.overall_score);
  const reference = baseline ?? overall ?? null;

  if (reference === null) {
    return {
      score: null,
      trafficLight: "yellow",
      urgency: "routine_checkup",
      label: "Limited Data",
      summary: "More test data is needed before a confident care level can be set.",
    };
  }

  if (reference >= 70) {
    return {
      score: reference,
      trafficLight: "green",
      urgency: "no_action",
      label: "Stable",
      summary: "Scores sit comfortably above the caution range. Maintain your current routine.",
    };
  }

  if (reference >= 40) {
    return {
      score: reference,
      trafficLight: "yellow",
      urgency: "consult_soon",
      label: "Monitor Closely",
      summary: "Mid-range scores suggest following up with your eye-care professional soon.",
    };
  }

  return {
    score: reference,
    trafficLight: "red",
    urgency: "urgent",
    label: "High Priority",
    summary: "Lowest readings dip below the safe range. Arrange urgent medical review.",
  };
};

const summarizeTests = (tests: any) => {
  const htmlBullets: string[] = [];
  const plainBullets: string[] = [];
  let lowestScore: number | null = null;

  Object.entries(tests ?? {}).forEach(([id, test]) => {
    const currentScore = toNumber((test as any)?.current?.score);
    const historyArray = Array.isArray((test as any)?.history) ? ((test as any)?.history as any[]) : [];
    const historyScores = historyArray
      .map((entry) => toNumber(entry?.score))
      .filter((value): value is number => value !== null);
    const sessions = historyArray.length;

    const testLowest =
      historyScores.length > 0
        ? historyScores.reduce((min, score) => Math.min(min, score), historyScores[0])
        : currentScore;

    if (typeof testLowest === "number") {
      lowestScore = lowestScore === null ? testLowest : Math.min(lowestScore, testLowest);
    }

    const trend = toNumber((test as any)?.trend);
    const trendText =
      trend === null || trend === 0 ? "steady" : trend > 0 ? `+${trend.toFixed(1)} pts` : `${trend.toFixed(1)} pts`;
    const latestText = currentScore !== null ? formatPercent(currentScore) : "not completed";
    const lowestText = testLowest !== null ? formatPercent(testLowest) : "not available";
    const sessionText = `${sessions} session${sessions === 1 ? "" : "s"}`;
    const name = friendlyTestName(id);

    const plain = `${name}: latest ${latestText}, lowest ${lowestText}, ${sessionText}, trend ${trendText}.`;
    plainBullets.push(plain);
    htmlBullets.push(
      `<li><strong>${escapeHtml(name)}</strong>: latest <span>${escapeHtml(latestText)}</span>, lowest <span>${escapeHtml(
        lowestText,
      )}</span>, ${escapeHtml(sessionText)}, trend ${escapeHtml(trendText)}.</li>`,
    );
  });

  if (htmlBullets.length === 0) {
    const message = "No completed tests yet. Run a screening to begin tracking detailed insights.";
    plainBullets.push(message);
    htmlBullets.push(`<li>${escapeHtml(message)}</li>`);
  }

  return { htmlBullets, plainBullets, lowestScore };
};

const renderSectionHtml = (section: SectionContent): string => {
  const titleText = section.title.replace(/^\d+\.\s*/, "").trim();
  const paragraphsHtml = (section.paragraphs ?? [])
    .map(
      (text) =>
        `<p style="margin:0 0 1rem; line-height:1.7; color:#1f2937;">${escapeHtml(text)}</p>`,
    )
    .join("");
  const bulletSource =
    section.htmlBullets ??
    (section.bullets ? section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`) : []);
  const bulletsHtml = bulletSource.length
    ? `<ul style="padding-left:1.2rem; margin:0 0 1rem; color:#1f2937;">${bulletSource.join("")}</ul>`
    : "";

  return `<section><h3 style="margin:0 0 0.75rem; font-size:1.05rem; color:#111827;">${escapeHtml(
    titleText,
  )}</h3>${paragraphsHtml}${bulletsHtml}</section>`;
};

const buildFallbackReport = (dataset: any, reason?: string | null) => {
  if (!dataset || typeof dataset !== "object") return null;

  const stats = dataset.stats ?? {};
  const lifestyle = dataset.lifestyle ?? {};
  const history = Array.isArray(dataset.history) ? dataset.history : [];
  const testBundle = summarizeTests(dataset.tests ?? {});
  const care = determineCareLevel(stats);

  const totalTestCategories = Object.keys(dataset.tests ?? {}).length;
  const totalSessions = history.length;
  const xp = toNumber(stats?.xp) ?? 0;
  const level = toNumber(stats?.level);
  const xpSummary = `${xp} XP${level ? ` (Level ${level})` : ""}`;
  const scoreText = formatPercent(care.score);
  const lowestRecorded = testBundle.lowestScore !== null ? formatPercent(testBundle.lowestScore) : "not recorded";
  const symptomList =
    Array.isArray(lifestyle?.symptoms) && lifestyle.symptoms.length > 0
      ? lifestyle.symptoms.slice(0, 4).join(", ") + (lifestyle.symptoms.length > 4 ? ", ..." : "")
      : null;

  const summaryParagraphs = [
    `Care baseline score ${scoreText} signals ${care.label.toLowerCase()} needs. ${care.summary}`,
    `We analysed ${totalTestCategories} test categor${totalTestCategories === 1 ? "y" : "ies"} across ${totalSessions} session${
      totalSessions === 1 ? "" : "s"
    }, with cumulative progress at ${xpSummary}.`,
  ];
  if (symptomList) {
    summaryParagraphs.push(`Reported symptom highlights: ${symptomList}.`);
  }
  if (reason) {
    summaryParagraphs.push("Fallback summary generated while AI formatting was unavailable.");
  }

  const analysisParagraphs = [
    "Test-by-test insights are summarised below so you can compare latest, lowest, and trend information at a glance.",
  ];

  const careMessage =
    care.trafficLight === "red"
      ? "Because results fall in the urgent range, keep a detailed symptom log and limit visual strain until reviewed."
      : care.trafficLight === "yellow"
        ? "Scores trend in the caution range—schedule consistent check-ins and track any subtle visual changes."
        : "Maintain the habits that are supporting strong scores and continue routine monitoring.";

  const guidanceParagraphs = [
    "Focus your daily routine on protecting central vision and sustaining comfortable screen habits. Implement the routines below consistently.",
    careMessage,
  ];

  const guidanceBullets = [
    "Eye exercise: 20-20-20 focus shifts — every 20 minutes, look 20 feet away for 20 seconds during screen use.",
    "Grid tracking: Scan the Amsler grid for 1 minute per eye each evening, noting any new distortions.",
    "Contrast drill: Alternate reading high-contrast and low-contrast text for 5 minutes daily to reinforce acuity stamina.",
    "Lifestyle: Rest for 5 minutes every hour away from bright screens and aim for at least 1 hour of outdoor natural light.",
    "Hydration and breaks: Drink water steadily (target 8 cups daily) to support tear film stability and reduce dryness.",
    "Nutrition: Include leafy greens, orange vegetables, and fatty fish weekly for lutein, zeaxanthin, and omega-3 support.",
    "Sample day plan — Morning: contrast reading drill in natural light; Midday: outdoor break with 20-20-20 routine; Evening: gentle grid scan and symptom log update.",
  ];

  const followUpParagraphs = [
    care.trafficLight === "red"
      ? "Book an urgent appointment with an optometrist or ophthalmologist. Bring your symptom log and AIris history to support diagnostics such as OCT imaging or dilated retinal evaluation."
      : care.trafficLight === "yellow"
        ? "Arrange a comprehensive eye exam within the next few weeks. Discuss whether enhanced macular imaging or contrast sensitivity testing is warranted."
        : "Plan your next routine eye exam at the standard cadence (often annually) unless new symptoms emerge.",
    "Seek immediate in-person care if you notice sudden vision loss, new blind spots, flashes of light, or rapid decline in clarity.",
  ];

  const improvementParagraphs = [
    "Use the following milestone plan to stay organised across the next three to six months.",
  ];

  const improvementBullets = [
    "Weeks 1–4: Complete weekly self-tests (Amsler, acuity, colour) and update your symptom journal.",
    "Weeks 5–8: Review results; contact your clinician if any score dips below 40% or symptoms escalate.",
    "Weeks 9–12: Maintain cross-training habits (screen breaks, lighting hygiene) and repeat the full testing cycle.",
    "Months 4–6: Schedule a formal eye exam and compare professional findings with your AIris test trends.",
  ];

  const disclaimersBullets = [
    "AIris summaries provide educational insight only and are not a replacement for personalised medical diagnosis.",
    "Follow the guidance of your licensed eye-care professional and local health regulations.",
    "Digital screenings may miss acute changes—seek emergency care for sudden or severe symptoms.",
  ];

  const sections: SectionContent[] = [
    { title: "1. Summary Overview", paragraphs: summaryParagraphs },
    {
      title: "2. Detailed Test Analysis",
      paragraphs: analysisParagraphs,
      bullets: testBundle.plainBullets,
      htmlBullets: testBundle.htmlBullets,
    },
    {
      title: "3. Personalised Self-Care Guidance",
      paragraphs: guidanceParagraphs,
      bullets: guidanceBullets,
    },
    {
      title: "4. Medical Follow-Up",
      paragraphs: followUpParagraphs,
    },
    {
      title: "5. Long-Term Improvement Plan",
      paragraphs: improvementParagraphs,
      bullets: improvementBullets,
    },
    {
      title: "6. Disclaimers",
      bullets: disclaimersBullets,
    },
  ];

  const plainTextDocument = sections
    .map((section) => {
      const lines: string[] = [];
      lines.push(section.title.toUpperCase());
      (section.paragraphs ?? []).forEach((text) => lines.push(text));
      (section.bullets ?? []).forEach((bullet) => lines.push(`- ${bullet}`));
      return lines.join("\n");
    })
    .join("\n\n");

  const htmlSections = sections.map((section) => ({
    title: section.title,
    blocks: [renderSectionHtml(section)],
  }));

  const keyFindings = [
    `Care level: ${care.label} (${scoreText}).`,
    `Lowest recorded test score: ${lowestRecorded}.`,
    `Testing coverage: ${totalTestCategories} categories across ${totalSessions} session${totalSessions === 1 ? "" : "s"}.`,
  ];

  return {
    visual_theme: {
      accentColor: ACCENT_BY_TRAFFIC[care.trafficLight],
      trafficLight: care.trafficLight,
      urgency: care.urgency,
      summary: care.summary,
    },
    plain_text_document: plainTextDocument,
    sections: htmlSections,
    key_findings: keyFindings,
  };
};

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

  // Escape literal newlines/tabs only when *inside* strings and track structure balance
  let out = "";
  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (!inStr) {
      if (ch === '"' && !esc) {
        inStr = true;
        out += ch;
        continue;
      }
      if (ch === "{" || ch === "[") {
        stack.push(ch);
      } else if (ch === "}" || ch === "]") {
        if (stack.length && ((stack[stack.length - 1] === "{" && ch === "}") || (stack[stack.length - 1] === "[" && ch === "]"))) {
          stack.pop();
        } else {
          // ignore unmatched closing bracket
          continue;
        }
      }
      if (ch === "\\") {
        esc = !esc;
      } else {
        esc = false;
      }
      out += ch;
      continue;
    }

    if (esc) {
      out += ch;
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      out += ch;
      continue;
    }
    if (ch === '"') {
      inStr = false;
      out += ch;
      continue;
    }
    if (ch === "\n") {
      out += "\\n";
      continue;
    }
    if (ch === "\r") {
      out += "\\r";
      continue;
    }
    if (ch === "\t") {
      out += "\\t";
      continue;
    }
    out += ch;
  }

  if (inStr) {
    out += '"';
  }

  while (stack.length) {
    const opener = stack.pop();
    if (opener === "{") out += "}";
    else if (opener === "[") out += "]";
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
    const RETRY_APPEND = `

The previous response was invalid JSON. RESPOND ONLY WITH VALID JSON THAT MATCHES THE SCHEMA EXACTLY. Close every quote and brace, include all required keys, and ensure the document is complete.`;

    const MAX_ATTEMPTS = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const retryNote = attempt === 0 ? "" : RETRY_APPEND;
      const finalPrompt = `${BASE_PROMPT}${retryNote}\n\n### DATASET\n${datasetBlock}${additional}`;

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
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      const candidate = firstBrace >= 0 && lastBrace > firstBrace ? raw.slice(firstBrace, lastBrace + 1) : raw;

      let jsonText = candidate;
      let parsed: any;

      try {
        parsed = tryParseJsonStrict(jsonText);
      } catch {
        const repaired = repairJsonLoose(jsonText);
        try {
          parsed = tryParseJsonStrict(repaired);
          jsonText = repaired;
        } catch (err) {
          lastError = new Error(`Model did not return valid JSON. Preview:\n${raw.slice(0, 400)}`);
          console.warn("Gemini JSON parse retry failed (attempt %d): %s", attempt + 1, lastError.message);
          continue;
        }
      }

      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof parsed.plain_text_document !== "string" ||
        !Array.isArray(parsed.sections) ||
        parsed.sections.length === 0
      ) {
        lastError = new Error(`Model response missing required fields. Preview:\n${raw.slice(0, 400)}`);
        console.warn("Gemini JSON validation failed (attempt %d): %s", attempt + 1, lastError.message);
        continue;
      }

      const clean = JSON.stringify(parsed);
      res.status(200).json({ text: clean, meta: { ok: true, len: clean.length, attempt: attempt + 1 } });
      return;
    }

    const fallbackPayload = buildFallbackReport(userData, lastError?.message);
    if (fallbackPayload) {
      const fallbackJson = JSON.stringify(fallbackPayload);
      res
        .status(200)
        .json({ text: fallbackJson, meta: { ok: false, fallback: true, reason: lastError?.message ?? null } });
      return;
    }

    throw lastError ?? new Error("Model did not return valid JSON after retry.");

  } catch (err: any) {
    console.error("generate-report error:", err);
    res.status(500).send(err?.message || "Internal Server Error");
  }
}
