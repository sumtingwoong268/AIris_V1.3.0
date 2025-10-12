import { useEffect, useState } from "react";
// Eye health tips for daily rotation
const EYE_TIPS = [
  "Follow the 20-20-20 rule: Every 20 minutes, look at something 20 feet away for 20 seconds.",
  "Blink often to keep your eyes moist, especially when using screens.",
  "Eat foods rich in vitamin A, C, E, and omega-3 for healthy eyes.",
  "Adjust your screen brightness and contrast to reduce eye strain.",
  "Wear sunglasses outdoors to protect your eyes from UV rays.",
  "Keep your prescription up to date for glasses or contacts.",
  "Get regular eye exams, even if you have no symptoms.",
  "Practice good sleep hygiene for optimal eye health.",
  "Keep your workspace well-lit to avoid squinting.",
  "Stay hydrated to help prevent dry eyes."
];
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useXP } from "@/hooks/useXP";
import { XPBar } from "@/components/XPBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Grid3x3, Type, BookOpen, Flame, Users, FileText, User, Award, Sparkles } from "lucide-react";
import logo from "@/assets/logo.png";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { xp } = useXP(user?.id);
  const [profile, setProfile] = useState<any>(null);
  const [testStats, setTestStats] = useState<{ avgScore: number, testsCompleted: number }>({ avgScore: 0, testsCompleted: 0 });
  // Fetch test stats
  useEffect(() => {
    if (user) {
      const fetchStats = async () => {
        const { data } = await supabase
          .from("test_results")
          .select("score")
          .eq("user_id", user.id);
        if (data && data.length > 0) {
          const scores = data.map((r: any) => r.score || 0);
          const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
          setTestStats({ avgScore: Math.round(avgScore), testsCompleted: scores.length });
        }
      };
      fetchStats();
    }
  }, [user]);

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
    }
  }, [user]);

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

  // Pick a daily tip based on the date
  const todayIdx = new Date().getDate() % EYE_TIPS.length;
  const dailyTip = EYE_TIPS[todayIdx];

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
            <Button variant="ghost" onClick={() => navigate("/statistics")}> 
              <Award className="mr-2 h-4 w-4" />
              Statistics
            </Button>
            <Button variant="ghost" onClick={() => navigate("/profile")}> 
              <User className="mr-2 h-4 w-4" />
              Profile
            </Button>
          </nav>
        </div>
      </header>


      <main className="container mx-auto px-4 py-8">
        {/* Dashboard Top: Welcome, Daily Tip, Stats */}
        <div className="mb-8 grid gap-6 md:grid-cols-3">
          {/* Welcome */}
          <Card className="shadow-card md:col-span-2 bg-gradient-to-br from-primary/10 to-blue-100">
            <CardContent className="p-6 flex flex-col h-full justify-between">
              <div>
                <h1 className="text-4xl font-bold text-foreground mb-2">
                  Welcome back, {profile?.display_name || "User"}!
                </h1>
                <p className="text-lg text-muted-foreground mb-2">
                  Ready to keep your eyes healthy?
                </p>
              </div>
              <div className="flex flex-wrap gap-4 mt-4">
                <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-300 to-orange-400 rounded-xl px-4 py-2 text-white shadow">
                  <Flame className="h-6 w-6" />
                  <span className="font-semibold">Streak:</span>
                  <span className="text-lg font-bold">{profile?.current_streak || 0} weeks</span>
                </div>
                <div className="flex items-center gap-2 bg-gradient-to-r from-blue-400 to-blue-600 rounded-xl px-4 py-2 text-white shadow">
                  <Award className="h-6 w-6" />
                  <span className="font-semibold">Level:</span>
                  <span className="text-lg font-bold">{level}</span>
                </div>
                <div className="flex items-center gap-2 bg-gradient-to-r from-green-400 to-emerald-500 rounded-xl px-4 py-2 text-white shadow">
                  <Eye className="h-6 w-6" />
                  <span className="font-semibold">Avg. Score:</span>
                  <span className="text-lg font-bold">{testStats.avgScore || 0}%</span>
                </div>
                <div className="flex items-center gap-2 bg-gradient-to-r from-purple-400 to-violet-500 rounded-xl px-4 py-2 text-white shadow">
                  <BookOpen className="h-6 w-6" />
                  <span className="font-semibold">Tests:</span>
                  <span className="text-lg font-bold">{testStats.testsCompleted}</span>
                </div>
                <div className="flex items-center gap-2 bg-gradient-to-r from-pink-400 to-red-500 rounded-xl px-4 py-2 text-white shadow">
                  <Users className="h-6 w-6" />
                  <span className="font-semibold">XP:</span>
                  <span className="text-lg font-bold">{xp}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Daily Eye Tip */}
          <Card className="shadow-card bg-gradient-to-br from-amber-100 to-yellow-50 flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-amber-700 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" /> Daily Eye Tip
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-md text-amber-900 italic">{dailyTip}</p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card className="shadow-card mb-8">
          <CardContent className="p-6">
            <XPBar xp={xp} />
          </CardContent>
        </Card>

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
      </main>
    </div>
  );
}
