import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const checkSetupStatus = async () => {
      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, setup_completed, display_name, username, privacy_accepted")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Failed to fetch profile during auth:", error);
          navigate("/dashboard");
          return;
        }

        if (!data) {
          const { error: insertError } = await supabase.from("profiles").insert({
            id: user.id,
            display_name: user.user_metadata?.full_name ?? user.email ?? null,
            avatar_url: user.user_metadata?.avatar_url ?? null,
            privacy_accepted: false,
          });
          if (insertError) {
            console.error("Failed to create missing profile during auth:", insertError);
          }
          navigate("/setup");
          return;
        }

        if (data.setup_completed) {
          navigate("/dashboard");
          return;
        }

        const hasExistingDetails = Boolean(data.display_name && data.username);
        if (hasExistingDetails) {
          const { error: autoCompleteError } = await supabase
            .from("profiles")
            .update({ setup_completed: true, updated_at: new Date().toISOString() })
            .eq("id", user.id);
          if (autoCompleteError) {
            console.error("Failed to auto-complete setup flag:", autoCompleteError);
            navigate("/setup");
            return;
          }
          navigate("/dashboard");
          return;
        }

        navigate("/setup");
      }
    };
    
    checkSetupStatus();
  }, [user, navigate]);

  const redirectEnv = import.meta.env.VITE_SUPABASE_REDIRECT_URL;
  const defaultRedirect =
    typeof window !== "undefined" && window.location.hostname.includes("localhost")
      ? `${window.location.origin}/setup`
      : "https://airis.care/setup";
  const redirectUrl =
    typeof redirectEnv === "string" && redirectEnv.length > 0
      ? redirectEnv.startsWith("http")
        ? redirectEnv
        : `${window.location.origin}${redirectEnv.startsWith("/") ? "" : "/"}${redirectEnv}`
      : defaultRedirect;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({ title: "Welcome back!", description: "Successfully signed in." });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });
        if (error) throw error;
        
        if (data?.user?.identities?.length === 0) {
          toast({ 
            title: "Email already registered", 
            description: "This email is already in use. Please login instead.", 
            variant: "destructive" 
          });
        } else {
          toast({ 
            title: "Check your email!", 
            description: "We sent you a verification link. Please check your inbox and spam folder.", 
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in with Google",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto flex min-h-screen flex-col justify-center px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr,1fr]">
          <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary via-indigo-600 to-fuchsia-600 text-white shadow-2xl">
            <span className="pointer-events-none absolute -left-12 top-1/3 h-48 w-48 rounded-full bg-white/25 blur-3xl" />
            <span className="pointer-events-none absolute -right-10 bottom-0 h-44 w-44 rounded-full bg-sky-400/30 blur-3xl" />
            <CardContent className="relative z-10 space-y-8 p-10">
              <div className="flex items-center gap-3">
                <img src={logo} alt="AIris" className="h-12" />
                <div className="flex flex-col">
                  <span className="text-lg font-semibold uppercase tracking-[0.3rem] text-white/70">
                    AIris
                  </span>
                  <span className="text-xs text-white/60">Personalized eye health companion</span>
                </div>
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-bold">
                  {isLogin ? "Welcome back to clear vision" : "Join AIris and care for your eyes smarter"}
                </h1>
                <p className="text-sm text-white/80">
                  Earn XP with guided screenings, receive AI-assisted reports, and build lasting habits that protect your
                  eyesight. It only takes a few minutes to get started.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/15 p-4 text-sm backdrop-blur">
                  <span className="text-xs uppercase tracking-wide text-white/70">Daily streaks</span>
                  <p className="mt-2 text-lg font-semibold">Stay accountable</p>
                </div>
                <div className="rounded-2xl bg-white/15 p-4 text-sm backdrop-blur">
                  <span className="text-xs uppercase tracking-wide text-white/70">Smart reports</span>
                  <p className="mt-2 text-lg font-semibold">Optometrist-ready</p>
                </div>
                <div className="rounded-2xl bg-white/15 p-4 text-sm backdrop-blur">
                  <span className="text-xs uppercase tracking-wide text-white/70">Adaptive tests</span>
                  <p className="mt-2 text-lg font-semibold">Tailored to you</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/60 bg-white/80 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
            <CardHeader className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/40 bg-white/70 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
                <img src={logo} alt="AIris" className="h-10" />
              </div>
              <CardTitle className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
                {isLogin ? "Sign in to AIris" : "Create your AIris account"}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {isLogin
                  ? "Access your dashboard, reports, and test history."
                  : "Set up your profile and start tracking your vision."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Button
                variant="outline"
                className="w-full rounded-2xl"
                onClick={handleGoogleAuth}
                disabled={loading}
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white/80 px-2 text-muted-foreground dark:bg-slate-900/70">Or</span>
                </div>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div className="space-y-2 text-left">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="rounded-2xl"
                  />
                </div>
                <div className="space-y-2 text-left">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="rounded-2xl"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full rounded-2xl bg-gradient-to-r from-primary to-blue-500 text-white hover:from-blue-500 hover:to-primary"
                  disabled={loading}
                >
                  {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
                </Button>
              </form>

              <div className="text-center text-sm text-slate-600 dark:text-slate-300">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="font-medium text-primary hover:underline"
                >
                  {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
