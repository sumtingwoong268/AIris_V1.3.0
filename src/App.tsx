import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Friends from "./pages/Friends";
import Reports from "./pages/Reports";
import Blogs from "./pages/Blogs";
import BlogArticle from "./pages/BlogArticle";
import Setup from "./pages/Setup";
import Statistics from "./pages/Statistics";
import Achievements from "./pages/Achievements";
import IshiharaTest from "./pages/tests/IshiharaTest";
import VisualAcuityTest from "./pages/tests/VisualAcuityTest";
import AmslerTest from "./pages/tests/AmslerTest";
import ReadingStressTest from "./pages/tests/ReadingStressTest";
import D15Test from "./pages/tests/D15Test";
import D15DesaturatedTest from "./pages/tests/D15DesaturatedTest";
import NotFound from "./pages/NotFound";
import { FriendRequestProvider } from "./context/FriendRequestsContext";
import { ThemeToggle } from "./components/ThemeToggle";
import { LanguageToggle } from "./components/LanguageToggle";
import { supabaseConfigError } from "./integrations/supabase/client";

const queryClient = new QueryClient();

const App = () => {
  if (supabaseConfigError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
        <div className="max-w-xl space-y-4">
          <h1 className="text-3xl font-bold">Configuration required</h1>
          <p className="text-lg text-white/80">
            Supabase environment variables are missing. Add VITE_SUPABASE_URL and
            VITE_SUPABASE_PUBLISHABLE_KEY in your environment (Vercel project settings) and redeploy.
          </p>
          <p className="text-sm text-white/60">
            If you use email auth links, also set VITE_SUPABASE_REDIRECT_URL.
          </p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
          <HashRouter>
            <FriendRequestProvider>
              <div className="fixed top-24 right-6 z-[60] flex flex-col items-end gap-3 pointer-events-none pt-[env(safe-area-inset-top)] switcher-container">
                <div className="flex flex-col items-end gap-3">
                  <ThemeToggle />
                  <LanguageToggle />
                </div>
              </div>
              <div className="flex-1">
                <Routes>
                  <Route path="/" element={<Auth />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/setup" element={<Setup />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/friends" element={<Friends />} />
                  <Route path="/achievements" element={<Achievements />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/blogs" element={<Blogs />} />
                  <Route path="/blogs/:slug" element={<BlogArticle />} />
                  <Route path="/statistics" element={<Statistics />} />
                  <Route path="/tests/ishihara" element={<IshiharaTest />} />
                  <Route path="/tests/visual-acuity" element={<VisualAcuityTest />} />
                  <Route path="/tests/amsler" element={<AmslerTest />} />
                  <Route path="/tests/reading-stress" element={<ReadingStressTest />} />
                  <Route path="/tests/d15" element={<D15Test />} />
                  <Route path="/tests/d15-desaturated" element={<D15DesaturatedTest />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </FriendRequestProvider>
          </HashRouter>
          <footer className="mt-auto w-full px-4 py-3 pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-center">
              <span className="rounded-full bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground shadow-sm ring-1 ring-border/50 backdrop-blur-md">
                🎨 AIris&apos; graphics illustrated by Uswa Touqeer ✨
              </span>
            </div>
          </footer>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
