import { format } from "date-fns";

export type AchievementCategory = "goals" | "progress" | "reflections";

export type AchievementMedia = {
  id: string;
  type: "image" | "video";
  url: string;
  name?: string;
};

export type AchievementEntry = {
  id: string;
  title: string;
  category: AchievementCategory;
  description: string;
  media: AchievementMedia[];
  createdAt: string;
};

const STORAGE_KEY = "airis_achievements";
const TAB_KEY = "airis_achievements_tab";

const SAMPLE_ENTRIES: AchievementEntry[] = [];

export const loadEntries = (): AchievementEntry[] => {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as AchievementEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to parse achievements from storage", error);
    return [];
  }
};

export const saveEntries = (entries: AchievementEntry[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
};

export const ensureSampleEntries = () => {
  if (typeof window === "undefined") return;
  const existing = loadEntries();
  if (existing.length === 0) {
    saveEntries(SAMPLE_ENTRIES);
  }
};

export const loadStoredTab = (): AchievementCategory | "all" => {
  if (typeof window === "undefined") return "all";
  const stored = window.localStorage.getItem(TAB_KEY) as AchievementCategory | "all" | null;
  return stored ?? "all";
};

export const saveStoredTab = (tab: AchievementCategory | "all") => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TAB_KEY, tab);
};

export const resetAchievements = () => {
  if (typeof window === "undefined") return;
  saveEntries(SAMPLE_ENTRIES);
};
