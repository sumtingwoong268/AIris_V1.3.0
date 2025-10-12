import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply dark mode from localStorage before app renders
const isDarkMode = localStorage.getItem("darkMode") === "true";
if (isDarkMode) {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(<App />);
