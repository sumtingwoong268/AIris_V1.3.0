import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useXP(userId: string | undefined) {
  const [xp, setXp] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchXP = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("xp")
      .eq("id", userId)
      .single();

    if (data && !error) {
      setXp(data.xp);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Fetch initial XP
    fetchXP();

    // Subscribe to realtime XP updates
    const channel = supabase
      .channel(`xp-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new && 'xp' in payload.new) {
            setXp(payload.new.xp as number);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchXP]);

  return { xp, loading, refetch: fetchXP };
}
