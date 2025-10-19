import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useXP } from "@/hooks/useXP";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowUp, ArrowDown, ArrowRight } from "lucide-react";
import logo from "@/assets/logo.png";
import { XPBar } from "@/components/XPBar";
import { useTestTimer, type QuestionTimingRecord } from "@/hooks/useTestTimer";
import { TestTimerDisplay } from "@/components/tests/TestTimerDisplay";

export default function VisualAcuityTest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { xp } = useXP(user?.id);
  const { toast } = useToast();
  const [started, setStarted] = useState(false);
  const [level, setLevel] = useState(1);
  const [correct, setCorrect] = useState(0);
  const [direction, setDirection] = useState<"up" | "down" | "left" | "right">("up");
  const [completed, setCompleted] = useState(false);
  const [responses, setResponses] = useState<
    Array<{ level: number; direction: typeof directions[number]; correct: boolean; timing?: QuestionTimingRecord | null }>
  >([]);
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

  const directions = ["up", "down", "left", "right"] as const;

  const handleStart = () => {
    resetTimer();
    setStarted(true);
    setLevel(1);
    setCorrect(0);
    setResponses([]);
    setCompleted(false);
    const firstDirection = randomizeDirection();
    startSession("level-1", `Level 1 (${firstDirection})`);
  };

  const randomizeDirection = () => {
    const random = directions[Math.floor(Math.random() * directions.length)];
    setDirection(random);
    return random;
  };

  const handleAnswer = (answer: typeof direction) => {
    if (completed) return;
    const answeredCorrectly = answer === direction;
    const timingPayload = completeQuestion(`level-${level}`, `Level ${level}`);
    const responseDetail = {
      level,
      direction,
      correct: answeredCorrectly,
      timing: timingPayload.record,
    };
    const updatedResponses = [...responses, responseDetail];
    setResponses(updatedResponses);
    const updatedCorrect = answeredCorrectly ? correct + 1 : correct;
    setCorrect(updatedCorrect);
    if (level < 8) {
      const nextLevel = level + 1;
      const nextDirection = randomizeDirection();
      setLevel(nextLevel);
      markQuestionStart(`level-${nextLevel}`, `Level ${nextLevel} (${nextDirection})`);
    } else {
      completeTest(updatedCorrect, updatedResponses);
    }
  };

  const completeTest = async (finalCorrect = correct, finalResponses = responses) => {
    if (!user || completed) return;
    setCompleted(true);
    try {
      const score = (finalCorrect / 8) * 100;
      // XP scaling: base 30, up to 40 for perfect score
      const xpEarned = Math.floor(30 + (score / 100) * 10);
      const timingSummary = completeSession();
      const responseSummary = finalResponses.map((entry) => ({
        level: entry.level,
        direction: entry.direction,
        correct: entry.correct,
        durationMs: entry.timing?.durationMs ?? null,
        startedAt: entry.timing?.startedAtIso ?? null,
        endedAt: entry.timing?.endedAtIso ?? null,
      }));

      await supabase.from("test_results").insert({
        user_id: user.id,
        test_type: "visual_acuity",
        score,
        xp_earned: xpEarned,
        details: {
          correct: finalCorrect,
          total: 8,
          responses: responseSummary,
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
      toast({
        title: "Test Complete!",
        description: `You earned ${xpEarned} XP!`,
      });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const iconSize = Math.max(32, 128 - level * 12);

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

      <main className="container mx-auto max-w-3xl space-y-8 px-4 py-10">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary via-indigo-600 to-fuchsia-600 text-white shadow-2xl">
          <span className="pointer-events-none absolute -left-12 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-white/25 blur-3xl" />
          <span className="pointer-events-none absolute -right-10 bottom-0 h-36 w-36 rounded-full bg-sky-400/30 blur-3xl" />
          <CardContent className="relative z-10 space-y-6 p-8">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.35rem] text-white/70">Visual acuity</p>
              <h1 className="text-3xl font-semibold">Measure how sharply you can recognize directional cues</h1>
              <p className="text-sm text-white/80">
                Work through eight stages of gradually shrinking arrows. Stay focused to maximize your score and earn up
                to 25 XP.
              </p>
            </div>
            <div className="rounded-2xl bg-white/15 p-4 shadow-lg backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-white/70">Your current XP</p>
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
                Make sure your screen brightness is comfortable and you’re seated about arm’s length from the display.
              </p>
              <div className="space-y-2 rounded-2xl border border-white/60 bg-white/70 p-6 text-left text-sm text-muted-foreground shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Instructions</p>
                <ul className="list-disc space-y-1 pl-6">
                  <li>Identify which direction the arrow is pointing.</li>
                  <li>Arrows shrink at each level to challenge your acuity.</li>
                  <li>Complete all 8 rounds to earn the full XP reward.</li>
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
            <CardContent className="space-y-8 p-8">
              <div className="text-center">
                <p className="mb-4 text-sm text-muted-foreground">
                  Level {level} of 8 • Correct answers {correct} / 8
                </p>
                <div className="flex items-center justify-center py-12">
                  {direction === "up" && <ArrowUp size={iconSize} className="text-primary" />}
                  {direction === "down" && <ArrowDown size={iconSize} className="text-primary" />}
                  {direction === "left" && <ArrowLeft size={iconSize} className="text-primary" />}
                  {direction === "right" && <ArrowRight size={iconSize} className="text-primary" />}
                </div>
              </div>

              <TestTimerDisplay
                sessionMs={sessionElapsedMs}
                questionMs={questionElapsedMs}
                questionLabel={activeQuestionLabel || `Level ${level}`}
              />

              <div className="space-y-3">
                <p className="text-center font-medium text-slate-900 dark:text-slate-100">
                  Which direction is the arrow pointing?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => handleAnswer("up")}
                    className="h-20 rounded-2xl border border-primary/20 bg-white/70 text-slate-900 hover:border-primary hover:bg-primary/10 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                    disabled={completed}
                  >
                    <ArrowUp className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => handleAnswer("down")}
                    className="h-20 rounded-2xl border border-primary/20 bg-white/70 text-slate-900 hover:border-primary hover:bg-primary/10 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                    disabled={completed}
                  >
                    <ArrowDown className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => handleAnswer("left")}
                    className="h-20 rounded-2xl border border-primary/20 bg-white/70 text-slate-900 hover:border-primary hover:bg-primary/10 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                    disabled={completed}
                  >
                    <ArrowLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => handleAnswer("right")}
                    className="h-20 rounded-2xl border border-primary/20 bg-white/70 text-slate-900 hover:border-primary hover:bg-primary/10 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                    disabled={completed}
                  >
                    <ArrowRight className="h-6 w-6" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
