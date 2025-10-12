import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ThemePreference = "light" | "dark";

const THEME_STORAGE_KEY = "theme";
const LEGACY_DARK_MODE_KEY = "darkMode";

export const applyTheme = (theme: ThemePreference) => {
  if (typeof document === "undefined") return;

  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.localStorage.removeItem(LEGACY_DARK_MODE_KEY);
  }
};

const resolveInitialTheme = (): ThemePreference => {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "dark" || storedTheme === "light") {
    return storedTheme;
  }

  const legacyDarkMode = window.localStorage.getItem(LEGACY_DARK_MODE_KEY);
  if (legacyDarkMode === "true") {
    return "dark";
  }

  return "light";
};

export function useThemePreference(userId?: string | null) {
  const [theme, setTheme] = useState<ThemePreference>(resolveInitialTheme);
  const [loading, setLoading] = useState<boolean>(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let active = true;

    const fetchPreference = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("user_preferences")
        .select("theme")
        .eq("user_id", userId)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (error && error.code !== "PGRST116") {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data && (data.theme === "dark" || data.theme === "light")) {
        setTheme(data.theme);
      }

      setLoading(false);
    };

    fetchPreference();

    return () => {
      active = false;
    };
  }, [userId]);

  const updateTheme = async (nextTheme: ThemePreference) => {
    if (nextTheme === theme) {
      return;
    }

    const previousTheme = theme;

    setTheme(nextTheme);
    setError(null);

    if (!userId) {
      return;
    }

    const { error } = await supabase
      .from("user_preferences")
      .upsert(
        {
          user_id: userId,
          theme: nextTheme,
        },
        {
          onConflict: "user_id",
        },
      );

    if (error) {
      setTheme(previousTheme);
      setError(error.message);
      throw error;
    }
  };

  return {
    theme,
    loading,
    error,
    updateTheme,
  };
}
