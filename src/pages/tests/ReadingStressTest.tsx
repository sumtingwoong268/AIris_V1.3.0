import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useXP } from "@/hooks/useXP";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";
import { XPBar } from "@/components/XPBar";
import { useTestTimer, type QuestionTimingRecord } from "@/hooks/useTestTimer";
import { TestTimerDisplay } from "@/components/tests/TestTimerDisplay";

const READING_TEXTS = [
  `The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet at least once.`,
  `Reading should feel comfortable and effortless when your eyes are healthy and properly rested for optimal performance.`,
  `If you experience strain, blurriness, or discomfort while reading, it may indicate eye fatigue or vision issues that need attention.`,
  `Regular breaks and proper lighting can help reduce reading stress. The 20-20-20 rule is a good practice to follow.`,
  `Remember to blink frequently and maintain a comfortable reading distance. Proper posture also contributes to reading comfort.`,
  `Digital screens emit blue light which can contribute to eye strain over extended periods of time. Consider using filters.`,
  `Font size and spacing play crucial roles in reading comfort. What feels comfortable varies from person to person.`,
];

const FONT_SIZES = [18, 16, 14, 12, 10, 9, 8] as const;

interface TrialResult {
  fontSize: number;
  duration: number;
  difficulty: number;
  text: string;
  timing?: QuestionTimingRecord | null;
}

export default function ReadingStressTest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { xp, refetch: refetchXP } = useXP(user?.id);
  const { toast } = useToast();

  const [started, setStarted] = useState(false);
  const [currentTrial, setCurrentTrial] = useState(0);
  const [difficulty, setDifficulty] = useState(1);
  const [trialResults, setTrialResults] = useState<TrialResult[]>([]);
  const [completed, setCompleted] = useState(false);
  const {
    sessionElapsedMs,
    questionElapsedMs,
    activeQuestionLabel,
    startSession,
    markQuestionStart,
    completeQuestion,
    completeSession,
    reset: resetTimer,
  } = useTestTimer();

  const handleStart = () => {
    resetTimer();
    setStarted(true);
    setCurrentTrial(0);
    setTrialResults([]);
    setDifficulty(1);
    setCompleted(false);
    startSession("trial-1", "Trial 1");
  };

  const handleNextTrial = () => {
    if (completed) {
      return;
    }

    const timingPayload = completeQuestion(`trial-${currentTrial + 1}`, `Trial ${currentTrial + 1}`);
    const durationSeconds =
      timingPayload.durationMs > 0 ? Math.max(1, Math.round(timingPayload.durationMs / 1000)) : 0;
    const result: TrialResult = {
      fontSize: FONT_SIZES[currentTrial],
      duration: durationSeconds,
      difficulty,
      text: READING_TEXTS[currentTrial],
      timing: timingPayload.record,
    };

    const updatedResults = [...trialResults, result];
    setTrialResults(updatedResults);

    if (currentTrial < FONT_SIZES.length - 1) {
      const nextTrialIndex = currentTrial + 1;
      setCurrentTrial(nextTrialIndex);
      setDifficulty(1);
      markQuestionStart(`trial-${nextTrialIndex + 1}`, `Trial ${nextTrialIndex + 1}`);
    } else {
      completeTest(updatedResults);
    }
  };

  const completeTest = async (results: TrialResult[]) => {
    if (!user || completed) {
      return;
    }

    setCompleted(true);

    try {
      const comfortableTrials = results.filter((r) => r.difficulty <= 3);
      const readabilityThreshold =
        comfortableTrials.length > 0
          ? Math.min(...comfortableTrials.map((r) => r.fontSize))
          : FONT_SIZES[0];

      const avgDifficulty =
        results.reduce((sum, r) => sum + r.difficulty, 0) / results.length;

      const score = Math.round(Math.max(0, 100 - (avgDifficulty - 1) * 12.5));
      const xpEarned = Math.round(18 + (score / 100) * 10);
      const timingSummary = completeSession();

      await supabase.from("test_results").insert({
        user_id: user.id,
        test_type: "reading_stress",
        score,
        xp_earned: xpEarned,
        details: {
          trials: results.map((r) => ({
            fontSize: r.fontSize,
            duration: r.duration,
            difficulty: r.difficulty,
            text: r.text,
            timing: r.timing ?? null,
          })),
          readabilityThreshold,
          avgDifficulty: Number(avgDifficulty.toFixed(2)),
          totalTrials: results.length,
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

      const now = new Date();
      const currentWeek = `${now.getFullYear()}-W${String(
        Math.ceil((now.getDate() + new Date(now.getFullYear(), 0, 1).getDay()) / 7),
      ).padStart(2, "0")}`;

      const { data: profile } = await supabase
        .from("profiles")
        .select("last_active_week, current_streak")
        .eq("id", user.id)
        .single();

      if (profile && profile.last_active_week !== currentWeek) {
        await supabase
          .from("profiles")
          .update({
            current_streak: (profile.current_streak || 0) + 1,
            last_active_week: currentWeek,
          })
          .eq("id", user.id);
      }

      await refetchXP();

      toast({
        title: "Test Complete!",
        description: `Comfortable size ≈ ${readabilityThreshold}px • +${xpEarned} XP`,
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
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="border-b border-border/40 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={logo} alt="AIris" className="h-10" />
        </div>
      </header>

      <main className="container mx-auto max-w-4xl space-y-8 px-4 py-10">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary via-indigo-600 to-fuchsia-600 text-white shadow-2xl">
          <span className="pointer-events-none absolute -left-12 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-white/25 blur-3xl" />
          <span className="pointer-events-none absolute -right-10 bottom-0 h-44 w-44 rounded-full bg-sky-400/30 blur-3xl" />
          <CardContent className="relative z-10 space-y-6 p-8">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.35rem] text-white/70">Reading comfort</p>
              <h1 className="text-3xl font-semibold">Find the smallest font size that still feels effortless</h1>
              <p className="text-sm text-white/80">
                Read short passages that shrink each round and rate how comfortable they feel. AIris uses your feedback
                to estimate an ideal reading size and measure fatigue.
              </p>
            </div>
            <div className="rounded-2xl bg-white/15 p-4 shadow-lg backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-white/70">Current XP</p>
              <div className="mt-3">
                <XPBar xp={xp} />
              </div>
            </div>
          </CardContent>
        </Card>

        {!started ? (
          <Card>
            <CardContent className="space-y-6 p-8 text-center">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Before you begin</h2>
              <p className="text-sm text-muted-foreground">
                Sit comfortably with good lighting and hold the screen at your normal reading distance. Wear any
                corrective lenses you use for daily reading.
              </p>
              <div className="space-y-2 rounded-2xl border border-white/60 bg-white/70 p-6 text-left text-sm text-muted-foreground shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Instructions</p>
                <ul className="list-disc space-y-1 pl-6">
                  <li>Read each passage at your regular pace.</li>
                  <li>Rate difficulty from 1 (easy) to 5 (very hard).</li>
                  <li>Font sizes shrink from 18px down to 8px.</li>
                  <li>Complete all trials to earn up to 28 XP.</li>
                </ul>
              </div>
              <Button
                size="lg"
                onClick={handleStart}
                className="w-full bg-gradient-to-r from-primary to-blue-500 text-white hover:from-blue-500 hover:to-primary"
              >
                Start Test
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-6 p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Trial {currentTrial + 1} of {FONT_SIZES.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Font size: {FONT_SIZES[currentTrial]}px</p>
                </div>
                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                  Stop Test
                </Button>
              </div>

              <TestTimerDisplay
                sessionMs={sessionElapsedMs}
                questionMs={questionElapsedMs}
                questionLabel={activeQuestionLabel || `Trial ${currentTrial + 1}`}
              />

              <div
                className="rounded-2xl border border-primary/20 bg-white/80 p-6 text-slate-900 shadow-inner dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
                style={{ fontSize: `${FONT_SIZES[currentTrial]}px`, lineHeight: 1.5 }}
              >
                {READING_TEXTS[currentTrial]}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">How easy was this to read?</p>
                <div className="grid grid-cols-5 gap-3">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant={difficulty === value ? "default" : "outline"}
                      className="rounded-2xl"
                      onClick={() => setDifficulty(value)}
                    >
                      {value}
                    </Button>
                  ))}
                </div>
                <p className="flex justify-between text-xs text-muted-foreground">
                  <span>1 = very easy</span>
                  <span>5 = very difficult</span>
                </p>
              </div>

              <Button
                onClick={handleNextTrial}
                className="w-full rounded-2xl bg-gradient-to-r from-primary to-blue-500 text-white hover:from-blue-500 hover:to-primary"
                disabled={completed}
              >
                {currentTrial === FONT_SIZES.length - 1 ? "Complete Test" : "Next Passage"}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
