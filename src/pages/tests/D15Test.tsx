import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, RotateCcw, Shuffle, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { deltaE76, confusionAxisAngle, labToSrgb, type Lab } from "@/lib/colourUtils";
import { D15_CAPS, LD15_CAPS, type HueCap } from "@/modules/color-vision/d15/caps";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useXP } from "@/hooks/useXP";
import { recordTestCompletionStreak } from "@/utils/streak";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

type Stage = "calibration" | "practice" | "test" | "summary";
type PanelType = "D15" | "LD15";

type InteractionLog = {
  capId: string;
  fromIndex: number;
  toIndex: number;
  timestamp: number;
};

type ArrangementMetrics = {
  totalDeltaE: number;
  pairDeltaEs: number[];
  axisAngle: number;
  crossings: number;
  severity: "Normal" | "Mild" | "Moderate" | "Severe";
  suspected: "Normal" | "Protan" | "Deutan" | "Tritan" | "Inconclusive";
};

const clampHex = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const rgbToHex = (rgb: [number, number, number]) =>
  `#${rgb.map((c) => clampHex(c).toString(16).padStart(2, "0")).join("")}`;

const shuffleCaps = (caps: HueCap[]) => {
  const mutable = [...caps];
  for (let i = mutable.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [mutable[i], mutable[j]] = [mutable[j], mutable[i]];
  }
  return mutable;
};

const calculateCrossings = (labs: Lab[]): number => {
  // Simple segment intersection counter on a*b* plane; ignores consecutive segments sharing a point.
  const points = labs.map(([_, a, b]) => ({ a, b }));
  let crossings = 0;
  for (let i = 0; i < points.length - 1; i++) {
    for (let j = i + 2; j < points.length - 1; j++) {
      if (i === 0 && j === points.length - 2) continue; // skip shared endpoints
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[j];
      const p4 = points[j + 1];

      const d =
        (p4.b - p3.b) * (p2.a - p1.a) -
        (p4.a - p3.a) * (p2.b - p1.b);
      if (d === 0) continue; // parallel
      const ua =
        ((p4.a - p3.a) * (p1.b - p3.b) - (p4.b - p3.b) * (p1.a - p3.a)) / d;
      const ub =
        ((p2.a - p1.a) * (p1.b - p3.b) - (p2.b - p1.b) * (p1.a - p3.a)) / d;
      if (ua > 0 && ua < 1 && ub > 0 && ub < 1) {
        crossings += 1;
      }
    }
  }
  return crossings;
};

const classifyArrangement = (
  labs: Lab[],
  pairDeltaEs: number[],
  totalDeltaE: number,
  arrangement: HueCap[],
  referenceCaps: HueCap[],
): ArrangementMetrics & { score: number } => {
  const axisAngle = confusionAxisAngle(labs);
  const crossings = calculateCrossings(labs);

  const movableOrder = arrangement.filter((c) => !c.isFixed).map((c) => c.capId);
  const idealOrder = referenceCaps.filter((c) => !c.isFixed).map((c) => c.capId);
  const reversedIdeal = [...idealOrder].reverse();

  const isPerfect =
    movableOrder.join("|") === idealOrder.join("|") || movableOrder.join("|") === reversedIdeal.join("|");

  const indexMap = new Map<string, number>();
  idealOrder.forEach((id, idx) => indexMap.set(id, idx));
  let displacement = 0;
  movableOrder.forEach((id, idx) => {
    const idealIdx = indexMap.get(id) ?? idx;
    displacement += Math.abs(idx - idealIdx);
  });
  const maxDisplacement = (idealOrder.length * (idealOrder.length - 1)) / 2 || 1;
  const score = isPerfect ? 100 : Math.max(0, Math.round(100 * (1 - displacement / maxDisplacement)));

  const severity =
    score >= 90 && crossings === 0
      ? "Normal"
      : totalDeltaE < 140
        ? "Normal"
        : totalDeltaE < 220
          ? "Mild"
          : totalDeltaE < 320
            ? "Moderate"
            : "Severe";

  const angle = axisAngle;
  let suspected: ArrangementMetrics["suspected"] = "Inconclusive";
  if (isPerfect || (score >= 90 && crossings === 0)) {
    suspected = "Normal";
  } else if ((angle >= 330 || angle < 30) || (angle >= 150 && angle < 210)) {
    suspected = "Protan";
  } else if (angle >= 30 && angle < 90) {
    suspected = "Deutan";
  } else if (angle >= 90 && angle < 150) {
    suspected = "Tritan";
  }

  return { totalDeltaE, pairDeltaEs, axisAngle, crossings, severity, suspected, score };
};

const createInitialArrangement = (caps: HueCap[]) => {
  const fixed = caps.filter((c) => c.isFixed);
  const movable = caps.filter((c) => !c.isFixed);
  const shuffled = shuffleCaps(movable);
  // keep first fixed at start, last fixed at end; others append.
  const start = fixed[0] ? [fixed[0]] : [];
  const end = fixed[fixed.length - 1] && fixed.length > 1 ? [fixed[fixed.length - 1]] : [];
  const middle = fixed.length > 2 ? fixed.slice(1, -1) : [];
  return [...start, ...shuffled, ...middle, ...end];
};

type D15Props = {
  initialPanelType?: PanelType;
  lockPanelType?: boolean;
  titleOverride?: string;
};

export default function D15Test({ initialPanelType = "D15", lockPanelType = false, titleOverride }: D15Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { xp, refetch: refetchXp } = useXP(user?.id);
  const [stage, setStage] = useState<Stage>("calibration");
  const [panelType, setPanelType] = useState<PanelType>(initialPanelType);
  const [arrangement, setArrangement] = useState<HueCap[]>(createInitialArrangement(D15_CAPS));
  const [dragging, setDragging] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<InteractionLog[]>([]);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<(ArrangementMetrics & { score: number }) | null>(null);
  const [lightingAcknowledged, setLightingAcknowledged] = useState(false);
  const [blueLightDisabled, setBlueLightDisabled] = useState(false);
  const [brightnessAdjusted, setBrightnessAdjusted] = useState(false);
  const [distanceChecked, setDistanceChecked] = useState(false);
  const [practiceOrder, setPracticeOrder] = useState<string[]>(["cool", "neutral", "warm"]);
  const [practiceDrag, setPracticeDrag] = useState<string | null>(null);
  const [shuffleCount, setShuffleCount] = useState(0);
  const [resetCount, setResetCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [tick, setTick] = useState(0);
  const [selectedCapId, setSelectedCapId] = useState<string | null>(null);

  useEffect(() => {
    if (lockPanelType) {
      setPanelType(initialPanelType);
    }
  }, [initialPanelType, lockPanelType]);

  const caps = useMemo(() => (panelType === "D15" ? D15_CAPS : LD15_CAPS), [panelType]);

  useEffect(() => {
    setArrangement(createInitialArrangement(caps));
    setInteractions([]);
    setMetrics(null);
    setStartMs(Date.now());
    setShuffleCount(0);
    setResetCount(0);
  }, [caps]);

  useEffect(() => {
    if (stage !== "test" || !startMs) return;
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [stage, startMs]);

  const handleDragStart = (capId: string, isFixed: boolean) => {
    if (isFixed) return;
    setDragging(capId);
    setSelectedCapId(null); // Clear selection when starting a drag
  };

  const handleDrop = (targetId: string) => {
    if (!dragging) return;
    performMove(dragging, targetId);
    setDragging(null);
  };

  const performMove = (sourceId: string, targetId: string) => {
    const next = [...arrangement];
    const fromIndex = next.findIndex((c) => c.capId === sourceId);
    const toIndex = next.findIndex((c) => c.capId === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    if (next[toIndex].isFixed) return;

    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setArrangement(next);
    setInteractions((logs) => [...logs, { capId: sourceId, fromIndex, toIndex, timestamp: Date.now() }]);
  };

  const handleCapClick = (capId: string, isFixed: boolean) => {
    if (isFixed) return;

    if (!selectedCapId) {
      setSelectedCapId(capId);
    } else if (selectedCapId === capId) {
      setSelectedCapId(null);
    } else {
      performMove(selectedCapId, capId);
      setSelectedCapId(null);
    }
  };

  const handleAnalyze = async () => {
    if (submitting) return;
    setSubmitting(true);
    const labs = arrangement.map((cap) => cap.lab);
    const pairDeltaEs: number[] = [];
    for (let i = 0; i < labs.length - 1; i += 1) {
      pairDeltaEs.push(deltaE76(labs[i], labs[i + 1]));
    }
    const totalDeltaE = pairDeltaEs.reduce((sum, v) => sum + v, 0);
    const summary = classifyArrangement(labs, pairDeltaEs, totalDeltaE, arrangement, caps);
    setMetrics(summary);
    setStage("summary");
    const runtimeMs = startMs ? Date.now() - startMs : null;

    const score = summary.score ?? 0;
    toast({
      title: "Analysis complete",
      description: `${summary.suspected} | ${summary.severity}`,
    });

    if (user) {
      try {
        const resultTestType =
          lockPanelType && initialPanelType === "LD15"
            ? "d15_desaturated"
            : panelType === "LD15"
              ? "d15_desaturated"
              : "d15";
        const xpEarned = Math.round(30 + (score / 100) * 20);
        const reordersByCap = interactions.reduce<Record<string, number>>((acc, log) => {
          acc[log.capId] = (acc[log.capId] ?? 0) + 1;
          return acc;
        }, {});

        await supabase.from("test_results").insert({
          user_id: user.id,
          test_type: resultTestType,
          score,
          xp_earned: xpEarned,
          details: {
            arrangement: arrangement.map((c) => c.capId),
            panelType,
            metrics: summary,
            interactions,
            interactionStats: { total: interactions.length, reordersByCap },
            shuffleCount,
            resetCount,
            runtimeMs,
            timing: {
              sessionDurationMs: runtimeMs,
              averageQuestionDurationMs: null,
              perQuestion: [],
            },
          },
        });

        await supabase.rpc("update_user_xp", {
          p_user_id: user.id,
          p_xp_delta: xpEarned,
        });

        await recordTestCompletionStreak(user.id);
        await refetchXp();
      } catch (err: any) {
        console.error("Failed to save D15 result", err);
        toast({
          title: "Could not save result",
          description: err?.message ?? "Please try again.",
          variant: "destructive",
        });
      }
    }
    setSubmitting(false);
  };

  const handleReset = () => {
    setArrangement(createInitialArrangement(caps));
    setInteractions([]);
    setMetrics(null);
    setStartMs((prev) => prev ?? Date.now());
    setResetCount((c) => c + 1);
  };

  const handlePracticeDrop = (target: string) => {
    if (!practiceDrag) return;
    performPracticeMove(practiceDrag, target);
    setPracticeDrag(null);
  };

  const performPracticeMove = (source: string, target: string) => {
    const next = [...practiceOrder];
    const from = next.indexOf(source);
    const to = next.indexOf(target);
    next.splice(from, 1);
    next.splice(to, 0, source);
    setPracticeOrder(next);
  };

  const handlePracticeClick = (cap: string) => {
    if (!practiceDrag) {
      setPracticeDrag(cap);
    } else if (practiceDrag === cap) {
      setPracticeDrag(null);
    } else {
      performPracticeMove(practiceDrag, cap);
      setPracticeDrag(null);
    }
  };

  const practiceComplete = practiceOrder.join(",") === "cool,neutral,warm";

  const neutralBg =
    "bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950";

  return (
    <div className={`min-h-screen ${neutralBg}`}>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-50/70 backdrop-blur-md dark:bg-slate-950/70 supports-[backdrop-filter]:bg-slate-50/40 dark:supports-[backdrop-filter]:bg-slate-950/40">
        <div className="container mx-auto flex items-center gap-3 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full hover:bg-white/20">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2" onClick={() => navigate("/dashboard")}>
            <img src={logo} alt="AIris" className="h-8 drop-shadow-md cursor-pointer" />
            <span className="font-bold tracking-tight">Farnsworth D-15</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {lockPanelType ? (
              <span className="rounded-full bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground backdrop-blur-sm border border-white/10">
                {panelType === "LD15" ? "Desaturated D-15" : "Standard D-15"}
              </span>
            ) : (
              <div className="flex bg-muted/30 p-1 rounded-full border border-white/10 backdrop-blur-sm">
                <Button
                  variant={panelType === "D15" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPanelType("D15")}
                  className={`rounded-full px-3 h-7 text-xs ${panelType === "D15" ? "bg-white shadow-sm dark:bg-slate-800" : ""}`}
                >
                  Standard
                </Button>
                <Button
                  variant={panelType === "LD15" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPanelType("LD15")}
                  className={`rounded-full px-3 h-7 text-xs ${panelType === "LD15" ? "bg-white shadow-sm dark:bg-slate-800" : ""}`}
                >
                  Desaturated
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-8 px-6 py-4">
        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8 shadow-2xl text-white">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
          <div className="relative z-10 grid gap-8 md:grid-cols-[1.5fr,1fr] items-center">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/70">Farnsworth D-15</p>
                <h1 className="text-3xl font-bold md:text-4xl">
                  {titleOverride ?? "Arrange hues to screen color vision"}
                </h1>
              </div>
              <p className="text-indigo-100 max-w-lg leading-relaxed">
                Arrange 15 hue caps to form a smooth transition. This screens for red-green and blue-yellow deficiencies.
              </p>
            </div>
            <div className="grid gap-3 text-sm">
              <div className="rounded-xl bg-white/10 border border-white/10 p-3 backdrop-blur-md flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg"><Palette className="h-4 w-4" /></div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide opacity-70">Method</p>
                  <p className="font-medium">15 caps on CIELAB circle</p>
                </div>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/10 p-3 backdrop-blur-md flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg"><CheckCircle2 className="h-4 w-4" /></div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide opacity-70">Reward</p>
                  <p className="font-medium">Up to 30 XP</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {stage === "calibration" && (
          <Card className="glass-card border-none shadow-none bg-transparent">
            <CardContent className="space-y-8 p-0">
              <div className="rounded-3xl bg-white/50 border border-white/20 backdrop-blur-sm p-8 dark:bg-slate-900/50">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Calibration</h2>
                    <p className="text-muted-foreground text-sm">Complete these steps for accuracy.</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  {/* ... checkbox labels rewritten slightly for consistency if desired, keeping content same */}
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-white/40 bg-white/40 hover:bg-white/60 transition-colors cursor-pointer dark:bg-slate-800/40 dark:border-white/10">
                    <Input
                      type="checkbox"
                      checked={blueLightDisabled}
                      onChange={(e) => setBlueLightDisabled(e.target.checked)}
                      className="h-5 w-5 rounded-md border-primary text-primary focus:ring-primary"
                    />
                    <span>Disable Night Shift / Blue-light filters.</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-white/40 bg-white/40 hover:bg-white/60 transition-colors cursor-pointer dark:bg-slate-800/40 dark:border-white/10">
                    <Input
                      type="checkbox"
                      checked={brightnessAdjusted}
                      onChange={(e) => setBrightnessAdjusted(e.target.checked)}
                      className="h-5 w-5 rounded-md border-primary text-primary focus:ring-primary"
                    />
                    <span>Brightness adjusted comfortably.</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-white/40 bg-white/40 hover:bg-white/60 transition-colors cursor-pointer dark:bg-slate-800/40 dark:border-white/10">
                    <Input
                      type="checkbox"
                      checked={distanceChecked}
                      onChange={(e) => setDistanceChecked(e.target.checked)}
                      className="h-5 w-5 rounded-md border-primary text-primary focus:ring-primary"
                    />
                    <span>Neutral lighting (no colored casts).</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-white/40 bg-white/40 hover:bg-white/60 transition-colors cursor-pointer dark:bg-slate-800/40 dark:border-white/10">
                    <Input
                      type="checkbox"
                      checked={lightingAcknowledged}
                      onChange={(e) => setLightingAcknowledged(e.target.checked)}
                      className="h-5 w-5 rounded-md border-primary text-primary focus:ring-primary"
                    />
                    <span>Device at arm&apos;s length, straight on.</span>
                  </label>
                </div>

                <div className="mt-6 space-y-3 rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-5">
                  <p className="text-sm font-semibold">Brightness Check</p>
                  <p className="text-xs text-muted-foreground">Ensure you can distinguish all 12 steps below.</p>
                  <div className="flex gap-1 h-10 w-full rounded-lg overflow-hidden border border-border/50">
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const v = Math.round((idx / 11) * 255);
                      const hex = v.toString(16).padStart(2, "0");
                      return (
                        <div
                          key={idx}
                          className="flex-1"
                          style={{ background: `#${hex}${hex}${hex}` }}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="mt-8">
                  <Button
                    onClick={() => setStage("practice")}
                    disabled={!(blueLightDisabled && brightnessAdjusted && distanceChecked && lightingAcknowledged)}
                    className="w-full h-12 rounded-full bg-gradient-to-r from-primary to-blue-600 shadow-lg shadow-blue-500/20 text-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                  >
                    Continue to Practice
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {stage === "practice" && (
          <Card className="glass-card border-none shadow-none bg-transparent">
            <CardContent className="space-y-6 p-0">
              <div className="rounded-3xl bg-white/50 border border-white/20 backdrop-blur-sm p-8 text-center dark:bg-slate-900/50">
                <h2 className="text-2xl font-bold mb-2">Practice Round</h2>
                <p className="text-muted-foreground mb-8 text-base">Drag the caps to form a smooth transition: Cool → Neutral → Warm.</p>

                <div className="flex justify-center gap-4 mb-8">
                  {practiceOrder.map((cap) => (
                    <div
                      key={cap}
                      draggable
                      onDragStart={() => setPracticeDrag(cap)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handlePracticeDrop(cap)}
                      onClick={() => handlePracticeClick(cap)}
                      className={cn(
                        "flex h-20 w-32 items-center justify-center rounded-2xl border-2 bg-white shadow-lg cursor-grab active:cursor-grabbing hover:-translate-y-1 transition-all dark:bg-slate-800",
                        practiceDrag === cap ? "border-primary ring-4 ring-primary/20 scale-105" : "border-white/50 dark:border-white/10"
                      )}
                    >
                      <span className={`font-semibold ${cap === "warm" ? "text-orange-500" : cap === "cool" ? "text-blue-500" : "text-slate-500"}`}>
                        {cap === "warm" ? "Warm" : cap === "neutral" ? "Neutral" : "Cool"}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-center gap-4">
                  <Button variant="ghost" className="rounded-full" onClick={() => setPracticeOrder(["cool", "neutral", "warm"])}>
                    Reset
                  </Button>
                  <Button
                    onClick={() => {
                      setStartMs(Date.now());
                      setStage("test");
                    }}
                    disabled={!practiceComplete}
                    className="rounded-full px-8 bg-gradient-to-r from-primary to-blue-600 shadow-md hover:shadow-lg"
                  >
                    Begin Test
                  </Button>
                </div>
                {!practiceComplete && (
                  <p className="mt-4 text-sm text-red-500/80 font-medium animate-pulse">
                    Arrange correctly to proceed.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {stage === "test" && (
          <Card className="glass-card border-none shadow-none bg-transparent">
            <CardContent className="space-y-8 p-0">
              <div className="rounded-3xl bg-white/50 border border-white/20 backdrop-blur-sm p-6 dark:bg-slate-900/50">
                <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">Arrange the Colors</h2>
                    <p className="text-muted-foreground text-sm">Drag movable caps to form a smooth hue circle between fixed anchors.</p>
                  </div>
                  <div className="flex gap-4 text-xs font-mono bg-white/40 px-3 py-1.5 rounded-full border border-white/20 dark:bg-slate-800/40">
                    <span>Time: {startMs ? Math.round((Date.now() - startMs) / 1000) : 0}s</span>
                    <span>Moves: {interactions.length}</span>
                  </div>
                </div>

                <div className="overflow-x-auto pb-4 custom-scrollbar">
                  <div className="flex min-w-max items-center gap-2 p-4 rounded-2xl bg-white/40 border border-white/20 dark:bg-slate-900/30">
                    {arrangement.map((cap) => {
                      const [r, g, b] = labToSrgb(cap.lab);
                      const color = rgbToHex([r, g, b]);
                      return (
                        <div
                          key={cap.capId}
                          draggable={!cap.isFixed}
                          onDragStart={() => handleDragStart(cap.capId, cap.isFixed)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDrop(cap.capId)}
                          onClick={() => handleCapClick(cap.capId, cap.isFixed)}
                          className={cn(
                            "relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full shadow-sm transition-all hover:scale-110",
                            !cap.isFixed ? 'cursor-grab active:cursor-grabbing hover:-translate-y-1' : '',
                            selectedCapId === cap.capId ? "ring-4 ring-primary ring-offset-4 ring-offset-white dark:ring-offset-slate-950 scale-110 z-10" : ""
                          )}
                          aria-label={cap.isFixed ? "Fixed anchor cap" : "Movable cap"}
                        >
                          <div
                            className={cn(
                              "rounded-full shadow-inner transition-transform",
                              cap.isFixed ? "h-12 w-12 ring-4 ring-white/50 dark:ring-white/20" : "h-16 w-16 border-4 border-white dark:border-slate-800"
                            )}
                            style={{ background: color }}
                          />
                          {cap.isFixed && (
                            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
                              Fixed
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                  <Button variant="ghost" onClick={handleReset} className="rounded-full hover:bg-white/40">
                    <RotateCcw className="mr-2 h-4 w-4" /> Reset
                  </Button>
                  <Button variant="ghost" onClick={() => {
                    setArrangement(createInitialArrangement(caps));
                    setShuffleCount((c) => c + 1);
                    setStartMs((prev) => prev ?? Date.now());
                  }} className="rounded-full hover:bg-white/40">
                    <Shuffle className="mr-2 h-4 w-4" /> Shuffle
                  </Button>
                  <Button onClick={handleAnalyze} disabled={submitting} className="rounded-full px-8 bg-gradient-to-r from-primary to-blue-600 shadow-md hover:shadow-lg">
                    Submit Analysis
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {stage === "summary" && metrics && (
          <Card className="glass-card border-none shadow-none bg-transparent">
            <CardContent className="space-y-8 p-0">
              <div className="rounded-3xl bg-white/50 border border-white/20 backdrop-blur-sm p-8 dark:bg-slate-900/50">
                <div className="flex items-center gap-3 mb-8">
                  <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Screening Summary</h2>
                    <p className="text-muted-foreground">AI-assisted interpretation.</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Score</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
                      {metrics.score.toFixed(0)} / 100
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Suspected pathway</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">{metrics.suspected}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Severity</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">{metrics.severity}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Confusion axis</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
                      {metrics.axisAngle.toFixed(1)}°
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Total ΔE</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
                      {metrics.totalDeltaE.toFixed(1)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Crossings (a*b*)</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">{metrics.crossings}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Pair ΔE avg</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
                      {metrics.pairDeltaEs.length ? (metrics.totalDeltaE / metrics.pairDeltaEs.length).toFixed(1) : "—"}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-xs text-muted-foreground">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Disclaimers</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    <li>Screening tool — not a medical diagnosis.</li>
                    <li>Results depend on display calibration and ambient lighting.</li>
                    <li>A licensed clinician must interpret results and advise next steps.</li>
                  </ul>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                  <Button
                    onClick={() => {
                      setStage("test");
                      setStartMs(Date.now());
                      setMetrics(null);
                      setInteractions([]);
                    }}
                    className="rounded-full"
                  >
                    Back to caps
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/dashboard")} className="rounded-full">
                    Return to dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {stage === "summary" && !metrics && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Preparing summary…</span>
          </div>
        )}
      </main>
    </div>
  );
}
