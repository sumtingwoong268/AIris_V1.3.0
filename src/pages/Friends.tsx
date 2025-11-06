import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Flame, Trophy, UserPlus, Check, X } from "lucide-react";
import logo from "@/assets/logo.png";
import { sanitizeUsername } from "@/utils/username";
import { useFriendRequests } from "@/context/FriendRequestsContext";
import {
  computeStreakStatus,
  formatCountdownParts,
  getCountdownParts,
  syncProfileStreak,
  type StreakStatus,
} from "@/utils/streak";

export default function Friends() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { refreshPending, pendingRequests, loading: pendingLoading } = useFriendRequests();
  const [friends, setFriends] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [usernameInput, setUsernameInput] = useState("");
  const [selfProfile, setSelfProfile] = useState<{
    display_name: string | null;
    username: string;
    avatar_url: string | null;
    current_streak?: number | null;
  } | null>(null);
  const [addingFriend, setAddingFriend] = useState(false);
  const [selfStreakStatus, setSelfStreakStatus] = useState<StreakStatus | null>(null);
  const [selfCountdown, setSelfCountdown] = useState<string>("");
  const hasRefetchedSelfOnExpiry = useRef(false);

  const fetchSelfProfile = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, username, avatar_url, current_streak, last_active_week")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Failed to load self profile:", error);
      return;
    }
    if (data) {
      try {
        const { profile: syncedProfile, status } = await syncProfileStreak(data, user.id);
        setSelfProfile({
          display_name: syncedProfile.display_name ?? null,
          username: syncedProfile.username,
          avatar_url: syncedProfile.avatar_url ?? null,
          current_streak: syncedProfile.current_streak ?? 0,
        });
        setSelfStreakStatus(status);
      } catch (syncError) {
        console.error("Failed to sync streak status:", syncError);
        setSelfProfile({
          display_name: data.display_name ?? null,
          username: data.username,
          avatar_url: data.avatar_url ?? null,
          current_streak: data.current_streak ?? 0,
        });
        setSelfStreakStatus(computeStreakStatus(data));
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchLeaderboard();
      void refreshPending();
      void fetchSelfProfile();
    }
  }, [user, refreshPending, fetchSelfProfile]);

  useEffect(() => {
    if (!selfStreakStatus) {
      setSelfCountdown("");
      return;
    }
    hasRefetchedSelfOnExpiry.current = false;
    const deadlineMs = selfStreakStatus.nextDeadline.getTime();
    const updateCountdown = () => {
      const ms = deadlineMs - Date.now();
      setSelfCountdown(formatCountdownParts(getCountdownParts(ms)));
      if (ms <= 0 && !hasRefetchedSelfOnExpiry.current) {
        hasRefetchedSelfOnExpiry.current = true;
        void fetchSelfProfile();
      }
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [selfStreakStatus, fetchSelfProfile]);

  const fetchFriends = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("friendships")
      .select("friend_id")
      .eq("user_id", user.id);

    if (error) {
      console.error("fetchFriends error:", error);
      setFriends([]);
      return;
    }

    const rows = data ?? [];
    if (rows.length === 0) {
      setFriends([]);
      return;
    }

    const friendIds = Array.from(new Set(rows.map((row) => row.friend_id).filter(Boolean)));
    if (friendIds.length === 0) {
      setFriends([]);
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url, current_streak, xp")
      .in("id", friendIds);

    if (profilesError) {
      console.error("fetchFriend profiles error:", profilesError);
      setFriends([]);
      return;
    }

    // Preserve original order based on friendships query
    const profileMap = new Map((profilesData ?? []).map((profile) => [profile.id, profile]));
    const ordered = friendIds
      .map((id) => profileMap.get(id))
      .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));

    setFriends(ordered);
  };

  const fetchLeaderboard = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url, current_streak, xp")
      .order("current_streak", { ascending: false })
      .limit(10);

    if (data) {
      setLeaderboard(data);
    }
  };

  const handleAddFriend = async () => {
    if (!user || !usernameInput.trim()) return;

    setAddingFriend(true);
    try {
      const sanitizedUsername = sanitizeUsername(usernameInput);
      if (!sanitizedUsername) {
        throw new Error("Enter a valid username (start with @, max 20 characters)");
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error("Session expired. Please sign in again.");
      }

      const lookupResponse = await fetch("/api/lookup-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ username: sanitizedUsername }),
      });

      const lookupRaw = await lookupResponse.text();
      let lookupData: any = null;
      if (lookupRaw) {
        try {
          lookupData = JSON.parse(lookupRaw);
        } catch {
          lookupData = null;
        }
      }
      if (!lookupResponse.ok) {
        const message =
          lookupData?.error || lookupData?.message || lookupRaw || "No user found with that username";
        throw new Error(message);
      }

      const targetUser = lookupData?.profile as { id: string; display_name: string | null; username: string } | undefined;
      if (!targetUser?.id) {
        throw new Error("User profile data was not returned");
      }

      // Check if already friends
      const { data: existing } = await supabase
        .from("friendships")
        .select("id")
        .eq("user_id", user.id)
        .eq("friend_id", targetUser.id)
        .single();

      if (existing) {
        throw new Error("Already friends with this user");
      }

      // Check if request already exists
      const { data: existingRequest } = await supabase
        .from("friend_requests")
        .select("id, status")
        .eq("sender_id", user.id)
        .eq("receiver_id", targetUser.id)
        .single();

      if (existingRequest) {
        throw new Error(`Friend request already ${existingRequest.status}`);
      }

      const { error: insertError } = await supabase
        .from("friend_requests")
        .insert({
          sender_id: user.id,
          receiver_id: targetUser.id,
          status: "pending",
        });

      if (insertError) throw insertError;

      toast({
        title: "Friend request sent!",
        description: `Request sent to ${targetUser.display_name ?? targetUser.username}`,
      });

      setUsernameInput("");
    } catch (error: any) {
      console.error("Add friend error:", error);
      toast({
        title: "Failed to send request",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAddingFriend(false);
    }
  };

  const handleAcceptRequest = async (requestId: string, senderId: string) => {
    if (!user) return;

    try {
      // Create mutual friendships
      await supabase.from("friendships").insert([
        { user_id: user.id, friend_id: senderId },
        { user_id: senderId, friend_id: user.id },
      ]);

      // Update request status
      await supabase
        .from("friend_requests")
        .update({ status: "accepted" })
        .eq("id", requestId);

      toast({ title: "Friend request accepted!" });
      
      fetchFriends();
      void refreshPending();
    } catch (error: any) {
      console.error("Accept request error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await supabase
        .from("friend_requests")
        .update({ status: "rejected" })
        .eq("id", requestId);

      toast({ title: "Friend request rejected" });
      void refreshPending();
    } catch (error: any) {
      console.error("Reject request error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="border-b border-border/40 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate("/dashboard")}
          >
            <img src={logo} alt="AIris" className="h-10" />
            <div className="flex flex-col">
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                AIris
              </span>
              <span className="text-[10px] text-muted-foreground -mt-1">
                the future of eyecare
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-8 px-4 py-10">
                    <div className="rounded-[28px] border border-primary/15 bg-gradient-to-br from-white via-slate-50 to-primary/10 p-6 shadow-xl dark:from-slate-900 dark:via-slate-900/70 dark:to-primary/10">
                      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">Friends & Leaderboard</h1>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        Celebrate your streaks, connect with friends, and send requests to keep one another accountable.
                      </p>
                    </div>

                    {selfProfile && (
                      <div className="flex flex-col gap-3 rounded-3xl border border-white/60 bg-white/80 p-5 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          {selfProfile.avatar_url ? (
                            <img
                              src={selfProfile.avatar_url}
                              alt={selfProfile.display_name || selfProfile.username}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary font-semibold text-white">
                              {(selfProfile.display_name?.[0] ?? selfProfile.username[1] ?? "?").toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm uppercase tracking-[0.25rem] text-muted-foreground">Your username</p>
                            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selfProfile.username}</p>
                            <p className="text-xs text-muted-foreground">
                              Friends can add you by entering this handle.
                            </p>
                            {selfStreakStatus && (
                              <div className="mt-2 space-y-1 text-xs text-muted-foreground dark:text-slate-300/80">
                                <p>
                                  Weekly streak:{" "}
                                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                                    {selfStreakStatus.effectiveStreak} week
                                    {selfStreakStatus.effectiveStreak === 1 ? "" : "s"}
                                  </span>
                                </p>
                                <p>
                                  Resets in{" "}
                                  <span className="font-mono text-primary dark:text-blue-400">
                                    {selfCountdown || "00h 00m 00s"}
                                  </span>
                                </p>
                                {!selfStreakStatus.isActiveThisWeek && (
                                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                    No test logged yet this week—complete one to stay on track.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(selfProfile.username);
                              toast({ title: "Username copied", description: "Share it with a friend to connect." });
                            } catch (error) {
                              console.error("copy username error:", error);
                              toast({ title: "Copy failed", description: "Couldn't copy username to clipboard.", variant: "destructive" });
                            }
                          }}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copy username
                        </Button>
                      </div>
                    )}

        <Tabs defaultValue="leaderboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-white/60 p-1 shadow-inner backdrop-blur dark:bg-slate-900/60">
            <TabsTrigger className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-blue-500 data-[state=active]:text-white" value="leaderboard">
              Leaderboard
            </TabsTrigger>
            <TabsTrigger className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-blue-500 data-[state=active]:text-white" value="friends">
              My Friends ({friends.length})
            </TabsTrigger>
            <TabsTrigger className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-blue-500 data-[state=active]:text-white" value="requests">
              Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leaderboard" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-level" />
                  Weekly Streak Leaders
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {leaderboard.map((profile, index) => (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/70 p-4 transition-transform hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-slate-900/60"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                          index === 0
                            ? "bg-level text-white"
                            : index === 1
                            ? "bg-muted-foreground/20"
                            : index === 2
                            ? "bg-streak/20"
                            : "bg-muted"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {profile.display_name || profile.username}
                        </p>
                        <p className="text-sm text-muted-foreground">{profile.username}</p>
                        <p className="text-sm text-muted-foreground">Level {Math.floor(profile.xp / 100) + 1}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-streak">
                      <Flame className="h-5 w-5" />
                      <span className="text-lg font-bold">{profile.current_streak}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="friends" className="space-y-4">
            {/* Add Friend Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Add Friend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter friend's username (e.g. @visionhero)"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddFriend()}
                    maxLength={20}
                  />
                  <Button 
                    onClick={handleAddFriend} 
                    disabled={addingFriend || !usernameInput.trim()}
                  >
                    {addingFriend ? "Sending..." : "Send Request"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Usernames are 2-20 characters, begin with @, and can include letters, numbers, dots, underscores, and hyphens.
                </p>
              </CardContent>
            </Card>

            {/* Friends List */}
            <Card>
              <CardHeader>
                <CardTitle>My Friends ({friends.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {friends.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-muted py-8 text-center text-muted-foreground">
                    You haven't added any friends yet. Send a friend request above!
                  </p>
                ) : (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-slate-900/60"
                    >
                      <div className="flex items-center gap-3">
                        {friend.avatar_url ? (
                          <img
                            src={friend.avatar_url}
                            alt={friend.display_name || friend.username}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary font-bold text-white">
                            {(friend.display_name?.[0] || friend.username?.[1] || "?").toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {friend.display_name || friend.username}
                          </p>
                          <p className="text-sm text-muted-foreground">{friend.username}</p>
                          <p className="text-sm text-muted-foreground">
                            Level {Math.floor((friend.xp || 0) / 100) + 1} • Streak: {friend.current_streak} weeks
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-streak">
                        <Flame className="h-5 w-5" />
                        <span className="font-bold">{friend.current_streak}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Friend Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingLoading ? (
                  <p className="rounded-2xl border border-dashed border-muted py-8 text-center text-muted-foreground">
                    Loading pending requests…
                  </p>
                ) : pendingRequests.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-muted py-8 text-center text-muted-foreground">
                    No pending friend requests
                  </p>
                ) : (
                  pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/60"
                    >
                      <div className="flex items-center gap-3">
                        {request.sender?.avatar_url ? (
                          <img
                            src={request.sender.avatar_url}
                            alt={request.sender.display_name || request.sender?.username}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary font-bold text-white">
                            {(
                              request.sender?.display_name?.[0] ??
                              request.sender?.username?.[1] ??
                              "?"
                            ).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold">
                            {request.sender?.display_name || request.sender?.username}
                          </p>
                          <p className="text-xs text-muted-foreground">{request.sender?.username}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAcceptRequest(request.id, request.sender_id)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectRequest(request.id)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
