import type { GeminiStructuredReport } from "@/utils/reportTypes";
import { TRAFFIC_BADGE_COLORS, type TrafficLight, type UrgencyLevel } from "@/utils/reportFormatting";

type StructuredReportViewProps = {
  report: GeminiStructuredReport;
  accentColor: string;
  trafficLight: TrafficLight;
  urgency: UrgencyLevel;
  keyFindings?: string[];
  themeSummary?: string;
};

/* ----------------------------- Sanitizer Utils ----------------------------- */

// Remove <script>/<style> blocks entirely
function stripDangerousBlocks(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
}

// Remove inline event handlers (onClick=, onload=, etc.) and javascript: URLs
function stripDangerousAttrs(html: string) {
  // remove on*="...", on*='...', on*=bare
  let out = html
    .replace(/\s(on\w+)\s*=\s*"(?:[^"]*)"/gi, "")
    .replace(/\s(on\w+)\s*=\s*'(?:[^']*)'/gi, "")
    .replace(/\s(on\w+)\s*=\s*[^\s>]+/gi, "");

  // neutralize javascript: in href/src/style
  out = out.replace(/\s(href|src)\s*=\s*"(javascript:[^"]*)"/gi, ' $1="#"');
  out = out.replace(/\s(href|src)\s*=\s*'(javascript:[^']*)'/gi, " $1='#'");
  out = out.replace(/\sstyle\s*=\s*"(?:[^"]*javascript:[^"]*)"/gi, ' style=""');
  out = out.replace(/\sstyle\s*=\s*'(?:[^']*javascript:[^']*)'/gi, " style=''");

  // very defensive: block url() in style
  out = out.replace(/\sstyle\s*=\s*"[^"]*url\s*\([^)]*\)[^"]*"/gi, ' style=""');
  out = out.replace(/\sstyle\s*=\s*'[^']*url\s*\([^)]*\)[^']*'/gi, " style=''");

  return out;
}

const BLOCK_STRING_KEYS = ["html", "content", "text", "markdown", "value"] as const;

function extractBlockString(raw: unknown): string | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(raw)) {
    const combined = raw
      .map((item) => extractBlockString(item))
      .filter((item): item is string => Boolean(item))
      .join("\n")
      .trim();
    return combined.length > 0 ? combined : null;
  }

  if (!raw || typeof raw !== "object") return null;

  for (const key of BLOCK_STRING_KEYS) {
    const candidate = extractBlockString((raw as Record<string, unknown>)[key]);
    if (candidate) return candidate;
  }

  if (Array.isArray((raw as Record<string, unknown>).children)) {
    const child = extractBlockString((raw as Record<string, unknown>).children);
    if (child) return child;
  }

  if (Array.isArray((raw as Record<string, unknown>).blocks)) {
    const nested = extractBlockString((raw as Record<string, unknown>).blocks);
    if (nested) return nested;
  }

  return null;
}

// Strip markdown code fences (```json ... ```), trim, and dedupe
function cleanBlocks(blocks: unknown[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of blocks ?? []) {
    const rawString = extractBlockString(raw);
    if (!rawString) continue;
    let s = rawString.trim();
    if (!s) continue;
    s = s.replace(/^```(?:json|md|markdown)?\s*/i, "").replace(/```$/i, "").trim();
    // sanitize HTML but still allow safe subset + inline styles
    s = stripDangerousBlocks(s);
    s = stripDangerousAttrs(s);

    // collapse excessive blank lines
    s = s.replace(/\n{3,}/g, "\n\n").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function sanitizeReport(report: any): GeminiStructuredReport {
  const safe: any = { ...report };

  safe.visual_theme = {
    accentColor: report?.visual_theme?.accentColor || "#6B8AFB",
    trafficLight: report?.visual_theme?.trafficLight || "green",
    urgency: report?.visual_theme?.urgency || "no_action",
    summary: (report?.visual_theme?.summary ?? "").toString().trim(),
  };

  safe.sections = (report?.sections ?? [])
    .map((sec: any) => {
      const title = (sec?.title ?? "").toString().trim() || "Untitled";
      const blocks = cleanBlocks(sec?.blocks ?? []);
      return { title, blocks };
    })
    .filter((s: any) => s.blocks.length > 0);

  // plain_text_document and key_findings (if present) should be safe as text
  if (typeof report?.plain_text_document === "string") {
    safe.plain_text_document = report.plain_text_document.replace(/^```[\s\S]*?```/g, "").trim();
  }
  if (Array.isArray(report?.key_findings)) {
    safe.key_findings = Array.from(
      new Set(
        report.key_findings
          .map((x: any) => (x ?? "").toString().trim())
          .filter((x: string) => x.length > 0)
      )
    );
  }

  return safe as GeminiStructuredReport;
}

/* --------------------------- Rendering Helper Bits -------------------------- */

const hasHtml = (block: string) => /<[^>]+>/.test(block);

const blockContent = (block: string) => {
  const trimmed = (block ?? "").trim();
  if (!trimmed) return null;
  if (hasHtml(trimmed)) {
    // Safe because we sanitized before
    return (
      <div
        className="leading-relaxed text-slate-700 dark:text-white"
        dangerouslySetInnerHTML={{ __html: trimmed }}
      />
    );
  }
  return (
    <p className="whitespace-pre-line leading-relaxed text-slate-700 dark:text-white">
      {trimmed}
    </p>
  );
};

const urgencyLabel = (urgency: UrgencyLevel) => urgency.replace(/_/g, " ");

/* --------------------------------- Component -------------------------------- */

export function StructuredReportView({
  report,
  accentColor,
  trafficLight,
  urgency,
  keyFindings,
  themeSummary,
}: StructuredReportViewProps) {
  // ✅ Sanitize once up-front
  const safeReport = sanitizeReport(report);
  const badgeColors = TRAFFIC_BADGE_COLORS[trafficLight];

  return (
    <div
      className="flex flex-col gap-6 rounded-3xl border border-white/40 bg-gradient-to-br from-slate-50/85 via-white/90 to-slate-100/90 p-8 shadow-2xl backdrop-blur dark:border-white/10 dark:from-slate-900/70 dark:via-slate-900/80 dark:to-slate-900/70"
      style={{
        backgroundImage: `linear-gradient(140deg, ${accentColor}22, rgba(15,23,42,0.04)), radial-gradient(circle at top left, ${accentColor}12, transparent 55%)`,
      }}
    >
      <header className="flex flex-col gap-4 rounded-2xl border border-white/40 bg-white/60 p-6 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-950/60">
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
          <span style={{ color: accentColor }}>AIris Vision Health Report</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold uppercase tracking-[0.12em]"
            style={{ backgroundColor: badgeColors.bg, color: badgeColors.text }}
          >
            Status · {trafficLight.toUpperCase()}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:bg-white/5 dark:text-slate-200">
            Urgency · {urgencyLabel(urgency)}
          </span>
        </div>
        {themeSummary && (
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{themeSummary}</p>
        )}
      </header>

      {keyFindings && keyFindings.length > 0 && (
        <section className="rounded-2xl border border-white/50 bg-white/80 p-6 shadow-md backdrop-blur dark:border-white/10 dark:bg-slate-950/60">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">
            Key Findings
          </h3>
          <ul className="grid gap-2 text-sm">
            {keyFindings.map((finding, idx) => (
              <li
                key={idx}
                className="rounded-xl border border-slate-200/70 bg-gradient-to-br from-white/90 via-white to-white/95 px-4 py-3 leading-relaxed text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:from-slate-900/65 dark:to-slate-900/80 dark:text-slate-100"
              >
                {finding}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-5">
        {safeReport.sections.map((section, idx) => (
          <section
            key={`${section.title}-${idx}`}
            className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-950/70"
          >
            <h2
              className="text-xl font-semibold tracking-tight"
              style={{ color: accentColor }}
            >
              {section.title}
            </h2>
            <div className="mt-4 grid gap-4 text-sm leading-relaxed text-slate-700 dark:text-slate-100">
              {section.blocks.map((block, blockIdx) => {
                const content = blockContent(block);
                if (!content) return null;
                return (
                  <div
                    key={blockIdx}
                    className="rounded-xl border border-slate-200/60 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/70"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
        <span>Generated on {new Date().toLocaleDateString()}</span>
        <span>AIris · Gemini 2.5</span>
      </footer>
    </div>
  );
}

export default StructuredReportView;
