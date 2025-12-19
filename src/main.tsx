import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase, supabaseConfigError } from "./integrations/supabase/client";

const STORAGE_KEY = "airis-theme";

const ensureInitialTheme = async () => {
  const applyTheme = (value: boolean) => {
    document.documentElement.classList.toggle("dark", value);
    window.localStorage.setItem(STORAGE_KEY, value ? "dark" : "light");
  };

  const localStored = window.localStorage.getItem(STORAGE_KEY);
  if (localStored) {
    applyTheme(localStored === "dark");
  } else {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    applyTheme(prefersDark);
  }

  if (supabaseConfigError) {
    console.error(supabaseConfigError);
    return;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("Failed to load user for theme preference:", userError);
    return;
  }

  if (!user) return;

  const { data, error } = await supabase
    .from("user_preferences")
    .select("dark_mode")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Failed to load dark mode preference:", error);
    return;
  }

  if (data?.dark_mode !== undefined) {
    applyTheme(!!data.dark_mode);
  }
};

const initApp = async () => {
  try {
    // Add a race condition to ensure we don't hang for more than 2 seconds if Supabase is slow
    await Promise.race([
      ensureInitialTheme(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Theme initialization timeout")), 2000))
    ]);
  } catch (error) {
    console.warn("Startup notice:", error);
  } finally {
    createRoot(document.getElementById("root")!).render(<App />);
  }
};

initApp();
