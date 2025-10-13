import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import logo from "@/assets/logo.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="AIris" className="h-12" />
          <div className="flex flex-col">
            <span className="text-lg font-semibold uppercase tracking-[0.35rem] text-slate-700 dark:text-slate-200">
              AIris
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Personalized eye care companion</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate("/auth")}>
            Sign In
          </Button>
          <Button className="rounded-full bg-gradient-to-r from-primary to-blue-500 text-white hover:from-blue-500 hover:to-primary" onClick={() => navigate("/auth")}>
            Get Started
          </Button>
        </div>
      </header>

      <main className="container mx-auto space-y-16 px-6 pb-16">
        <section className="grid gap-10 lg:grid-cols-[1.1fr,1fr]">
          <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary via-indigo-600 to-fuchsia-600 text-white shadow-2xl">
            <span className="pointer-events-none absolute -left-16 top-1/3 h-48 w-48 rounded-full bg-white/25 blur-3xl" />
            <span className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-sky-400/30 blur-3xl" />
            <CardContent className="relative z-10 space-y-6 p-10">
              <h1 className="text-4xl font-bold leading-tight lg:text-5xl">
                Protect your vision with adaptive screenings and AI-powered insights.
              </h1>
              <p className="max-w-xl text-sm text-white/80">
                AIris makes eye care feel effortless. Complete guided tests, track trends with smart reports, and stay
                motivated with streaks and XP.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="rounded-full bg-white text-primary shadow-lg hover:bg-slate-100"
                  onClick={() => navigate("/auth")}
                >
                  Create free account
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-white/60 bg-white/20 text-white backdrop-blur transition hover:bg-white/30"
                  onClick={() => navigate("/auth")}
                >
                  Sign in
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/15 p-4 text-sm backdrop-blur">
                  <span className="text-xs uppercase tracking-wide text-white/70">Adaptive tests</span>
                  <p className="mt-2 text-lg font-semibold">Ishihara, acuity & more</p>
                </div>
                <div className="rounded-2xl bg-white/15 p-4 text-sm backdrop-blur">
                  <span className="text-xs uppercase tracking-wide text-white/70">AI summaries</span>
                  <p className="mt-2 text-lg font-semibold">Optometrist-ready reports</p>
                </div>
                <div className="rounded-2xl bg-white/15 p-4 text-sm backdrop-blur">
                  <span className="text-xs uppercase tracking-wide text-white/70">Motivation</span>
                  <p className="mt-2 text-lg font-semibold">Streaks + XP rewards</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/60 bg-white/80 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
            <CardContent className="grid gap-4 p-8">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">What you can do with AIris</h2>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <li>• Track visual acuity, color perception, and reading comfort over time.</li>
                <li>• Receive adaptive tips based on your lifestyle and screening results.</li>
                <li>• Export detailed PDFs to share with your optometrist before appointments.</li>
                <li>• Connect with friends and stay motivated through shared streaks.</li>
              </ul>
              <Button
                className="mt-2 rounded-2xl bg-gradient-to-r from-primary to-blue-500 text-white hover:from-blue-500 hover:to-primary"
                onClick={() => navigate("/auth")}
              >
                Start your first test
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          {[
            {
              title: "Personalized recommendations",
              copy: "AIris suggests the next best action based on your screening history, whether it's retesting or taking a break.",
            },
            {
              title: "Smart reminders",
              copy: "Gentle nudges help you maintain healthy habits without overwhelming your schedule.",
            },
            {
              title: "Privacy-first design",
              copy: "Your health data stays encrypted, and reports are generated only when you request them.",
            },
          ].map((feature) => (
            <Card key={feature.title} className="border border-primary/15 bg-white/80 shadow-lg backdrop-blur dark:bg-slate-900/70">
              <CardContent className="space-y-3 p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{feature.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">{feature.copy}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
};

export default Index;
