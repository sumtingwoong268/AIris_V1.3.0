import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const ASCII_PATTERN = /^[\u0020-\u007E]+$/;

export const USERNAME_REGEX = /^@[a-z0-9_.-]{1,19}$/;
export const USERNAME_MAX_LENGTH = 20;

export const sanitizeUsername = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !ASCII_PATTERN.test(trimmed)) {
    return null;
  }
  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (!withoutAt) {
    return null;
  }

  if (withoutAt.length > USERNAME_MAX_LENGTH - 1) {
    return null;
  }
  const normalized = `@${withoutAt.toLowerCase()}`;
  if (!USERNAME_REGEX.test(normalized)) {
    return null;
  }
  return normalized;
};

export const usernameIsAvailable = async (
  supabase: SupabaseClient<Database>,
  username: string,
  excludeId?: string,
): Promise<boolean> => {
  const query = supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("username", username);

  if (excludeId) {
    query.neq("id", excludeId);
  }

  const { count, error } = await query;
  if (error) {
    throw error;
  }
  return (count ?? 0) === 0;
};
