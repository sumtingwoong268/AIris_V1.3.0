import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyTheme, resolveInitialTheme, ThemePreference } from "@/hooks/useThemePreference";

const fetchThemePreference = async (userId: string): Promise<ThemePreference | null> => {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("theme")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("Failed to fetch theme preference:", error.message);
    return null;
  }

  if (data && (data.theme === "dark" || data.theme === "light")) {
    return data.theme;
  }

  return null;
};

export const ThemeManager = () => {
  useEffect(() => {
    let active = true;

    const applyStoredTheme = (fallback?: ThemePreference | null) => {
      const themeToApply = fallback ?? resolveInitialTheme();
      applyTheme(themeToApply);
    };

    const syncTheme = async (userId: string | null) => {
      if (!active) return;

      if (!userId) {
        applyStoredTheme();
        return;
      }

      const preference = await fetchThemePreference(userId);
      if (!active) return;

      if (preference) {
        applyTheme(preference);
      } else {
        applyStoredTheme();
      }
    };

    applyStoredTheme();

    const initialize = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await syncTheme(user?.id ?? null);
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncTheme(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return null;
};
