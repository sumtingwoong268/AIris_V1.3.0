import { useMemo } from "react";
import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useDarkModePreference } from "@/hooks/useDarkModePreference";
import { cn } from "@/lib/utils";

export const ThemeToggle = () => {
  const { darkMode, setDarkMode, loading } = useDarkModePreference();

  const label = useMemo(() => (darkMode ? "Dark" : "Light"), [darkMode]);

  return (
    <div
      className={cn(
        "fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full border border-border/70 bg-white/85 px-3 py-1.5 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/80",
      )}
    >
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
  );
};
