import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Flame, Trophy, UserPlus, Check, X } from "lucide-react";
import logo from "@/assets/logo.png";

export default function Friends() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [friends, setFriends] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);

  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchLeaderboard();
      fetchRequests();
    }
  }, [user]);

  const fetchFriends = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("friendships")
      .select(`
        friend_id,
        profiles!friendships_friend_id_fkey(id, display_name, avatar_url, current_streak, xp)
      `)
      .eq("user_id", user.id);

    if (data) {
      setFriends(data.map(f => f.profiles).filter(Boolean));
    }
  };

  const fetchLeaderboard = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, current_streak, xp")
      .order("current_streak", { ascending: false })
      .limit(10);

    if (data) {
      setLeaderboard(data);
    }
  };

  const fetchRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("friend_requests")
      .select(`
        id,
        sender_id,
        created_at,
        profiles!friend_requests_sender_id_fkey(id, display_name, avatar_url)
      `)
      .eq("receiver_id", user.id)
      .eq("status", "pending");

    if (data) {
      setRequests(data);
    }
  };

  const handleAddFriend = async () => {
    if (!user || !emailInput.trim()) return;
    
    setAddingFriend(true);
    try {
      // Get user's email first
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser?.email) {
        throw new Error("Could not retrieve your email");
      }

      // Check if trying to add self
      if (emailInput.toLowerCase() === authUser.email.toLowerCase()) {
        throw new Error("You cannot add yourself as a friend");
      }

      // Find user by email - query auth.users via profiles
      const { data: targetProfile, error: searchError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .limit(1)
        .single();

      // Since we can't directly query by email from profiles, we'll use RPC or a workaround
      // For now, let's search all profiles and match on the client (not ideal but functional)
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, display_name");

      // In production, you'd want to add an email field to profiles or use an RPC function
      // For now, show a message
      if (!allProfiles || allProfiles.length === 0) {
        throw new Error("User not found with that email");
      }

      // Temporary: Let users enter display name instead for demo
      const targetUser = allProfiles.find(p => 
        p.display_name?.toLowerCase() === emailInput.toLowerCase()
      );

      if (!targetUser) {
        throw new Error(`User not found. Try entering their display name instead of email.`);
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

      // Create friend request
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
        description: `Request sent to ${targetUser.display_name}`,
      });
      
      setEmailInput("");
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
      fetchRequests();
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
      fetchRequests();
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
    <div className="min-h-screen bg-gradient-to-br from-background via-primary-lighter/10 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm">
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

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold">Friends & Leaderboard</h1>

        <Tabs defaultValue="leaderboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="friends">
              My Friends ({friends.length})
            </TabsTrigger>
            <TabsTrigger value="requests">
              Requests {requests.length > 0 && `(${requests.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leaderboard" className="space-y-4">
            <Card className="shadow-card">
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
                    className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
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
                        <p className="font-semibold">{profile.display_name || "User"}</p>
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
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Add Friend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter display name (email search coming soon)"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddFriend()}
                  />
                  <Button 
                    onClick={handleAddFriend} 
                    disabled={addingFriend || !emailInput.trim()}
                  >
                    {addingFriend ? "Sending..." : "Send Request"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Tip: For now, enter the exact display name of the person you want to add
                </p>
              </CardContent>
            </Card>

            {/* Friends List */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>My Friends ({friends.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {friends.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    You haven't added any friends yet. Send a friend request above!
                  </p>
                ) : (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {friend.avatar_url ? (
                          <img
                            src={friend.avatar_url}
                            alt={friend.display_name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold">
                            {friend.display_name?.[0]?.toUpperCase() || "?"}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold">{friend.display_name || "User"}</p>
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
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Friend Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {requests.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No pending friend requests
                  </p>
                ) : (
                  requests.map((request: any) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-3">
                        {request.profiles?.avatar_url ? (
                          <img
                            src={request.profiles.avatar_url}
                            alt={request.profiles.display_name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold">
                            {request.profiles?.display_name?.[0]?.toUpperCase() || "?"}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold">
                            {request.profiles?.display_name || "User"}
                          </p>
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
