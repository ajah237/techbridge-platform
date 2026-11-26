import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isUuid } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Post = Pick<Tables<"blog_posts">, "id" | "slug" | "title" | "excerpt" | "cover_image_url" | "published_at" | "tags">;

interface RelatedPostsProps {
  currentId: string;
  tags?: string[] | null;
  limit?: number;
}

const RelatedPosts = ({ currentId, tags, limit = 3 }: RelatedPostsProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let result: Post[] = [];
      // Prefer posts sharing at least one tag.
      if (tags && tags.length > 0) {
        const { data } = await supabase
          .from("blog_posts")
          .select("id, slug, title, excerpt, cover_image_url, published_at, tags")
          .eq("status", "published")
          .neq("id", currentId)
          .overlaps("tags", tags)
          .order("published_at", { ascending: false })
          .limit(limit);
        result = data || [];
      }
      // Fallback / fill with recent posts.
      if (result.length < limit) {
        const exclude = [currentId, ...result.map((p) => p.id)].filter(isUuid);
        let q = supabase
          .from("blog_posts")
          .select("id, slug, title, excerpt, cover_image_url, published_at, tags")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(limit - result.length);
        if (exclude.length > 0) {
          q = q.not("id", "in", `(${exclude.join(",")})`);
        }
        const { data } = await q;
        result = [...result, ...(data || [])];
      }
      setPosts(result);
      setLoading(false);
    };
    load();
  }, [currentId, tags?.join(","), limit]);

  if (loading || posts.length === 0) return null;

  return (
    <section className="mt-16 pt-10 border-t border-border" aria-labelledby="related-posts-heading">
      <h2 id="related-posts-heading" className="text-2xl font-heading font-bold text-foreground mb-6">
        Related reads
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <Link
            key={p.id}
            to={`/blog/${p.slug}`}
            className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 hover:shadow-md transition-all"
          >
            {p.cover_image_url && (
              <img
                src={p.cover_image_url}
                alt={p.title}
                loading="lazy"
                className="w-full h-36 object-cover group-hover:scale-105 transition-transform"
              />
            )}
            <div className="p-4">
              <h3 className="font-heading font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                {p.title}
              </h3>
              {p.excerpt && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{p.excerpt}</p>
              )}
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                {p.published_at && (
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(p.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
                <span className="flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Read <ArrowRight size={12} />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default RelatedPosts;