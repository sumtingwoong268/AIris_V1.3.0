import { supabase } from "@/integrations/supabase/client";

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const MS_IN_WEEK = MS_IN_DAY * 7;
const ISO_WEEK_REGEX = /^(\d{4})-W(\d{2})$/;
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const getWeekStartUTC = (date: Date): Date => {
  const utcYear = date.getUTCFullYear();
  const utcMonth = date.getUTCMonth();
  const utcDate = date.getUTCDate();
  const utcDay = date.getUTCDay(); // Sunday = 0, Monday = 1
  const diffToMonday = (utcDay + 6) % 7;
  const start = new Date(Date.UTC(utcYear, utcMonth, utcDate));
  start.setUTCDate(start.getUTCDate() - diffToMonday);
  start.setUTCHours(0, 0, 0, 0);
  return start;
};

const getIsoWeekStart = (week: number, year: number): Date => {
  const fourthJan = new Date(Date.UTC(year, 0, 4));
  const weekOneStart = getWeekStartUTC(fourthJan);
  const start = new Date(weekOneStart);
  start.setUTCDate(weekOneStart.getUTCDate() + (week - 1) * 7);
  return start;
};

export const getWeekKey = (date: Date): string => {
  const start = getWeekStartUTC(date);
  return start.toISOString().slice(0, 10);
};

export const parseWeekKey = (key?: string | null): Date | null => {
  if (!key) return null;
  if (DATE_KEY_REGEX.test(key)) {
    return new Date(`${key}T00:00:00Z`);
  }
  const isoMatch = key.match(ISO_WEEK_REGEX);
  if (isoMatch) {
    const [, yearStr, weekStr] = isoMatch;
    const week = Number.parseInt(weekStr, 10);
    const year = Number.parseInt(yearStr, 10);
    if (Number.isFinite(week) && Number.isFinite(year) && week > 0 && week <= 53) {
      return getIsoWeekStart(week, year);
    }
  }
  return null;
};

export const normalizeWeekKey = (key?: string | null): { normalized: string | null; changed: boolean } => {
  if (!key) {
    return { normalized: null, changed: false };
  }
  if (DATE_KEY_REGEX.test(key)) {
    return { normalized: key, changed: false };
  }
  const parsed = parseWeekKey(key);
  if (!parsed) {
    return { normalized: null, changed: key !== null };
  }
  return { normalized: getWeekKey(parsed), changed: true };
};

export const getCurrentWeekKey = (): string => getWeekKey(new Date());

export const getCurrentWeekStart = (): Date => getWeekStartUTC(new Date());

export const getWeekEndUTC = (weekStart: Date): Date => {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
};

export const getCountdownParts = (ms: number) => {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
};

export const formatCountdownParts = (parts: ReturnType<typeof getCountdownParts>) => {
  const segments = [
    parts.days > 0 ? `${parts.days}d` : null,
    `${String(parts.hours).padStart(2, "0")}h`,
    `${String(parts.minutes).padStart(2, "0")}m`,
    `${String(parts.seconds).padStart(2, "0")}s`,
  ].filter(Boolean);
  return segments.join(" ");
};

const getWeekDifference = (later: Date, earlier: Date): number =>
  Math.floor((later.getTime() - earlier.getTime()) / MS_IN_WEEK);

type ProfileLike = {
  current_streak?: number | null;
  last_active_week?: string | null;
};

export type StreakStatus = {
  effectiveStreak: number;
  shouldReset: boolean;
  lastActiveWeekKey: string | null;
  isActiveThisWeek: boolean;
  currentWeekKey: string;
  nextDeadline: Date;
  msUntilDeadline: number;
  needsNormalization: boolean;
};

export const computeStreakStatus = (profile: ProfileLike): StreakStatus => {
  const currentWeekStart = getCurrentWeekStart();
  const currentWeekKey = getWeekKey(currentWeekStart);
  const { normalized, changed } = normalizeWeekKey(profile.last_active_week ?? null);
  const lastActiveWeekKey = normalized;
  const lastActiveDate = parseWeekKey(lastActiveWeekKey);
  const nextDeadline = getWeekEndUTC(currentWeekStart);
  const msUntilDeadline = Math.max(0, nextDeadline.getTime() - Date.now());

  let shouldReset = false;
  let isActiveThisWeek = false;

  if (lastActiveDate) {
    const diffWeeks = getWeekDifference(currentWeekStart, lastActiveDate);
    if (diffWeeks === 0) {
      isActiveThisWeek = true;
    } else if (diffWeeks >= 2) {
      shouldReset = (profile.current_streak ?? 0) !== 0;
    }
  } else if ((profile.current_streak ?? 0) !== 0) {
    shouldReset = true;
  }

  const effectiveStreak = shouldReset ? 0 : profile.current_streak ?? 0;

  return {
    effectiveStreak,
    shouldReset,
    lastActiveWeekKey,
    isActiveThisWeek,
    currentWeekKey,
    nextDeadline,
    msUntilDeadline,
    needsNormalization: changed,
  };
};

export const syncProfileStreak = async <T extends ProfileLike>(
  profile: T,
  userId: string,
): Promise<{ profile: T; status: StreakStatus }> => {
  const status = computeStreakStatus(profile);
  const updates: Record<string, unknown> = {};

  if (status.shouldReset) {
    updates.current_streak = 0;
  }
  if (status.needsNormalization) {
    updates.last_active_week = status.lastActiveWeekKey;
  }

  if (Object.keys(updates).length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const refreshedProfile = data as T;
    const refreshedStatus = computeStreakStatus(refreshedProfile);
    return { profile: refreshedProfile, status: refreshedStatus };
  }

  return { profile, status };
};

export const recordTestCompletionStreak = async (userId: string) => {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("last_active_week, current_streak")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  const currentWeekKey = getCurrentWeekKey();
  const parsedLast = parseWeekKey(profile?.last_active_week ?? null);
  const currentWeekStart = getCurrentWeekStart();

  let newStreak = profile?.current_streak ?? 0;
  let shouldUpdate = false;

  if (!parsedLast) {
    newStreak = 1;
    shouldUpdate = true;
  } else {
    const lastWeekKey = getWeekKey(parsedLast);
    if (lastWeekKey === currentWeekKey) {
      return;
    }
    const diffWeeks = getWeekDifference(currentWeekStart, parsedLast);
    if (diffWeeks === 1) {
      newStreak = Math.max(profile?.current_streak ?? 0, 0) + 1;
      shouldUpdate = true;
    } else if (diffWeeks >= 2) {
      newStreak = 1;
      shouldUpdate = true;
    }
  }

  if (!shouldUpdate) {
    return;
  }

  await supabase
    .from("profiles")
    .update({
      current_streak: newStreak,
      last_active_week: currentWeekKey,
    })
    .eq("id", userId);
};
