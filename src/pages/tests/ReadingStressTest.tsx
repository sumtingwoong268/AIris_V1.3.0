import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { XPBar } from "@/components/XPBar";
import { useXP } from "@/hooks/useXP";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";

const READING_TEXTS = [
  `The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet at least once.`,
  `Reading should feel comfortable and effortless when your eyes are healthy and properly rested for optimal performance.`,
  `If you experience strain, blurriness, or discomfort while reading, it may indicate eye fatigue or vision issues that need attention.`,
  `Regular breaks and proper lighting can help reduce reading stress. The 20-20-20 rule is a good practice to follow.`,
  `Remember to blink frequently and maintain a comfortable reading distance. Proper posture also contributes to reading comfort.`,
  `Digital screens emit blue light which can contribute to eye strain over extended periods of time. Consider using filters.`,
  `Font size and spacing play crucial roles in reading comfort. What feels comfortable varies from person to person.`,
];

const FONT_SIZES = [18, 16, 14, 12, 10, 9, 8]; // px

interface TrialResult {
  fontSize: number;
  duration: number;
  difficulty: number;
  text: string;
}

export default function ReadingStressTest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { xp, refetch: refetchXP } = useXP(user?.id);
  const { toast } = useToast();
  const [started, setStarted] = useState(false);
  const [currentTrial, setCurrentTrial] = useState(0);
  const [trialStartTime, setTrialStartTime] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState(1);
  const [trialResults, setTrialResults] = useState<TrialResult[]>([]);

  useEffect(() => {
    if (started && !trialStartTime) {
      setTrialStartTime(Date.now());
    }
  }, [started, currentTrial]);

  const handleStart = () => {
    setStarted(true);
    setCurrentTrial(0);
    setTrialResults([]);
    setTrialStartTime(Date.now());
  };

  const handleNextTrial = () => {
    if (!trialStartTime) return;

    const duration = Math.floor((Date.now() - trialStartTime) / 1000);
    const newResult: TrialResult = {
      fontSize: FONT_SIZES[currentTrial],
      duration,
      difficulty,
      text: READING_TEXTS[currentTrial],
    };

    const newResults = [...trialResults, newResult];
    setTrialResults(newResults);

    if (currentTrial < FONT_SIZES.length - 1) {
      setCurrentTrial(currentTrial + 1);
      setDifficulty(1);
      setTrialStartTime(Date.now());
    } else {
      completeTest(newResults);
    }
  };

  const completeTest = async (results: TrialResult[]) => {
    if (!user) return;

    try {
      // Calculate readability threshold (smallest comfortable font)
      const comfortableTrials = results.filter((r) => r.difficulty <= 3);
      const readabilityThreshold = comfortableTrials.length > 0 
        ? Math.min(...comfortableTrials.map((r) => r.fontSize))
        : FONT_SIZES[0];

      // Calculate average difficulty
      const avgDifficulty = results.reduce((sum, r) => sum + r.difficulty, 0) / results.length;
      
      // Calculate score based on comfort level
      const score = Math.round(Math.max(0, 100 - (avgDifficulty - 1) * 12.5));
      
      // XP based on completion and performance
      const xpEarned = Math.round(15 * (score / 100));

      await supabase.from("test_results").insert({
        user_id: user.id,
        test_type: "reading_stress",
        score,
        xp_earned: xpEarned,
        details: { 
          trials: results,
          readabilityThreshold,
          avgDifficulty: Number(avgDifficulty.toFixed(2)),
          totalTrials: results.length,
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
        description: `Readability: ${readabilityThreshold}px | +${xpEarned} XP`,
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
              <h1 className="text-3xl font-bold">Reading Stress Test</h1>
              <p className="text-muted-foreground">
                This test evaluates your reading comfort across different font sizes. 
                You'll read {FONT_SIZES.length} passages with progressively smaller text.
              </p>
              <div className="space-y-2 text-left">
                <p className="font-semibold">Instructions:</p>
                <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
                  <li>Read each passage at your normal pace</li>
                  <li>Rate difficulty: 1 = easy, 5 = hard/uncomfortable</li>
                  <li>Font sizes range from 18px down to 8px</li>
                  <li>Complete all trials to earn up to 15 XP</li>
                  <li>Determines your optimal reading font size</li>
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">
                      Trial {currentTrial + 1} of {FONT_SIZES.length}
                    </h2>
                    <span className="text-sm font-medium text-primary">
                      Font size: {FONT_SIZES[currentTrial]}px
                    </span>
                  </div>
                  
                  <div className="rounded-lg bg-muted p-6">
                    <p 
                      style={{ fontSize: `${FONT_SIZES[currentTrial]}px` }}
                      className="leading-relaxed"
                    >
                      {READING_TEXTS[currentTrial]}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="mb-3 font-medium text-center">
                      How difficult was this to read?
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <Button
                          key={level}
                          variant={difficulty === level ? "default" : "outline"}
                          size="lg"
                          onClick={() => setDifficulty(level)}
                          className="w-16 h-16 text-lg font-bold"
                        >
                          {level}
                        </Button>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground px-2">
                      <span>Easy</span>
                      <span>Hard</span>
                    </div>
                  </div>

                  <Button onClick={handleNextTrial} className="w-full" size="lg">
                    {currentTrial < FONT_SIZES.length - 1 ? "Next Trial" : "Complete Test"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
