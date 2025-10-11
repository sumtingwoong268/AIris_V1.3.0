import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { XPBar } from "@/components/XPBar";
import { useXP } from "@/hooks/useXP";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowUp, ArrowDown, ArrowRight } from "lucide-react";
import logo from "@/assets/logo.png";

export default function VisualAcuityTest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { xp } = useXP(user?.id);
  const { toast } = useToast();
  const [started, setStarted] = useState(false);
  const [level, setLevel] = useState(1);
  const [correct, setCorrect] = useState(0);
  const [direction, setDirection] = useState<"up" | "down" | "left" | "right">("up");

  const directions = ["up", "down", "left", "right"] as const;

  const handleStart = () => {
    setStarted(true);
    setLevel(1);
    setCorrect(0);
    randomizeDirection();
  };

  const randomizeDirection = () => {
    const random = directions[Math.floor(Math.random() * directions.length)];
    setDirection(random);
  };

  const handleAnswer = (answer: typeof direction) => {
    if (answer === direction) {
      setCorrect(correct + 1);
    }

    if (level < 8) {
      setLevel(level + 1);
      randomizeDirection();
    } else {
      completeTest();
    }
  };

  const completeTest = async () => {
    if (!user) return;

    try {
      const score = (correct / 8) * 100;
      const xpEarned = Math.floor((score / 100) * 25);

      await supabase.from("test_results").insert({
        user_id: user.id,
        test_type: "visual_acuity",
        score,
        xp_earned: xpEarned,
        details: { correct, total: 8 },
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
              <h1 className="text-3xl font-bold">Visual Acuity Test</h1>
              <p className="text-muted-foreground">
                This test measures your visual sharpness. You'll see arrows pointing in different
                directions that get progressively smaller.
              </p>
              <div className="space-y-2 text-left">
                <p className="font-semibold">Instructions:</p>
                <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
                  <li>Identify which direction the arrow is pointing</li>
                  <li>The arrows will get smaller as you progress</li>
                  <li>Complete 8 levels to earn up to 25 XP</li>
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
              <CardContent className="space-y-8 p-8">
                <div className="text-center">
                  <p className="mb-4 text-sm text-muted-foreground">
                    Level {level} of 8
                  </p>
                  <div className="flex items-center justify-center py-12">
                    {direction === "up" && <ArrowUp size={iconSize} className="text-primary" />}
                    {direction === "down" && <ArrowDown size={iconSize} className="text-primary" />}
                    {direction === "left" && <ArrowLeft size={iconSize} className="text-primary" />}
                    {direction === "right" && <ArrowRight size={iconSize} className="text-primary" />}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-center font-medium">Which direction is the arrow pointing?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => handleAnswer("up")}
                      className="h-20"
                    >
                      <ArrowUp className="h-6 w-6" />
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => handleAnswer("down")}
                      className="h-20"
                    >
                      <ArrowDown className="h-6 w-6" />
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => handleAnswer("left")}
                      className="h-20"
                    >
                      <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => handleAnswer("right")}
                      className="h-20"
                    >
                      <ArrowRight className="h-6 w-6" />
                    </Button>
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
