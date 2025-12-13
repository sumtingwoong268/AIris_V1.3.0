import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { XPBar } from "@/components/XPBar";
import { useXP } from "@/hooks/useXP";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDarkModePreference } from "@/hooks/useDarkModePreference";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";
import { useTestTimer } from "@/hooks/useTestTimer";
import { TestTimerDisplay } from "@/components/tests/TestTimerDisplay";
import { recordTestCompletionStreak } from "@/utils/streak";

export default function AmslerTest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { xp } = useXP(user?.id);
  const { toast } = useToast();
  const { darkMode } = useDarkModePreference();
  const [started, setStarted] = useState(false);
  const [eye, setEye] = useState<"left" | "right" | null>(null);
  const [leftClicks, setLeftClicks] = useState<{ x: number; y: number }[]>([]);
  const [rightClicks, setRightClicks] = useState<{ x: number; y: number }[]>([]);
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
    setEye("left");
    setCompleted(false);
    startSession("left-eye", "Left eye");
  };

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (completed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (eye === "left") {
      setLeftClicks([...leftClicks, { x, y }]);
    } else if (eye === "right") {
      setRightClicks([...rightClicks, { x, y }]);
    }
  };

  const handleNext = () => {
    if (eye === "left") {
      completeQuestion("left-eye", "Left eye");
      setEye("right");
      markQuestionStart("right-eye", "Right eye");
    } else {
      completeQuestion("right-eye", "Right eye");
      completeTest();
    }
  };

  const completeTest = async () => {
    if (!user || completed) return;
    setCompleted(true);
    const hasMarks = leftClicks.length > 0 || rightClicks.length > 0;

    try {
      // Award a flat amount of XP for completing the assessment
      const xpEarned = 20;
      const score = hasMarks ? 0 : 100;
      const timingSummary = completeSession();

      await supabase.from("test_results").insert({
        user_id: user.id,
        test_type: "amsler",
        score,
        xp_earned: xpEarned,
        details: {
          leftClicks,
          rightClicks,
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

  const currentClicks = eye === "left" ? leftClicks : rightClicks;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-white/70 backdrop-blur-md dark:bg-slate-900/70 supports-[backdrop-filter]:bg-white/40 dark:supports-[backdrop-filter]:bg-slate-900/40">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full hover:bg-white/20">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2" onClick={() => navigate("/dashboard")}>
            <img src={logo} alt="AIris" className="h-8 drop-shadow-md cursor-pointer" />
            <span className="font-bold tracking-tight">Amsler Grid</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl space-y-8 px-4 py-10">
        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8 shadow-2xl text-white">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
          <div className="relative z-10 grid gap-8 md:grid-cols-[1.5fr,1fr] items-center">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/70">Amsler Grid</p>
                <h1 className="text-3xl font-bold md:text-4xl">Monitor your central vision</h1>
              </div>
              <p className="text-indigo-100 max-w-lg leading-relaxed">
                Cover one eye at a time and mark any areas that appear wavy, missing, or blurred. This helps identify potential macular changes.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-6 backdrop-blur-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white/80">Potential XP Reward</span>
                <span className="text-lg font-bold text-yellow-300">20 XP</span>
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
                Hold the device at a comfortable reading distance (approx 30cm) and ensure proper lighting. Wear corrective lenses if prescribed.
              </p>

              <div className="grid gap-4 md:grid-cols-3 text-left">
                <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                  <div className="h-2 w-2 rounded-full bg-primary mb-2" />
                  <h3 className="font-semibold mb-1">Cover</h3>
                  <p className="text-xs text-muted-foreground">Test one eye at a time. Keep the other covered.</p>
                </div>
                <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                  <div className="h-2 w-2 rounded-full bg-primary mb-2" />
                  <h3 className="font-semibold mb-1">Focus</h3>
                  <p className="text-xs text-muted-foreground">Stare at the center dot. Do not move your eye.</p>
                </div>
                <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                  <div className="h-2 w-2 rounded-full bg-primary mb-2" />
                  <h3 className="font-semibold mb-1">Tap</h3>
                  <p className="text-xs text-muted-foreground">Mark any areas that look wavy or distorted.</p>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  size="lg"
                  onClick={handleStart}
                  className="w-full max-w-xs rounded-full bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:scale-105 transition-all duration-300"
                >
                  Start Grid Test
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card border-none shadow-none bg-transparent">
            <CardContent className="space-y-8 p-0">
              <div className="flex flex-col items-center justify-center py-6 rounded-3xl bg-white/50 border border-white/20 backdrop-blur-sm dark:bg-slate-900/50">
                <div className="mb-6 flex items-center gap-4 text-sm font-medium text-muted-foreground bg-white/40 px-6 py-2 rounded-full border border-white/20 dark:bg-slate-800/40">
                  <span>Testing: <span className="text-foreground font-bold capitalize">{eye} Eye</span></span>
                </div>

                <div
                  className="relative mx-auto h-80 w-80 rounded-2xl border border-primary/30 bg-white shadow-2xl dark:bg-slate-900 cursor-crosshair transition-transform active:scale-[0.99]"
                  onClick={handleGridClick}
                  style={{
                    backgroundColor: darkMode ? "#e0f2ff" : "#ffffff",
                    backgroundImage: `linear-gradient(0deg, ${darkMode ? "rgba(29, 78, 216, 0.2)" : "rgba(0,0,0,0.12)"
                      } 1px, transparent 1px), linear-gradient(90deg, ${darkMode ? "rgba(29, 78, 216, 0.2)" : "rgba(0,0,0,0.12)"
                      } 1px, transparent 1px)`,
                    backgroundSize: "20px 20px",
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                      className="h-3 w-3 rounded-full bg-primary shadow-lg ring-4 ring-primary/20"
                      style={{ backgroundColor: darkMode ? "#1d4ed8" : undefined }}
                    />
                  </div>
                  {currentClicks.map((point, index) => (
                    <div
                      key={index}
                      className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500 shadow-md ring-2 ring-white dark:ring-slate-900 animate-in zoom-in-50 duration-300"
                      style={{ left: `${point.x}%`, top: `${point.y}%` }}
                    />
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted-foreground max-w-xs text-center">
                  Tap where lines look distorted. Focus on the center dot.
                </p>
              </div>

              <div className="flex flex-col gap-4 max-w-md mx-auto">
                <TestTimerDisplay
                  sessionMs={sessionElapsedMs}
                  questionMs={questionElapsedMs}
                  questionLabel={activeQuestionLabel || (eye ? `${eye} eye` : undefined)}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-12 rounded-xl bg-white/40 border-primary/10 hover:bg-white/60 dark:bg-slate-800/40"
                    onClick={() => {
                      if (eye === "left") {
                        setLeftClicks([]);
                      } else {
                        setRightClicks([]);
                      }
                    }}
                  >
                    Clear Marks
                  </Button>
                  <Button
                    className="h-12 rounded-xl bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                    onClick={handleNext}
                    disabled={completed}
                  >
                    {eye === "left" ? "Next (Right Eye)" : "Complete Test"}
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
