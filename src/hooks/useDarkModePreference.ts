import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useDarkModePreference() {
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  // Fetch preference from Supabase
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("user_preferences")
      .select("dark_mode")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setDarkMode(!!data?.dark_mode);
        setLoading(false);
      });
  }, [user]);

  // Update preference in Supabase
  const updateDarkMode = useCallback(
    async (value: boolean) => {
      if (!user) return;
      setDarkMode(value);
      await supabase
        .from("user_preferences")
        .upsert({ user_id: user.id, dark_mode: value }, { onConflict: "user_id" });
    },
    [user]
  );

  return { darkMode, setDarkMode: updateDarkMode, loading };
}
