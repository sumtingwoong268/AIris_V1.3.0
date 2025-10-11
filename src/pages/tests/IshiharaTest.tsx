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

export default function IshiharaTest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { xp } = useXP(user?.id);
  const { toast } = useToast();
  const [started, setStarted] = useState(false);
  const [currentPlate, setCurrentPlate] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [manifest, setManifest] = useState<any>(null);

  useEffect(() => {
    fetch("/ishihara_manifest_38.json")
      .then((res) => res.json())
      .then((data) => setManifest(data))
      .catch((err) => console.error("Failed to load manifest:", err));
  }, []);

  const handleStart = () => {
    setStarted(true);
    setCurrentPlate(0);
    setAnswers([]);
  };

  const handleAnswer = (answer: string) => {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    if (currentPlate < 9) {
      // Show 10 plates for now
      setCurrentPlate(currentPlate + 1);
    } else {
      completeTest(newAnswers);
    }
  };

  const completeTest = async (testAnswers: string[]) => {
    if (!user) return;

    try {
      const score = testAnswers.filter((a) => a !== "").length * 10;
      const xpEarned = Math.min(30, score);

      await supabase.from("test_results").insert({
        user_id: user.id,
        test_type: "ishihara",
        score,
        xp_earned: xpEarned,
        details: { answers: testAnswers },
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

  if (!manifest) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading test...</p>
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
          <img src={logo} alt="AIris" className="h-10" />
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-8">
        {!started ? (
          <Card className="shadow-elevated">
            <CardContent className="space-y-6 p-8 text-center">
              <h1 className="text-3xl font-bold">Ishihara Color Test</h1>
              <p className="text-muted-foreground">
                This test checks for color vision deficiencies. You'll be shown a series of colored
                plates. Enter the number you see in each plate.
              </p>
              <div className="space-y-2 text-left">
                <p className="font-semibold">Instructions:</p>
                <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
                  <li>Look at each plate carefully</li>
                  <li>Enter the number you can see</li>
                  <li>If you can't see a number, enter "0"</li>
                  <li>Complete all plates to earn up to 30 XP</li>
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
                  <p className="mb-2 text-sm text-muted-foreground">
                    Plate {currentPlate + 1} of 10
                  </p>
                  <div className="mx-auto w-full max-w-md">
                    {/* Placeholder for plate image */}
                    <div className="aspect-square rounded-lg bg-gradient-to-br from-primary-lighter to-muted flex items-center justify-center">
                      <p className="text-muted-foreground">Plate {currentPlate + 1}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-center font-medium">What number do you see?</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <Button
                        key={num}
                        variant="outline"
                        size="lg"
                        onClick={() => handleAnswer(String(num))}
                      >
                        {num}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
