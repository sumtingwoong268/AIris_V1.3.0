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
      <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-16">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary via-indigo-600 to-fuchsia-600 text-white shadow-2xl">
          <span className="pointer-events-none absolute -left-10 top-1/3 h-48 w-48 rounded-full bg-white/25 blur-3xl" />
          <span className="pointer-events-none absolute -right-8 bottom-0 h-40 w-40 rounded-full bg-sky-400/30 blur-3xl" />
          <CardContent className="relative z-10 space-y-6 p-10 text-center">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.35rem] text-white/70">404 not found</p>
              <h1 className="text-4xl font-bold">We couldn&apos;t find that page.</h1>
              <p className="text-sm text-white/80">
                The link might be broken or the page may have been removed. Let&apos;s get you back to somewhere safe.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                className="rounded-full bg-white text-primary shadow-lg hover:bg-slate-100"
                onClick={() => navigate("/dashboard")}
              >
                Go to dashboard
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-white/60 bg-white/20 text-white hover:bg-white/30"
                onClick={() => navigate("/auth")}
              >
                Sign in
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotFound;
