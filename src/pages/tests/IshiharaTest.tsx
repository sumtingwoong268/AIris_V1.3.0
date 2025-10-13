import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { XPBar } from "@/components/XPBar";
import { useXP } from "@/hooks/useXP";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";

interface PlateData {
  id: number;
  image: string;
  analysis: {
    raw?: string;
    normal?: string;
    protan?: string;
    deutan?: string;
  };
}

interface ManifestData {
  plates: PlateData[];
}

interface TestAnswer {
  plateId: number;
  answer: string;
  expected: string;
  correct: boolean;
}

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

  useEffect(() => {
    fetch("/ishihara_manifest_38.json")
      .then((res) => res.json())
      .then((data: ManifestData) => setManifest(data))
      .catch((err) => console.error("Failed to load manifest:", err));
  }, []);

  // Preload images
  useEffect(() => {
    if (testPlates.length > 0 && currentPlateIndex < testPlates.length - 1) {
      const nextPlate = testPlates[currentPlateIndex + 1];
      if (nextPlate) {
        const img = new Image();
        img.src = `/${nextPlate.image}`;
      }
    }
  }, [currentPlateIndex, testPlates]);

  const normalizeAnswer = (answer: string): string => {
    // Convert to lowercase and trim
    let normalized = answer.toLowerCase().trim();
    
    // Handle common variations of "nothing"
    const nothingVariations = ['nothing', 'none', 'no', 'n/a', 'na', 'blank', 'empty', '0'];
    if (nothingVariations.includes(normalized)) {
      normalized = 'nothing';
    }
    
    // Remove punctuation and extra spaces
    normalized = normalized.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ');
    
    return normalized;
  };

  const handleStart = () => {
    if (!manifest) return;
    // Select initial 20 plates randomly
    const shuffled = [...manifest.plates].sort(() => Math.random() - 0.5);
    const initialPlates = shuffled.slice(0, 20);
    setTestPlates(initialPlates);
    setStarted(true);
    setCurrentPlateIndex(0);
    setAnswers([]);
    setCompleted(false);
  };

  const handleAnswer = () => {
    if (!manifest || !userInput.trim() || completed) return;

    const currentPlate = testPlates[currentPlateIndex];
    const normalizedInput = normalizeAnswer(userInput);
    const expected = currentPlate.analysis.normal || "";
    const normalizedExpected = normalizeAnswer(expected);
    
    const isCorrect = normalizedInput === normalizedExpected;
    
    const newAnswer: TestAnswer = {
      plateId: currentPlate.id,
      answer: userInput,
      expected: expected,
      correct: isCorrect,
    };
    
    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);
    setUserInput("");
    setImageError(false);

    // Adaptive logic: if incorrect, add follow-up plates
    if (!isCorrect && testPlates.length < 32) {
      // Find plates that help distinguish protan/deutan
      const followUpPlates = manifest.plates.filter(
        (p) => 
          !testPlates.some((tp) => tp.id === p.id) && 
          (p.analysis.protan || p.analysis.deutan)
      ).slice(0, 2);
      
      if (followUpPlates.length > 0) {
        setTestPlates([...testPlates, ...followUpPlates]);
      }
    }

    if (currentPlateIndex < testPlates.length - 1) {
      setCurrentPlateIndex(currentPlateIndex + 1);
    } else {
      completeTest(newAnswers);
    }
  };

  const completeTest = async (testAnswers: TestAnswer[]) => {
    if (!user || completed) return;
    setCompleted(true);

    try {
      const correctCount = testAnswers.filter((a) => a.correct).length;
      const score = Math.round((correctCount / testAnswers.length) * 100);
      
      // Determine subtype based on pattern of mistakes
      let subtype = "normal";
      const mistakes = testAnswers.filter((a) => !a.correct);
      
      if (mistakes.length >= 3) {
        // Check for protan/deutan patterns in the manifest
        const protanMatches = mistakes.filter((m) => {
          const plate = manifest?.plates.find((p) => p.id === m.plateId);
          return plate?.analysis.protan;
        });
        
        const deutanMatches = mistakes.filter((m) => {
          const plate = manifest?.plates.find((p) => p.id === m.plateId);
          return plate?.analysis.deutan;
        });
        
        if (protanMatches.length >= 3 && protanMatches.length > deutanMatches.length) {
          subtype = "protan";
        } else if (deutanMatches.length >= 3) {
          subtype = "deutan";
        } else if (mistakes.length >= 5) {
          subtype = "deficiency";
        }
      }

      // XP scaling: base 35, up to 55 for perfect score
      const xpEarned = Math.round(35 + (score / 100) * 20);

      await supabase.from("test_results").insert({
        user_id: user.id,
        test_type: "ishihara",
        score,
        xp_earned: xpEarned,
        details: {
          answers: testAnswers.map(a => ({
            plateId: a.plateId,
            answer: a.answer,
            expected: a.expected,
            correct: a.correct
          })),
          subtype,
          totalPlates: testAnswers.length,
          correctCount,
        },
      });

      await supabase.rpc("update_user_xp", {
        p_user_id: user.id,
        p_xp_delta: xpEarned,
      });

      // Update streak
      const now = new Date();
      const currentWeek = `${now.getFullYear()}-W${String(Math.ceil((now.getDate() + new Date(now.getFullYear(), 0, 1).getDay()) / 7)).padStart(2, '0')}`;
      
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

  const currentPlate = testPlates[currentPlateIndex];

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
              <p className="text-sm uppercase tracking-[0.35rem] text-white/70">Ishihara color test</p>
              <h1 className="text-3xl font-semibold">Gauge red-green perception with adaptive Ishihara plates</h1>
              <p className="text-sm text-white/80">
                Enter the numbers you see—or mark “nothing” when no digits are visible. AIris adapts the sequence to
                explore color differences and refine your results.
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
                Make sure your display shows crisp colors with comfortable brightness. If you normally wear glasses or
                contacts for everyday tasks, keep them on.
              </p>
              <div className="space-y-2 rounded-2xl border border-white/60 bg-white/70 p-6 text-left text-sm text-muted-foreground shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Instructions</p>
                <ul className="list-disc space-y-1 pl-6">
                  <li>Enter the number or pattern you see on each plate.</li>
                  <li>Type “nothing” if no number is visible.</li>
                  <li>Plates may adapt to your answers to explore color perception.</li>
                  <li>Complete the sequence to earn up to 45 XP.</li>
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
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                  Plate {currentPlateIndex + 1} / {testPlates.length}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Enter the number you see or type “nothing” if none is visible.
                </p>
              </div>

              <div className="flex flex-col items-center gap-6">
                <div className="relative w-full max-w-md">
                  <img
                    src={`/${currentPlate?.image}`}
                    alt={`Ishihara Plate ${currentPlate?.id}`}
                    className="mx-auto w-full max-w-md rounded-2xl border border-white/60 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900/60"
                    onError={() => setImageError(true)}
                    onLoad={() => setImageError(false)}
                  />
                  {imageError && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-muted/80 text-sm text-muted-foreground">
                      Image failed to load. Try refreshing.
                    </div>
                  )}
                </div>

                <div className="w-full max-w-md space-y-4">
                  <Input
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAnswer()}
                    placeholder="Type the number you see (or 'nothing')"
                    className="rounded-2xl border border-primary/20 bg-white/80 text-center text-lg dark:border-white/10 dark:bg-slate-900/70"
                    autoFocus
                  />
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button variant="outline" onClick={() => setUserInput("nothing")} className="flex-1 rounded-2xl">
                      Mark as Nothing
                    </Button>
                    <Button
                      onClick={handleAnswer}
                      disabled={!userInput.trim() || submitting}
                      className="flex-1 rounded-2xl bg-gradient-to-r from-primary to-blue-500 text-white hover:from-blue-500 hover:to-primary"
                    >
                      {currentPlateIndex === testPlates.length - 1 ? "Finish" : "Next"}
                    </Button>
                  </div>
                  <p className="text-xs text-center text-muted-foreground">Press Enter to submit</p>
                </div>

                <div className="text-sm text-muted-foreground">
                  Correct so far: {answers.filter((a) => a.correct).length} / {answers.length}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
