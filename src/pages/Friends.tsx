import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Flame, Trophy } from "lucide-react";
import logo from "@/assets/logo.png";

export default function Friends() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [friends, setFriends] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchLeaderboard();
    }
  }, [user]);

  const fetchFriends = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("friendships")
      .select(`
        friend_id,
        profiles!friendships_friend_id_fkey(id, display_name, avatar_url, current_streak)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary-lighter/10 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={logo} alt="AIris" className="h-10" />
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold">Friends & Leaderboard</h1>

        <Tabs defaultValue="leaderboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="friends">My Friends</TabsTrigger>
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
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>My Friends ({friends.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {friends.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    You haven't added any friends yet. Check the leaderboard to connect!
                  </p>
                ) : (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-semibold">{friend.display_name || "User"}</p>
                        <p className="text-sm text-muted-foreground">
                          Streak: {friend.current_streak} weeks
                        </p>
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
