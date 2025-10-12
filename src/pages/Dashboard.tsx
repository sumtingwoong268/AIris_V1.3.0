import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useXP } from "@/hooks/useXP";
import { XPBar } from "@/components/XPBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Grid3x3, Type, BookOpen, Flame, Users, FileText, User, Award } from "lucide-react";
import logo from "@/assets/logo.png";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { xp } = useXP(user?.id);
  const [profile, setProfile] = useState<any>(null);

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
        {/* Welcome Section */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
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

          <Card className="shadow-card">
            <CardContent className="p-6">
              <XPBar xp={xp} />
            </CardContent>
          </Card>
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
      </main>
    </div>
  );
}
