import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useXP } from "@/hooks/useXP";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowUp, ArrowDown, ArrowRight } from "lucide-react";
import logo from "@/assets/airis-logo.png";
import { XPBar } from "@/components/XPBar";
import { useTestTimer, type QuestionTimingRecord } from "@/hooks/useTestTimer";
import { TestTimerDisplay } from "@/components/tests/TestTimerDisplay";
import { recordTestCompletionStreak } from "@/utils/streak";

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
      await recordTestCompletionStreak(user.id);
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
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-50/70 backdrop-blur-md dark:bg-slate-950/70 supports-[backdrop-filter]:bg-slate-50/40 dark:supports-[backdrop-filter]:bg-slate-950/40">
        <div className="container mx-auto flex items-center gap-3 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full hover:bg-white/20">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2" onClick={() => navigate("/dashboard")}>
            <img src={logo} alt="AIris" className="h-8 drop-shadow-md cursor-pointer" />
            <span className="font-bold tracking-tight">Visual Acuity</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl space-y-8 px-6 py-4">
        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8 shadow-2xl text-white">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
          <div className="relative z-10 grid gap-8 md:grid-cols-[1.5fr,1fr] items-center">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/70">Visual acuity</p>
                <h1 className="text-3xl font-bold md:text-4xl">Measure your focus</h1>
              </div>
              <p className="text-indigo-100 max-w-lg leading-relaxed">
                Work through eight stages of gradually shrinking arrows. Identify the direction to test your sharpness.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-6 backdrop-blur-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white/80">Potential XP Reward</span>
                <span className="text-lg font-bold text-yellow-300">up to 40 XP</span>
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
                Make sure your screen brightness is comfortable and you’re seated about arm’s length from the display.
              </p>

              <div className="grid gap-4 md:grid-cols-3 text-left">
                <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                  <div className="h-2 w-2 rounded-full bg-primary mb-2" />
                  <h3 className="font-semibold mb-1">Identify</h3>
                  <p className="text-xs text-muted-foreground">Recognize the arrow's direction correctly.</p>
                </div>
                <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                  <div className="h-2 w-2 rounded-full bg-primary mb-2" />
                  <h3 className="font-semibold mb-1">Focus</h3>
                  <p className="text-xs text-muted-foreground">Arrows shrink at each level to challenge you.</p>
                </div>
                <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                  <div className="h-2 w-2 rounded-full bg-primary mb-2" />
                  <h3 className="font-semibold mb-1">Complete</h3>
                  <p className="text-xs text-muted-foreground">Finish all 8 rounds to earn full XP.</p>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  size="lg"
                  onClick={handleStart}
                  className="w-full max-w-xs rounded-full bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:scale-105 transition-all duration-300"
                >
                  Start Sensitivity Test
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card border-none shadow-none bg-transparent">
            <CardContent className="space-y-8 p-0">
              <div className="flex flex-col items-center justify-center py-10 min-h-[400px] rounded-3xl bg-white/50 border border-white/20 backdrop-blur-sm dark:bg-slate-900/50">
                <div className="mb-8 flex items-center gap-4 text-sm font-medium text-muted-foreground bg-white/40 px-4 py-2 rounded-full border border-white/20 dark:bg-slate-800/40">
                  <span>Level {level} of 8</span>
                  <div className="h-4 w-px bg-border" />
                  <span>Correct: {correct}</span>
                </div>

                <div className="relative flex items-center justify-center h-48 w-48 transition-all">
                  {/* We use a key to force re-animation if needed, or just standard render */}
                  <div key={`${level}-${direction}`} className="animate-in zoom-in-50 duration-300">
                    {direction === "up" && <ArrowUp size={iconSize} className="text-primary drop-shadow-lg" />}
                    {direction === "down" && <ArrowDown size={iconSize} className="text-primary drop-shadow-lg" />}
                    {direction === "left" && <ArrowLeft size={iconSize} className="text-primary drop-shadow-lg" />}
                    {direction === "right" && <ArrowRight size={iconSize} className="text-primary drop-shadow-lg" />}
                  </div>
                </div>

                <div className="mt-8">
                  <TestTimerDisplay
                    sessionMs={sessionElapsedMs}
                    questionMs={questionElapsedMs}
                    questionLabel={activeQuestionLabel || `Level ${level}`}
                  />
                </div>
              </div>

              <div className="space-y-4 max-w-2xl mx-auto">
                <p className="text-center text-lg font-medium text-slate-900 dark:text-slate-100">
                  Which direction is it pointing?
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {directions.map((dir) => (
                    <Button
                      key={dir}
                      variant="outline"
                      onClick={() => handleAnswer(dir)}
                      disabled={completed}
                      className="h-24 rounded-2xl border-2 border-transparent bg-white shadow-sm hover:border-primary/50 hover:bg-primary/5 hover:shadow-md transition-all active:scale-95 dark:bg-slate-800 dark:hover:bg-slate-700"
                    >
                      {dir === "up" && <ArrowUp className="h-8 w-8" />}
                      {dir === "down" && <ArrowDown className="h-8 w-8" />}
                      {dir === "left" && <ArrowLeft className="h-8 w-8" />}
                      {dir === "right" && <ArrowRight className="h-8 w-8" />}
                    </Button>
                  ))}
                </div>
                <div className="text-center">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => navigate("/dashboard")}>
                    End Test
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
