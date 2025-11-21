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

const SAMPLE_ENTRIES: AchievementEntry[] = [
  {
    id: "sample-vision-goal",
    title: "Refine nighttime driving comfort",
    category: "goals",
    description:
      "Set a plan to improve nighttime clarity by practicing dark adaptation, keeping anti-glare coating clean, and logging any halos or flares after weekly drives.",
    media: [
      {
        id: "sample-image-1",
        type: "image",
        url: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nNTAwJyBoZWlnaHQ9JzI4MCcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJz48cmVjdCB3aWR0aD0nNTAwJyBoZWlnaHQ9JzI4MCcgZmlsbD0nI0VGRUY5Nycgcng9JzIwJy8+PGNpcmNsZSBjeD0nMTIwJyBjeT0nMTQwJyByPSc2MCcgZmlsbD0nI0Q2RURGRicvPjxyZWN0IHg9JzIwMCcgeT0nNjAnIHdpZHRoPScxOTAnIGhlaWdodD0nMTYwJyByeD0nMjQnIGZpbGw9JyM0RTk2RjYnIG9wYWNpdHk9JzAuOCcvPjx0ZXh0IHg9JzI1MCcgeT0nMTUwJyBmb250LXNpemU9JzI0JyB0ZXh0LWFuY2hvcj0nbWlkZGxlJyBmaWxsPScjMTMxNjFiJz5TYW1wbGUgR29hbDwvdGV4dD48L3N2Zz4=",
        name: "goal-placeholder.svg",
      },
    ],
    createdAt: format(new Date(), "yyyy-MM-dd"),
  },
  {
    id: "sample-progress",
    title: "Consistent weekly Ishihara practice",
    category: "progress",
    description:
      "Logged three consecutive weeks without missing color plates. Observing faster response times and clearer differentiation between similar hues.",
    media: [],
    createdAt: format(new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), "yyyy-MM-dd"),
  },
  {
    id: "sample-reflection",
    title: "Reflections after morning eye yoga",
    category: "reflections",
    description:
      "Morning palming and focus-shift exercises are reducing screen strain. Noticed fewer dry-eye episodes when pairing with humidifier.",
    media: [
      {
        id: "sample-video",
        type: "video",
        url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        name: "breathing-demo.mp4",
      },
    ],
    createdAt: format(new Date(Date.now() - 1000 * 60 * 60 * 24 * 25), "yyyy-MM-dd"),
  },
];

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
