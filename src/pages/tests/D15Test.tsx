import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, RotateCcw, Shuffle, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { deltaE76, confusionAxisAngle, labToSrgb, type Lab } from "@/lib/colourUtils";
import { D15_CAPS, LD15_CAPS, type HueCap } from "@/modules/color-vision/d15/caps";
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

const classifyArrangement = (labs: Lab[], pairDeltaEs: number[], totalDeltaE: number): ArrangementMetrics => {
  const axisAngle = confusionAxisAngle(labs);
  const crossings = calculateCrossings(labs);

  // Heuristic severity bands; refine with clinical tuning.
  const severity =
    totalDeltaE < 140
      ? "Normal"
      : totalDeltaE < 220
        ? "Mild"
        : totalDeltaE < 320
          ? "Moderate"
          : "Severe";

  const angle = axisAngle;
  let suspected: ArrangementMetrics["suspected"] = "Inconclusive";
  if (totalDeltaE < 140 && crossings === 0) {
    suspected = "Normal";
  } else if ((angle >= 330 || angle < 30) || (angle >= 150 && angle < 210)) {
    suspected = "Protan";
  } else if (angle >= 30 && angle < 90) {
    suspected = "Deutan";
  } else if (angle >= 90 && angle < 150) {
    suspected = "Tritan";
  }

  return { totalDeltaE, pairDeltaEs, axisAngle, crossings, severity, suspected };
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

export default function D15Test() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>("calibration");
  const [panelType, setPanelType] = useState<PanelType>("D15");
  const [arrangement, setArrangement] = useState<HueCap[]>(createInitialArrangement(D15_CAPS));
  const [dragging, setDragging] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<InteractionLog[]>([]);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<ArrangementMetrics | null>(null);
  const [lightingAcknowledged, setLightingAcknowledged] = useState(false);
  const [blueLightDisabled, setBlueLightDisabled] = useState(false);
  const [brightnessAdjusted, setBrightnessAdjusted] = useState(false);
  const [distanceChecked, setDistanceChecked] = useState(false);
  const [practiceOrder, setPracticeOrder] = useState<string[]>(["warm", "neutral", "cool"]);
  const [practiceDrag, setPracticeDrag] = useState<string | null>(null);

  const caps = useMemo(() => (panelType === "D15" ? D15_CAPS : LD15_CAPS), [panelType]);

  useEffect(() => {
    setArrangement(createInitialArrangement(caps));
    setInteractions([]);
    setMetrics(null);
    setStartMs(Date.now());
  }, [caps]);

  const handleDragStart = (capId: string, isFixed: boolean) => {
    if (isFixed) return;
    setDragging(capId);
  };

  const handleDrop = (targetId: string) => {
    if (!dragging) return;
    const next = [...arrangement];
    const fromIndex = next.findIndex((c) => c.capId === dragging);
    const toIndex = next.findIndex((c) => c.capId === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    if (next[toIndex].isFixed) return;
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setArrangement(next);
    setInteractions((logs) => [...logs, { capId: dragging, fromIndex, toIndex, timestamp: Date.now() }]);
    setDragging(null);
  };

  const handleAnalyze = () => {
    const labs = arrangement.map((cap) => cap.lab);
    const pairDeltaEs: number[] = [];
    for (let i = 0; i < labs.length - 1; i += 1) {
      pairDeltaEs.push(deltaE76(labs[i], labs[i + 1]));
    }
    const totalDeltaE = pairDeltaEs.reduce((sum, v) => sum + v, 0);
    const summary = classifyArrangement(labs, pairDeltaEs, totalDeltaE);
    setMetrics(summary);
    setStage("summary");
    toast({
      title: "Analysis complete",
      description: `${summary.suspected} | ${summary.severity}`,
    });
  };

  const handleReset = () => {
    setArrangement(createInitialArrangement(caps));
    setInteractions([]);
    setMetrics(null);
    setStartMs(Date.now());
  };

  const handlePracticeDrop = (target: string) => {
    if (!practiceDrag) return;
    const next = [...practiceOrder];
    const from = next.indexOf(practiceDrag);
    const to = next.indexOf(target);
    next.splice(from, 1);
    next.splice(to, 0, practiceDrag);
    setPracticeOrder(next);
    setPracticeDrag(null);
  };

  const practiceComplete = practiceOrder.join(",") === "warm,neutral,cool";

  const neutralBg =
    "bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950";

  return (
    <div className={`min-h-screen ${neutralBg}`}>
      <header className="border-b border-border/40 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={logo} alt="AIris" className="h-10" />
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={panelType === "D15" ? "default" : "outline"}
              size="sm"
              onClick={() => setPanelType("D15")}
              className="rounded-full"
            >
              Standard D-15
            </Button>
            <Button
              variant={panelType === "LD15" ? "default" : "outline"}
              size="sm"
              onClick={() => setPanelType("LD15")}
              className="rounded-full"
            >
              Desaturated (Lanthony)
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-8 px-4 py-10">
        <Card className="border-none bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-white shadow-2xl">
          <CardContent className="space-y-5 p-8">
            <div className="flex items-center gap-3">
              <Palette className="h-10 w-10 text-primary" />
              <div>
                <p className="text-sm uppercase tracking-[0.35rem] text-white/60">Farnsworth D-15</p>
                <h1 className="text-3xl font-semibold">Hue arrangement screening for colour vision</h1>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-white/10 p-4 text-sm shadow-lg backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-white/60">Purpose</p>
                <p className="mt-1 text-white/90">Screens red-green and blue-yellow pathways; complements Ishihara.</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 text-sm shadow-lg backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-white/60">Basis</p>
                <p className="mt-1 text-white/90">15 hue caps arranged on the CIELAB circle; fixed anchors.</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 text-sm shadow-lg backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-white/60">Disclaimer</p>
                <p className="mt-1 text-white/90">
                  Screening tool only. Display and lighting affect results. Clinician interpretation required.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {stage === "calibration" && (
          <Card className="border border-border/60 bg-card/80 shadow-lg">
            <CardContent className="space-y-6 p-8">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Calibration</h2>
                  <p className="text-sm text-muted-foreground">
                    Complete these steps before any colour screening.
                  </p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <label className="flex items-center gap-3">
                  <Input
                    type="checkbox"
                    checked={blueLightDisabled}
                    onChange={(e) => setBlueLightDisabled(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span>Disable Night Shift / True Tone / blue-light filters.</span>
                </label>
                <label className="flex items-center gap-3">
                  <Input
                    type="checkbox"
                    checked={brightnessAdjusted}
                    onChange={(e) => setBrightnessAdjusted(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span>Set comfortable brightness using the greyscale strip.</span>
                </label>
                <label className="flex items-center gap-3">
                  <Input
                    type="checkbox"
                    checked={distanceChecked}
                    onChange={(e) => setDistanceChecked(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span>Use neutral indoor lighting; avoid coloured casts.</span>
                </label>
                <label className="flex items-center gap-3">
                  <Input
                    type="checkbox"
                    checked={lightingAcknowledged}
                    onChange={(e) => setLightingAcknowledged(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span>Hold device at arm&apos;s length; keep screen straight-on.</span>
                </label>
              </div>
              <Button
                onClick={() => setStage("practice")}
                disabled={!(blueLightDisabled && brightnessAdjusted && distanceChecked && lightingAcknowledged)}
                className="w-full rounded-full"
              >
                Continue to practice
              </Button>
            </CardContent>
          </Card>
        )}

        {stage === "practice" && (
          <Card className="border border-border/60 bg-card/80 shadow-lg">
            <CardContent className="space-y-6 p-8">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Practice (3 caps)</h2>
                  <p className="text-sm text-muted-foreground">
                    Drag the caps into smooth order: warm → neutral → cool. Caps snap into place.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {practiceOrder.map((cap) => (
                  <div
                    key={cap}
                    draggable
                    onDragStart={() => setPracticeDrag(cap)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handlePracticeDrop(cap)}
                    className="flex h-14 items-center justify-center rounded-xl border border-border/70 bg-white text-sm font-medium shadow-sm dark:bg-slate-900"
                  >
                    {cap === "warm" ? "Warm hue" : cap === "neutral" ? "Neutral" : "Cool hue"}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setPracticeOrder(["warm", "neutral", "cool"])}>
                  Reset
                </Button>
                <Button
                  onClick={() => setStage("test")}
                  disabled={!practiceComplete}
                  className="rounded-full"
                >
                  Begin test
                </Button>
              </div>
              {!practiceComplete && (
                <p className="text-xs text-muted-foreground">
                  Arrange the practice caps correctly to unlock the test.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {stage === "test" && (
          <Card className="border border-border/60 bg-card/80 shadow-lg">
            <CardContent className="space-y-6 p-8">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                  Arrange the hue caps
                </h2>
                <p className="text-sm text-muted-foreground">
                  Drag the movable caps into the smoothest colour circle between the fixed anchors. Identical shape and luminance to prevent cues.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>Runtime: {startMs ? Math.round((Date.now() - startMs) / 1000) : 0}s</span>
                <span aria-hidden>•</span>
                <span>Interaction logs: {interactions.length}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                      className="flex items-center gap-3 rounded-xl border border-border/70 bg-white/80 p-3 shadow-sm transition hover:-translate-y-0.5 dark:bg-slate-900/70"
                    >
                      <div
                        className="h-12 w-12 shrink-0 rounded-full border border-border"
                        style={{ background: color }}
                        aria-label={`Cap ${cap.capId}`}
                      />
                      <div className="flex flex-col text-sm">
                        <span className="font-semibold text-slate-900 dark:text-slate-50">
                          {cap.capId}
                          {cap.isFixed && " (fixed)"}
                        </span>
                        <span className="text-xs text-muted-foreground">L*,a*,b*: {cap.lab.map((n) => n.toFixed(1)).join(", ")}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleAnalyze} className="rounded-full">
                  Submit & analyse
                </Button>
                <Button variant="outline" onClick={handleReset} className="rounded-full">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset order
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setArrangement((prev) => createInitialArrangement(prev))}
                  className="rounded-full"
                >
                  <Shuffle className="mr-2 h-4 w-4" />
                  Shuffle movable caps
                </Button>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Integrity reminders</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>Maximum runtime goal: under 8 minutes to reduce fatigue.</li>
                  <li>Pause allowed; avoid changing lighting or display settings mid-test.</li>
                  <li>Results are for screening; a licensed clinician must interpret outcomes.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {stage === "summary" && metrics && (
          <Card className="border border-border/60 bg-card/80 shadow-lg">
            <CardContent className="space-y-6 p-8">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Screening summary</h2>
                  <p className="text-sm text-muted-foreground">AI-assisted interpretation for clinician review.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => setStage("test")} className="rounded-full">
                  Back to caps
                </Button>
                <Button variant="outline" onClick={() => navigate("/dashboard")} className="rounded-full">
                  Return to dashboard
                </Button>
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
