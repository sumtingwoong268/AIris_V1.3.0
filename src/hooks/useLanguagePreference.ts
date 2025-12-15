import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseConfigError } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "airis-language";
export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "bn", label: "Bengali" },
  { code: "pa", label: "Punjabi" },
  { code: "ta", label: "Tamil" },
  { code: "ko", label: "Korean" },
  { code: "ur", label: "Urdu" },
  { code: "ja", label: "Japanese" },
] as const;

const DEFAULT_LANGUAGE = "en";
const isSupported = (code: string | null | undefined) =>
  Boolean(code && SUPPORTED_LANGUAGES.some((lang) => lang.code === code));

const readLocalLanguage = () => {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isSupported(stored) ? (stored as string) : DEFAULT_LANGUAGE;
};

const writeLocalLanguage = (value: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, value);
};

export function useLanguagePreference() {
  const { user } = useAuth();
  const [language, setLanguage] = useState<string>(readLocalLanguage());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === undefined) return;

    let cancelled = false;

    const apply = (value: string) => {
      if (cancelled) return;
      const next = isSupported(value) ? value : DEFAULT_LANGUAGE;
      setLanguage(next);
      writeLocalLanguage(next);
      setLoading(false);
    };

    if (supabaseConfigError || !user) {
      apply(readLocalLanguage());
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    supabase
      .from("user_preferences")
      .select("language")
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error && error.code !== "PGRST116") {
          console.error("Failed to load language preference:", error);
        }
        apply(data?.language ?? readLocalLanguage());
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load language preference:", error);
          apply(readLocalLanguage());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const updateLanguage = useCallback(
    async (value: string) => {
      const next = isSupported(value) ? value : DEFAULT_LANGUAGE;
      setLanguage(next);
      writeLocalLanguage(next);

      if (!user || supabaseConfigError) return;

      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: user.id, language: next }, { onConflict: "user_id" });

      if (error) {
        console.error("Failed to update language preference:", error);
      }
    },
    [user],
  );

  return { language, setLanguage: updateLanguage, loading, supportedLanguages: SUPPORTED_LANGUAGES };
}
