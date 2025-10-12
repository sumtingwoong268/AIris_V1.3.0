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
  };

  const handleAnswer = () => {
    if (!manifest || !userInput.trim()) return;

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
    if (!user) return;

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

      const xpEarned = Math.round(50 * (score / 100)); // Scaled up from 30

      await supabase.from("test_results").insert({
        user_id: user.id,
        test_type: "ishihara",
        score,
        xp_earned: xpEarned,
        details: { 
          answers: testAnswers,
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
    <div className="min-h-screen bg-gradient-to-br from-background via-primary-lighter/10 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate("/dashboard")}
          >
            <img src={logo} alt="AIris" className="h-10" />
            <div className="flex flex-col">
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                AIris
              </span>
              <span className="text-[10px] text-muted-foreground -mt-1">
                the future of eyecare
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-8">
        {!started ? (
          <Card className="shadow-elevated">
            <CardContent className="space-y-6 p-8 text-center">
              <h1 className="text-3xl font-bold">Ishihara Color Test</h1>
              <p className="text-muted-foreground">
                This test checks for color vision deficiencies. You'll be shown a series of colored
                plates. Enter what you see in each plate.
              </p>
              <div className="space-y-2 text-left">
                <p className="font-semibold">Instructions:</p>
                <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
                  <li>Look at each plate carefully</li>
                  <li>Enter the number, text, or pattern you see</li>
                  <li>Type "nothing" if you see no pattern</li>
                  <li>Complete all plates to earn up to 30 XP</li>
                  <li>Adaptive test: incorrect answers may trigger follow-up plates</li>
                </ul>
              </div>
              <Button size="lg" onClick={handleStart} className="w-full">
                Start Test
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-4">
                <XPBar xp={xp} />
              </CardContent>
            </Card>

            <Card className="shadow-elevated">
              <CardContent className="space-y-6 p-8">
                <div className="text-center">
                  <p className="mb-4 text-sm text-muted-foreground">
                    Plate {currentPlateIndex + 1} of {testPlates.length}
                  </p>
                  <div className="mx-auto w-full max-w-md">
                    {imageError ? (
                      <div className="aspect-square rounded-lg bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                        <div className="text-center p-4">
                          <p className="text-sm text-muted-foreground">
                            Image failed to load
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Plate {currentPlate?.id}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={`/${currentPlate?.image}`}
                        alt={`Ishihara Plate ${currentPlate?.id}`}
                        className="w-full h-auto rounded-lg shadow-lg"
                        onError={() => {
                          console.error(`Failed to load image: /${currentPlate?.image}`);
                          setImageError(true);
                        }}
                        onLoad={() => setImageError(false)}
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-center font-medium">What do you see?</p>
                  <div className="flex gap-2">
                    <Input
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAnswer()}
                      placeholder="Type number, text, or 'nothing'"
                      className="text-lg"
                      autoFocus
                    />
                    <Button onClick={handleAnswer} disabled={!userInput.trim()}>
                      Submit
                    </Button>
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    Press Enter to submit
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
