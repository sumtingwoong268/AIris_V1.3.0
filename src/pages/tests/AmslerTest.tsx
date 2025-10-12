import { useState } from "react";
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

export default function AmslerTest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { xp } = useXP(user?.id);
  const { toast } = useToast();
  const [started, setStarted] = useState(false);
  const [eye, setEye] = useState<"left" | "right" | null>(null);
  const [leftClicks, setLeftClicks] = useState<{ x: number; y: number }[]>([]);
  const [rightClicks, setRightClicks] = useState<{ x: number; y: number }[]>([]);
  const [completed, setCompleted] = useState(false);

  const handleStart = () => {
    setStarted(true);
    setEye("left");
    setCompleted(false);
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
      setEye("right");
    } else {
      completeTest();
    }
  };

  const completeTest = async () => {
    if (!user || completed) return;
    setCompleted(true);

    try {
      // XP scaling: base 28 for completion
      const xpEarned = 28;

      await supabase.from("test_results").insert({
        user_id: user.id,
        test_type: "amsler",
        score: 100,
        xp_earned: xpEarned,
        details: { leftClicks, rightClicks },
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

  const currentClicks = eye === "left" ? leftClicks : rightClicks;

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
              <h1 className="text-3xl font-bold">Amsler Grid Test</h1>
              <p className="text-muted-foreground">
                This test checks for visual distortions in your central vision, which can be an
                early sign of macular problems.
              </p>
              <div className="space-y-2 text-left">
                <p className="font-semibold">Instructions:</p>
                <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
                  <li>Cover one eye and look at the center dot</li>
                  <li>Click on any areas where the lines appear wavy or distorted</li>
                  <li>Repeat for the other eye</li>
                  <li>Complete both eyes to earn 20 XP</li>
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
                  <h2 className="mb-2 text-xl font-bold">
                    Testing: {eye === "left" ? "Left" : "Right"} Eye
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Cover your {eye === "left" ? "right" : "left"} eye and focus on the center dot.
                    Click any distorted areas.
                  </p>
                </div>

                <div className="relative mx-auto aspect-square w-full max-w-md">
                  <div
                    className="relative h-full w-full cursor-crosshair border-2 border-foreground bg-white"
                    style={{
                      backgroundImage: `
                        linear-gradient(to right, #000 1px, transparent 1px),
                        linear-gradient(to bottom, #000 1px, transparent 1px)
                      `,
                      backgroundSize: "10% 10%",
                    }}
                    onClick={handleGridClick}
                  >
                    {/* Center dot */}
                    <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
                    
                    {/* User clicks */}
                    {currentClicks.map((click, i) => (
                      <div
                        key={i}
                        className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive"
                        style={{ left: `${click.x}%`, top: `${click.y}%` }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (eye === "left") setLeftClicks([]);
                      else setRightClicks([]);
                    }}
                  >
                    Clear Marks
                  </Button>
                  <Button onClick={handleNext} className="flex-1">
                    {eye === "left" ? "Next Eye" : "Complete Test"}
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
