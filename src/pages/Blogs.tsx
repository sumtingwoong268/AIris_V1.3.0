import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpenText, Clock, Plus, Search } from "lucide-react";
import logo from "@/assets/logo.png";
import { getBlogPosts } from "@/api/blogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";

const BLOG_QUERY_KEY = ["blog-posts"];

export default function Blogs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: posts = [], isLoading } = useQuery({
    queryKey: BLOG_QUERY_KEY,
    queryFn: () => getBlogPosts({ fallbackToSeed: true }),
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const formatPublishDate = (value: string) => {
    if (!value) {
      return "";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(parsed);
  };

  const allTags = useMemo(() => {
    const unique = new Set<string>();
    posts.forEach((post) => {
      post.tags.forEach((tag) => unique.add(tag));
    });
    return Array.from(unique).sort();
  }, [posts]);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const query = searchTerm.trim().toLowerCase();
      const matchesQuery =
        query.length === 0 ||
        post.title.toLowerCase().includes(query) ||
        post.description.toLowerCase().includes(query) ||
        post.tags.some((tag) => tag.toLowerCase().includes(query));

      if (!matchesQuery) {
        return false;
      }

      if (activeTags.length === 0) {
        return true;
      }

      return activeTags.every((tag) => post.tags.includes(tag));
    });
  }, [posts, searchTerm, activeTags]);

  const handleToggleTag = (tag: string) => {
    setActiveTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  };

  const isStaff = user?.user_metadata?.role === "staff";

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
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {isStaff && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/blogs/manage")}
                  className="border-primary/40 text-primary hover:bg-primary/10 dark:border-primary/30 dark:hover:bg-primary/20"
                >
                  Manage posts
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                className="inline-flex items-center gap-2 text-primary hover:bg-primary/10 dark:hover:bg-primary/20"
                disabled
              >
                New features coming soon
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-3xl border border-border/40 bg-white/80 p-4 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by topic, keyword, or tag"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-9"
                />
              </div>
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => {
                    const isActive = activeTags.includes(tag);
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => handleToggleTag(tag)}
                        className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-950 ${
                          isActive
                            ? "border-primary bg-primary text-primary-foreground shadow"
                            : "border-primary/40 bg-white text-primary hover:bg-primary/10 dark:border-primary/30 dark:bg-transparent"
                        }`}
                      >
                        {tag.replace(/-/g, " ")}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="grid gap-6 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Card key={index} className="overflow-hidden border border-transparent bg-white/80 shadow-lg dark:bg-slate-900/70">
                    <CardHeader className="space-y-3">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardHeader>
                    <CardContent className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredPosts.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2">
                {filteredPosts.map((post) => (
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
                      {post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {post.tags.map((tag) => (
                            <Badge key={`${post.slug}-${tag}`} variant="secondary" className="bg-primary/10 text-[10px] uppercase tracking-[0.2em] text-primary">
                              {tag.replace(/-/g, " ")}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="relative flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      <span>{formatPublishDate(post.publishDate)}</span>
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
            ) : (
              <Card className="border border-dashed border-primary/30 bg-white/70 p-8 text-center dark:border-primary/20 dark:bg-slate-900/60">
                <CardHeader className="space-y-3">
                  <CardTitle className="text-xl">No matching articles yet</CardTitle>
                  <CardDescription>
                    Adjust your search or tags to explore our current library. We publish new stories frequently, so check back soon.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" onClick={() => {
                    setSearchTerm("");
                    setActiveTags([]);
                  }}>
                    Clear filters
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
