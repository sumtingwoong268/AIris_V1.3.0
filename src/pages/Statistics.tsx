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
} from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { format, formatDistanceToNow } from "date-fns";

type TestResult = {
  id?: string;
  created_at: string | null;
  score: number | null;
  test_type: string | null;
  xp_earned: number | null;
};

type TestTypeConfig = {
  id: string;
  keys: string[];
  name: string;
  gradient: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const TEST_TYPES: TestTypeConfig[] = [
  { id: "ishihara", keys: ["ishihara"], name: "Ishihara Color Test", gradient: "from-rose-500 to-orange-500", icon: Palette },
  { id: "visual_acuity", keys: ["visual_acuity", "acuity"], name: "Visual Acuity Test", gradient: "from-blue-500 to-indigo-500", icon: Eye },
  { id: "amsler", keys: ["amsler"], name: "Amsler Grid Test", gradient: "from-emerald-500 to-green-600", icon: Grid3x3 },
  { id: "reading_stress", keys: ["reading_stress"], name: "Reading Stress Test", gradient: "from-purple-500 to-fuchsia-500", icon: BookOpen },
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

        setTestHistory(data || []);
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

  const lastResult = sortedHistory.at(-1) ?? null;
  const previousResult = sortedHistory.length >= 2 ? sortedHistory[sortedHistory.length - 2] : null;
  const latestTrend =
    previousResult && lastResult
      ? (lastResult.score ?? 0) - (previousResult.score ?? 0)
      : null;
  const timeSinceLast = lastResult?.created_at
    ? formatDistanceToNow(new Date(lastResult.created_at), { addSuffix: true })
    : "No sessions yet";

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
  const latestChangeDescription =
    latestTrend === null
      ? "Complete another test to see change over time"
      : latestTrend > 0
        ? "Improved since your last session"
        : latestTrend < 0
          ? "Slight drop from your last session"
          : "Holding steady session to session";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto max-w-6xl px-4 py-10 lg:px-6">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>

        <section className="grid gap-6 xl:grid-cols-[2fr,1fr]">
          <Card className="relative overflow-hidden rounded-[32px] border border-white/20 bg-gradient-to-br from-primary via-blue-600 to-indigo-600 text-white shadow-2xl">
            <span className="absolute -top-24 -left-6 h-72 w-72 rounded-full bg-white/40 blur-3xl" />
            <span className="absolute -bottom-24 right-0 h-60 w-60 rounded-full bg-sky-400/40 blur-3xl" />
            <CardContent className="relative z-10 space-y-8 p-8 lg:p-10">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <p className="text-sm uppercase tracking-wide text-white/70">Insight Center</p>
                  <h1 className="text-4xl font-bold lg:text-5xl">Your Statistics</h1>
                  <p className="max-w-xl text-sm text-white/80">
                    Monitor patterns, celebrate wins, and keep your eye health journey on track with fresh insights.
                  </p>
                </div>
                <div className="rounded-3xl bg-white/15 px-6 py-5 text-center shadow-lg backdrop-blur">
                  <span className="text-xs uppercase tracking-wide text-white/70">Best performance</span>
                  <div className="mt-2 text-4xl font-bold">{bestScore ? `${bestScore}%` : "-"}</div>
                  <p className="text-xs text-white/70">{bestScoreLabel}</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-white/15 bg-white/15 p-4 shadow-sm backdrop-blur">
                  <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-white/70">
                    <Target className="h-4 w-4" />
                    Total Tests
                  </div>
                  <div className="mt-3 text-3xl font-semibold">{totalTests}</div>
                  <p className="text-xs text-white/60">Lifetime check-ins</p>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/15 p-4 shadow-sm backdrop-blur">
                  <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-white/70">
                    <Award className="h-4 w-4" />
                    Average Score
                  </div>
                  <div className="mt-3 text-3xl font-semibold">{averageScore}%</div>
                  <p className="text-xs text-white/60">Across all sessions</p>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/15 p-4 shadow-sm backdrop-blur">
                  <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-white/70">
                    <Activity className="h-4 w-4" />
                    Last Session
                  </div>
                  <div className="mt-3 text-xl font-semibold">{timeSinceLast}</div>
                  <p className="text-xs text-white/60">
                    {lastResult ? formatTestLabel(lastResult.test_type) : "Run a test to get started"}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/15 p-4 shadow-sm backdrop-blur">
                  <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-white/70">
                    {latestTrend !== null && latestTrend < 0 ? (
                      <TrendingDown className="h-4 w-4" />
                    ) : (
                      <TrendingUp className="h-4 w-4" />
                    )}
                    Latest Change
                  </div>
                  <div className="mt-3 text-3xl font-semibold">{latestChangeValue}</div>
                  <p className="text-xs text-white/60">{latestChangeDescription}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[24px] border border-primary/15 bg-gradient-to-br from-white via-sky-50 to-primary/20 shadow-xl backdrop-blur dark:from-slate-900 dark:via-slate-900/80 dark:to-primary/10">
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
              <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-amber-200/80 via-orange-200/80 to-rose-200/80 p-4 shadow-sm backdrop-blur dark:from-amber-500/30 dark:via-orange-500/30 dark:to-rose-500/30">
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
              <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-sky-200/80 via-blue-200/80 to-indigo-200/80 p-4 shadow-sm backdrop-blur dark:from-sky-500/30 dark:via-blue-500/30 dark:to-indigo-500/30">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Award className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Most Reliable Test</p>
                  <p className="text-xs text-muted-foreground">
                    {bestScoreLabel === "-"
                      ? "Complete tests to discover your strongest area."
                      : `${bestScoreLabel} is leading with ${bestScore}%`}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-emerald-200/80 via-mint-200/80 to-teal-200/80 p-4 shadow-sm backdrop-blur dark:from-emerald-500/30 dark:via-teal-500/30 dark:to-green-500/30">
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
            <section className="mt-10 grid gap-6 xl:grid-cols-[2fr,1fr]">
              <Card className="border border-primary/15 bg-gradient-to-br from-white via-slate-50 to-primary/10 shadow-xl hover:shadow-2xl dark:from-slate-900 dark:via-slate-900/80 dark:to-primary/10">
                <CardHeader>
                  <CardTitle>Performance Trend</CardTitle>
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
                      className="aspect-auto h-80 rounded-[24px] bg-white/85 p-3 shadow-inner dark:bg-slate-900/60 md:h-96"
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
              <div className="grid gap-6">
                <Card className="border border-primary/15 bg-gradient-to-br from-primary/10 via-sky-100 to-indigo-100 shadow-xl hover:shadow-2xl dark:from-slate-900 dark:via-primary/15 dark:to-indigo-950">
                  <CardHeader>
                    <CardTitle>Monthly Activity</CardTitle>
                    <CardDescription>How often you&apos;ve checked in recently.</CardDescription>
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
                        className="aspect-auto h-72 rounded-[24px] bg-white/85 p-3 shadow-inner dark:bg-slate-900/60"
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
                <Card className="border border-primary/15 bg-gradient-to-br from-white via-emerald-50 to-primary/10 shadow-xl hover:shadow-2xl dark:from-slate-900 dark:via-slate-900/80 dark:to-primary/15">
                  <CardHeader>
                    <CardTitle>Test Mix</CardTitle>
                    <CardDescription>Where you&apos;re spending the most time.</CardDescription>
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
                          className="aspect-auto h-60 w-full rounded-[24px] bg-white/85 p-3 shadow-inner dark:bg-slate-900/60"
                        >
                          <PieChart>
                            <Pie
                              data={distributionData}
                              dataKey="value"
                              nameKey="label"
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={90}
                              paddingAngle={4}
                            >
                              {distributionData.map((entry) => (
                                <Cell key={entry.label} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ChartContainer>
                        <div className="grid w-full gap-3">
                          {distributionData.map((entry) => (
                            <div
                              key={entry.label}
                              className="flex items-center justify-between rounded-xl border border-white/50 bg-white/80 px-3 py-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/70"
                            >
                              <div className="flex items-center gap-3">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-sm font-medium" style={{ color: entry.color }}>
                                  {entry.label}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {entry.value} session{entry.value === 1 ? "" : "s"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>

            <section className="mt-10 grid gap-6 lg:grid-cols-2">
              {TEST_TYPES.map((testType) => {
                const data = getTestTypeData(testType.keys);
                const Icon = testType.icon;
                return (
                  <Card key={testType.id} className="overflow-hidden rounded-3xl border border-primary/15 shadow-xl hover:-translate-y-1 hover:shadow-2xl transition-transform">
                    <div
                      className={`flex items-center justify-between bg-gradient-to-br ${testType.gradient} px-5 py-4 text-white`}
                    >
                      <div>
                        <p className="flex items-center gap-2 text-lg font-semibold">
                          <Icon className="h-5 w-5" />
                          {testType.name}
                        </p>
                        <p className="text-xs text-white/80">
                          {data.count} session{data.count === 1 ? "" : "s"} completed
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">{data.latest}%</div>
                        <div className="flex items-center justify-end gap-1 text-xs text-white/80">
                          {data.trend > 0 ? (
                            <>
                              <TrendingUp className="h-4 w-4" />
                              <span>+{Math.abs(data.trend).toFixed(1)}%</span>
                            </>
                          ) : data.trend < 0 ? (
                            <>
                              <TrendingDown className="h-4 w-4" />
                              <span>-{Math.abs(data.trend).toFixed(1)}%</span>
                            </>
                          ) : (
                            <>
                              <Activity className="h-4 w-4" />
                              <span>steady</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <CardContent className="space-y-4 bg-gradient-to-br from-white via-slate-50 to-primary/10 py-5 dark:from-slate-900 dark:via-slate-900/70 dark:to-primary/15">
                      {data.count === 0 ? (
                        <div className="rounded-2xl border border-dashed border-muted p-6 text-center text-sm text-muted-foreground">
                          No results yet - run this test to unlock insights.
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-3 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Average</span>
                              <span className="font-semibold text-primary">{data.avg}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Best Score</span>
                              <span className="font-semibold text-emerald-600">{data.best}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Latest Score</span>
                              <span className="font-semibold text-primary">{data.latest}%</span>
                            </div>
                          </div>
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Recent Scores
                            </p>
                            <div className="flex h-16 items-end gap-1.5">
                              {data.tests.slice(-12).map((test, index) => (
                                <div
                                  key={`${test.created_at}-${index}`}
                                  className="flex-1 rounded-t-md bg-gradient-to-t from-primary/20 via-primary/40 to-primary/60"
                                  style={{ height: `${Math.min(test.score ?? 0, 100)}%` }}
                                  title={
                                    test.created_at
                                      ? `${test.score ?? 0}% • ${new Date(test.created_at).toLocaleDateString()}`
                                      : `${test.score ?? 0}%`
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </section>

            <Card className="mt-10 rounded-[28px] border border-primary/15 bg-gradient-to-br from-white via-slate-50 to-primary/10 shadow-xl hover:shadow-2xl dark:from-slate-900 dark:via-slate-900/80 dark:to-primary/10">
              <CardHeader>
                <CardTitle>Recent Test History</CardTitle>
                <CardDescription>A snapshot of your latest sessions.</CardDescription>
              </CardHeader>
              <CardContent>
                {sortedHistory.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-muted p-8 text-center text-sm text-muted-foreground">
                    No test history yet. Complete some tests to see your progress.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sortedHistory.slice(-15).reverse().map((test, idx) => {
                      const score = test.score ?? 0;
                      const matchingType = TEST_TYPES.find((entry) => entry.keys.includes(test.test_type ?? ""));
                      const Icon = matchingType?.icon ?? Sparkles;
                      const gradient = matchingType?.gradient ?? "from-slate-500 to-slate-700";
                      const date = test.created_at ? new Date(test.created_at) : null;
                      const formattedDate =
                        date && !Number.isNaN(date.getTime())
                          ? `${format(date, "MMM d, yyyy")} • ${format(date, "h:mm a")}`
                          : "Recent session";

                      const scoreColor =
                        score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-rose-600";

                      return (
                        <div
                          key={`${test.id ?? test.created_at ?? idx}`}
                          className="flex items-center justify-between rounded-xl border border-primary/20 bg-white/70 px-4 py-3 shadow-sm backdrop-blur dark:bg-slate-900/70"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-white shadow`}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{formatTestLabel(test.test_type)}</p>
                              <p className="text-xs text-muted-foreground">{formattedDate}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${scoreColor}`}>{score}%</p>
                            <p className="text-xs text-muted-foreground">+{test.xp_earned ?? 0} XP</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
