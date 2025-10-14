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

const hasHtml = (block: string) => /<[^>]+>/.test(block);

const blockContent = (block: string) => {
  if (hasHtml(block)) {
    return <div dangerouslySetInnerHTML={{ __html: block }} />;
  }
  return <p className="leading-relaxed text-slate-700 dark:text-slate-100">{block}</p>;
};

const urgencyLabel = (urgency: UrgencyLevel) => urgency.replace(/_/g, " ");

export function StructuredReportView({
  report,
  accentColor,
  trafficLight,
  urgency,
  keyFindings,
  themeSummary,
}: StructuredReportViewProps) {
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
        {themeSummary && <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{themeSummary}</p>}
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
        {report.sections.map((section, idx) => (
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
              {section.blocks.map((block, blockIdx) => (
                <div
                  key={blockIdx}
                  className="rounded-xl border border-slate-200/60 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/70"
                >
                  {blockContent(block)}
                </div>
              ))}
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
