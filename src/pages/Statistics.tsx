import { useEffect, useMemo, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Award,
  Target,
  Calendar,
  Activity,
  Eye,
  Grid3x3,
  BookOpen,
  Sparkles,
  Palette,
  Timer,
  Hourglass,
} from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { format, formatDistanceToNow } from "date-fns";
import { formatDurationMs } from "@/hooks/useTestTimer";
import { PremiumHeader } from "@/components/ui/PremiumHeader";

type TestResult = {
  id?: string;
  created_at: string | null;
  score: number | null;
  test_type: string | null;
  xp_earned: number | null;
  details?: Record<string, any> | null;
};

type TestTypeConfig = {
  id: string;
  keys: string[];
  name: string;
  gradient: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

type TimingSession = {
  id: string;
  testType: string | null;
  label: string;
  createdAt: string | null;
  sessionDurationMs: number | null;
  averageQuestionDurationMs: number | null;
  perQuestion: Array<{ durationMs: number | null }>;
};

const TEST_TYPES: TestTypeConfig[] = [
  { id: "ishihara", keys: ["ishihara"], name: "Ishihara Color Test", gradient: "from-rose-500 to-orange-500", icon: Palette },
  { id: "visual_acuity", keys: ["visual_acuity", "acuity"], name: "Visual Acuity Test", gradient: "from-blue-500 to-indigo-500", icon: Eye },
  { id: "amsler", keys: ["amsler"], name: "Amsler Grid Test", gradient: "from-emerald-500 to-green-600", icon: Grid3x3 },
  { id: "reading_stress", keys: ["reading_stress"], name: "Reading Stress Test", gradient: "from-purple-500 to-fuchsia-500", icon: BookOpen },
  { id: "d15", keys: ["d15"], name: "Farnsworth D-15", gradient: "from-amber-500 to-rose-500", icon: Palette },
  { id: "d15_desaturated", keys: ["d15_desaturated"], name: "D-15 (Desaturated)", gradient: "from-amber-500 to-slate-500", icon: Palette },
];

const CHART_COLORS = [
  "hsl(6 92% 68%)",
  "hsl(199 89% 62%)",
  "hsl(142 71% 45%)",
  "hsl(271 81% 69%)",
  "hsl(40 93% 64%)",
];

const formatTestLabel = (type: string | null) => {
  if (!type) {
    return "Vision Check";
  }
  const match = TEST_TYPES.find((entry) => entry.keys.includes(type));
  if (match) {
    return match.name;
  }
  return type
    .split(/[_-]/g)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

export default function Statistics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [testHistory, setTestHistory] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadHistory = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("test_results")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Failed to load statistics", error);
          setTestHistory([]);
          return;
        }

        setTestHistory((data ?? []) as TestResult[]);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [user]);

  const sortedHistory = useMemo(
    () =>
      [...testHistory].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return aTime - bTime;
      }),
    [testHistory],
  );

  const timingSessions = useMemo<TimingSession[]>(() => {
    return sortedHistory
      .map((test) => {
        const timing = test.details && typeof test.details === "object" ? (test.details as any).timing : null;
        if (!timing) return null;
        const sessionDurationMs = Number.isFinite(timing.sessionDurationMs)
          ? Number(timing.sessionDurationMs)
          : null;
        const averageQuestionDurationMs = Number.isFinite(timing.averageQuestionDurationMs)
          ? Number(timing.averageQuestionDurationMs)
          : null;
        const perQuestionRaw = Array.isArray(timing.perQuestion) ? timing.perQuestion : [];
        const perQuestion = perQuestionRaw.map((entry: any) => ({
          durationMs: Number.isFinite(entry?.durationMs) ? Number(entry.durationMs) : null,
        }));

        if (sessionDurationMs === null && averageQuestionDurationMs === null && perQuestion.length === 0) {
          return null;
        }

        return {
          id: test.id ?? `${test.test_type ?? "unknown"}-${test.created_at ?? Date.now()}`,
          testType: test.test_type,
          label: formatTestLabel(test.test_type),
          createdAt: test.created_at,
          sessionDurationMs,
          averageQuestionDurationMs,
          perQuestion,
        } satisfies TimingSession;
      })
      .filter((entry): entry is TimingSession => entry !== null);
  }, [sortedHistory]);

  const totalTests = sortedHistory.length;
  const averageScore = totalTests
    ? Number((sortedHistory.reduce((sum, test) => sum + (test.score ?? 0), 0) / totalTests).toFixed(1))
    : 0;

  const testsThisMonth = useMemo(() => {
    const now = new Date();
    return sortedHistory.filter((test) => {
      if (!test.created_at) return false;
      const date = new Date(test.created_at);
      if (Number.isNaN(date.getTime())) return false;
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
  }, [sortedHistory]);

  const lastResult = sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1] : null;
  const previousResult = sortedHistory.length >= 2 ? sortedHistory[sortedHistory.length - 2] : null;
  const latestTrend =
    previousResult && lastResult
      ? (lastResult.score ?? 0) - (previousResult.score ?? 0)
      : null;
  const timeSinceLast = lastResult?.created_at
    ? formatDistanceToNow(new Date(lastResult.created_at), { addSuffix: true })
    : "No sessions yet";

  const sessionDurations = timingSessions
    .map((session) => session.sessionDurationMs)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);

  const questionDurations = timingSessions.flatMap((session) =>
    session.perQuestion
      .map((entry) => entry.durationMs)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0),
  );

  const averageSessionMs = sessionDurations.length
    ? Math.round(sessionDurations.reduce((sum, value) => sum + value, 0) / sessionDurations.length)
    : 0;

  const averageQuestionMs = questionDurations.length
    ? Math.round(questionDurations.reduce((sum, value) => sum + value, 0) / questionDurations.length)
    : 0;

  const fastestQuestionMs = questionDurations.length ? Math.min(...questionDurations) : 0;
  const slowestQuestionMs = questionDurations.length ? Math.max(...questionDurations) : 0;
  const latestSessionTiming = timingSessions.length ? timingSessions[timingSessions.length - 1] : null;

  const timingByTest = useMemo(() => {
    const map = new Map<
      string,
      {
        sessionDurations: number[];
        questionDurations: number[];
        sessionCount: number;
        questionCount: number;
      }
    >();

    timingSessions.forEach((session) => {
      const key = session.label;
      if (!map.has(key)) {
        map.set(key, { sessionDurations: [], questionDurations: [], sessionCount: 0, questionCount: 0 });
      }
      const bucket = map.get(key)!;
      if (session.sessionDurationMs && Number.isFinite(session.sessionDurationMs)) {
        bucket.sessionDurations.push(session.sessionDurationMs);
        bucket.sessionCount += 1;
      }
      const validQuestions = session.perQuestion
        .map((entry) => entry.durationMs)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
      if (validQuestions.length > 0) {
        bucket.questionDurations.push(...validQuestions);
        bucket.questionCount += validQuestions.length;
      } else if (session.averageQuestionDurationMs && Number.isFinite(session.averageQuestionDurationMs)) {
        bucket.questionDurations.push(session.averageQuestionDurationMs);
        bucket.questionCount += 1;
      }
    });

    return Array.from(map.entries()).map(([label, values]) => {
      const avgSession = values.sessionDurations.length
        ? Math.round(values.sessionDurations.reduce((sum, value) => sum + value, 0) / values.sessionDurations.length)
        : 0;
      const avgQuestion = values.questionDurations.length
        ? Math.round(values.questionDurations.reduce((sum, value) => sum + value, 0) / values.questionDurations.length)
        : 0;
      return {
        label,
        averageSessionMs: avgSession,
        averageQuestionMs: avgQuestion,
        sessionCount: values.sessionCount,
        questionCount: values.questionCount,
      };
    });
  }, [timingSessions]);

  const bestResult = sortedHistory.reduce<TestResult | null>((best, current) => {
    const currentScore = current.score ?? 0;
    const bestScore = best?.score ?? -Infinity;
    return currentScore > bestScore ? current : best;
  }, null);
  const bestScore = bestResult?.score ?? 0;
  const latestScoreValue = lastResult?.score ?? 0;
  const bestScoreLabel = bestResult ? formatTestLabel(bestResult.test_type) : "-";

  const performanceTrendData = useMemo(
    () =>
      sortedHistory.slice(-12).map((test) => {
        const date = test.created_at ? new Date(test.created_at) : null;
        return {
          date: date && !Number.isNaN(date.getTime()) ? format(date, "MMM d") : "-",
          score: test.score ?? 0,
          type: formatTestLabel(test.test_type),
        };
      }),
    [sortedHistory],
  );

  const sessionTrendData = useMemo(() => {
    if (timingSessions.length === 0) return [];
    return timingSessions.slice(-12).map((session) => {
      const date = session.createdAt ? new Date(session.createdAt) : null;
      const label = date && !Number.isNaN(date.getTime()) ? format(date, "MMM d") : "-";
      return {
        date: label,
        minutes: session.sessionDurationMs ? Number((session.sessionDurationMs / 60000).toFixed(2)) : 0,
        test: session.label,
      };
    });
  }, [timingSessions]);

  const monthlyActivityData = useMemo(() => {
    const aggregates = new Map<
      string,
      {
        tests: number;
        totalScore: number;
        order: number;
      }
    >();

    sortedHistory.forEach((test) => {
      if (!test.created_at) return;
      const date = new Date(test.created_at);
      if (Number.isNaN(date.getTime())) return;
      const key = format(date, "MMM yyyy");
      const monthStart = new Date(date.getFullYear(), date.getMonth()).getTime();
      if (!aggregates.has(key)) {
        aggregates.set(key, { tests: 0, totalScore: 0, order: monthStart });
      }
      const entry = aggregates.get(key)!;
      entry.tests += 1;
      entry.totalScore += test.score ?? 0;
    });

    return Array.from(aggregates.entries())
      .sort((a, b) => a[1].order - b[1].order)
      .slice(-6)
      .map(([month, value]) => ({
        month,
        tests: value.tests,
        average: value.tests ? Number((value.totalScore / value.tests).toFixed(1)) : 0,
      }));
  }, [sortedHistory]);

  const distributionData = useMemo(() => {
    if (!sortedHistory.length) {
      return [];
    }
    const counts = new Map<string, number>();

    sortedHistory.forEach((test) => {
      const label = formatTestLabel(test.test_type);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });

    return Array.from(counts.entries()).map(([label, value], index) => ({
      label,
      value,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [sortedHistory]);

  const getTestTypeData = (keys: string[]) => {
    const normalized = new Set(keys);
    const tests = sortedHistory.filter((test) => test.test_type && normalized.has(test.test_type));
    const scores = tests.map((test) => test.score ?? 0);
    const avg = scores.length
      ? Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(1))
      : 0;
    const latest = tests.length ? tests[tests.length - 1].score ?? 0 : 0;
    const trend =
      tests.length >= 2
        ? (tests[tests.length - 1].score ?? 0) - (tests[tests.length - 2].score ?? 0)
        : 0;
    const best = scores.length ? Math.max(...scores) : 0;

    return { tests, avg, latest, trend, count: tests.length, best };
  };

  const latestChangeValue =
    latestTrend === null ? "-" : `${latestTrend > 0 ? "+" : latestTrend < 0 ? "-" : ""}${Math.abs(latestTrend).toFixed(1)}%`;

  // New Stats Calculations
  const currentStreak = useMemo(() => {
    if (sortedHistory.length === 0) return 0;
    const dates = Array.from(new Set(sortedHistory.map(t => t.created_at ? new Date(t.created_at).toDateString() : null).filter(Boolean))).map(d => new Date(d as string));
    dates.sort((a, b) => b.getTime() - a.getTime()); // Descending

    let streak = 0;
    const now = new Date();
    const today = new Date(now.toDateString());
    const yesterday = new Date(now.setDate(now.getDate() - 1));
    yesterday.setHours(0, 0, 0, 0);

    // Check if streak is active (test today or yesterday)
    if (dates.length > 0) {
      const lastTest = dates[0];
      if (lastTest.getTime() === today.getTime() || lastTest.getTime() === yesterday.getTime()) {
        streak = 1;
        let checkDate = lastTest;
        for (let i = 1; i < dates.length; i++) {
          const prevDate = new Date(checkDate);
          prevDate.setDate(prevDate.getDate() - 1);
          if (dates[i].getTime() === prevDate.getTime()) {
            streak++;
            checkDate = prevDate;
          } else {
            break;
          }
        }
      }
    }
    return streak;
  }, [sortedHistory]);

  const totalFocusMinutes = useMemo(() => {
    const totalMs = sessionDurations.reduce((acc, curr) => acc + curr, 0);
    return Math.round(totalMs / 60000);
  }, [sessionDurations]);

  const topTestCategory = useMemo(() => {
    if (distributionData.length === 0) return { label: "-", value: 0 };
    return distributionData.reduce((prev, current) => (prev.value > current.value) ? prev : current);
  }, [distributionData]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <PremiumHeader title="AIris Stats" backRoute="/dashboard">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-1 w-full md:w-auto">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 justify-start md:justify-center px-4 py-6 md:py-2">
            <span className="text-base md:text-sm">Dashboard</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/friends")} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 justify-start md:justify-center px-4 py-6 md:py-2">
            <span className="text-base md:text-sm">Friends</span>
          </Button>
        </div>
      </PremiumHeader>

      <div className="container mx-auto max-w-6xl px-4 pt-28 md:pt-32 pb-20 lg:px-6 animate-slide-in-right md:animate-none mt-[env(safe-area-inset-top)]">
        <section className="grid gap-6 grid-cols-1 xl:grid-cols-[2fr,1fr]">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-white/20 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-2xl p-1">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
            <div className="relative z-10 rounded-[2.3rem] bg-white/5 p-6 md:p-8 backdrop-blur-sm lg:p-10 h-full flex flex-col justify-between">

              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between mb-8">
                <div className="space-y-3">
                  <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/70 font-bold bg-white/10 px-3 py-1 rounded-full w-fit">
                    <Activity className="h-3 w-3" /> Insight Center
                  </p>
                  <h1 className="text-3xl font-extrabold lg:text-5xl tracking-tight">Your Vision Stats</h1>
                  <p className="max-w-md text-indigo-100/90 leading-relaxed text-lg">
                    Monitor patterns, celebrate wins, and keep your eye health on track.
                  </p>
                </div>
                <div className="rounded-3xl bg-white/10 border border-white/10 px-6 py-5.5 text-center backdrop-blur-md shadow-lg">
                  <span className="text-[10px] uppercase tracking-wider text-white/70 font-bold block mb-1">Best performance</span>
                  <div className="text-4xl font-extrabold animate-fade-in">{bestScore ? `${bestScore}%` : "-"}</div>
                  <p className="text-xs text-white/70 mt-1 font-medium">{bestScoreLabel}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Total Tests */}
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md hover:bg-white/20 transition-colors">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/70 mb-2">
                    <Target className="h-3 w-3" /> Total Tests
                  </div>
                  <div className="text-2xl font-bold">{totalTests}</div>
                </div>

                {/* Avg Score */}
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md hover:bg-white/20 transition-colors">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/70 mb-2">
                    <Award className="h-3 w-3" /> Avg Score
                  </div>
                  <div className="text-2xl font-bold">{averageScore}%</div>
                </div>

                {/* Current Streak */}
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md hover:bg-white/20 transition-colors">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/70 mb-2">
                    <Activity className="h-3 w-3" /> Streak
                  </div>
                  <div className="text-2xl font-bold">{currentStreak} <span className="text-sm font-medium text-white/60">days</span></div>
                </div>

                {/* Focus Time */}
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md hover:bg-white/20 transition-colors">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/70 mb-2">
                    <Timer className="h-3 w-3" /> Focus Time
                  </div>
                  <div className="text-2xl font-bold">{totalFocusMinutes} <span className="text-sm font-medium text-white/60">min</span></div>
                </div>

                {/* Top Category - Spans 2 cols */}
                <div className="col-span-2 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md hover:bg-white/20 transition-colors flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/70 mb-1">
                      <Target className="h-3 w-3" /> Top Category
                    </div>
                    <div className="text-lg font-bold truncate max-w-[200px]">{topTestCategory.label}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/60 mb-1">Sessions</div>
                    <div className="text-lg font-bold">{topTestCategory.value}</div>
                  </div>
                </div>

                {/* Last Session / Change - Spans 2 cols */}
                <div className="col-span-2 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md hover:bg-white/20 transition-colors flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/70 mb-1">
                      <Calendar className="h-3 w-3" /> Last Session
                    </div>
                    <div className="text-lg font-bold">{timeSinceLast}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/60 mb-1">Trend</div>
                    <div className="text-lg font-bold flex items-center gap-1 justify-end">
                      {latestTrend !== null && latestTrend < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                      {latestChangeValue}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" />
                Vision Snapshot
              </CardTitle>
              <CardDescription className="text-sm text-slate-600 dark:text-slate-300">
                Key highlights pulled from your recent activity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-primary/10 bg-gradient-to-br from-amber-50 to-amber-100/50 p-4 shadow-sm dark:from-amber-900/20 dark:to-amber-900/10">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">This Month&apos;s Momentum</p>
                  <p className="text-xs text-muted-foreground">
                    {testsThisMonth} session{testsThisMonth === 1 ? "" : "s"} logged in {format(new Date(), "MMMM")}.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-primary/10 bg-gradient-to-br from-blue-50 to-indigo-100/50 p-4 shadow-sm dark:from-blue-900/20 dark:to-blue-900/10">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Award className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Your Best Test</p>
                  <p className="text-xs text-muted-foreground">
                    {bestScoreLabel === "-"
                      ? "Complete tests to discover your strongest area."
                      : `${bestScoreLabel} is leading with ${bestScore}%`}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-primary/10 bg-gradient-to-br from-emerald-50 to-teal-100/50 p-4 shadow-sm dark:from-emerald-900/20 dark:to-emerald-900/10">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Next Suggested Step</p>
                  <p className="text-xs text-muted-foreground">
                    Alternate between different test types each week for balanced insight.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading your insights...</div>
        ) : (
          <>
            <section className="mt-8 grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 items-start">
              {/* Performance Trend - Spans 2 cols */}
              <Card className="glass-card col-span-1 lg:col-span-2 xl:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    Performance Trend
                  </CardTitle>
                  <CardDescription>Your recent scores across all tests.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-2">
                  {performanceTrendData.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-muted p-8 text-center text-sm text-muted-foreground">
                      Complete a few tests to visualize your performance trajectory.
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
                      className="aspect-auto h-64 w-full rounded-[20px] bg-white/50 border border-white/20 p-3 shadow-sm backdrop-blur-sm dark:bg-slate-950/50"
                    >
                      <LineChart data={performanceTrendData}>
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
                          domain={[0, 100]}
                          stroke="currentColor"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          className="text-xs text-muted-foreground"
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line
                          dataKey="score"
                          type="monotone"
                          stroke="var(--color-score)"
                          strokeWidth={3}
                          dot={{ r: 3 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ChartContainer>
                  )}
                  {!loading && performanceTrendData.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-primary/15 bg-white/80 p-4 text-center shadow-sm dark:border-white/10 dark:bg-slate-900/70">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Latest score</p>
                        <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-50">{latestScoreValue}%</p>
                      </div>
                      <div className="rounded-2xl border border-primary/15 bg-white/80 p-4 text-center shadow-sm dark:border-white/10 dark:bg-slate-900/70">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Average</p>
                        <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-50">{averageScore}%</p>
                      </div>
                      <div className="rounded-2xl border border-primary/15 bg-white/80 p-4 text-center shadow-sm dark:border-white/10 dark:bg-slate-900/70">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Best result</p>
                        <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-50">{bestScore}%</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Monthly Activity - Col 3 */}
              <Card className="glass-card col-span-1">
                <CardHeader>
                  <CardTitle>Monthly Activity</CardTitle>
                  <CardDescription>Check-in frequency.</CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  {monthlyActivityData.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-muted p-6 text-center text-sm text-muted-foreground">
                      Your monthly cadence will appear after a few sessions.
                    </div>
                  ) : (
                    <ChartContainer
                      config={{
                        tests: {
                          label: "Tests",
                          theme: {
                            light: "hsl(220 90% 55%)",
                            dark: "hsl(210 100% 78%)",
                          },
                        },
                      }}
                      className="aspect-auto h-64 rounded-[24px] bg-white/85 p-3 shadow-inner dark:bg-slate-900/60"
                    >
                      <BarChart data={monthlyActivityData}>
                        <CartesianGrid strokeDasharray="4 8" className="stroke-muted" />
                        <XAxis
                          dataKey="month"
                          stroke="currentColor"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={12}
                          className="text-xs text-muted-foreground"
                        />
                        <YAxis
                          allowDecimals={false}
                          stroke="currentColor"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          className="text-xs text-muted-foreground"
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="tests" fill="var(--color-tests)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              {/* Test Mix - New Row, Col 1 */}
              <Card className="glass-card col-span-1">
                <CardHeader>
                  <CardTitle>Test Mix</CardTitle>
                  <CardDescription>Focus distribution.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-6 pt-2">
                  {distributionData.length === 0 ? (
                    <div className="w-full rounded-2xl border border-dashed border-muted p-6 text-center text-sm text-muted-foreground">
                      Run a variety of tests to see your distribution chart.
                    </div>
                  ) : (
                    <>
                      <ChartContainer
                        config={{
                          sessions: {
                            label: "Sessions",
                            theme: {
                              light: "hsl(158 70% 45%)",
                              dark: "hsl(158 70% 78%)",
                            },
                          },
                        }}
                        className="aspect-auto h-48 w-full rounded-[24px] bg-white/85 p-3 shadow-inner dark:bg-slate-900/60"
                      >
                        <PieChart>
                          <Pie
                            data={distributionData}
                            dataKey="value"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={75}
                            paddingAngle={4}
                          >
                            {distributionData.map((entry) => (
                              <Cell key={entry.label} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                      <div className="grid w-full gap-2">
                        {distributionData.map((entry) => (
                          <div
                            key={entry.label}
                            className="flex items-center justify-between rounded-xl border border-white/50 bg-white/80 px-3 py-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/70"
                          >
                            <div className="flex items-center gap-3">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                              <span className="text-xs font-medium truncate max-w-[100px]" style={{ color: entry.color }}>
                                {entry.label}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {entry.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Session Tempo - Col 2 */}
              <Card className="glass-card col-span-1">
                <CardHeader>
                  <CardTitle>Session Tempo</CardTitle>
                  <CardDescription>Recent duration.</CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  {sessionTrendData.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-muted p-6 text-center text-sm text-muted-foreground">
                      Timers will appear once you complete a timed session.
                    </div>
                  ) : (
                    <ChartContainer
                      config={{
                        minutes: {
                          label: "Minutes",
                          theme: {
                            light: "hsl(265 85% 55%)",
                            dark: "hsl(265 80% 75%)",
                          },
                        },
                      }}
                      className="aspect-auto h-48 rounded-[20px] bg-white/50 border border-white/20 p-3 shadow-sm backdrop-blur-sm dark:bg-slate-950/50"
                    >
                      <LineChart data={sessionTrendData}>
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
                          className="text-xs text-muted-foreground"
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line
                          dataKey="minutes"
                          type="monotone"
                          stroke="var(--color-minutes)"
                          strokeWidth={3}
                          dot={{ r: 3 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ChartContainer>
                  )}
                  {latestSessionTiming && (
                    <div className="mt-4 rounded-2xl border border-primary/20 bg-white/80 p-3 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100">
                      <p className="font-semibold text-foreground text-xs">Most recent</p>
                      <p className="text-xs text-muted-foreground">
                        {latestSessionTiming.createdAt ? format(new Date(latestSessionTiming.createdAt), "MMM d, h:mma") : "recent"}
                      </p>
                      <p className="mt-1 text-xs font-medium">
                        {latestSessionTiming.sessionDurationMs
                          ? `Duration: ${formatDurationMs(latestSessionTiming.sessionDurationMs)}`
                          : "Duration pending"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Average Timing - Col 3 */}
              <Card className="glass-card col-span-1">
                <CardHeader>
                  <CardTitle>Average Timing</CardTitle>
                  <CardDescription>Pacing by test.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {timingByTest.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-muted p-6 text-center text-sm text-muted-foreground">
                      Data needed.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {timingByTest.map((entry) => (
                        <div
                          key={entry.label}
                          className="flex flex-col gap-1 rounded-2xl border border-primary/15 bg-white/80 p-3 shadow-sm dark:border-white/10 dark:bg-slate-900/70"
                        >
                          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                            <span>{entry.label}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {entry.averageSessionMs
                                ? `${formatDurationMs(entry.averageSessionMs)}`
                                : "--"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="mt-6">

              {/* Detailed Breakdown: Colorful & Data-Rich */}
              <div className="col-span-1 lg:col-span-2 xl:col-span-2 space-y-8">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                    <Grid3x3 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Detailed Breakdown</h2>
                    <p className="text-slate-500 dark:text-slate-400">Deep dive into each test category.</p>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {TEST_TYPES.map((typeConfig) => {
                    const { tests, avg, latest, trend, best, count } = getTestTypeData(typeConfig.keys);

                    const timingInfo = timingByTest.find(t => t.label === typeConfig.name) || { averageSessionMs: 0, sessionCount: 0 };

                    const chartData = tests.slice(-15).map((t) => ({
                      date: t.created_at ? format(new Date(t.created_at), "M/d") : "-",
                      score: t.score ?? 0,
                    }));

                    // Dynamic color styles based on the test type config
                    // typeConfig.gradient is e.g. "from-rose-500 to-orange-500"
                    // We can extract the raw color for other uses or just use the gradient classes.

                    return (
                      <div key={typeConfig.id} className="group relative overflow-hidden rounded-[2.5rem] bg-white p-1 shadow-xl shadow-slate-200/50 transition-all hover:scale-[1.01] hover:shadow-2xl hover:shadow-slate-300/50 dark:bg-slate-900 dark:shadow-black/40">
                        {/* Colorful Background Mesh */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${typeConfig.gradient} opacity-5 group-hover:opacity-10 transition-opacity`} />

                        <div className="relative flex h-full flex-col justify-between rounded-[2.3rem] bg-white/50 p-6 backdrop-blur-xl dark:bg-slate-950/50">

                          {/* Header */}
                          <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-4">
                              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${typeConfig.gradient} text-white shadow-md`}>
                                <typeConfig.icon className="h-6 w-6" />
                              </div>
                              <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{typeConfig.name}</h3>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">{count} Sessions</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Best Score</div>
                              <div className={`text-2xl font-black bg-gradient-to-br ${typeConfig.gradient} bg-clip-text text-transparent`}>
                                {best}%
                              </div>
                            </div>
                          </div>

                          {/* Mini Metrics Grid */}
                          <div className="grid grid-cols-3 gap-3 mb-6">
                            <div className="rounded-2xl bg-slate-100/50 p-3 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
                              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Latest</div>
                              <div className="text-lg font-bold text-slate-700 dark:text-slate-200">{latest}%</div>
                            </div>
                            <div className="rounded-2xl bg-slate-100/50 p-3 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
                              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Average</div>
                              <div className="text-lg font-bold text-slate-700 dark:text-slate-200">{avg}%</div>
                            </div>
                            <div className="rounded-2xl bg-slate-100/50 p-3 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
                              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Avg Time</div>
                              <div className="text-lg font-bold text-slate-700 dark:text-slate-200">
                                {timingInfo.averageSessionMs ? formatDurationMs(timingInfo.averageSessionMs) : "-"}
                              </div>
                            </div>
                          </div>

                          {/* Chart Area */}
                          <div className="h-32 w-full rounded-2xl bg-slate-50/50 p-4 border border-slate-100 dark:bg-slate-900/50 dark:border-slate-800">
                            {chartData.length > 1 ? (
                              <ChartContainer config={{ value: { label: "Score" } }} className="h-full w-full">
                                <LineChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                                  <ChartTooltip content={<ChartTooltipContent />} />
                                  <Line
                                    type="monotone"
                                    dataKey="score"
                                    strokeWidth={3}
                                    stroke={`url(#gradient-${typeConfig.id})`}
                                    dot={{ r: 4, strokeWidth: 2, fill: "white" }}
                                    activeDot={{ r: 6 }}
                                  />
                                  <defs>
                                    <linearGradient id={`gradient-${typeConfig.id}`} x1="0" y1="0" x2="1" y2="0">
                                      {/* We can't easily parse the Tailwind classes here for SVG, so we fallback to a rough approximation or current color */}
                                      <stop offset="0%" stopColor="currentColor" className="text-primary" />
                                      <stop offset="100%" stopColor="currentColor" className="text-purple-500" />
                                    </linearGradient>
                                  </defs>
                                </LineChart>
                              </ChartContainer>
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-slate-400 italic">
                                Not enough data for chart
                              </div>
                            )}
                          </div>

                          {/* Footer Trend */}
                          <div className="mt-4 flex items-center gap-2 text-xs font-medium relative top-1">
                            <span className="text-slate-400">Trend: </span>
                            <span className={`px-2 py-0.5 rounded-full ${trend > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : trend < 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-slate-100 text-slate-600'}`}>
                              {trend > 0 ? '+' : ''}{trend}% vs last
                            </span>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>


              {/* Complete History Log */}
              <div className="col-span-1 lg:col-span-2 xl:col-span-2 mt-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg dark:bg-white dark:text-slate-900">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Full History Log</h2>
                    <p className="text-slate-500 dark:text-slate-400">Every test you've ever taken.</p>
                  </div>
                </div>

                <Card className="glass-card overflow-hidden border-0 bg-white/60 dark:bg-slate-900/60 shadow-none">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200/60 dark:bg-slate-900/80 dark:border-slate-800 dark:text-slate-400">
                        <tr>
                          <th className="px-6 py-4 font-bold">Date</th>
                          <th className="px-6 py-4 font-bold">Test Type</th>
                          <th className="px-6 py-4 font-bold">Performance</th>
                          <th className="px-6 py-4 font-bold">XP Earned</th>
                          <th className="px-6 py-4 font-bold text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sortedHistory.slice().reverse().map((test) => {
                          const config = TEST_TYPES.find(t => t.keys.includes(test.test_type || ''));
                          const gradient = config?.gradient || "from-slate-500 to-slate-600";
                          const Icon = config?.icon || Activity;

                          return (
                            <tr key={test.id} className="hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-800/30">
                              <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-200">
                                {test.created_at ? format(new Date(test.created_at), "MMM d, yyyy • h:mm a") : "-"}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className={`p-1.5 rounded-lg bg-gradient-to-br ${gradient} text-white shadow-sm`}>
                                    <Icon className="h-3 w-3" />
                                  </div>
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                                    {config?.name || test.test_type}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-2 rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
                                    <div
                                      className={`h-full bg-gradient-to-r ${gradient}`}
                                      style={{ width: `${test.score}%` }}
                                    />
                                  </div>
                                  <span className="font-bold">{test.score}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  <Sparkles className="h-3 w-3" />
                                  +{test.xp_earned || 0} XP
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => navigate(`/report/${test.id}`)}>
                                  <ArrowLeft className="h-4 w-4 rotate-180" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {sortedHistory.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                      No test history found. Start your journey!
                    </div>
                  )}
                </Card>
              </div>

            </section>
          </>
        )}
      </div>
    </div>
  );
}
