import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type PendingRequest = {
  id: string;
  sender_id: string;
  status: string | null;
  created_at: string;
  sender: {
    id: string;
    display_name: string | null;
    username: string;
    avatar_url: string | null;
  } | null;
};

type FriendRequestContextValue = {
  pendingCount: number;
  refreshPending: () => Promise<void>;
  loading: boolean;
  pendingRequests: PendingRequest[];
};

const FriendRequestContext = createContext<FriendRequestContextValue | undefined>(undefined);

type FriendRequestProviderProps = {
  children: ReactNode;
};

export const FriendRequestProvider = ({ children }: FriendRequestProviderProps) => {
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshPending = useCallback(async () => {
    if (!user?.id) {
      setPendingRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: requestRows, error } = await supabase
        .from("friend_requests")
        .select("id, sender_id, status, created_at")
        .eq("receiver_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = requestRows ?? [];
      if (rows.length === 0) {
        setPendingRequests([]);
        return;
      }

      const senderIds = Array.from(new Set(rows.map((row) => row.sender_id)));
      const { data: senderProfiles, error: senderError } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", senderIds);

      if (senderError) throw senderError;

      const senderMap = new Map(
        (senderProfiles ?? []).map((profile) => [
          profile.id,
          {
            id: profile.id,
            display_name: profile.display_name ?? null,
            username: profile.username,
            avatar_url: profile.avatar_url ?? null,
          },
        ]),
      );

      const enhanced = rows.map((row) => ({
        ...row,
        sender: senderMap.get(row.sender_id) ?? null,
      }));

      setPendingRequests(enhanced);
    } catch (error) {
      console.error("Failed to load pending friend requests:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
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
      pendingCount: pendingRequests.length,
      pendingRequests,
      refreshPending,
      loading,
    }),
    [pendingRequests, refreshPending, loading],
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
