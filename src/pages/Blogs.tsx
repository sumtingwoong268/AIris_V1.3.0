import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpenText, Clock, Plus } from "lucide-react";
import logo from "@/assets/logo.png";
import { BLOG_POSTS } from "@/utils/blogPosts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Blogs() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="border-b border-border/40 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div
            className="flex cursor-pointer items-center gap-3"
            onClick={() => navigate("/dashboard")}
          >
            <img src={logo} alt="AIris" className="hidden h-10 sm:block" />
            <div className="flex flex-col">
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                AIris Insights
              </span>
              <span className="text-[10px] text-muted-foreground -mt-1">Eye care guides & wellness tips</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-10 px-4 py-10">
        <section className="relative overflow-hidden rounded-[32px] border border-primary/15 bg-gradient-to-br from-primary/10 via-sky-100 to-indigo-100 p-8 shadow-xl dark:from-slate-900 dark:via-primary/15 dark:to-indigo-950">
          <span className="pointer-events-none absolute -top-12 left-8 h-32 w-32 rounded-full bg-white/50 blur-3xl dark:bg-primary/30" />
          <span className="pointer-events-none absolute -bottom-16 right-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl dark:bg-indigo-500/30" />
          <div className="relative z-10 space-y-4 text-slate-900 dark:text-slate-100">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-primary">
              <BookOpenText className="h-4 w-4" />
              Expert eye care blog
            </p>
            <h1 className="text-3xl font-bold sm:text-4xl">Stay inspired with actionable tips for brighter, healthier vision</h1>
            <p className="max-w-2xl text-sm text-slate-700 dark:text-slate-300">
              Dive into curated articles crafted by our vision specialists. Each guide translates clinical advice into everyday routines you can follow with confidence.
            </p>
            <Button
              onClick={() => navigate("/dashboard")}
              variant="outline"
              className="mt-4 inline-flex items-center gap-2 rounded-full border-primary/60 bg-white/60 px-6 text-primary shadow-sm hover:bg-white/80 dark:border-primary/40 dark:bg-slate-900/70 dark:text-primary-foreground dark:hover:bg-slate-900"
            >
              <Plus className="h-4 w-4" />
              Explore your personalized insights
            </Button>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/70">Latest reads</p>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Featured eye care stories</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Click any title to open the full article. We will keep expanding this library with new perspectives.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="inline-flex items-center gap-2 text-primary hover:bg-primary/10 dark:hover:bg-primary/20"
              disabled
            >
              Coming soon
            </Button>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {BLOG_POSTS.map((post) => (
              <Card
                key={post.slug}
                className="group relative overflow-hidden border border-transparent bg-white/80 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-2xl dark:bg-slate-900/70"
              >
                <span className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${post.heroGradient} opacity-0 transition-opacity duration-500 group-hover:opacity-10`} />
                <CardHeader className="relative space-y-3">
                  <CardTitle
                    onClick={() => navigate(`/blogs/${post.slug}`)}
                    className="cursor-pointer text-xl font-semibold text-slate-900 transition-colors hover:text-primary dark:text-slate-50 dark:hover:text-primary"
                  >
                    {post.title}
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-600 dark:text-slate-300">
                    {post.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <span>{post.publishDate}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {post.readTime}
                  </span>
                </CardContent>
                <button
                  onClick={() => navigate(`/blogs/${post.slug}`)}
                  className="absolute inset-0"
                  aria-label={`Read ${post.title}`}
                />
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
