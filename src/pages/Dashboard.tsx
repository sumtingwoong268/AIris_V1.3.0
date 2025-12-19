import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useXP } from "@/hooks/useXP";
import { XPBar } from "@/components/XPBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import { PremiumHeader } from "@/components/ui/PremiumHeader";
import { XPBanner } from "@/components/dashboard/XPBanner";
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
  Trophy,
} from "lucide-react";
import { Palette } from "lucide-react";

import { useFriendRequests } from "@/context/FriendRequestsContext";
import { formatCountdownParts, getCountdownParts, syncProfileStreak, type StreakStatus } from "@/utils/streak";

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
  d15: "Farnsworth D-15",
  d15_desaturated: "Farnsworth D-15 (Desaturated)",
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
  const { xp } = useXP(user?.id);
  const { pendingCount: pendingFriendRequests } = useFriendRequests();
  const [profile, setProfile] = useState<any>(null);
  const [testStats, setTestStats] = useState<{ avgScore: number, testsCompleted: number }>({ avgScore: 0, testsCompleted: 0 });
  const [recentTests, setRecentTests] = useState<DashboardTestResult[]>([]);
  const [performanceData, setPerformanceData] = useState<{ date: string; score: number; test: string }[]>([]);
  const [testTypeStats, setTestTypeStats] = useState<
    Array<{ key: string; label: string; average: number; best: number; attempts: number; recent: number }>
  >([]);
  const [streakStatus, setStreakStatus] = useState<StreakStatus | null>(null);
  const [countdown, setCountdown] = useState<string>("");
  const hasFetchedOnExpiry = useRef(false);

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

  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        throw error;
      }

      const { profile: syncedProfile, status } = await syncProfileStreak(data, user.id);
      setProfile(syncedProfile);
      setStreakStatus(status);
      hasFetchedOnExpiry.current = false;
    } catch (error) {
      console.error("Failed to load profile:", error);
    }
  }, [user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!streakStatus) {
      setCountdown("");
      return;
    }

    const deadlineMs = streakStatus.nextDeadline.getTime();
    const updateCountdown = () => {
      const ms = deadlineMs - Date.now();
      setCountdown(formatCountdownParts(getCountdownParts(ms)));
      if (ms <= 0 && !hasFetchedOnExpiry.current) {
        hasFetchedOnExpiry.current = true;
        void loadProfile();
      }
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [streakStatus, loadProfile]);

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
    {
      title: "Farnsworth D-15",
      description: "Arrange hue caps to screen colour vision",
      icon: Palette,
      xp: "35 XP",
      path: "/tests/d15",
      gradient: "from-amber-400 to-rose-500",
    },
    {
      title: "D-15 (Desaturated)",
      description: "More tritan-sensitive Lanthony variant",
      icon: Palette,
      xp: "35 XP",
      path: "/tests/d15-desaturated",
      gradient: "from-amber-500 to-slate-500",
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
  const streakValue = streakStatus?.effectiveStreak ?? profile?.current_streak ?? 0;

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
      value: `${streakValue} week${streakValue === 1 ? "" : "s"}`,
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
      label: "Log Achievements",
      icon: Sparkles,
      action: () => navigate("/achievements"),
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-20 transition-colors duration-500">

      {/* Floating Header */}
      <PremiumHeader title="AIris" backRoute="/dashboard" hideBackArrow>
        {/* Restored Navigation Links including Blogs */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-1 w-full lg:w-auto">
          <Button variant="ghost" size="sm" onClick={() => navigate("/friends")} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 justify-start lg:justify-center px-4 py-6 lg:py-2">
            <Users className="mr-2 h-5 w-5 lg:h-4 lg:w-4 text-emerald-500" />
            <span className="text-base lg:text-sm">Friends</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/achievements")} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 justify-start lg:justify-center px-4 py-6 lg:py-2">
            <Sparkles className="mr-2 h-5 w-5 lg:h-4 lg:w-4 text-amber-500" />
            <span className="text-base lg:text-sm">Achievements</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/reports")} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 justify-start lg:justify-center px-4 py-6 lg:py-2">
            <FileText className="mr-2 h-5 w-5 lg:h-4 lg:w-4 text-blue-500" />
            <span className="text-base lg:text-sm">Reports</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/statistics")} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 justify-start lg:justify-center px-4 py-6 lg:py-2">
            <Award className="mr-2 h-5 w-5 lg:h-4 lg:w-4 text-purple-500" />
            <span className="text-base lg:text-sm">Statistics</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/blogs")} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 justify-start lg:justify-center px-4 py-6 lg:py-2">
            <BookOpen className="mr-2 h-5 w-5 lg:h-4 lg:w-4 text-indigo-500" />
            <span className="text-base lg:text-sm">Blogs</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/profile")} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 justify-start lg:justify-center px-4 py-6 lg:py-2">
            <User className="mr-2 h-5 w-5 lg:h-4 lg:w-4 text-slate-500" />
            <span className="text-base lg:text-sm">Profile</span>
          </Button>
        </div>
      </PremiumHeader>

      <main className="container mx-auto px-4 pt-28 md:pt-32 max-w-6xl animate-slide-in-right md:animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-6 auto-rows-auto">

          {/* 0. Daily Tip (Moved to Top) */}
          <div className="col-span-1 md:col-span-4 lg:col-span-6 rounded-[2rem] bg-gradient-to-r from-emerald-50/80 via-teal-50/80 to-emerald-50/80 border border-emerald-100 p-6 flex flex-col sm:flex-row items-center justify-between gap-6 dark:from-emerald-950/20 dark:to-teal-900/10 dark:border-emerald-900/20 backdrop-blur-sm mb-2">
            <div className="flex items-start sm:items-center gap-5">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-500/20">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-600/80 uppercase tracking-widest mb-1.5 dark:text-emerald-400">Daily Wisdom</h4>
                <p className="text-base text-slate-700 font-medium italic dark:text-slate-300 max-w-2xl leading-relaxed">"{dailyTip}"</p>
              </div>
            </div>
          </div>

          {/* 1. XP Banner Widget (Replaces simple Welcome) */}
          <div className="col-span-1 md:col-span-2 lg:col-span-4">
            <XPBanner xp={xp} level={level} username={profile?.username} />
          </div>

          {/* 2. Streak Widget (More Colorful) */}
          <div className="col-span-1 md:col-span-2 lg:col-span-2 rounded-[2.5rem] bg-gradient-to-b from-orange-50 to-white border border-orange-100/50 p-8 flex flex-col justify-between relative overflow-hidden group shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-[40px]" />

            <div className="relative z-10 flex justify-between items-start">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-orange-600/80 dark:text-orange-400">Current Streak</span>
                <div className="text-5xl font-extrabold text-slate-900 mt-2 dark:text-white flex items-baseline gap-1">
                  {streakValue}
                  <span className="text-lg font-medium text-slate-400">weeks</span>
                </div>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-3xl shadow-lg shadow-orange-500/30 text-white animate-pulse-glow">
                🔥
              </div>
            </div>

            <div className="relative z-10 mt-6 md:mt-0">
              <div className="flex justify-between items-center text-sm font-medium mb-2 text-slate-600 dark:text-slate-300">
                <span>Keep it up!</span>
                <span className="text-orange-600 font-mono bg-orange-100 px-2 py-0.5 rounded-md text-xs dark:bg-orange-900/40 dark:text-orange-300">{countdown || "Loading..."} left</span>
              </div>
            </div>
          </div>

          {/* 3. Available Tests Grid (Vibrant Gradients) */}
          <div className="col-span-1 md:col-span-4 lg:col-span-6 space-y-5 mt-2">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-1.5 h-6 bg-indigo-500 rounded-full inline-block" />
                Available Tests
              </h3>
              <Button variant="link" className="text-indigo-600 dark:text-indigo-400" onClick={() => navigate("/tests")}>View All</Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
              {tests.map((test, i) => (
                <div
                  key={test.path}
                  onClick={() => navigate(test.path)}
                  className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group dark:bg-slate-800 dark:border-slate-700 relative overflow-hidden"
                >
                  <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${test.gradient} opacity-5 group-hover:opacity-10 rounded-bl-[4rem] transition-opacity`} />

                  <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${test.gradient} flex items-center justify-center text-white shadow-lg mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                    <test.icon className="h-7 w-7" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white leading-tight mb-1">{test.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{test.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="inline-flex items-center text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full dark:bg-slate-700 dark:text-slate-300">
                      <Trophy className="h-3 w-3 mr-1 text-yellow-500" />
                      +{test.xp}
                    </span>
                    <div className="h-6 w-6 rounded-full border border-slate-200 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-colors text-slate-300 dark:border-slate-600">
                      <PlayCircle className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Recent Activity (Cleaner List) */}
          <div className="col-span-1 md:col-span-2 lg:col-span-4 rounded-[2.5rem] bg-white border border-slate-200 p-8 shadow-sm dark:bg-slate-800 dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full inline-block" />
                Recent Activity
              </h3>
              <Button variant="ghost" size="sm" onClick={() => navigate("/statistics")} className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors">View All</Button>
            </div>
            <div className="space-y-4">
              {recentTests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 dark:bg-slate-900/50 dark:border-slate-700">
                  <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-300">
                    <LineChartIcon className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium">No tests taken yet</p>
                  <p className="text-xs text-slate-400 mt-1">Start your journey above!</p>
                </div>
              ) : (
                recentTests.slice(0, 3).map((test, index) => {
                  const Icon = TEST_ICONS[test.test_type ?? ""] ?? Sparkles;
                  return (
                    <div key={index} className="flex items-center justify-between p-3 pl-4 rounded-2xl bg-white border border-slate-100 hover:border-indigo-100 hover:shadow-md hover:shadow-indigo-500/5 transition-all group cursor-default dark:bg-slate-900 dark:border-slate-800 dark:hover:border-indigo-900">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors dark:bg-slate-800 dark:border-slate-700">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm dark:text-white">{formatTestLabel(test.test_type)}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] text-slate-500 font-medium">
                              {test.created_at ? format(new Date(test.created_at), 'MMM d, h:mm a') : ''}
                            </p>
                            {test.xp_earned ? (
                              <span className="text-[9px] px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-bold">+{test.xp_earned} XP</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="text-right pr-2">
                        <span className={`block font-black text-lg ${(test.score ?? 0) >= 80 ? 'text-emerald-500' :
                          (test.score ?? 0) >= 50 ? 'text-amber-500' : 'text-rose-500'
                          }`}>
                          {test.score}%
                        </span>
                        <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Score</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* 5. Trends & Insights (Visually Enhanced) */}
          <div className="col-span-1 md:col-span-2 lg:col-span-2 rounded-[2.5rem] bg-slate-900 text-white p-6 lg:p-8 relative overflow-hidden flex flex-col justify-between dark:bg-black dark:border dark:border-slate-800 shadow-xl group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/30 transition-colors" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-fuchsia-500/20 rounded-full blur-[40px] translate-y-1/2 -translate-x-1/4" />

            <div className="relative z-10 mb-4 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold mb-1">Trends</h3>
                <p className="text-xs text-slate-400">Last 5 scores</p>
              </div>
            </div>

            <div className="h-40 relative z-10 w-full flex items-end justify-between gap-2 mt-auto">
              {performanceData.length > 0 ? (
                performanceData.slice(-5).map((point, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 w-full group/bar h-full justify-end">
                    <div className="relative w-full rounded-t-lg bg-indigo-500/20 overflow-hidden"
                      style={{ height: `${point.score * 0.8}%`, minHeight: '10%' }}>
                      <div className="absolute inset-0 bg-gradient-to-t from-indigo-600 to-indigo-400 group-hover/bar:from-indigo-500 group-hover/bar:to-indigo-300 transition-all opacity-80" />
                    </div>
                    <span className="text-[10px] text-slate-400 group-hover/bar:text-white transition-colors font-mono">{point.score}</span>
                  </div>
                ))
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-xs text-slate-600 border border-dashed border-slate-800 rounded-xl">
                  <span>No data available</span>
                </div>
              )}
            </div>
          </div>



        </div>
      </main>
    </div>
  );
}
