import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase } from "./integrations/supabase/client";

// Apply dark mode from database before app renders
(async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data } = await supabase
      .from("user_preferences")
      .select("dark_mode")
      .eq("user_id", user.id)
      .single();
    
    if (data?.dark_mode) {
      document.documentElement.classList.add("dark");
    }
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
