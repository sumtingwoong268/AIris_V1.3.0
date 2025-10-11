import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useXP } from "@/hooks/useXP";
import { XPBar } from "@/components/XPBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Grid3x3, Type, BookOpen, Flame, Users, FileText, User, TrendingUp, Award, Target, Lightbulb, Calendar, CheckCircle } from "lucide-react";
import logo from "@/assets/logo.png";

const DAILY_TIPS = [
  "💡 Follow the 20-20-20 rule: Every 20 minutes, look at something 20 feet away for 20 seconds.",
  "🥕 Eat foods rich in Vitamin A like carrots, sweet potatoes, and spinach for better eye health.",
  "💧 Stay hydrated! Drinking water helps maintain moisture in your eyes and prevents dryness.",
  "☀️ Wear UV-protective sunglasses when outdoors to shield your eyes from harmful rays.",
  "🛌 Get 7-8 hours of sleep. Your eyes need rest to repair and recover from daily strain.",
  "📱 Reduce screen time before bed to improve sleep quality and reduce eye fatigue.",
  "🧘 Practice eye exercises daily: palming, focus shifts, and figure-8 movements.",
  "💻 Position your screen 20-26 inches away and slightly below eye level for comfort.",
  "🌟 Blink frequently! Blinking keeps your eyes moist and prevents irritation.",
  "🏥 Schedule annual eye exams even if you don't notice vision problems.",
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { xp } = useXP(user?.id);
  const [profile, setProfile] = useState<any>(null);
  const [testStats, setTestStats] = useState<any>(null);
  const [friendsLeaderboard, setFriendsLeaderboard] = useState<any[]>([]);
  const [dailyTip, setDailyTip] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(data);
      };
      fetchProfile();
      fetchTestStats();
      fetchFriendsLeaderboard();
    }
  }, [user]);

  useEffect(() => {
    // Set daily tip based on day of year
    const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    setDailyTip(DAILY_TIPS[dayOfYear % DAILY_TIPS.length]);
  }, []);

  const fetchTestStats = async () => {
    if (!user) return;
    
    const { data: results } = await supabase
      .from("test_results")
      .select("test_type, score, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (results) {
      const stats = {
        totalTests: results.length,
        thisWeek: results.filter(r => {
          const testDate = new Date(r.created_at);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return testDate >= weekAgo;
        }).length,
        avgScore: results.length > 0 
          ? Math.round(results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length)
          : 0,
        byType: {
          ishihara: results.filter(r => r.test_type === 'ishihara').length,
          acuity: results.filter(r => r.test_type === 'acuity').length,
          amsler: results.filter(r => r.test_type === 'amsler').length,
          reading_stress: results.filter(r => r.test_type === 'reading_stress').length,
        }
      };
      setTestStats(stats);
    }
  };

  const fetchFriendsLeaderboard = async () => {
    if (!user) return;

    // Get user's friends
    const { data: friendships } = await supabase
      .from("friendships")
      .select("friend_id")
      .eq("user_id", user.id);

    if (friendships && friendships.length > 0) {
      const friendIds = friendships.map(f => f.friend_id);
      
      // Get friend profiles
      const { data: friends } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, current_streak, xp")
        .in("id", friendIds)
        .order("current_streak", { ascending: false })
        .limit(5);

      if (friends) {
        setFriendsLeaderboard(friends);
      }
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const tests = [
    {
      title: "Ishihara Color Test",
      description: "Test for color vision deficiencies",
      icon: Eye,
      xp: "30 XP",
      path: "/tests/ishihara",
      gradient: "from-red-400 to-pink-500",
    },
    {
      title: "Visual Acuity Test",
      description: "Measure your visual sharpness",
      icon: Type,
      xp: "25 XP",
      path: "/tests/visual-acuity",
      gradient: "from-blue-400 to-blue-600",
    },
    {
      title: "Amsler Grid Test",
      description: "Check for visual distortions",
      icon: Grid3x3,
      xp: "20 XP",
      path: "/tests/amsler",
      gradient: "from-green-400 to-emerald-500",
    },
    {
      title: "Reading Stress Test",
      description: "Evaluate reading comfort",
      icon: BookOpen,
      xp: "15 XP",
      path: "/tests/reading-stress",
      gradient: "from-purple-400 to-violet-500",
    },
  ];

  const level = Math.floor(xp / 100) + 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary-lighter/10 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => navigate("/dashboard")}
          >
            <img src={logo} alt="AIris" className="h-14 group-hover:scale-105 transition-transform" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                AIris
              </span>
              <span className="text-xs text-muted-foreground -mt-1">
                the future of eyecare
              </span>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate("/friends")}>
              <Users className="mr-2 h-4 w-4" />
              Friends
            </Button>
            <Button variant="ghost" onClick={() => navigate("/reports")}>
              <FileText className="mr-2 h-4 w-4" />
              Reports
            </Button>
            <Button variant="ghost" onClick={() => navigate("/profile")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground">
                Welcome back, {profile?.display_name || "User"}!
              </h1>
              <p className="mt-2 text-lg text-muted-foreground">
                Ready to keep your eyes healthy?
              </p>
            </div>
            <div className="flex items-center gap-4 rounded-2xl bg-gradient-primary p-6 text-white shadow-elevated">
              <Flame className="h-8 w-8" />
              <div>
                <p className="text-sm font-medium opacity-90">Week Streak</p>
                <p className="text-3xl font-bold">{profile?.current_streak || 0}</p>
              </div>
            </div>
          </div>

          {/* Daily Tip Card */}
          {dailyTip && (
            <Card className="shadow-card border-l-4 border-l-primary bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Lightbulb className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-primary mb-1">Daily Eye Care Tip</p>
                    <p className="text-sm text-foreground">{dailyTip}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-card">
            <CardContent className="p-6">
              <XPBar xp={xp} />
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                    <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Tests</p>
                    <p className="text-2xl font-bold">{testStats?.totalTests || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                    <Calendar className="h-5 w-5 text-green-600 dark:text-green-300" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">This Week</p>
                    <p className="text-2xl font-bold">{testStats?.thisWeek || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                    <Target className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Score</p>
                    <p className="text-2xl font-bold">{testStats?.avgScore || 0}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                    <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-300" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Level</p>
                    <p className="text-2xl font-bold">{level}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tests Grid */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Available Tests</h2>
            <p className="mt-1 text-muted-foreground">
              Complete tests to earn XP and track your vision health
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {tests.map((test) => (
              <Card
                key={test.path}
                className="group cursor-pointer transition-all hover:shadow-elevated hover:-translate-y-1"
                onClick={() => navigate(test.path)}
              >
                <CardHeader className="space-y-4">
                  <div
                    className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${test.gradient} text-white shadow-lg`}
                  >
                    <test.icon className="h-7 w-7" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{test.title}</CardTitle>
                    <CardDescription className="mt-1">{test.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-primary">{test.xp}</span>
                    <Button size="sm" className="group-hover:bg-primary group-hover:text-primary-foreground">
                      Start Test
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Additional Info Tabs */}
        {friendsLeaderboard.length > 0 && (
          <div className="mt-8">
            <Tabs defaultValue="leaderboard" className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="leaderboard">
                  <Award className="h-4 w-4 mr-2" />
                  Friends Leaderboard
                </TabsTrigger>
                <TabsTrigger value="stats">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Test Breakdown
                </TabsTrigger>
              </TabsList>

              <TabsContent value="leaderboard" className="mt-4">
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-yellow-500" />
                      Top Friends by Streak
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {friendsLeaderboard.map((friend, index) => (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-sm ${
                              index === 0
                                ? "bg-yellow-500 text-white"
                                : index === 1
                                ? "bg-gray-300 text-gray-700"
                                : index === 2
                                ? "bg-orange-400 text-white"
                                : "bg-muted"
                            }`}
                          >
                            {index + 1}
                          </div>
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
                              Level {Math.floor((friend.xp || 0) / 100) + 1}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-orange-500">
                          <Flame className="h-5 w-5" />
                          <span className="font-bold text-lg">{friend.current_streak}</span>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      className="w-full mt-4"
                      onClick={() => navigate("/friends")}
                    >
                      View All Friends
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="stats" className="mt-4">
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Tests by Type
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {testStats && (
                      <>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950">
                          <div className="flex items-center gap-3">
                            <Eye className="h-5 w-5 text-red-600" />
                            <span className="font-medium">Ishihara Color</span>
                          </div>
                          <span className="text-2xl font-bold text-red-600">
                            {testStats.byType?.ishihara || 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
                          <div className="flex items-center gap-3">
                            <Type className="h-5 w-5 text-blue-600" />
                            <span className="font-medium">Visual Acuity</span>
                          </div>
                          <span className="text-2xl font-bold text-blue-600">
                            {testStats.byType?.acuity || 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950">
                          <div className="flex items-center gap-3">
                            <Grid3x3 className="h-5 w-5 text-green-600" />
                            <span className="font-medium">Amsler Grid</span>
                          </div>
                          <span className="text-2xl font-bold text-green-600">
                            {testStats.byType?.amsler || 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 dark:bg-purple-950">
                          <div className="flex items-center gap-3">
                            <BookOpen className="h-5 w-5 text-purple-600" />
                            <span className="font-medium">Reading Stress</span>
                          </div>
                          <span className="text-2xl font-bold text-purple-600">
                            {testStats.byType?.reading_stress || 0}
                          </span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
