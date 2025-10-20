import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useXP } from "@/hooks/useXP";
import { XPBar } from "@/components/XPBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import {
  Eye,
  Grid3x3,
  Type,
  BookOpen,
  Users,
  FileText,
  User,
  Award,
  Sparkles,
  PlayCircle,
  LineChart as LineChartIcon,
  Settings2,
} from "lucide-react";
import logo from "@/assets/logo.png";

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
  "Stay hydrated to help prevent dry eyes.",
];

const TEST_LABELS: Record<string, string> = {
  ishihara: "Ishihara Color Test",
  visual_acuity: "Visual Acuity Test",
  acuity: "Visual Acuity Test",
  amsler: "Amsler Grid Test",
  reading_stress: "Reading Stress Test",
};

const TEST_ICONS: Record<string, typeof Eye> = {
  ishihara: Eye,
  visual_acuity: Type,
  acuity: Type,
  amsler: Grid3x3,
  reading_stress: BookOpen,
};

const TEST_GRADIENTS: Record<string, string> = {
  ishihara: "from-rose-500 to-orange-500",
  visual_acuity: "from-blue-500 to-cyan-500",
  acuity: "from-blue-500 to-cyan-500",
  amsler: "from-emerald-500 to-teal-500",
  reading_stress: "from-purple-500 to-fuchsia-500",
};

const HIGHLIGHT_GRADIENTS = [
  "from-rose-500/90 via-orange-400/90 to-amber-400/90",
  "from-emerald-500/90 via-teal-400/90 to-lime-400/90",
  "from-sky-500/90 via-indigo-400/90 to-blue-500/90",
  "from-fuchsia-500/90 via-purple-500/90 to-blue-500/90",
] as const;

type DashboardTestResult = {
  score: number | null;
  test_type: string | null;
  xp_earned: number | null;
  created_at: string | null;
};

const formatTestLabel = (type: string | null) => {
  if (!type) {
    return "Vision Check";
  }
  if (TEST_LABELS[type]) {
    return TEST_LABELS[type];
  }
  return type
    .split(/[_-]/g)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const isStaff = user?.user_metadata?.role === "staff";
  const { xp } = useXP(user?.id);
  const [profile, setProfile] = useState<any>(null);
  const [testStats, setTestStats] = useState<{ avgScore: number, testsCompleted: number }>({ avgScore: 0, testsCompleted: 0 });
  const [recentTests, setRecentTests] = useState<DashboardTestResult[]>([]);
  const [performanceData, setPerformanceData] = useState<{ date: string; score: number; test: string }[]>([]);
  const [testTypeStats, setTestTypeStats] = useState<
    Array<{ key: string; label: string; average: number; best: number; attempts: number; recent: number }>
  >([]);

  // Fetch test stats
  useEffect(() => {
    if (user) {
      const fetchStats = async () => {
        const { data, error } = await supabase
          .from("test_results")
          .select("score, test_type, xp_earned, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Failed to load test results", error);
          setTestStats({ avgScore: 0, testsCompleted: 0 });
          setRecentTests([]);
          setPerformanceData([]);
          setTestTypeStats([]);
          return;
        }

        const results: DashboardTestResult[] = (data || []).map((item) => ({
          score: item.score ?? 0,
          test_type: item.test_type ?? "other",
          xp_earned: item.xp_earned ?? 0,
          created_at: item.created_at ?? null,
        }));

        if (results.length === 0) {
          setTestStats({ avgScore: 0, testsCompleted: 0 });
          setRecentTests([]);
          setPerformanceData([]);
          setTestTypeStats([]);
          return;
        }

        const scores = results.map((item) => item.score ?? 0);
        const avgScore = scores.reduce((sum, value) => sum + value, 0) / results.length;
        setTestStats({ avgScore: Math.round(avgScore), testsCompleted: results.length });

        const sortedByDate = [...results].sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return aTime - bTime;
        });

        setRecentTests([...sortedByDate].slice(-6).reverse());

        setPerformanceData(
          sortedByDate.slice(-10).map((entry) => {
            const date = entry.created_at ? new Date(entry.created_at) : null;
            return {
              date: date && !Number.isNaN(date.getTime()) ? format(date, "MMM d") : "-",
              score: entry.score ?? 0,
              test: formatTestLabel(entry.test_type),
            };
          }),
        );

        const grouped = sortedByDate.reduce<Record<string, DashboardTestResult[]>>((acc, entry) => {
          const key = entry.test_type ?? "other";
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(entry);
          return acc;
        }, {});

        const summaries = Object.entries(grouped).map(([key, entries]) => {
          const entryScores = entries.map((item) => item.score ?? 0);
          const average =
            entryScores.length > 0
              ? Number((entryScores.reduce((sum, value) => sum + value, 0) / entryScores.length).toFixed(1))
              : 0;
          const best = entryScores.length > 0 ? Math.max(...entryScores) : 0;
          const recent = entries[entries.length - 1]?.score ?? 0;
          return {
            key,
            label: formatTestLabel(key),
            average,
            best,
            attempts: entries.length,
            recent,
          };
        });

        setTestTypeStats(summaries.sort((a, b) => b.attempts - a.attempts));
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
  const topCategory = testTypeStats[0];
  const latestPerformanceScore =
    performanceData.length > 0
      ? performanceData[performanceData.length - 1].score
      : testStats.avgScore;

  const highlightStats = [
    {
      label: "Average Score",
      value: testStats.avgScore ? `${testStats.avgScore}%` : "-",
      subLabel: "Across all completed tests",
    },
    {
      label: "Tests Completed",
      value: testStats.testsCompleted,
      subLabel: "Lifetime progress",
    },
    {
      label: "Current Streak",
      value: `${profile?.current_streak || 0} weeks`,
      subLabel: "Consistent check-ins",
    },
    {
      label: "Top Performing Test",
      value: topCategory ? topCategory.label : "-",
      subLabel: topCategory ? `Best score ${topCategory.best}%` : "Complete a test to unlock insights",
    },
  ];

  const quickActions = [
    {
      label: "Start a Test",
      icon: PlayCircle,
      action: () => navigate(tests[0].path),
    },
    {
      label: "View Reports",
      icon: FileText,
      action: () => navigate("/reports"),
    },
    {
      label: "See Statistics",
      icon: LineChartIcon,
      action: () => navigate("/statistics"),
    },
    {
      label: "Read Eye Care Blogs",
      icon: BookOpen,
      action: () => navigate("/blogs"),
    },
    ...(isStaff
      ? [
          {
            label: "Manage Blog Posts",
            icon: Settings2,
            action: () => navigate("/blogs/manage"),
          },
        ]
      : []),
    {
      label: "Invite Friends",
      icon: Users,
      action: () => navigate("/friends"),
    },
    {
      label: "Edit Profile",
      icon: User,
      action: () => navigate("/profile"),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex items-center justify-between px-4 py-4 lg:px-6">
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => navigate("/dashboard")}
          >
            <img src={logo} alt="AIris" className="h-12 transition-transform duration-300 group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                AIris
              </span>
              <span className="text-xs -mt-1 text-muted-foreground">
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
            <Button variant="ghost" onClick={() => navigate("/blogs")}>
              <BookOpen className="mr-2 h-4 w-4" />
              Blogs
            </Button>
            {isStaff && (
              <Button variant="ghost" onClick={() => navigate("/blogs/manage")}>
                <Settings2 className="mr-2 h-4 w-4" />
                Manage
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate("/profile")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </Button>
          </nav>
        </div>
      </header>


      <main className="container mx-auto space-y-10 px-4 py-10 lg:px-6">
        {/* Tests Highlight */}
        <section className="relative overflow-hidden rounded-[32px] border border-primary/15 bg-gradient-to-br from-primary/10 via-sky-100 to-indigo-100 p-6 shadow-xl dark:from-slate-900 dark:via-primary/15 dark:to-indigo-950 lg:p-10">
          <span className="pointer-events-none absolute -top-12 left-8 h-32 w-32 rounded-full bg-white/50 blur-3xl dark:bg-primary/30" />
          <span className="pointer-events-none absolute -bottom-16 right-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl dark:bg-indigo-500/30" />
          <div className="relative z-10 space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25rem] text-primary/80 dark:text-primary/70">
                  Explore & grow
                </p>
                <h2 className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-50 sm:text-4xl">
                  Jump back into your vision journey
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-700 dark:text-slate-200">
                  Start with a quick assessment and keep your streak alive. Each test is crafted to monitor a different
                  part of your eyesight.
                </p>
              </div>
              <Button
                size="lg"
                className="h-11 rounded-full bg-gradient-to-r from-primary to-blue-600 px-6 text-primary-foreground shadow-lg hover:from-blue-600 hover:to-primary"
                onClick={() => navigate(tests[0].path)}
              >
                Start With Ishihara
              </Button>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {tests.map((test) => (
                <Card
                  key={test.path}
                  className="group relative overflow-hidden border-none bg-white/80 transition-all duration-500 ease-out hover:-translate-y-2 hover:shadow-2xl dark:bg-slate-900/70"
                  onClick={() => navigate(test.path)}
                >
                  <span
                    className={`absolute inset-x-6 top-6 h-24 rounded-3xl bg-gradient-to-br ${test.gradient} opacity-80 blur-2xl transition-opacity group-hover:opacity-100`}
                  />
                  <CardHeader className="relative flex flex-col gap-6 pt-6">
                    <div
                      className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${test.gradient} text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}
                    >
                      <test.icon className="h-8 w-8" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-slate-900 dark:text-slate-50">{test.title}</CardTitle>
                      <CardDescription className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        {test.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="relative flex items-center justify-between pb-6 pt-0">
                    <span className="text-sm font-semibold text-primary">{test.xp}</span>
                    <Button
                      size="sm"
                      className="rounded-full bg-slate-900 px-4 text-white shadow-sm transition-colors group-hover:bg-primary dark:bg-primary"
                    >
                      Launch Test
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* XP Progress */}
        <section className="relative overflow-hidden rounded-[28px] border border-primary/15 bg-gradient-to-br from-white via-slate-50 to-primary/10 p-6 shadow-xl dark:from-slate-900 dark:via-slate-900/70 dark:to-primary/10 lg:p-10">
          <span className="pointer-events-none absolute -left-10 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl dark:bg-primary/30" />
          <span className="pointer-events-none absolute -right-12 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full bg-blue-200/60 blur-3xl dark:bg-blue-500/30" />
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 text-slate-700 dark:text-slate-200">
              <p className="text-sm font-semibold uppercase tracking-[0.3rem] text-primary dark:text-primary/80">
                XP progress
              </p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                Level up by completing your next assessment
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Every session keeps your streak alive and unlocks new milestones.
              </p>
            </div>
            <div className="w-full sm:max-w-xl lg:max-w-2xl">
              <XPBar xp={xp} />
            </div>
          </div>
        </section>

        {/* Welcome + Quick Focus */}
        <section className="grid gap-6 xl:grid-cols-[1.8fr,1fr]">
          <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary via-indigo-600 to-fuchsia-600 text-white shadow-2xl">
            <span className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/25 blur-3xl" />
            <CardContent className="relative z-10 grid gap-8 p-8 lg:grid-cols-[1.4fr,1fr] lg:p-10">
              <div className="flex flex-col justify-between gap-6">
                <div className="space-y-2">
                  <p className="text-sm uppercase tracking-[0.35rem] text-white/70">Personalized vision insights</p>
                  <h1 className="text-4xl font-bold leading-tight lg:text-5xl">
                    Welcome back, {profile?.display_name || profile?.username || "Explorer"}!
                  </h1>
                  {profile?.username && (
                    <p className="text-sm font-medium text-white/75">{profile.username}</p>
                  )}
                  <p className="max-w-xl text-base text-white/80">
                    Keep the momentum going—stay on top of your vision health with guided tests, insights, and goals tailored just for you.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/15 p-4 text-center shadow-lg backdrop-blur">
                    <span className="text-xs uppercase tracking-wide text-white/70">Current level</span>
                    <div className="mt-2 text-3xl font-semibold">{level}</div>
                    <p className="text-xs text-white/70">Total XP {xp}</p>
                  </div>
                  <div className="rounded-2xl bg-white/15 p-4 text-center shadow-lg backdrop-blur">
                    <span className="text-xs uppercase tracking-wide text-white/70">Latest score</span>
                    <div className="mt-2 text-3xl font-semibold">{latestPerformanceScore}%</div>
                    <p className="text-xs text-white/70">Most recent session</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {highlightStats.map((item, index) => (
                  <div
                    key={item.label}
                    className={`rounded-3xl bg-gradient-to-br ${HIGHLIGHT_GRADIENTS[index % HIGHLIGHT_GRADIENTS.length]} p-4 text-white shadow-lg transition-transform hover:-translate-y-1`}
                  >
                    <p className="text-xs uppercase tracking-wide text-white/85">{item.label}</p>
                    <div className="mt-3 text-xl font-semibold">{item.value}</div>
                    <p className="text-xs text-white/80">{item.subLabel}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-6">
            <Card className="border border-primary/15 bg-gradient-to-br from-amber-100 via-rose-100 to-primary/10 shadow-xl hover:shadow-2xl dark:from-slate-900 dark:via-slate-900/70 dark:to-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Daily Eye Tip
                </CardTitle>
                <CardDescription>Refresh your habits to ease fatigue and protect long-term vision.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="rounded-2xl bg-white/80 p-4 text-sm leading-relaxed text-primary shadow-inner dark:bg-slate-900/60">
                  {dailyTip}
                </p>
              </CardContent>
            </Card>
            <Card className="h-full border border-primary/15 bg-gradient-to-br from-white via-mint-100 to-emerald-100 shadow-xl hover:shadow-2xl dark:from-slate-900 dark:via-slate-900/70 dark:to-emerald-900/30">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
                <CardDescription>Jump into what matters most right now.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {quickActions.map(({ label, icon: Icon, action }) => (
                  <Button
                    key={label}
                    variant="outline"
                    className="h-12 justify-between rounded-xl border-white/60 bg-white/80 text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-gradient-to-r hover:from-primary hover:to-blue-500 hover:text-white dark:border-white/20 dark:bg-slate-900/70 dark:text-slate-100"
                    onClick={action}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-primary dark:text-emerald-300" />
                      {label}
                    </span>
                    <span className="text-xs text-muted-foreground">Go</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Performance & Focus */}
        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card className="border border-primary/15 bg-gradient-to-br from-white via-slate-50 to-sky-100 shadow-xl hover:shadow-2xl dark:from-slate-900 dark:via-slate-900/70 dark:to-sky-900/30">
            <CardHeader>
              <CardTitle>Performance Trend</CardTitle>
              <CardDescription>Your last few test scores at a glance.</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {performanceData.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-muted p-8 text-center text-sm text-muted-foreground">
                  Complete a test to start building your performance timeline.
                </div>
              ) : (
                <ChartContainer
                  config={{
                    score: {
                      label: "Score",
                      theme: {
                        light: "hsl(210 90% 50%)",
                        dark: "hsl(198 100% 78%)",
                      },
                    },
                  }}
                  className="aspect-auto h-80 rounded-[24px] bg-white/85 p-3 shadow-inner dark:bg-slate-900/60 md:h-96"
                >
                  <AreaChart data={performanceData}>
                    <CartesianGrid strokeDasharray="4 8" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      stroke="currentColor"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={12}
                      className="text-xs text-muted-foreground"
                    />
                    <YAxis
                      stroke="currentColor"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      domain={[0, 100]}
                      className="text-xs text-muted-foreground"
                    />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Area
                      dataKey="score"
                      type="monotone"
                      stroke="var(--color-score)"
                      fill="var(--color-score)"
                      fillOpacity={0.3}
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
          <Card className="border border-primary/15 bg-gradient-to-br from-white via-lavender-100 to-fuchsia-100 shadow-xl hover:shadow-2xl dark:from-slate-900 dark:via-slate-900/70 dark:to-fuchsia-900/30">
            <CardHeader>
              <CardTitle>Focus Areas</CardTitle>
              <CardDescription>Where you shine and where to practice next.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {testTypeStats.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-muted p-6 text-center text-sm text-muted-foreground">
                  You&apos;ll see personalized guidance once you complete a few tests.
                </div>
              ) : (
                testTypeStats.slice(0, 4).map((stat) => {
                  const gradient = TEST_GRADIENTS[stat.key] ?? "from-primary to-blue-500";
                  return (
                    <div
                      key={stat.key}
                      className="space-y-3 rounded-2xl border border-white/50 bg-white/80 p-4 shadow-md backdrop-blur dark:border-white/10 dark:bg-slate-900/70"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{stat.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {stat.attempts} {stat.attempts === 1 ? "session" : "sessions"} tracked • Best {stat.best}%
                          </p>
                        </div>
                        <span
                          className={`rounded-full bg-gradient-to-r ${gradient} px-3 py-1 text-xs font-semibold text-white shadow`}
                        >
                          Avg {stat.average}%
                        </span>
                      </div>
                    <div className="h-2 w-full rounded-full bg-muted/50 dark:bg-slate-800">
                      <div
                          className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
                        style={{ width: `${Math.min(stat.average, 100)}%` }}
                      />
                    </div>
                  </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </section>

        {/* Recent Activity */}
        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border border-primary/10 bg-gradient-to-br from-white via-slate-50 to-slate-100 shadow-lg hover:shadow-xl dark:from-slate-900 dark:via-slate-900/80 dark:to-slate-900">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest check-ins and earned XP.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentTests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-muted p-8 text-center text-sm text-muted-foreground">
                  When you complete tests they will appear here with detailed results.
                </div>
              ) : (
                recentTests.map((test, index) => {
                  const Icon = TEST_ICONS[test.test_type ?? ""] ?? Sparkles;
                  const iconGradient = TEST_GRADIENTS[test.test_type ?? ""] ?? "from-slate-500 to-slate-700";
                  const date = test.created_at ? new Date(test.created_at) : null;
                  const formattedDate =
                    date && !Number.isNaN(date.getTime()) ? format(date, "MMM d, yyyy • h:mm a") : "Recent session";
                  const scoreValue = test.score ?? 0;
                  const scoreClass =
                    scoreValue >= 70 ? "text-green-600" : scoreValue >= 40 ? "text-yellow-600" : "text-red-600";
                  return (
                    <div
                      key={`${test.created_at}-${index}`}
                      className="flex items-center justify-between rounded-2xl border border-border/30 bg-white/70 px-4 py-3 shadow-sm backdrop-blur dark:bg-slate-900/70"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${iconGradient} text-white shadow`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{formatTestLabel(test.test_type)}</p>
                          <p className="text-xs text-muted-foreground">{formattedDate}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${scoreClass}`}>
                          {scoreValue}%
                        </p>
                        <p className="text-xs text-muted-foreground">+{test.xp_earned ?? 0} XP</p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
          <Card className="border border-primary/10 bg-gradient-to-br from-slate-100 via-white to-primary/10 shadow-lg hover:shadow-xl dark:from-slate-900 dark:via-slate-900/80 dark:to-primary/10">
            <CardHeader>
              <CardTitle>Next on Your Radar</CardTitle>
              <CardDescription>Suggested steps based on your latest progress.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-amber-200/80 via-orange-200/80 to-rose-200/80 p-4 text-slate-800 shadow-sm backdrop-blur dark:from-amber-500/30 dark:via-orange-500/30 dark:to-rose-500/30 dark:text-slate-100">
                <p className="text-sm font-semibold text-foreground">Stay on your streak</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aim for at least one check-in every week to keep your momentum.
                </p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-sky-200/80 via-blue-200/80 to-indigo-200/80 p-4 text-slate-800 shadow-sm backdrop-blur dark:from-sky-500/30 dark:via-blue-500/30 dark:to-indigo-500/30 dark:text-slate-100">
                <p className="text-sm font-semibold text-foreground">Compare test types</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Alternate between color, acuity, and reading tests for balanced insights.
                </p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-emerald-200/80 via-mint-200/80 to-teal-200/80 p-4 text-slate-800 shadow-sm backdrop-blur dark:from-emerald-500/30 dark:via-teal-500/30 dark:to-green-500/30 dark:text-slate-100">
                <p className="text-sm font-semibold text-foreground">Review your reports</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Download a detailed report before your next optometrist appointment.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
