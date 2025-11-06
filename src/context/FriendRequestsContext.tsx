import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type FriendRequestContextValue = {
  pendingCount: number;
  refreshPending: () => Promise<void>;
  loading: boolean;
};

const FriendRequestContext = createContext<FriendRequestContextValue | undefined>(undefined);

export const FriendRequestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refreshPending = useCallback(async () => {
    if (!user?.id) {
      setPendingCount(0);
      setLoading(false);
      return;
    }

    try {
      const { count, error } = await supabase
        .from("friend_requests")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("status", "pending");

      if (error) throw error;
      setPendingCount(count ?? 0);
    } catch (error) {
      console.error("Failed to load pending friend requests:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    void refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`friend-requests-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          void refreshPending();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void refreshPending();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshPending]);

  const value = useMemo(
    () => ({
      pendingCount,
      refreshPending,
      loading,
    }),
    [pendingCount, refreshPending, loading],
  );

  return <FriendRequestContext.Provider value={value}>{children}</FriendRequestContext.Provider>;
};

export const useFriendRequests = () => {
  const context = useContext(FriendRequestContext);
  if (!context) {
    throw new Error("useFriendRequests must be used within a FriendRequestProvider");
  }
  return context;
};
