import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Clock, Share2 } from "lucide-react";
import { BLOG_POSTS } from "@/utils/blogPosts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PremiumHeader } from "@/components/ui/PremiumHeader";

export default function BlogArticle() {
  const navigate = useNavigate();
  const { slug } = useParams();

  const post = useMemo(() => BLOG_POSTS.find((item) => item.slug === slug), [slug]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch (error) {
      console.error("share link error", error);
    }
  };

  if (!post) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Card className="max-w-lg border border-primary/20 bg-white/80 p-8 text-center shadow-xl backdrop-blur dark:bg-slate-900/70">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Article not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The blog you’re looking for isn’t available yet. Explore our latest insights while we publish more stories.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={() => navigate("/blogs")}>Browse blogs</Button>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Go to dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <PremiumHeader
        title="AIris Insights"
        subtitle={post.title.length > 30 ? `${post.title.substring(0, 30)}...` : post.title}
        onBack={() => navigate(-1)}
        rightContent={
          <Button
            variant="ghost"
            className="hidden items-center gap-2 text-primary hover:bg-white/20 sm:inline-flex rounded-full"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        }
      />

      <main className="container mx-auto max-w-4xl space-y-10 px-4 py-10">
        <div className={`relative overflow-hidden rounded-[32px] border border-primary/20 bg-gradient-to-br ${post.heroGradient} p-10 text-white shadow-2xl`}>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
          <div className="relative z-10 space-y-4">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.35em] text-white/70">
              <CalendarDays className="h-4 w-4" /> {post.publishDate}
            </p>
            <h1 className="text-3xl font-bold sm:text-5xl drop-shadow-sm">{post.title}</h1>
            <p className="max-w-2xl text-lg text-white/90 font-light leading-relaxed">{post.description}</p>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-md px-4 py-2 text-sm font-medium text-white border border-white/10">
              <Clock className="h-4 w-4" />
              {post.readTime}
            </div>
          </div>
        </div>

        <article className="space-y-8">
          {post.sections.map((section) => (
            <section key={section.heading} className="glass-card p-8">
              <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-base leading-relaxed text-slate-700 dark:text-slate-200 mb-4">
                  {paragraph}
                </p>
              ))}
              {section.tips && section.tips.length > 0 && (
                <div className="mt-6 rounded-2xl bg-primary/5 border border-primary/10 p-6 text-sm text-primary dark:bg-primary/20">
                  <p className="font-bold uppercase tracking-widest text-xs text-primary/80 mb-3">Try this</p>
                  <ul className="list-disc space-y-2 pl-5 marker:text-primary/50">
                    {section.tips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))}
        </article>

        <section className="grid gap-6 rounded-3xl border border-border/40 bg-white/80 p-8 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/70 md:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Key takeaways</h3>
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-200">
              {post.keyTakeaways.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          {post.resources && post.resources.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Further resources</h3>
              <ul className="space-y-2 text-sm text-primary">
                {post.resources.map((resource) => (
                  <li key={resource.url}>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline transition-colors hover:text-primary/80"
                    >
                      {resource.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-primary/15 bg-gradient-to-r from-primary/10 via-sky-100 to-indigo-100 p-6 shadow-xl dark:from-slate-900 dark:via-primary/15 dark:to-indigo-950">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/70">Next steps</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-50">Ready for personalized vision coaching?</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Head back to your dashboard to track habits, schedule tests, and unlock new AIris recommendations tailored to you.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate("/dashboard")}>Return to dashboard</Button>
            <Button variant="outline" onClick={() => navigate("/blogs")}>Browse more blogs</Button>
          </div>
        </section>
      </main>
    </div>
  );
}
