import { formatDurationMs } from "@/hooks/useTestTimer";
import { clsx } from "clsx";

type TestTimerDisplayProps = {
  sessionMs: number;
  questionMs: number;
  questionLabel?: string;
  className?: string;
};

export function TestTimerDisplay({ sessionMs, questionMs, questionLabel, className }: TestTimerDisplayProps) {
  return (
    <div
      className={clsx(
        "grid gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs font-medium text-primary dark:border-primary/40 dark:bg-primary/10 sm:grid-cols-2",
        className,
      )}
    >
      <div className="flex flex-col gap-1 rounded-xl bg-white/70 p-3 text-slate-900 shadow-sm dark:bg-slate-900/60 dark:text-slate-100">
        <span className="text-[11px] uppercase tracking-wide text-primary/80 dark:text-primary/50">Session Time</span>
        <span className="text-base font-semibold">{formatDurationMs(sessionMs)}</span>
        <span className="text-[11px] text-muted-foreground">Total elapsed this session</span>
      </div>
      <div className="flex flex-col gap-1 rounded-xl bg-white/70 p-3 text-slate-900 shadow-sm dark:bg-slate-900/60 dark:text-slate-100">
        <span className="text-[11px] uppercase tracking-wide text-primary/80 dark:text-primary/50">
          {questionLabel ? `Current: ${questionLabel}` : "Question Time"}
        </span>
        <span className="text-base font-semibold">{formatDurationMs(questionMs)}</span>
        <span className="text-[11px] text-muted-foreground">Time spent on this step</span>
      </div>
    </div>
  );
}
