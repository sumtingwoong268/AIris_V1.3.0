import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto flex min-h-screen items-center justify-center px-6 py-16">
        <Card className="glass-card relative overflow-hidden border-none shadow-2xl max-w-lg w-full">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-indigo-600 to-fuchsia-600 opacity-90" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
          <span className="pointer-events-none absolute -left-10 top-1/3 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
          <span className="pointer-events-none absolute -right-8 bottom-0 h-40 w-40 rounded-full bg-sky-400/30 blur-3xl" />

          <CardContent className="relative z-10 space-y-8 p-12 text-center text-white">
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.35rem] text-white/50">404 Error</p>
              <h1 className="text-5xl font-extrabold tracking-tight">Page not found</h1>
              <p className="text-lg text-indigo-100/90 leading-relaxed font-light">
                The link might be broken or the page may have been removed. Let&apos;s get you back on track.
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                className="rounded-full bg-white text-primary font-semibold shadow-lg hover:bg-slate-50 hover:scale-105 transition-all duration-300"
                onClick={() => navigate("/dashboard")}
              >
                Go to Dashboard
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full border-white/40 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 transition-all"
                onClick={() => navigate("/auth")}
              >
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotFound;
