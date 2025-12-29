import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import logo from "@/assets/airis-logo.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Floating Header */}
      <div className="fixed top-10 left-0 right-0 z-50 flex justify-center px-4 pt-[env(safe-area-inset-top)]">
        <header className="flex w-full max-w-5xl items-center justify-between rounded-full border border-white/20 bg-white/70 px-6 py-3 shadow-lg shadow-black/5 backdrop-blur-xl transition-all hover:bg-white/80 dark:bg-slate-900/70 dark:border-white/10 supports-[backdrop-filter]:bg-white/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-md">
              <img src={logo} alt="AIris" className="h-6 w-6 object-contain brightness-0 invert" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">AIris</span>
          </div>

          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#testimonials" className="hover:text-primary transition-colors">Stories</a>
            <a href="#science" className="hover:text-primary transition-colors">Science</a>
            <a href="/blogs" onClick={(e) => { e.preventDefault(); navigate("/blogs"); }} className="hover:text-primary transition-colors cursor-pointer">Blogs</a>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="hidden sm:inline-flex rounded-full text-slate-600 hover:bg-slate-100 px-5 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => navigate("/auth")}
            >
              Sign In
            </Button>
            <Button
              className="rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 hover:shadow-xl hover:-translate-y-0.5 transition-all px-6"
              onClick={() => navigate("/auth")}
            >
              Get Started
            </Button>

            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Menu className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[80vw] sm:w-[350px]">
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col gap-4 mt-8">
                    <a href="#features" className="text-lg font-medium hover:text-primary transition-colors">Features</a>
                    <a href="#testimonials" className="text-lg font-medium hover:text-primary transition-colors">Stories</a>
                    <a href="#science" className="text-lg font-medium hover:text-primary transition-colors">Science</a>
                    <a href="/blogs" onClick={(e) => { e.preventDefault(); navigate("/blogs"); }} className="text-lg font-medium hover:text-primary transition-colors cursor-pointer">Blogs</a>
                    <hr className="my-2 border-slate-200 dark:border-slate-800" />
                    <Button
                      variant="outline"
                      className="w-full rounded-xl justify-start h-12"
                      onClick={() => navigate("/auth")}
                    >
                      Sign In
                    </Button>
                    <Button
                      className="w-full rounded-xl justify-start h-12 bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => navigate("/auth")}
                    >
                      Get Started
                    </Button>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>
      </div>

      <main className="container mx-auto px-4 pt-24 md:pt-28 pb-20 space-y-20 mt-[env(safe-area-inset-top)]">

        {/* Hero Section - Asymmetrical */}
        <section className="relative">
          <div className="grid gap-12 lg:grid-cols-[1.2fr,1fr] items-center">
            <div className="space-y-8 relative z-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 py-1.5 px-4 shadow-sm text-sm font-medium text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 animate-fade-in">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                v1.3 Now Live
              </div>
              <h1 className="text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-7xl lg:text-8xl leading-[0.9]">
                Vision care, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 animate-gradient-x">reimagined.</span>
              </h1>
              <p className="max-w-xl text-lg text-slate-600 leading-relaxed dark:text-slate-300">
                Clinical-grade eye screenings, intelligent tracking, and personalized insights—all from the comfort of your browser.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button
                  size="lg"
                  className="h-14 px-8 rounded-full bg-blue-600 text-white text-lg font-semibold shadow-xl shadow-blue-600/20 hover:bg-blue-700 hover:scale-105 transition-all"
                  onClick={() => navigate("/auth")}
                >
                  Start Free Screening
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 rounded-full border-2 border-slate-200 bg-transparent text-lg font-semibold hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  onClick={() => navigate("/auth")}
                >
                  View Demo
                </Button>
              </div>

              <div className="pt-8 flex items-center gap-4 text-sm font-medium text-slate-500">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`h-10 w-10 rounded-full border-2 border-white bg-slate-${200 + i * 100}`} />
                  ))}
                </div>
                <p>Trusted by 10,000+ users</p>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative h-[600px] w-full hidden lg:block">
              <div className="absolute top-10 right-0 w-3/4 h-[90%] bg-gradient-to-br from-indigo-100 to-purple-100 rounded-[3rem] -z-10 dark:from-indigo-900/20 dark:to-purple-900/20 transform rotate-3" />
              <Card className="absolute top-0 right-10 w-80 p-6 rounded-[2.5rem] bg-white/80 backdrop-blur-xl border-white/50 shadow-2xl animate-float z-20 hover:scale-105 transition-transform dark:bg-slate-800/80 dark:border-white/10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
                    <span className="font-bold text-xl">Aa</span>
                  </div>
                  <div>
                    <h3 className="font-bold">Visual Acuity</h3>
                    <p className="text-xs text-slate-500">Last checked: 2d ago</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Left Eye</span>
                    <span className="text-green-600">20/20</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 w-full" />
                  </div>
                </div>
              </Card>

              <Card className="absolute bottom-20 left-0 w-72 p-6 rounded-[2.5rem] bg-white/80 backdrop-blur-xl border-white/50 shadow-2xl animate-float animation-delay-2000 z-30 hover:scale-105 transition-transform dark:bg-slate-800/80 dark:border-white/10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                    <span className="font-bold">⚡</span>
                  </div>
                  <div>
                    <h3 className="font-bold">Daily Streak</h3>
                    <p className="text-xs text-slate-500">Keep it up!</p>
                  </div>
                </div>
                <div className="text-3xl font-bold text-slate-900 dark:text-white">
                  12 <span className="text-base font-normal text-slate-500">days</span>
                </div>
              </Card>

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-[100px] opacity-20 -z-20 pointer-events-none" />
            </div>
          </div>
        </section>

        {/* Bento Grid Features */}
        <section id="features" className="space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-slate-900 dark:text-white">Why AIris?</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">Detailed analytics and proactive care, designed for the modern lifestyle.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 auto-rows-[minmax(200px,auto)]">
            {/* Large Featured Card */}
            <div className="col-span-1 md:col-span-2 lg:col-span-2 row-span-2 rounded-[2.5rem] bg-white text-slate-900 p-10 flex flex-col justify-between overflow-hidden relative group border border-slate-200 shadow-sm dark:bg-slate-900 dark:text-white dark:border-slate-800">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="relative z-10 space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                  <span className="text-2xl">🧠</span>
                </div>
                <h3 className="text-3xl font-bold">AI-Powered Analysis</h3>
                <p className="text-slate-600 text-lg leading-relaxed dark:text-slate-300">
                  Our advanced algorithms analyze your test results to detect subtle changes in your vision over time, providing early warnings and tailored advice.
                </p>
              </div>
              <div className="relative z-10 pt-8">
                <Button
                  variant="outline"
                  className="rounded-full border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
                >
                  Learn more
                </Button>
              </div>
            </div>

            {/* Vertical Card */}
            <div className="col-span-1 md:col-span-1 lg:col-span-1 row-span-2 rounded-[2.5rem] bg-indigo-50 border border-indigo-100 p-8 flex flex-col items-center justify-center text-center space-y-6 hover:shadow-lg transition-all dark:bg-slate-800 dark:border-slate-700">
              <div className="w-24 h-24 rounded-full bg-white shadow-xl shadow-indigo-100 flex items-center justify-center text-4xl mb-4 dark:bg-slate-700 dark:shadow-none">
                📱
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Mobile Ready</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Take tests on any device. Your progress syncs automatically across phone, tablet, and desktop.
              </p>
            </div>

            {/* Small Card 1 */}
            <div className="col-span-1 md:col-span-1 lg:col-span-1 rounded-[2.5rem] bg-white border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all dark:bg-slate-800 dark:border-slate-700">
              <h3 className="text-lg font-bold mb-2">Export Data</h3>
              <p className="text-sm text-slate-500">Download optometry-grade PDF reports instantly.</p>
            </div>

            {/* Small Card 2 */}
            <div className="col-span-1 md:col-span-2 lg:col-span-1 rounded-[2.5rem] bg-gradient-to-br from-purple-500 to-indigo-600 text-white p-8 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
              <h3 className="text-lg font-bold mb-2">Gamified Health</h3>
              <p className="text-sm text-indigo-100">Earn XP and badges for maintaining healthy vision habits.</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-[3rem] bg-gradient-to-r from-white via-blue-50 to-indigo-50 text-slate-900 overflow-hidden relative py-20 px-6 text-center border border-slate-200/70 shadow-sm dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-900/80 dark:text-white dark:border-slate-800">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10" />
          <div className="relative z-10 max-w-3xl mx-auto space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Ready to see the difference?</h2>
            <p className="text-xl text-slate-600 dark:text-slate-300">Join the thousands of people who are taking control of their eye health today.</p>
            <Button
              className="h-16 px-10 rounded-full bg-primary text-primary-foreground text-lg font-bold hover:bg-primary/90 hover:scale-105 transition-all shadow-xl"
              onClick={() => navigate("/auth")}
            >
              Get Started for Free
            </Button>
          </div>
        </section>

      </main>
    </div>
  );
};

export default Index;
