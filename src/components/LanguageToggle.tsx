import { useMemo, useRef, useState } from "react";
import { Languages, Check, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguagePreference, SUPPORTED_LANGUAGES } from "@/hooks/useLanguagePreference";
import { usePageTranslation } from "@/hooks/usePageTranslation";

export const LanguageToggle = () => {
  const { language, setLanguage, loading } = useLanguagePreference();
  const { translating } = usePageTranslation(language, !loading);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const label = useMemo(
    () => SUPPORTED_LANGUAGES.find((item) => item.code === language)?.label ?? "English",
    [language],
  );

  return (
    <div
      ref={containerRef}
      className="fixed right-3 top-16 z-[95] flex flex-col items-end gap-2"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-full border border-border/70 bg-white/90 px-3 text-sm font-medium text-slate-700 shadow-lg backdrop-blur transition hover:scale-105 active:scale-95 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-100",
        )}
        aria-label="Open language selector"
        disabled={loading || translating}
      >
        <Globe2 className="mr-2 h-4 w-4" />
        <span className="truncate max-w-[140px]">{label}</span>
      </button>

      <div
        className={cn(
          "origin-top-right rounded-2xl border border-border/70 bg-white/95 p-3 shadow-xl backdrop-blur transition-all duration-200 dark:border-slate-700 dark:bg-slate-900/90",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        )}
      >
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
          <Languages className="h-4 w-4" />
          <span>Translate page</span>
          {(loading || translating) && <span className="text-amber-500">...</span>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SUPPORTED_LANGUAGES.map((item) => {
            const active = item.code === language;
            return (
              <button
                key={item.code}
                type="button"
                className={cn(
                  "flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-300",
                  active
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200"
                    : "border-border/70 bg-white dark:border-slate-800 dark:bg-slate-800/60",
                )}
                disabled={loading || translating}
                onClick={() => {
                  setLanguage(item.code);
                  setOpen(false);
                }}
              >
                <span>{item.label}</span>
                {active && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
