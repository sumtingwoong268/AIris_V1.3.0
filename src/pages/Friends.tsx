import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Flame, Trophy, UserPlus, Check, X, Users } from "lucide-react";
import { PremiumHeader } from "@/components/ui/PremiumHeader";
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
  const [allUsers, setAllUsers] = useState<any[]>([]);
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
  const formatUsername = (value: string) => (value.startsWith("@") ? value : `@${value}`);

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
      fetchAllUsers();
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

  const fetchAllUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url, current_streak, xp")
      .order("current_streak", { ascending: false })
      .order("xp", { ascending: false })
      .order("display_name", { ascending: true })
      .order("username", { ascending: true });

    if (error) {
      console.error("fetchAllUsers error:", error);
      setAllUsers([]);
      return;
    }

    setAllUsers(data ?? []);
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

      const { data: existing } = await supabase
        .from("friendships")
        .select("id")
        .eq("user_id", user.id)
        .eq("friend_id", targetUser.id)
        .single();

      if (existing) {
        throw new Error("Already friends with this user");
      }

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
      await supabase.from("friendships").insert([
        { user_id: user.id, friend_id: senderId },
        { user_id: senderId, friend_id: user.id },
      ]);

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Floating Header Pattern to match other pages */}
      <PremiumHeader title="AIris Community" backRoute="/dashboard" />

      <main className="container mx-auto max-w-5xl space-y-8 px-4 pt-24 md:pt-28 pb-20 animate-slide-in-right md:animate-none mt-[env(safe-area-inset-top)]">
        <div className="rounded-[2rem] md:rounded-[2.5rem] border border-white/20 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-6 md:p-10 shadow-2xl text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
          <div className="relative z-10">
            <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl mb-3">Friends & Leaderboard</h1>
            <p className="text-indigo-100 max-w-2xl text-lg font-medium leading-relaxed">
              Celebrate your streaks, connect with friends, and send requests to keep one another accountable.
            </p>
          </div>
        </div>

        {selfProfile && (
          <div className="flex flex-col gap-5 rounded-[2rem] border border-white/60 bg-white/70 p-6 shadow-xl shadow-indigo-500/5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/40 sm:flex-row sm:items-center sm:justify-between transition-all hover:bg-white/90">
            <div className="flex items-center gap-4">
              {selfProfile.avatar_url ? (
                <img
                  src={selfProfile.avatar_url}
                  alt={selfProfile.display_name || selfProfile.username}
                  className="h-16 w-16 rounded-2xl object-cover shadow-md"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-2xl text-white shadow-md">
                  {(selfProfile.display_name?.[0] ?? selfProfile.username[1] ?? "?").toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-[0.2em] font-bold text-slate-400 mb-1">Your Profile</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{selfProfile.username}</p>
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300">You</Badge>
                </div>

                {selfStreakStatus && (
                  <div className="mt-2 flex items-center gap-3 text-sm font-medium">
                    <div className="flex items-center gap-1.5 text-orange-500 bg-orange-50 px-2.5 py-1 rounded-lg dark:bg-orange-950/30">
                      <Flame className="h-4 w-4 fill-orange-500" />
                      <span>{selfStreakStatus.effectiveStreak} week streak</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto rounded-xl border-slate-200 hover:bg-slate-50 hover:text-indigo-600 dark:border-slate-800 dark:hover:bg-slate-900"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(selfProfile.username);
                  toast({ title: "Username copied", description: "Share it with a friend to connect." });
                } catch (error) {
                  // ...
                }
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy username
            </Button>
          </div>
        )}

        <Tabs defaultValue="leaderboard" className="space-y-8">
          <TabsList className="bg-slate-100/80 p-1 w-full grid grid-cols-3 gap-1 rounded-2xl dark:bg-slate-800/50 h-auto">
            <TabsTrigger
              value="leaderboard"
              className="rounded-xl px-2 py-2.5 font-medium data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-indigo-400 whitespace-nowrap overflow-hidden text-ellipsis"
            >
              Leaderboard
            </TabsTrigger>
            <TabsTrigger
              value="friends"
              className="rounded-xl px-2 py-2.5 font-medium data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-indigo-400 whitespace-nowrap overflow-hidden text-ellipsis"
            >
              My Friends ({friends.length})
            </TabsTrigger>
            <TabsTrigger
              value="requests"
              className="rounded-xl px-2 py-2.5 font-medium data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-indigo-400 whitespace-nowrap overflow-hidden text-ellipsis"
            >
              Requests {pendingRequests.length > 0 && <span className="ml-1.5 bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full text-[10px]">{pendingRequests.length}</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leaderboard" className="space-y-4">
            <Tabs defaultValue="weekly" className="space-y-6">
              <TabsList className="inline-flex h-auto p-1 bg-slate-100 rounded-xl dark:bg-slate-800/50">
                <TabsTrigger
                  className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all shadow-none"
                  value="weekly"
                >
                  Weekly Streak Leaders
                </TabsTrigger>

              </TabsList>

              <TabsContent value="weekly" className="space-y-4">
                <Card className="glass-card border-none shadow-none bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Trophy className="h-6 w-6 text-yellow-400" />
                      Weekly Streak Leaders
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {leaderboard.map((profile, index) => (
                      <div
                        key={profile.id}
                        className={`group flex items-center justify-between rounded-2xl border p-4 transition-all hover:-translate-y-1 hover:shadow-lg ${index === 0 ? "bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/20" :
                          index === 1 ? "bg-gradient-to-r from-slate-400/10 to-slate-500/10 border-slate-400/20" :
                            index === 2 ? "bg-gradient-to-r from-orange-400/10 to-orange-500/10 border-orange-400/20" :
                              "bg-white/40 border-white/40 hover:bg-white/60 dark:bg-slate-800/40 dark:border-white/5"
                          }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-lg shadow-sm ${index === 0 ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white" :
                            index === 1 ? "bg-gradient-to-br from-slate-300 to-slate-400 text-white" :
                              index === 2 ? "bg-gradient-to-br from-orange-300 to-orange-400 text-white" :
                                "bg-white text-muted-foreground dark:bg-slate-700 dark:text-slate-300"
                            }`}>
                            {index + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-base text-foreground">
                                {profile.display_name || profile.username}
                              </p>
                              {(index < 3) && <Trophy className={`h-3 w-3 ${index === 0 ? "text-yellow-500" :
                                index === 1 ? "text-slate-400" :
                                  "text-orange-400"
                                }`} />}
                            </div>
                            <p className="text-xs text-muted-foreground font-medium">
                              {formatUsername(profile.username)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1.5 text-orange-500 bg-orange-500/10 px-2 py-1 rounded-lg">
                            <Flame className="h-4 w-4 fill-orange-500" />
                            <span className="text-sm font-bold">{profile.current_streak}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-1 font-medium">
                            Level {Math.floor((profile.xp || 0) / 100) + 1}
                          </span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* <TabsContent value="all-users" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      All Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {allUsers.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-muted py-8 text-center text-muted-foreground">
                        No users found yet.
                      </p>
                    ) : (
                      allUsers.map((profile) => (
                        <div
                          key={profile.id}
                          className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-slate-900/60"
                        >
                          <div className="flex items-center gap-3">
                            {profile.avatar_url ? (
                              <img
                                src={profile.avatar_url}
                                alt={profile.display_name || profile.username}
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary font-bold text-white">
                                {(profile.display_name?.[0] || profile.username?.[1] || "?").toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-slate-100">
                                {profile.display_name || profile.username}
                              </p>
                              <p className="text-sm text-muted-foreground">{profile.username}</p>
                              <p className="text-sm text-muted-foreground">
                                Level {Math.floor((profile.xp || 0) / 100) + 1} • Streak: {profile.current_streak} weeks
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-primary">
                            <Flame className="h-5 w-5" />
                            <span className="font-semibold">{profile.current_streak}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent> */}


            </Tabs>
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
            {/* Friends List */}
            <Card className="glass-card border-none shadow-none bg-transparent">
              <CardHeader>
                <CardTitle>My Friends ({friends.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {friends.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-muted p-10 text-center text-muted-foreground bg-white/30 dark:bg-slate-900/30">
                    <UserPlus className="h-10 w-10 opacity-20 mb-4" />
                    <p>You haven't added any friends yet. Send a friend request above!</p>
                  </div>
                ) : (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="group flex items-center justify-between rounded-2xl border border-white/40 bg-white/60 p-4 shadow-sm transition-all hover:bg-white/80 hover:shadow-md dark:border-white/10 dark:bg-slate-800/40 dark:hover:bg-slate-800/60"
                    >
                      <div className="flex items-center gap-3">
                        {friend.avatar_url ? (
                          <img
                            src={friend.avatar_url}
                            alt={friend.display_name || friend.username}
                            className="h-12 w-12 rounded-full object-cover ring-2 ring-white/50"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 font-bold text-white shadow-sm">
                            {(friend.display_name?.[0] || friend.username?.[1] || "?").toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-foreground">
                            {friend.display_name || friend.username}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatUsername(friend.username)}</p>
                          <Badge variant="secondary" className="mt-1 h-5 text-[10px] px-1.5 bg-primary/10 text-primary hover:bg-primary/20">
                            Level {Math.floor((friend.xp || 0) / 100) + 1}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 text-orange-500 bg-orange-500/10 px-2 py-1 rounded-lg">
                          <Flame className="h-4 w-4 fill-orange-500" />
                          <span className="text-sm font-bold">{friend.current_streak}</span>
                        </div>
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
