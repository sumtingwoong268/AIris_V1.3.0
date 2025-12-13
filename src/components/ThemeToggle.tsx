import { useEffect, useMemo, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useDarkModePreference } from "@/hooks/useDarkModePreference";
import { cn } from "@/lib/utils";

export const ThemeToggle = () => {
  const { darkMode, setDarkMode, loading } = useDarkModePreference();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const label = useMemo(() => (darkMode ? "Dark" : "Light"), [darkMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!open) return;
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="fixed right-3 top-3 z-[100] flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-white/90 text-slate-700 shadow-lg backdrop-blur transition hover:scale-105 active:scale-95 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-100",
        )}
        aria-label="Open theme toggle"
      >
        {darkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </button>

      <div
        className={cn(
          "origin-top-right rounded-2xl border border-border/70 bg-white/95 p-3 shadow-xl backdrop-blur transition-all duration-200 dark:border-slate-700 dark:bg-slate-900/90",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        )}
      >
        <div className="flex items-center gap-3">
          <Sun className={cn("h-4 w-4 text-amber-500 transition-transform", darkMode && "scale-90 opacity-70")} />
          <Switch
            checked={darkMode}
            onCheckedChange={(value) => {
              if (loading) return;
              void setDarkMode(value);
            }}
            disabled={loading}
            aria-label="Toggle dark mode"
          />
          <Moon className={cn("h-4 w-4 text-indigo-500 transition-transform", !darkMode && "scale-90 opacity-70")} />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-200">{label}</span>
        </div>
      </div>
    </div>
  );
};
