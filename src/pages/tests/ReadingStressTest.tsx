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

const READING_TEXT = `The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet. Reading should feel comfortable and effortless when your eyes are healthy and properly rested. If you experience strain, blurriness, or discomfort while reading, it may indicate eye fatigue or other vision issues. Regular breaks and proper lighting can help reduce reading stress. Remember to blink frequently and maintain a comfortable reading distance.`;

export default function ReadingStressTest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { xp } = useXP(user?.id);
  const { toast } = useToast();
  const [started, setStarted] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [discomfortLevel, setDiscomfortLevel] = useState(0);

  useEffect(() => {
    if (started && !startTime) {
      setStartTime(Date.now());
    }
  }, [started, startTime]);

  const handleStart = () => {
    setStarted(true);
  };

  const completeTest = async () => {
    if (!user || !startTime) return;

    const duration = Math.floor((Date.now() - startTime) / 1000);

    try {
      const score = Math.max(0, 100 - discomfortLevel * 10);
      const xpEarned = Math.floor((score / 100) * 15);

      await supabase.from("test_results").insert({
        user_id: user.id,
        test_type: "reading_stress",
        score,
        xp_earned: xpEarned,
        details: { duration, discomfortLevel },
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary-lighter/10 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={logo} alt="AIris" className="h-10" />
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-8">
        {!started ? (
          <Card className="shadow-elevated">
            <CardContent className="space-y-6 p-8 text-center">
              <h1 className="text-3xl font-bold">Reading Stress Test</h1>
              <p className="text-muted-foreground">
                This test evaluates your comfort level while reading. You'll read a short passage
                and rate any discomfort you experience.
              </p>
              <div className="space-y-2 text-left">
                <p className="font-semibold">Instructions:</p>
                <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
                  <li>Read the passage carefully at your normal pace</li>
                  <li>Pay attention to any eye strain or discomfort</li>
                  <li>Rate your comfort level after reading</li>
                  <li>Earn up to 15 XP based on your comfort</li>
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
                  <h2 className="text-xl font-bold">Read the following text:</h2>
                  <div className="rounded-lg bg-muted p-6 text-lg leading-relaxed">
                    {READING_TEXT}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="mb-3 font-medium">
                      How much discomfort did you experience? (0 = none, 10 = severe)
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">0</span>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={discomfortLevel}
                        onChange={(e) => setDiscomfortLevel(Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground">10</span>
                    </div>
                    <p className="mt-2 text-center text-2xl font-bold text-primary">
                      {discomfortLevel}
                    </p>
                  </div>

                  <Button onClick={completeTest} className="w-full" size="lg">
                    Complete Test
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
