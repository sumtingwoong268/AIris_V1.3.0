import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { getBlogPostBySlug, getBlogPosts, upsertBlogPost, deleteBlogPost } from "@/api/blogs";
import { BlogPost } from "@/utils/blogPosts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";

const BLOG_LIST_QUERY_KEY = ["blog-posts"];

const sanitizeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

type EditableSection = {
  heading: string;
  paragraphsText: string;
  tipsText: string;
};

type EditableResource = {
  label: string;
  url: string;
};

type BlogEditorState = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  heroGradient: string;
  readTime: string;
  publishDate: string;
  tagsInput: string;
  keyTakeawaysInput: string;
  relatedSlugsInput: string;
  sections: EditableSection[];
  resources: EditableResource[];
};

const createEmptyState = (): BlogEditorState => ({
  title: "",
  slug: "",
  description: "",
  heroGradient: "from-primary/80 via-sky-500 to-indigo-500",
  readTime: "5 min read",
  publishDate: new Date().toISOString().split("T")[0],
  tagsInput: "",
  keyTakeawaysInput: "",
  relatedSlugsInput: "",
  sections: [
    {
      heading: "",
      paragraphsText: "",
      tipsText: "",
    },
  ],
  resources: [],
});

const mapPostToState = (post: BlogPost): BlogEditorState => ({
  id: post.id,
  title: post.title,
  slug: post.slug,
  description: post.description,
  heroGradient: post.heroGradient,
  readTime: post.readTime,
  publishDate: post.publishDate.includes("T") ? post.publishDate.split("T")[0] : post.publishDate,
  tagsInput: post.tags.join(", "),
  keyTakeawaysInput: post.keyTakeaways.join("\n"),
  relatedSlugsInput: (post.relatedSlugs ?? []).join(", "),
  sections: post.sections.map((section) => ({
    heading: section.heading,
    paragraphsText: section.paragraphs.join("\n\n"),
    tipsText: (section.tips ?? []).join("\n"),
  })),
  resources: (post.resources ?? []).map((resource) => ({ ...resource })),
});

const mapStateToPayload = (state: BlogEditorState, authorId: string | null | undefined) => {
  const tags = state.tagsInput
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const keyTakeaways = state.keyTakeawaysInput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const relatedSlugs = state.relatedSlugsInput
    .split(",")
    .map((value) => sanitizeSlug(value))
    .filter(Boolean);

  const sections = state.sections
    .map((section) => {
      const paragraphs = section.paragraphsText
        .split(/\n+/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);

      const tips = section.tipsText
        .split(/\n+/)
        .map((tip) => tip.trim())
        .filter(Boolean);

      if (!section.heading.trim() || paragraphs.length === 0) {
        return undefined;
      }

      return {
        heading: section.heading.trim(),
        paragraphs,
        ...(tips.length > 0 ? { tips } : {}),
      };
    })
    .filter((section): section is NonNullable<typeof section> => Boolean(section));

  const resources = state.resources
    .map((resource) => ({
      label: resource.label.trim(),
      url: resource.url.trim(),
    }))
    .filter((resource) => resource.label && resource.url);

  const publishDate = state.publishDate || new Date().toISOString().split("T")[0];

  return {
    id: state.id,
    title: state.title.trim(),
    slug: sanitizeSlug(state.slug || state.title),
    description: state.description.trim(),
    heroGradient: state.heroGradient.trim(),
    readTime: state.readTime.trim(),
    publishDate,
    tags,
    keyTakeaways,
    sections,
    resources: resources.length > 0 ? resources : undefined,
    relatedSlugs,
    authorId,
  };
};

export default function ManageBlogs() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [editorState, setEditorState] = useState<BlogEditorState>(createEmptyState);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: BLOG_LIST_QUERY_KEY,
    queryFn: () => getBlogPosts({ fallbackToSeed: true }),
  });

  const createSlugSuggestion = useMemo(() => sanitizeSlug(editorState.title), [editorState.title]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!selectedSlug) {
      return;
    }

    let active = true;

    getBlogPostBySlug(selectedSlug, { fallbackToSeed: true }).then((post) => {
      if (post && active) {
        setEditorState(mapPostToState(post));
      }
    });

    return () => {
      active = false;
    };
  }, [selectedSlug]);

  const isStaff = user?.user_metadata?.role === "staff";

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = mapStateToPayload(editorState, user?.id);

      if (!payload.title || !payload.slug || payload.sections.length === 0) {
        throw new Error("A title, slug, and at least one section with content are required.");
      }

      return upsertBlogPost(payload);
    },
    onSuccess: (post) => {
      toast({
        title: "Blog saved",
        description: "Your updates are live for readers.",
      });
      queryClient.invalidateQueries({ queryKey: BLOG_LIST_QUERY_KEY });
      if (post) {
        queryClient.invalidateQueries({ queryKey: ["blog-post", post.slug] });
      }
      if (post) {
        setSelectedSlug(post.slug);
        setEditorState(mapPostToState(post));
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Unable to save blog post.";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!editorState.id) {
        throw new Error("You can only delete saved posts.");
      }
      await deleteBlogPost(editorState.id);
    },
    onSuccess: () => {
      toast({
        title: "Blog deleted",
        description: "The post has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: BLOG_LIST_QUERY_KEY });
      if (editorState.slug) {
        queryClient.invalidateQueries({ queryKey: ["blog-post", editorState.slug] });
      }
      setEditorState(createEmptyState());
      setSelectedSlug(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Unable to delete blog post.";
      toast({ title: "Delete failed", description: message, variant: "destructive" });
    },
  });

  const handleSectionChange = (index: number, updates: Partial<EditableSection>) => {
    setEditorState((current) => {
      const sections = [...current.sections];
      sections[index] = { ...sections[index], ...updates };
      return { ...current, sections };
    });
  };

  const handleAddSection = () => {
    setEditorState((current) => ({
      ...current,
      sections: [...current.sections, { heading: "", paragraphsText: "", tipsText: "" }],
    }));
  };

  const handleRemoveSection = (index: number) => {
    setEditorState((current) => ({
      ...current,
      sections: current.sections.filter((_, idx) => idx !== index),
    }));
  };

  const handleResourceChange = (index: number, updates: Partial<EditableResource>) => {
    setEditorState((current) => {
      const resources = [...current.resources];
      resources[index] = { ...resources[index], ...updates };
      return { ...current, resources };
    });
  };

  const handleAddResource = () => {
    setEditorState((current) => ({
      ...current,
      resources: [...current.resources, { label: "", url: "" }],
    }));
  };

  const handleRemoveResource = (index: number) => {
    setEditorState((current) => ({
      ...current,
      resources: current.resources.filter((_, idx) => idx !== index),
    }));
  };

  const handleReset = () => {
    setEditorState(createEmptyState());
    setSelectedSlug(null);
  };

  if (!isStaff) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Card className="max-w-lg border border-primary/20 bg-white/80 p-8 text-center shadow-xl backdrop-blur dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle>Restricted access</CardTitle>
            <CardDescription>Only staff members can manage blog posts. Please contact an administrator for permissions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/blogs")}>Return to blogs</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="border-b border-border/40 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/80">AIris Blog</span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-50">Manage posts</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleReset} disabled={upsertMutation.isPending || deleteMutation.isPending}>
              <Sparkles className="mr-2 h-4 w-4" />
              Start new
            </Button>
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={upsertMutation.isPending || deleteMutation.isPending}
            >
              {upsertMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save changes
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit border border-primary/20 bg-white/80 shadow-lg backdrop-blur dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-lg">Existing posts</CardTitle>
            <CardDescription>Tap a title to edit the content.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {postsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-10 animate-pulse rounded-lg bg-muted/50" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No posts found yet. Start by creating a new one.</p>
            ) : (
              <div className="space-y-2">
                {posts.map((post) => {
                  const isActive = editorState.slug === post.slug;
                  return (
                    <button
                      key={post.slug}
                      onClick={() => setSelectedSlug(post.slug)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                        isActive
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-transparent bg-white hover:border-primary/30 dark:bg-slate-900/70"
                      }`}
                    >
                      <p className="text-sm font-semibold">{post.title}</p>
                      <p className="text-xs text-muted-foreground">{post.slug}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/40 bg-white/80 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
          <CardHeader className="space-y-3">
            <CardTitle>Edit blog details</CardTitle>
            <CardDescription>
              Use descriptive titles, consistent slugs, and clear sections to keep articles easy to scan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={editorState.title}
                  onChange={(event) => setEditorState((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Protect Your Vision: Daily Habits"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="slug"
                    value={editorState.slug}
                    onChange={(event) => setEditorState((current) => ({ ...current, slug: sanitizeSlug(event.target.value) }))}
                    placeholder={createSlugSuggestion}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditorState((current) => ({ ...current, slug: createSlugSuggestion }))}
                  >
                    Auto
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="publishDate">Publish date</Label>
                <Input
                  id="publishDate"
                  type="date"
                  value={editorState.publishDate}
                  onChange={(event) => setEditorState((current) => ({ ...current, publishDate: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="readTime">Read time</Label>
                <Input
                  id="readTime"
                  value={editorState.readTime}
                  onChange={(event) => setEditorState((current) => ({ ...current, readTime: event.target.value }))}
                  placeholder="6 min read"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="heroGradient">Hero gradient classes</Label>
                <Input
                  id="heroGradient"
                  value={editorState.heroGradient}
                  onChange={(event) => setEditorState((current) => ({ ...current, heroGradient: event.target.value }))}
                  placeholder="from-sky-500 via-blue-500 to-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Short description</Label>
              <Textarea
                id="description"
                value={editorState.description}
                onChange={(event) => setEditorState((current) => ({ ...current, description: event.target.value }))}
                placeholder="Summarize the article in a concise paragraph."
                rows={3}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={editorState.tagsInput}
                  onChange={(event) => setEditorState((current) => ({ ...current, tagsInput: event.target.value }))}
                  placeholder="digital-health, self-care"
                />
                <p className="text-xs text-muted-foreground">Separate tags with commas. They power filters and related articles.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="relatedSlugs">Related slugs</Label>
                <Input
                  id="relatedSlugs"
                  value={editorState.relatedSlugsInput}
                  onChange={(event) => setEditorState((current) => ({ ...current, relatedSlugsInput: event.target.value }))}
                  placeholder="nutrition-for-clear-vision"
                />
                <p className="text-xs text-muted-foreground">Optional: comma-separated list to manually curate related articles.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keyTakeaways">Key takeaways</Label>
              <Textarea
                id="keyTakeaways"
                value={editorState.keyTakeawaysInput}
                onChange={(event) => setEditorState((current) => ({ ...current, keyTakeawaysInput: event.target.value }))}
                placeholder={`Hydration supports the tear film.\nMicro-breaks prevent strain.`}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">Enter each takeaway on a new line.</p>
            </div>

            <Separator />

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Sections</h3>
                <Button type="button" variant="outline" onClick={handleAddSection}>
                  <Plus className="mr-2 h-4 w-4" /> Add section
                </Button>
              </div>

              {editorState.sections.map((section, index) => (
                <Card key={`section-${index}`} className="border border-border/40 bg-card/60 shadow-sm dark:border-white/10">
                  <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                      <Label htmlFor={`section-title-${index}`}>Heading</Label>
                      <Input
                        id={`section-title-${index}`}
                        value={section.heading}
                        onChange={(event) => handleSectionChange(index, { heading: event.target.value })}
                        placeholder="Start Your Day with Eye-Friendly Rituals"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleRemoveSection(index)}
                      disabled={editorState.sections.length === 1}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Remove
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`section-paragraphs-${index}`}>Paragraphs</Label>
                      <Textarea
                        id={`section-paragraphs-${index}`}
                        value={section.paragraphsText}
                        onChange={(event) => handleSectionChange(index, { paragraphsText: event.target.value })}
                        placeholder={`Write supporting paragraphs. Separate each paragraph with a blank line.`}
                        rows={5}
                      />
                      <p className="text-xs text-muted-foreground">Separate paragraphs with blank lines.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`section-tips-${index}`}>Tips (optional)</Label>
                      <Textarea
                        id={`section-tips-${index}`}
                        value={section.tipsText}
                        onChange={(event) => handleSectionChange(index, { tipsText: event.target.value })}
                        placeholder={`Add actionable tips. One per line.`}
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Separator />

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Resources</h3>
                <Button type="button" variant="outline" onClick={handleAddResource}>
                  <Plus className="mr-2 h-4 w-4" /> Add resource
                </Button>
              </div>

              {editorState.resources.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add optional external references that support the article.</p>
              ) : (
                <div className="grid gap-4">
                  {editorState.resources.map((resource, index) => (
                    <div
                      key={`resource-${index}`}
                      className="grid gap-4 rounded-xl border border-border/40 p-4 dark:border-white/10 md:grid-cols-[1fr_auto] md:items-start"
                    >
                      <div className="space-y-2">
                        <Label htmlFor={`resource-label-${index}`}>Label</Label>
                        <Input
                          id={`resource-label-${index}`}
                          value={resource.label}
                          onChange={(event) => handleResourceChange(index, { label: event.target.value })}
                          placeholder="American Academy of Ophthalmology"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`resource-url-${index}`}>URL</Label>
                        <Input
                          id={`resource-url-${index}`}
                          value={resource.url}
                          onChange={(event) => handleResourceChange(index, { url: event.target.value })}
                          placeholder="https://example.com/article"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveResource(index)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Remove resource
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {editorState.tagsInput
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean)
                  .map((tag) => (
                    <Badge key={tag} variant="secondary" className="bg-primary/10 text-primary">
                      {tag.replace(/-/g, " ")}
                    </Badge>
                  ))}
              </div>
              {editorState.id && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending || upsertMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete post
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
