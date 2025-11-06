import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase } from "./integrations/supabase/client";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

ensureInitialTheme()
  .catch((error) => {
    console.error("Failed to initialise theme:", error);
  })
  .finally(() => {
    createRoot(document.getElementById("root")!).render(<App />);
  });
