import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { BlogPost, BlogResource, BlogSection, SEED_BLOG_POSTS } from "@/utils/blogPosts";

export type BlogPostPayload = Omit<BlogPost, "publishDate" | "tags" | "sections" | "keyTakeaways" | "resources" | "relatedSlugs" | "authorId"> & {
  publishDate: string;
  tags: string[];
  sections: BlogSection[];
  keyTakeaways: string[];
  resources?: BlogResource[];
  relatedSlugs?: string[];
  authorId?: string | null;
};

type BlogPostRow = Database["public"]["Tables"]["blog_posts"]["Row"];

type BlogPostInsert = Database["public"]["Tables"]["blog_posts"]["Insert"];

const mapRowToBlogPost = (row: BlogPostRow): BlogPost => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  description: row.description,
  heroGradient: row.hero_gradient,
  readTime: row.read_time,
  publishDate: row.publish_date,
  sections: (row.sections as BlogSection[]) ?? [],
  keyTakeaways: row.key_takeaways ?? [],
  resources: (row.resources as BlogResource[] | null) ?? undefined,
  tags: row.tags ?? [],
  relatedSlugs: row.related_slugs ?? [],
  authorId: row.author_id,
});

const withSeedFallback = (posts: BlogPost[] | null | undefined, fallbackEnabled: boolean) => {
  if (posts && posts.length > 0) {
    return posts;
  }
  return fallbackEnabled ? SEED_BLOG_POSTS : [];
};

export const getBlogPosts = async (options: { fallbackToSeed?: boolean } = {}): Promise<BlogPost[]> => {
  try {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .order("publish_date", { ascending: false });

    if (error) {
      console.error("Failed to load blog posts", error);
      return withSeedFallback(undefined, Boolean(options.fallbackToSeed));
    }

    const posts = (data ?? []).map(mapRowToBlogPost);
    return withSeedFallback(posts, Boolean(options.fallbackToSeed));
  } catch (error) {
    console.error("Unexpected blog post fetch error", error);
    return withSeedFallback(undefined, Boolean(options.fallbackToSeed));
  }
};

export const getBlogPostBySlug = async (slug: string, options: { fallbackToSeed?: boolean } = {}): Promise<BlogPost | undefined> => {
  if (!slug) {
    return undefined;
  }

  try {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error(`Failed to load blog post ${slug}`, error);
      if (options.fallbackToSeed) {
        return SEED_BLOG_POSTS.find((post) => post.slug === slug);
      }
      return undefined;
    }

    if (!data) {
      return options.fallbackToSeed ? SEED_BLOG_POSTS.find((post) => post.slug === slug) : undefined;
    }

    return mapRowToBlogPost(data);
  } catch (error) {
    console.error(`Unexpected error while fetching blog post ${slug}`, error);
    return options.fallbackToSeed ? SEED_BLOG_POSTS.find((post) => post.slug === slug) : undefined;
  }
};

export const upsertBlogPost = async (payload: BlogPostPayload) => {
  const { authorId, relatedSlugs, ...rest } = payload;

  const record: BlogPostInsert = {
    id: payload.id,
    slug: rest.slug,
    title: rest.title,
    description: rest.description,
    hero_gradient: rest.heroGradient,
    read_time: rest.readTime,
    publish_date: rest.publishDate,
    sections: rest.sections,
    key_takeaways: rest.keyTakeaways,
    resources: rest.resources ?? null,
    tags: rest.tags,
    related_slugs: relatedSlugs ?? [],
    author_id: authorId ?? null,
  };

  const { data, error } = await supabase
    .from("blog_posts")
    .upsert(record, { onConflict: "slug" })
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapRowToBlogPost(data) : undefined;
};

export const deleteBlogPost = async (id: string) => {
  if (!id) {
    throw new Error("Missing blog post id");
  }

  const { error } = await supabase
    .from("blog_posts")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
};
