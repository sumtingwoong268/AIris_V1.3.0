import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpenText, Clock, Plus } from "lucide-react";
import { PremiumHeader } from "@/components/ui/PremiumHeader";
import { BLOG_POSTS } from "@/utils/blogPosts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Blogs() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <PremiumHeader
        title="AIris Insights"
        subtitle="Eye care guides"
        onBack={() => navigate(-1)}
        rightContent={
          <Button onClick={() => navigate("/dashboard")} variant="ghost" size="sm" className="rounded-full px-4 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
            Dashboard
          </Button>
        }
      />

      <main className="container mx-auto max-w-5xl space-y-10 px-4 pt-32 pb-20">
        <div className="relative overflow-hidden rounded-[32px] border border-white/20 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8 shadow-2xl text-white">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
          <div className="relative z-10 grid gap-8 md:grid-cols-[1.5fr,1fr] items-center">
            <div className="space-y-4">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.35em] text-white/70 mb-2">
                  <BookOpenText className="h-4 w-4" /> Expert Blog
                </p>
                <h1 className="text-3xl font-bold sm:text-4xl text-white">Stay inspired with actionable tips for brighter vision</h1>
              </div>
              <p className="max-w-lg text-indigo-100 leading-relaxed font-light">
                Dive into curated articles crafted by our vision specialists. Each guide translates clinical advice into everyday routines.
              </p>
              <Button
                onClick={() => navigate("/dashboard")}
                variant="outline"
                className="mt-4 rounded-full border-white/40 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 transition-all font-semibold"
              >
                <Plus className="h-4 w-4 mr-2" />
                Explore personalized insights
              </Button>
            </div>

            <div className="hidden md:block">
              {/* Visual element or illustration could go here */}
              <div className="relative h-40 w-full rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center">
                <span className="text-white/50 text-sm">Featured content</span>
              </div>
            </div>
          </div>
        </div>

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
                className="glass-card group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
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
