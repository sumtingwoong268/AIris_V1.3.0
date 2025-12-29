import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/airis-logo.png";

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
      console.error("Auth error details:", error);
      toast({
        title: "Error",
        description: error.message || JSON.stringify(error) || "Something went wrong",
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
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2 bg-background p-4 lg:p-0 gap-4">
      {/* Left Panel - Brand Art (Visible on Desktop) */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden rounded-[2.5rem] lg:rounded-none lg:rounded-r-[3rem] bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white p-12 lg:p-16 lg:m-4 lg:mr-0 shadow-2xl">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
        <div className="absolute top-1/3 -left-12 h-96 w-96 rounded-full bg-white/20 blur-[100px] animate-pulse-glow" />
        <div className="absolute bottom-0 -right-10 h-80 w-80 rounded-full bg-fuchsia-500/30 blur-[80px]" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner">
            <img src={logo} alt="AIris" className="h-8 drop-shadow-md" />
          </div>
          <span className="text-xl font-bold tracking-widest text-white/90">AIRIS</span>
        </div>

        <div className="relative z-10 space-y-6 max-w-lg">
          <h1 className="text-5xl font-bold leading-tight drop-shadow-sm">
            {isLogin ? "Welcome back to clarity." : "Future-proof your vision today."}
          </h1>
          <p className="text-lg text-indigo-100 font-light leading-relaxed">
            Join thousands of users tracking their eye health with clinical-grade screenings and AI-powered insights.
          </p>

          <div className="flex gap-3 pt-4">
            <div className="h-2 w-12 rounded-full bg-white/50" />
            <div className="h-2 w-2 rounded-full bg-white/20" />
            <div className="h-2 w-2 rounded-full bg-white/20" />
          </div>
        </div>

        <div className="relative z-10 rounded-3xl bg-white/10 border border-white/10 p-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              {[1, 2, 3].map(i => (
                <div key={i} className={`h-10 w-10 rounded-full border-2 border-indigo-500 bg-indigo-${300 + i * 100}`} />
              ))}
            </div>
            <div className="text-sm">
              <span className="font-bold block">Join the community</span>
              <span className="text-white/70">Tracking daily streaks</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form (Centered) */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">
              {isLogin ? "Sign in to your account" : "Create your free account"}
            </h2>
            <p className="text-muted-foreground">
              {isLogin ? "Welcome back! Please enter your details." : "Get started with AIris in seconds."}
            </p>
          </div>

          <div className="grid gap-6">
            <Button
              variant="outline"
              className="h-12 rounded-2xl bg-card border-border hover:bg-accent/5 transition-all text-base font-medium relative group overflow-hidden"
              onClick={handleGoogleAuth}
              disabled={loading}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity dark:from-blue-950 dark:to-indigo-950" />
              <div className="relative flex items-center justify-center gap-3">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
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
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.47 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </div>
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or with email</span>
              </div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-2xl bg-secondary/30 border-transparent focus:bg-background focus:border-primary/50 transition-all font-medium"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {isLogin && <a href="#" className="text-xs text-primary hover:underline">Forgot password?</a>}
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12 rounded-2xl bg-secondary/30 border-transparent focus:bg-background focus:border-primary/50 transition-all font-medium"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 rounded-2xl bg-primary text-white text-base font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:scale-[1.02] transition-all"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </div>
                ) : (
                  isLogin ? "Sign In" : "Create Account"
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-4">
              {isLogin ? "New to AIris?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="font-semibold text-primary hover:underline transition-all"
              >
                {isLogin ? "Create an account" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
