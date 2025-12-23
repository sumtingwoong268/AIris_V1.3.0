import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useXP } from "@/hooks/useXP";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";
import { XPBar } from "@/components/XPBar";
import { useTestTimer, type QuestionTimingRecord } from "@/hooks/useTestTimer";
import { TestTimerDisplay } from "@/components/tests/TestTimerDisplay";
import { recordTestCompletionStreak } from "@/utils/streak";

interface PlateData {
  id: number;
  image: string;
  analysis: {
    raw?: string;
    normal?: string;
    second_line?: string;
    color_blindness_if_other_raw?: string;
    color_blindness_if_other?: Record<string, string>;
    type_inferred?: string;
    plate_class?: string;
  };
}

interface ManifestData {
  plates: PlateData[];
}

interface TestAnswer {
  plateId: number;
  answer: string;
  normalizedAnswer: string;
  expectedNormal: string;
  alternateOutcomes: {
    key: string;
    label: string;
    answer: string;
    normalizedAnswer: string;
  }[];
  matchedOutcome: string | null;
  matchedOutcomeLabel: string | null;
  correct: boolean;
  plateType: string | null;
  plateTypeNormalized: string | null;
  plateClass: string | null;
  timing?: QuestionTimingRecord | null;
}

type Phase = "idle" | "control" | "redGreen" | "diagnostic" | "targeted" | "complete";

const TYPE_CONTROL = "control";
const TYPE_RED_GREEN = "red_green_deficiency";
const TYPE_DIAGNOSTIC = "diagnostic_red_green";
const TYPE_DEUTAN = "deutanopia";
const TYPE_PROTAN = "protanopia";

const MAX_TOTAL_PLATES = 15;
const RED_GREEN_BASE_COUNT = 3;
const RED_GREEN_MAX_EXTRA = 2;
const DIAGNOSTIC_MIN_COUNT = 2;
const DIAGNOSTIC_MAX_COUNT = 4;
const TARGET_FOCUS_COUNT = 3;
const TARGET_SECONDARY_COUNT = 2;
const FINAL_PROTAN_COUNT = 1;

const normalizeType = (value?: string | null): string | null => {
  if (!value) return null;
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
};

const normalizeOutcomeKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export default function IshiharaTest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { xp, refetch: refetchXP } = useXP(user?.id);
  const { toast } = useToast();
  const [started, setStarted] = useState(false);
  const [currentPlateIndex, setCurrentPlateIndex] = useState(0);
  const [testPlates, setTestPlates] = useState<PlateData[]>([]);
  const [answers, setAnswers] = useState<TestAnswer[]>([]);
  const [manifest, setManifest] = useState<ManifestData | null>(null);
  const [userInput, setUserInput] = useState("");
  const [imageError, setImageError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [controlPlate, setControlPlate] = useState<PlateData | null>(null);
  const [controlAttempts, setControlAttempts] = useState(0);
  const [controlPassAttempt, setControlPassAttempt] = useState<number | null>(null);
  const [controlWarning, setControlWarning] = useState<string | null>(null);
  const [usedPlateIds, setUsedPlateIds] = useState<number[]>([]);
  const [focusType, setFocusType] = useState<"deutanopia" | "protanopia">("deutanopia");
  const [secondaryType, setSecondaryType] = useState<"deutanopia" | "protanopia">("protanopia");
  const [targetedScheduled, setTargetedScheduled] = useState(false);
  const {
    sessionElapsedMs,
    questionElapsedMs,
    hasSessionStarted,
    activeQuestionLabel,
    startSession,
    markQuestionStart,
    completeQuestion,
    completeSession,
    reset: resetTimer,
  } = useTestTimer();

  useEffect(() => {
    fetch("/ishihara_manifest_38.json")
      .then((res) => res.json())
      .then((data: ManifestData) => setManifest(data))
      .catch((err) => console.error("Failed to load manifest:", err));
  }, []);

  useEffect(() => {
    if (phase !== "control" && testPlates.length > 0 && currentPlateIndex < testPlates.length - 1) {
      const nextPlate = testPlates[currentPlateIndex + 1];
      if (nextPlate) {
        const img = new Image();
        img.src = `/${nextPlate.image}`;
      }
    }
  }, [currentPlateIndex, testPlates, phase]);

  const normalizeAnswer = (answer: string): string => {
    let normalized = answer.toLowerCase().trim();
    const nothingVariations = ["nothing", "none", "no", "n/a", "na", "blank", "empty", "0"];
    if (nothingVariations.includes(normalized)) {
      normalized = "nothing";
    }
    normalized = normalized.replace(/[^\w\s-]/g, "").replace(/\s+/g, " ");
    return normalized;
  };

  const pickPlatesByType = (
    type: string,
    desiredCount: number,
    used: Set<number>,
    remainingSlots: number,
  ): PlateData[] => {
    if (!manifest || desiredCount <= 0 || remainingSlots <= 0) return [];
    let needed = Math.min(desiredCount, remainingSlots);
    const picked: PlateData[] = [];

    for (const plate of manifest.plates) {
      if (needed <= 0) break;
      if (used.has(plate.id)) continue;
      const plateType = normalizeType(plate.analysis.type_inferred);
      if (plateType !== type) continue;
      picked.push(plate);
      used.add(plate.id);
      needed -= 1;
    }

    return picked;
  };

  const schedulePlates = (plates: PlateData[]) => {
    if (!plates.length) return;
    setTestPlates((prev) => [...prev, ...plates]);
    setUsedPlateIds((prev) => [...prev, ...plates.map((plate) => plate.id)]);
  };

  const beginRedGreenSequence = () => {
    const used = new Set<number>(usedPlateIds);
    const remainingSlots = Math.max(0, MAX_TOTAL_PLATES - testPlates.length);
    const initial = pickPlatesByType(TYPE_RED_GREEN, 1, used, remainingSlots);

    if (!initial.length) {
      const fallback =
        pickPlatesByType(TYPE_DIAGNOSTIC, 1, used, remainingSlots) ||
        pickPlatesByType(TYPE_DEUTAN, 1, used, remainingSlots) ||
        pickPlatesByType(TYPE_PROTAN, 1, used, remainingSlots);

      if (!fallback.length) {
        toast({
          title: "No plates available",
          description: "Could not load an Ishihara plate sequence. Please refresh and try again.",
          variant: "destructive",
        });
        setPhase("complete");
        return;
      }

      schedulePlates(fallback);
      setPhase("diagnostic");
      setTargetedScheduled(false);
      const first = fallback[0];
      startSession(`plate-${first.id}`, `Plate ${first.id}`);
      setCurrentPlateIndex(0);
      return;
    }

    schedulePlates(initial);
    setPhase("redGreen");
    setTargetedScheduled(false);
    const first = initial[0];
    startSession(`plate-${first.id}`, `Plate ${first.id}`);
    setCurrentPlateIndex(0);
  };

  const handleStart = () => {
    if (!manifest) return;
    resetTimer();
    setStarted(true);
    setAnswers([]);
    setTestPlates([]);
    setUsedPlateIds([]);
    setCurrentPlateIndex(0);
    setCompleted(false);
    setSubmitting(false);
    setTargetedScheduled(false);
    setFocusType("deutanopia");
    setSecondaryType("protanopia");
    setControlAttempts(0);
    setControlPassAttempt(null);
    setControlWarning(null);

    const controlCandidate =
      manifest.plates.find((plate) => normalizeType(plate.analysis.type_inferred) === TYPE_CONTROL) ?? null;
    setControlPlate(controlCandidate);

    if (controlCandidate) {
      setPhase("control");
    } else {
      setPhase("redGreen");
      beginRedGreenSequence();
    }
  };

  const evaluateAnswer = (plate: PlateData, rawAnswer: string) => {
    const normalizedAnswer = normalizeAnswer(rawAnswer);
    const expectedNormal = normalizeAnswer(plate.analysis.normal || "");
    const alternateEntries = Object.entries(plate.analysis.color_blindness_if_other ?? {});
    const alternateOutcomes = alternateEntries.map(([label, value]) => ({
      key: normalizeOutcomeKey(label),
      label,
      answer: value,
      normalizedAnswer: normalizeAnswer(value),
    }));

    const matchedAlternate =
      alternateOutcomes.find((outcome) => outcome.normalizedAnswer === normalizedAnswer) ?? null;

    const correct = normalizedAnswer === expectedNormal && expectedNormal.length > 0;
    const matchedOutcome = correct ? "normal" : matchedAlternate?.key ?? null;
    const matchedOutcomeLabel = correct ? "Normal vision" : matchedAlternate?.label ?? null;

    return {
      normalizedAnswer,
      expectedNormal,
      alternateOutcomes,
      matchedOutcome,
      matchedOutcomeLabel,
      correct,
    };
  };

  const scheduleTargetedSequence = (focus: "deutanopia" | "protanopia", secondary: "deutanopia" | "protanopia") => {
    if (!manifest) return [];
    const used = new Set<number>([...usedPlateIds, ...testPlates.map((plate) => plate.id)]);
    let remainingSlots = Math.max(0, MAX_TOTAL_PLATES - testPlates.length);
    const planned: PlateData[] = [];

    const take = (type: string, count: number) => {
      if (count <= 0 || remainingSlots <= 0) return;
      for (const plate of manifest.plates) {
        if (remainingSlots <= 0 || count <= 0) break;
        if (used.has(plate.id)) continue;
        const plateType = normalizeType(plate.analysis.type_inferred);
        if (plateType !== type) continue;
        planned.push(plate);
        used.add(plate.id);
        remainingSlots -= 1;
        count -= 1;
      }
    };

    take(focus, TARGET_FOCUS_COUNT);
    if (secondary !== focus) {
      take(secondary, TARGET_SECONDARY_COUNT);
    }

    const needFinalProtan =
      focus === TYPE_PROTAN ? true : secondary === TYPE_PROTAN ? false : true;

    if (needFinalProtan) {
      take(TYPE_PROTAN, FINAL_PROTAN_COUNT);
    }

    schedulePlates(planned);
    setTargetedScheduled(true);
    setPhase("targeted");
    return planned;
  };

  const handleControlAnswer = (overrideAnswer?: string) => {
    if (!controlPlate) return;
    const rawInput = overrideAnswer ?? userInput;
    if (!rawInput.trim()) return;

    const normalizedInput = normalizeAnswer(rawInput);
    const expected = normalizeAnswer(controlPlate.analysis.normal || "");
    const attemptNumber = controlAttempts + 1;
    setControlAttempts(attemptNumber);

    if (normalizedInput === expected && expected.length > 0) {
      setControlPassAttempt(attemptNumber);
      setControlWarning(null);
      setUserInput("");
      beginRedGreenSequence();
    } else {
      setControlWarning(
        "That did not match the control plate. Adjust your screen brightness or viewing angle, then try again.",
      );
      setUserInput("");
    }
  };

  const handleAnswer = (overrideAnswer?: string) => {
    if (!manifest || completed || submitting) return;
    if (phase === "control") {
      handleControlAnswer(overrideAnswer);
      return;
    }
    const rawAnswer = overrideAnswer ?? userInput;
    if (!rawAnswer.trim()) return;

    const currentPlate = testPlates[currentPlateIndex];
    if (!currentPlate) return;

    const { normalizedAnswer, expectedNormal, alternateOutcomes, matchedOutcome, matchedOutcomeLabel, correct } =
      evaluateAnswer(currentPlate, rawAnswer);

    const timingPayload = completeQuestion(`plate-${currentPlate.id}`, `Plate ${currentPlate.id}`);

    const plateTypeNormalized = normalizeType(currentPlate.analysis.type_inferred);

    const newAnswer: TestAnswer = {
      plateId: currentPlate.id,
      answer: rawAnswer,
      normalizedAnswer,
      expectedNormal,
      alternateOutcomes,
      matchedOutcome,
      matchedOutcomeLabel,
      correct,
      plateType: currentPlate.analysis.type_inferred ?? null,
      plateTypeNormalized,
      plateClass: currentPlate.analysis.plate_class ?? null,
      timing: timingPayload.record,
    };

    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);
    setUserInput("");
    setImageError(false);

    let upcomingPlate: PlateData | null = null;

    const redGreenAnswers = newAnswers.filter((answer) => answer.plateTypeNormalized === TYPE_RED_GREEN);
    const redGreenMistakes = redGreenAnswers.filter((answer) => !answer.correct).length;
    const redGreenRequired = Math.min(
      manifest.plates.filter((plate) => normalizeType(plate.analysis.type_inferred) === TYPE_RED_GREEN).length,
      RED_GREEN_BASE_COUNT + Math.min(RED_GREEN_MAX_EXTRA, redGreenMistakes),
    );

    if (phase === "redGreen") {
      if (redGreenAnswers.length < redGreenRequired && testPlates.length < MAX_TOTAL_PLATES) {
        const used = new Set<number>([...usedPlateIds, ...testPlates.map((plate) => plate.id)]);
        const remainingSlots = Math.max(0, MAX_TOTAL_PLATES - testPlates.length);
        const next = pickPlatesByType(TYPE_RED_GREEN, 1, used, remainingSlots);
        if (next.length) {
          schedulePlates(next);
          upcomingPlate = next[0];
        } else {
          setPhase("diagnostic");
        }
      }

      if (!upcomingPlate) {
        setPhase("diagnostic");
        const used = new Set<number>([...usedPlateIds, ...testPlates.map((plate) => plate.id)]);
        const remainingSlots = Math.max(0, MAX_TOTAL_PLATES - testPlates.length);
        const next = pickPlatesByType(TYPE_DIAGNOSTIC, 1, used, remainingSlots);
        if (next.length) {
          schedulePlates(next);
          upcomingPlate = next[0];
        } else {
          const focus = focusType;
          const secondary = focus === "deutanopia" ? "protanopia" : "deutanopia";
          const planned = targetedScheduled ? [] : scheduleTargetedSequence(focus, secondary);
          if (planned.length) {
            upcomingPlate = planned[0];
          }
        }
      }
    } else if (phase === "diagnostic") {
      const diagnosticAnswers = newAnswers.filter((answer) => answer.plateTypeNormalized === TYPE_DIAGNOSTIC);
      const diagMatches = diagnosticAnswers.reduce(
        (acc, answer) => {
          if (answer.matchedOutcome === TYPE_DEUTAN) acc.deutanopia += 1;
          if (answer.matchedOutcome === TYPE_PROTAN) acc.protanopia += 1;
          return acc;
        },
        { deutanopia: 0, protanopia: 0 },
      );

      let nextFocus: "deutanopia" | "protanopia" = focusType;
      if (diagMatches.deutanopia > diagMatches.protanopia && diagMatches.deutanopia > 0) {
        nextFocus = "deutanopia";
      } else if (diagMatches.protanopia > diagMatches.deutanopia && diagMatches.protanopia > 0) {
        nextFocus = "protanopia";
      } else if (diagnosticAnswers.length && diagnosticAnswers[diagnosticAnswers.length - 1].matchedOutcome) {
        const last = diagnosticAnswers[diagnosticAnswers.length - 1].matchedOutcome;
        if (last === TYPE_DEUTAN) nextFocus = "deutanopia";
        if (last === TYPE_PROTAN) nextFocus = "protanopia";
      }

      const suspectedMatches = diagMatches[nextFocus];
      const totalMatches = diagMatches.deutanopia + diagMatches.protanopia;

      const shouldContinueDiagnostic =
        diagnosticAnswers.length < DIAGNOSTIC_MIN_COUNT ||
        (diagnosticAnswers.length < DIAGNOSTIC_MAX_COUNT && totalMatches === 0) ||
        (diagnosticAnswers.length < DIAGNOSTIC_MAX_COUNT && suspectedMatches < 2 && suspectedMatches > 0);

      if (shouldContinueDiagnostic && testPlates.length < MAX_TOTAL_PLATES) {
        const used = new Set<number>([...usedPlateIds, ...testPlates.map((plate) => plate.id)]);
        const remainingSlots = Math.max(0, MAX_TOTAL_PLATES - testPlates.length);
        const next = pickPlatesByType(TYPE_DIAGNOSTIC, 1, used, remainingSlots);
        if (next.length) {
          schedulePlates(next);
          upcomingPlate = next[0];
        }
      }

      if (!upcomingPlate) {
        const focus = nextFocus;
        const secondary = focus === "deutanopia" ? "protanopia" : "deutanopia";
        setFocusType(focus);
        setSecondaryType(secondary);
        const planned = targetedScheduled ? [] : scheduleTargetedSequence(focus, secondary);
        if (planned.length) {
          upcomingPlate = planned[0];
        }
      }
    }

    if (!upcomingPlate) {
      const nextIndex = currentPlateIndex + 1;
      const alreadyScheduled = testPlates[nextIndex];
      if (alreadyScheduled) {
        upcomingPlate = alreadyScheduled;
      }
    }

    if (upcomingPlate) {
      setCurrentPlateIndex((prev) => prev + 1);
      markQuestionStart(`plate-${upcomingPlate.id}`, `Plate ${upcomingPlate.id}`);
    } else {
      void completeTest(newAnswers);
    }
  };

  const completeTest = async (testAnswers: TestAnswer[]) => {
    if (completed) return;
    const timingSummary = completeSession();
    setSubmitting(true);
    setCompleted(true);
    setPhase("complete");

    const correctCount = testAnswers.filter((a) => a.correct).length;
    const score = Math.round((correctCount / testAnswers.length) * 100);

    let subtype = "normal";
    const mistakes = testAnswers.filter((a) => !a.correct);

    if (mistakes.length >= 3) {
      const protanMatches = mistakes.filter((m) => m.matchedOutcome === TYPE_PROTAN);
      const deutanMatches = mistakes.filter((m) => m.matchedOutcome === TYPE_DEUTAN);

      if (protanMatches.length >= 3 && protanMatches.length > deutanMatches.length) {
        subtype = "protanopia";
      } else if (deutanMatches.length >= 3 && deutanMatches.length > protanMatches.length) {
        subtype = "deutanopia";
      } else if (mistakes.length >= 5) {
        subtype = "red_green_deficiency";
      }
    }

    const redGreenAnswers = testAnswers.filter((answer) => answer.plateTypeNormalized === TYPE_RED_GREEN);
    const diagnosticAnswers = testAnswers.filter((answer) => answer.plateTypeNormalized === TYPE_DIAGNOSTIC);
    const deutanAnswers = testAnswers.filter((answer) => answer.plateTypeNormalized === TYPE_DEUTAN);
    const protanAnswers = testAnswers.filter((answer) => answer.plateTypeNormalized === TYPE_PROTAN);

    const matchCounter = testAnswers.reduce(
      (acc, answer) => {
        if (answer.matchedOutcome && answer.matchedOutcome !== "normal") {
          acc[answer.matchedOutcome] = (acc[answer.matchedOutcome] ?? 0) + 1;
        }
        if (!answer.correct) {
          acc.totalMistakes += 1;
        }
        return acc;
      },
      { totalMistakes: 0 } as Record<string, number>,
    );

    const suspectedDeficiency =
      subtype !== "normal"
        ? subtype
        : (() => {
          if ((matchCounter[TYPE_DEUTAN] ?? 0) >= 3) return TYPE_DEUTAN;
          if ((matchCounter[TYPE_PROTAN] ?? 0) >= 3) return TYPE_PROTAN;
          if ((matchCounter[TYPE_RED_GREEN] ?? 0) >= 2) return TYPE_RED_GREEN;
          if (score >= 90) return "normal";
          return "inconclusive";
        })();

    const analysisSummary = {
      control: {
        attempts: controlAttempts,
        passed_on_attempt: controlPassAttempt,
        plate_id: controlPlate?.id ?? null,
      },
      segments: {
        red_green: {
          total: redGreenAnswers.length,
          correct: redGreenAnswers.filter((answer) => answer.correct).length,
          mistakes: redGreenAnswers.filter((answer) => !answer.correct).length,
        },
        diagnostic_red_green: {
          total: diagnosticAnswers.length,
          matches: {
            deutanopia: diagnosticAnswers.filter((answer) => answer.matchedOutcome === TYPE_DEUTAN).length,
            protanopia: diagnosticAnswers.filter((answer) => answer.matchedOutcome === TYPE_PROTAN).length,
          },
        },
        deutanopia: {
          total: deutanAnswers.length,
          matches: deutanAnswers.filter((answer) => answer.matchedOutcome === TYPE_DEUTAN).length,
        },
        protanopia: {
          total: protanAnswers.length,
          matches: protanAnswers.filter((answer) => answer.matchedOutcome === TYPE_PROTAN).length,
        },
      },
      matched_outcomes: matchCounter,
      focus_type: focusType,
      secondary_type: secondaryType,
      suspected_deficiency: suspectedDeficiency,
    };

    if (!user) {
      setSubmitting(false);
      toast({
        title: "Test complete",
        description: "Sign in to save your Ishihara results to your profile.",
      });
      return;
    }

    try {
      const xpEarned = Math.round(35 + (score / 100) * 20);

      await supabase.from("test_results").insert({
        user_id: user.id,
        test_type: "ishihara",
        score,
        xp_earned: xpEarned,
        details: {
          answers: testAnswers.map((a) => ({
            plateId: a.plateId,
            answer: a.answer,
            normalizedAnswer: a.normalizedAnswer,
            expectedNormal: a.expectedNormal,
            alternateOutcomes: a.alternateOutcomes,
            matchedOutcome: a.matchedOutcome,
            matchedOutcomeLabel: a.matchedOutcomeLabel,
            correct: a.correct,
            plateType: a.plateType,
            plateTypeNormalized: a.plateTypeNormalized,
            plateClass: a.plateClass,
            timing: a.timing ?? null,
          })),
          subtype,
          totalPlates: testAnswers.length,
          correctCount,
          control: {
            attempts: controlAttempts,
            passedOnAttempt: controlPassAttempt,
          },
          focusType,
          secondaryType,
          suspectedDeficiency,
          analysisSummary,
          timing: {
            sessionDurationMs: timingSummary.sessionDurationMs,
            averageQuestionDurationMs: timingSummary.averageQuestionDurationMs,
            perQuestion: timingSummary.questionTimings,
          },
        },
      });

      await supabase.rpc("update_user_xp", {
        p_user_id: user.id,
        p_xp_delta: xpEarned,
      });

      await recordTestCompletionStreak(user.id);

      await refetchXP();

      toast({
        title: "Test Complete!",
        description: `Score: ${score}% | Subtype: ${subtype} | +${xpEarned} XP`,
        duration: 5000,
      });

      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (error: any) {
      console.error("Test completion error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const activePlate = phase === "control" ? controlPlate : testPlates[currentPlateIndex];

  if (!manifest) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading test...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-50/70 backdrop-blur-md dark:bg-slate-950/70 supports-[backdrop-filter]:bg-slate-50/40 dark:supports-[backdrop-filter]:bg-slate-950/40">
        <div className="container mx-auto flex items-center gap-3 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full hover:bg-white/20">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2" onClick={() => navigate("/dashboard")}>
            <img src={logo} alt="AIris" className="h-8 drop-shadow-md cursor-pointer" />
            <span className="font-bold tracking-tight">Ishihara Color Test</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl space-y-8 px-6 py-4">
        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8 shadow-2xl text-white">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
          <div className="relative z-10 grid gap-8 md:grid-cols-[1.5fr,1fr] items-center">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/70">Ishihara color test</p>
                <h1 className="text-3xl font-bold md:text-4xl">Gauge your color perception</h1>
              </div>
              <p className="text-indigo-100 max-w-lg leading-relaxed">
                Enter the numbers you see. AIris adapts the sequence to explore subtle color differences and refine your results.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-6 backdrop-blur-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white/80">Potential XP Reward</span>
                <span className="text-lg font-bold text-yellow-300">up to 45 XP</span>
              </div>
              <XPBar xp={xp} />
            </div>
          </div>
        </div>

        {!started ? (
          <Card className="glass-card">
            <CardContent className="space-y-6 p-8 text-center">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">Before you begin</h2>
              <p className="text-base text-muted-foreground max-w-lg mx-auto">
                Make sure your display shows crisp colors with comfortable brightness. If you normally wear glasses or
                contacts for everyday tasks, keep them on.
              </p>

              <div className="grid gap-4 md:grid-cols-3 text-left">
                <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                  <div className="h-2 w-2 rounded-full bg-primary mb-2" />
                  <h3 className="font-semibold mb-1">Observe</h3>
                  <p className="text-xs text-muted-foreground">Enter the number or pattern you see.</p>
                </div>
                <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                  <div className="h-2 w-2 rounded-full bg-primary mb-2" />
                  <h3 className="font-semibold mb-1">Adapt</h3>
                  <p className="text-xs text-muted-foreground">Plates change based on your answers.</p>
                </div>
                <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                  <div className="h-2 w-2 rounded-full bg-primary mb-2" />
                  <h3 className="font-semibold mb-1">Complete</h3>
                  <p className="text-xs text-muted-foreground">Finish the sequence to earn 45 XP.</p>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  size="lg"
                  onClick={handleStart}
                  className="w-full max-w-xs rounded-full bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:scale-105 transition-all duration-300"
                >
                  Start Color Test
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card border-none shadow-none bg-transparent">
            <CardContent className="space-y-8 p-0">
              <div className="text-center space-y-2">
                {phase === "control" ? (
                  <>
                    <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Control plate</h2>
                    <p className="text-sm text-muted-foreground">
                      We’ll begin once you correctly identify this plate. Adjust your screen or lighting if needed.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                      Plate {currentPlateIndex + 1} / {Math.max(testPlates.length, currentPlateIndex + 1)}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Enter the number you see or type “nothing” if none is visible.
                    </p>
                  </>
                )}
              </div>

              <div className="flex flex-col items-center gap-6">
                <div className="relative w-full max-w-md">
                  <img
                    src={`/${activePlate?.image}`}
                    alt={activePlate ? `Ishihara Plate ${activePlate.id}` : "Ishihara Plate"}
                    className="mx-auto w-full max-w-md rounded-2xl border border-white/60 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900/60"
                    onError={() => setImageError(true)}
                    onLoad={() => setImageError(false)}
                  />
                  {imageError && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-muted/80 text-sm text-muted-foreground backdrop-blur-sm">
                      Image failed to load. Try refreshing.
                    </div>
                  )}
                  {phase === "control" && controlWarning && !imageError && (
                    <div className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-yellow-100/90 p-3 text-xs font-medium text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-100">
                      {controlWarning}
                    </div>
                  )}
                </div>

                <TestTimerDisplay
                  sessionMs={hasSessionStarted ? sessionElapsedMs : 0}
                  questionMs={hasSessionStarted ? questionElapsedMs : 0}
                  questionLabel={
                    phase === "control"
                      ? "Control plate (timer starts after this)"
                      : activeQuestionLabel || (activePlate ? `Plate ${activePlate.id}` : undefined)
                  }
                  className="w-full max-w-md"
                />

                <div className="w-full max-w-md space-y-4">
                  <Input
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAnswer()}
                    placeholder="Type the number you see (or 'nothing')"
                    className="h-14 rounded-2xl border border-primary/20 bg-white/50 backdrop-blur-sm text-center text-xl font-medium tracking-widest px-4 focus:ring-2 focus:ring-primary/20 transition-all dark:border-white/10 dark:bg-slate-900/50"
                    autoFocus
                  />
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      variant="outline"
                      onClick={() => handleAnswer("nothing")}
                      disabled={submitting}
                      className="h-12 flex-1 rounded-xl bg-white/40 border-primary/10 hover:bg-white/60 dark:bg-slate-800/40"
                    >
                      Mark as Nothing
                    </Button>
                    <Button
                      onClick={() => handleAnswer()}
                      disabled={!userInput.trim() || submitting}
                      className="h-12 flex-1 rounded-xl bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                    >
                      {phase === "control"
                        ? "Verify Control"
                        : currentPlateIndex === testPlates.length - 1
                          ? "Finish"
                          : "Next Plate"}
                    </Button>
                  </div>
                  <p className="text-xs text-center text-muted-foreground">Press Enter to submit</p>
                </div>

                {phase !== "control" && answers.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Correct so far: {answers.filter((a) => a.correct).length} / {answers.length}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
