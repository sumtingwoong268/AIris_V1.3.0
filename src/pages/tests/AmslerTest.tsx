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
              <p className="text-sm uppercase tracking-[0.35rem] text-white/70">Amsler grid</p>
              <h1 className="text-3xl font-semibold">Check for subtle distortions in your central vision</h1>
              <p className="text-sm text-white/80">
                Cover one eye at a time and mark any areas that appear wavy, missing, or blurred. This helps monitor
                potential macular changes.
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
                Hold the device at a comfortable reading distance and ensure proper lighting. Wear corrective lenses if
                prescribed.
              </p>
              <div className="space-y-2 rounded-2xl border border-white/60 bg-white/70 p-6 text-left text-sm text-muted-foreground shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Instructions</p>
                <ul className="list-disc space-y-1 pl-6">
                  <li>Cover one eye and focus on the center dot.</li>
                  <li>Tap anywhere lines look warped, blank, or distorted.</li>
                  <li>Repeat the process for your other eye.</li>
                  <li>Completing both eyes earns 20 XP.</li>
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
                  Currently testing {eye === "left" ? "left eye" : "right eye"}
                </p>
                <div
                  className="relative mx-auto h-80 w-80 rounded-2xl border border-primary/30 bg-white shadow-inner dark:bg-slate-900"
                  onClick={handleGridClick}
                  style={{
                    backgroundColor: darkMode ? "#e0f2ff" : "#ffffff",
                    backgroundImage: `linear-gradient(0deg, ${
                      darkMode ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.12)"
                    } 1px, transparent 1px), linear-gradient(90deg, ${
                      darkMode ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.12)"
                    } 1px, transparent 1px)`,
                    backgroundSize: "20px 20px",
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="h-2 w-2 rounded-full bg-primary"
                      style={{ backgroundColor: darkMode ? "#1d4ed8" : undefined }}
                    />
                  </div>
                  {currentClicks.map((point, index) => (
                    <div
                      key={index}
                      className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500"
                      style={{ left: `${point.x}%`, top: `${point.y}%` }}
                    />
                  ))}
                </div>
              </div>

              <TestTimerDisplay
                sessionMs={sessionElapsedMs}
                questionMs={questionElapsedMs}
                questionLabel={activeQuestionLabel || (eye ? `${eye} eye` : undefined)}
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <Button
                  variant="outline"
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
                  className="bg-gradient-to-r from-primary to-blue-500 text-white hover:from-blue-500 hover:to-primary"
                  onClick={handleNext}
                  disabled={completed}
                >
                  {eye === "left" ? "Switch to right eye" : "Complete Test"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
