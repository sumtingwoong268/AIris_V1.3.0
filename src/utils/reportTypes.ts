export type GeminiVisualTheme = {
  accentColor?: string;
  trafficLight?: "green" | "yellow" | "red";
  urgency?: "no_action" | "routine_checkup" | "consult_soon" | "urgent";
  summary?: string;
};

export type GeminiStructuredSection = {
  title: string;
  blocks: string[];
};

export type GeminiStructuredReport = {
  visual_theme?: GeminiVisualTheme;
  sections: GeminiStructuredSection[];
  key_findings?: string[];
};
