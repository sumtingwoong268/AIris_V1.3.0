import type { GeminiStructuredReport, GeminiStructuredSection, GeminiVisualTheme } from "@/utils/reportTypes";

type TrafficLight = "green" | "yellow" | "red";
type UrgencyLevel = "no_action" | "routine_checkup" | "consult_soon" | "urgent";

export type ParsedReport = {
  structured: GeminiStructuredReport | null;
  html: string;
  plainText: string;
  keyFindings: string[];
  summary: string;
  accentColor: string;
  trafficLight: TrafficLight;
  urgency: UrgencyLevel;
  themeSummary?: string;
};

type ParseOptions = {
  fallbackTrafficLight?: TrafficLight;
  fallbackUrgency?: UrgencyLevel;
  fallbackAccentColor?: string;
};

const DEFAULT_ACCENT = "#6366F1";
const TRAFFIC_SEVERITY: Record<TrafficLight, number> = {
  green: 1,
  yellow: 2,
  red: 3,
};

const URGENCY_SEVERITY: Record<UrgencyLevel, number> = {
  no_action: 1,
  routine_checkup: 2,
  consult_soon: 3,
  urgent: 4,
};

const TRAFFIC_BADGE_COLORS: Record<TrafficLight, { bg: string; text: string }> = {
  green: { bg: "rgba(34,197,94,0.15)", text: "rgb(21,128,61)" },
  yellow: { bg: "rgba(251,191,36,0.18)", text: "rgb(180,83,9)" },
  red: { bg: "rgba(248,113,113,0.18)", text: "rgb(190,18,60)" },
};

const stripCodeFence = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  const body = trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "");
  return body.trim();
};

const isValidHex = (value?: string): value is string => Boolean(value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()));

const COERCE_BLOCK_KEYS = ["html", "content", "text", "markdown", "value"] as const;

const coerceBlockToString = (input: unknown): string | null => {
  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(input)) {
    const combined = input
      .map((segment) => coerceBlockToString(segment))
      .filter((segment): segment is string => Boolean(segment))
      .join("\n")
      .trim();
    return combined.length > 0 ? combined : null;
  }

  if (!input || typeof input !== "object") return null;

  for (const key of COERCE_BLOCK_KEYS) {
    const value = (input as Record<string, unknown>)[key];
    const coerced = coerceBlockToString(value);
    if (coerced) return coerced;
  }

  if (Array.isArray((input as Record<string, unknown>).children)) {
    const childText = coerceBlockToString((input as Record<string, unknown>).children);
    if (childText) return childText;
  }

  if (Array.isArray((input as Record<string, unknown>).blocks)) {
    const nested = coerceBlockToString((input as Record<string, unknown>).blocks);
    if (nested) return nested;
  }

  return null;
};

const ensureSection = (section: any): GeminiStructuredSection | null => {
  if (!section || typeof section !== "object") return null;
  const title =
    typeof section.title === "string"
      ? section.title.trim()
      : typeof section.heading === "string"
        ? section.heading.trim()
        : null;
  if (!title) return null;

  const rawBlocks = Array.isArray(section.blocks) ? section.blocks : Array.isArray(section.content) ? section.content : [];
  const blocks = rawBlocks
    .map((block) => coerceBlockToString(block))
    .filter((block): block is string => typeof block === "string" && block.trim().length > 0);

  if (blocks.length === 0) return null;

  return {
    title,
    blocks,
  };
};

const normalizeStructuredReport = (input: any): GeminiStructuredReport | null => {
  if (!input || typeof input !== "object") return null;

  const sections = Array.isArray(input.sections)
    ? input.sections.map(ensureSection).filter((section): section is GeminiStructuredSection => section !== null)
    : [];

  if (sections.length === 0) return null;

  const key_findings = Array.isArray(input.key_findings)
    ? input.key_findings.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  const visual_theme: GeminiVisualTheme | undefined =
    input.visual_theme && typeof input.visual_theme === "object"
      ? {
          accentColor: isValidHex(input.visual_theme.accentColor) ? input.visual_theme.accentColor.trim() : undefined,
          trafficLight: ["green", "yellow", "red"].includes(input.visual_theme.trafficLight)
            ? (input.visual_theme.trafficLight as TrafficLight)
            : undefined,
          urgency: ["no_action", "routine_checkup", "consult_soon", "urgent"].includes(input.visual_theme.urgency)
            ? (input.visual_theme.urgency as UrgencyLevel)
            : undefined,
          summary: typeof input.visual_theme.summary === "string" ? input.visual_theme.summary.trim() : undefined,
        }
      : undefined;

  return {
    sections,
    key_findings,
    visual_theme,
  };
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toHtmlBlock = (block: string): string => {
  const trimmed = block.trim();
  if (!trimmed) return "";
  if (trimmed.includes("<")) return trimmed;
  return `<p style="margin: 0 0 12px; line-height: 1.6;">${escapeHtml(trimmed)}</p>`;
};

const sectionHtml = (section: GeminiStructuredSection, accentColor: string): string => {
  const gradientBg = `linear-gradient(135deg, rgba(255,255,255,0.9), rgba(226,232,240,0.9))`;
  const titleColor = accentColor || DEFAULT_ACCENT;

  const blocksHtml = section.blocks.map(toHtmlBlock).join("\n");
  return `
    <section style="background: ${gradientBg}; border-radius: 20px; padding: 24px; box-shadow: 0 12px 32px rgba(15,23,42,0.08); border: 1px solid rgba(15,23,42,0.08);">
      <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: ${titleColor}; letter-spacing: -0.01em;">${escapeHtml(section.title)}</h2>
      <div style="color: #1f2937; font-size: 15px;">${blocksHtml}</div>
    </section>
  `;
};

const keyFindingsHtml = (keyFindings: string[], accentColor: string): string => {
  if (keyFindings.length === 0) return "";
  const items = keyFindings
    .map((finding) => `<li style="padding: 10px 14px; background: rgba(255,255,255,0.55); border-radius: 14px; font-size: 15px; color: #0f172a; line-height: 1.5; border: 1px solid rgba(15,23,42,0.1);">${escapeHtml(finding)}</li>`)
    .join("");

  return `
    <div style="background: rgba(15,23,42,0.08); padding: 20px 24px; border-radius: 18px; display: flex; flex-direction: column; gap: 12px; border: 1px solid rgba(15,23,42,0.1);">
      <span style="font-weight: 700; font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase; color: ${accentColor};">Key Findings</span>
      <ul style="list-style: none; margin: 0; padding: 0; display: grid; gap: 10px;">${items}</ul>
    </div>
  `;
};

const badgeHtml = (trafficLight: TrafficLight): string => {
  const colors = TRAFFIC_BADGE_COLORS[trafficLight];
  const label = trafficLight.toUpperCase();
  return `<span style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; background: ${colors.bg}; color: ${colors.text}; font-size: 13px; font-weight: 600; letter-spacing: 0.08em;">STATUS · ${label}</span>`;
};

export const buildHtmlFromStructure = (report: GeminiStructuredReport, accentColor: string, trafficLight: TrafficLight, urgency: UrgencyLevel, themeSummary?: string): string => {
  const resolvedAccent = accentColor || DEFAULT_ACCENT;
  const gradient = `linear-gradient(135deg, ${resolvedAccent}, rgba(88,28,135,0.9) 55%, rgba(30,64,175,0.92))`;
  const sectionsHtml = report.sections.map((section) => sectionHtml(section, resolvedAccent)).join("\n");
  const keyFindings = report.key_findings ? keyFindingsHtml(report.key_findings, resolvedAccent) : "";

  const urgencyLabel = urgency.replace(/_/g, " ").toUpperCase();

  return `
    <article style="font-family: 'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: ${gradient}; color: #0f172a; padding: 40px; border-radius: 32px; display: flex; flex-direction: column; gap: 28px;">
      <header style="display: flex; flex-direction: column; gap: 14px; background: rgba(255,255,255,0.12); border-radius: 24px; padding: 24px 28px; border: 1px solid rgba(255,255,255,0.2);">
        <span style="letter-spacing: 0.18em; font-weight: 600; color: rgba(255,255,255,0.72); font-size: 13px;">AIris Vision Health Report</span>
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px;">
          ${badgeHtml(trafficLight)}
          <span style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,0.16); color: rgba(255,255,255,0.86); font-size: 13px; font-weight: 500; letter-spacing: 0.08em;">
            URGENCY · ${urgencyLabel}
          </span>
        </div>
        ${themeSummary ? `<p style="margin: 0; color: rgba(255,255,255,0.92); font-size: 15px; line-height: 1.7;">${escapeHtml(themeSummary)}</p>` : ""}
      </header>
      ${keyFindings}
      <div style="display: flex; flex-direction: column; gap: 20px;">${sectionsHtml}</div>
      <footer style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: rgba(255,255,255,0.75); letter-spacing: 0.08em;">
        <span>Generated on ${new Date().toLocaleDateString()}</span>
        <span>Powered by AIris · Gemini 2.5</span>
      </footer>
    </article>
  `;
};

const stripHtmlTags = (html: string): string =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|ul|ol)>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/(h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const buildPlainTextFromSection = (section: GeminiStructuredSection): string => {
  const header = section.title;
  const blockText = section.blocks
    .map((block) => stripHtmlTags(block))
    .filter((text) => text.length > 0)
    .join("\n");
  return `${header}\n${blockText}`.trim();
};

export const buildPlainTextFromStructure = (report: GeminiStructuredReport): string => {
  return report.sections.map(buildPlainTextFromSection).filter(Boolean).join("\n\n");
};

export const sanitizeToPlainText = (input: string): string => stripHtmlTags(input);

const deriveSummary = (report: GeminiStructuredReport, plainText: string): string => {
  if (report.visual_theme?.summary) return report.visual_theme.summary;
  const firstSection = report.sections[0];
  if (firstSection) {
    const firstBlock = firstSection.blocks[0];
    if (firstBlock) {
      const text = stripHtmlTags(firstBlock);
      if (text) return text.length > 260 ? `${text.slice(0, 257).trim()}…` : text;
    }
  }
  if (plainText.length > 0) {
    return plainText.length > 260 ? `${plainText.slice(0, 257).trim()}…` : plainText;
  }
  return "Automated vision health summary";
};

const mergeTraffic = (primary: TrafficLight, fallback?: TrafficLight): TrafficLight => {
  if (!fallback) return primary;
  return TRAFFIC_SEVERITY[fallback] > TRAFFIC_SEVERITY[primary] ? fallback : primary;
};

const mergeUrgency = (primary: UrgencyLevel, fallback?: UrgencyLevel): UrgencyLevel => {
  if (!fallback) return primary;
  return URGENCY_SEVERITY[fallback] > URGENCY_SEVERITY[primary] ? fallback : primary;
};

const resolveAccentColor = (theme: GeminiVisualTheme | undefined, fallback?: string) => {
  if (theme?.accentColor) return theme.accentColor;
  if (fallback && isValidHex(fallback)) return fallback;
  if (theme?.trafficLight === "red") return "#EF4444";
  if (theme?.trafficLight === "yellow") return "#F59E0B";
  if (theme?.trafficLight === "green") return "#10B981";
  return fallback && isValidHex(fallback) ? fallback : DEFAULT_ACCENT;
};

export const parseAiReportText = (rawText: string, options?: ParseOptions): ParsedReport => {
  const fallbackTraffic = options?.fallbackTrafficLight ?? "yellow";
  const fallbackUrgency = options?.fallbackUrgency ?? "routine_checkup";
  const fallbackAccent = options?.fallbackAccentColor ?? DEFAULT_ACCENT;

  const fallbackPlain = sanitizeToPlainText(rawText);
  const fallbackSummary =
    fallbackPlain.length > 0
      ? fallbackPlain.length > 260
        ? `${fallbackPlain.slice(0, 257).trim()}…`
        : fallbackPlain
      : "Automated vision health summary";

  const fallback: ParsedReport = {
    structured: null,
    html: rawText?.trim() || `<p>${escapeHtml(fallbackPlain)}</p>`,
    plainText: fallbackPlain,
    keyFindings: [],
    summary: fallbackSummary,
    accentColor: fallbackAccent,
    trafficLight: fallbackTraffic,
    urgency: fallbackUrgency,
    themeSummary: undefined,
  };

  if (!rawText || rawText.trim().length === 0) return fallback;

  const trimmed = rawText.trim();
  const candidate = stripCodeFence(trimmed);

  const tryParse = (input: string | null | undefined) => {
    if (!input) return null;
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  };

  let parsedJson: any = tryParse(candidate);

  if (!parsedJson && /```/.test(trimmed)) {
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      parsedJson = tryParse(fenceMatch[1]);
    }
  }

  if (!parsedJson) {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      parsedJson = tryParse(trimmed.slice(firstBrace, lastBrace + 1));
    }
  }

  const plainTextDoc =
    parsedJson && typeof parsedJson.plain_text_document === "string"
      ? parsedJson.plain_text_document.trim()
      : "";

  if (!parsedJson) return fallback;

  const structured = normalizeStructuredReport(parsedJson);
  if (!structured) {
    if (plainTextDoc.length > 0) {
      const summary =
        plainTextDoc.length > 260 ? `${plainTextDoc.slice(0, 257).trim()}…` : plainTextDoc;
      return {
        ...fallback,
        plainText: plainTextDoc,
        summary,
      };
    }
    return fallback;
  }

  const accentColor = resolveAccentColor(structured.visual_theme, fallbackAccent);
  const trafficLight = mergeTraffic(structured.visual_theme?.trafficLight ?? fallbackTraffic, fallbackTraffic);
  const urgency = mergeUrgency(structured.visual_theme?.urgency ?? fallbackUrgency, fallbackUrgency);
  const builtPlain = buildPlainTextFromStructure(structured);
  const plainText = plainTextDoc.length > 0 ? plainTextDoc : builtPlain;
  const html = buildHtmlFromStructure(structured, accentColor, trafficLight, urgency, structured.visual_theme?.summary);
  const summary = deriveSummary(structured, plainText);

  return {
    structured,
    html,
    plainText,
    keyFindings: structured.key_findings ?? [],
    summary,
    accentColor,
    trafficLight,
    urgency,
    themeSummary: structured.visual_theme?.summary,
  };
};

export const extractSectionPlainText = (report: GeminiStructuredReport | null, matcher: (section: GeminiStructuredSection) => boolean): string | null => {
  if (!report) return null;
  const section = report.sections.find(matcher);
  if (!section) return null;
  const text = section.blocks.map(stripHtmlTags).filter(Boolean).join("\n");
  return text.length > 0 ? text : null;
};

export { TrafficLight, UrgencyLevel, TRAFFIC_BADGE_COLORS };
