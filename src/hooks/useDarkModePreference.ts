import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "airis-theme";

const readLocalPreference = () => {
  if (typeof window === "undefined") return undefined;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
};

const writeLocalPreference = (value: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, value ? "dark" : "light");
};

export function useDarkModePreference() {
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState<boolean>(readLocalPreference() ?? false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === undefined) return;

    let cancelled = false;

    const apply = (value: boolean) => {
      if (cancelled) return;
      setDarkMode(value);
      setLoading(false);
    };

    if (!user) {
      apply(readLocalPreference() ?? false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    supabase
      .from("user_preferences")
      .select("dark_mode")
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error && error.code !== "PGRST116") {
          console.error("Failed to load dark mode preference:", error);
        }
        apply(!!data?.dark_mode);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load dark mode preference:", error);
          apply(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", darkMode);
    writeLocalPreference(darkMode);
  }, [darkMode]);

  const updateDarkMode = useCallback(
    async (value: boolean) => {
      setDarkMode(value);
      if (!user) {
        writeLocalPreference(value);
        return;
      }
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: user.id, dark_mode: value }, { onConflict: "user_id" });
      if (error) {
        console.error("Failed to update dark mode preference:", error);
      }
    },
    [user],
  );

  return { darkMode, setDarkMode: updateDarkMode, loading };
}
