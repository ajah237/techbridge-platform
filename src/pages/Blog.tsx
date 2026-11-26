import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, ArrowRight, Clock, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { withBreadcrumbs } from "@/lib/breadcrumb";
import type { Tables } from "@/integrations/supabase/types";

type BlogPostType = Tables<"blog_posts">;

const Blog = () => {
  const [posts, setPosts] = useState<BlogPostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");

  useEffect(() => {
    const fetchPosts = async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      setPosts(data ?? []);
      setLoading(false);
    };
    fetchPosts();
  }, []);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    posts.forEach((p) =>
      p.tags?.forEach((t) => {
        if (t && t.trim()) s.add(t);
      }),
    );
    return Array.from(s).sort();
  }, [posts]);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.excerpt?.toLowerCase().includes(q) ||
        p.content?.toLowerCase().includes(q);
      const matchesTag = tagFilter === "all" || p.tags?.includes(tagFilter);
      return matchesSearch && matchesTag;
    });
  }, [posts, search, tagFilter]);

  const hasActiveFilters = search || tagFilter !== "all";

  const readTime = (text: string | null) => {
    if (!text) return "1 min";
    const words = text.replace(/<[^>]*>/g, " ").trim().split(/\s+/).length;
    return `${Math.max(1, Math.ceil(words / 200))} min`;
  };

  const jsonLd = withBreadcrumbs(
    {
      "@type": "Blog",
      name: "TechBridge Blog",
      description: "Tech articles, program updates, and stories from the TechBridge community.",
      url: "https://techbridgehub.lovable.app/blog",
    },
    [{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }],
  );

  return (
    <main className="pt-20">
      <SEO title="Blog" description="Tech articles, program updates, and stories from the TechBridge community." jsonLd={jsonLd} />

      <section className="py-14 sm:py-20 bg-gradient-hero dark">
        <div className="container mx-auto px-4 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-primary/20 text-primary mb-4">Blog</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground">Insights &amp; Updates</h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Tech articles, program updates, and stories from the TechBridge community.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-20">
        <div className="container mx-auto px-4">
          {/* Search & Filters */}
          <div className="mb-8 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input
                placeholder="Search articles..."
                aria-label="Search articles"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {allTags.length > 0 && (
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter articles by tag">
                  <SelectValue placeholder="Tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {allTags.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Clear filters"
                onClick={() => {
                  setSearch("");
                  setTagFilter("all");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-border/50">
                  <CardContent className="p-6">
                    <Skeleton className="h-40 w-full mb-4" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {hasActiveFilters ? "No articles match your search." : "No blog posts yet. Check back soon!"}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((p) => (
                <Link
                  key={p.id}
                  to={`/blog/${p.slug}`}
                  className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Card className="h-full shadow-card hover:shadow-elevated transition-all duration-300 group-hover:-translate-y-1 border-border/50 bg-card overflow-hidden">
                    {p.cover_image_url && (
                      <img src={p.cover_image_url} alt={p.title} className="w-full h-48 object-cover" loading="lazy" />
                    )}
                    <CardContent className="p-6">
                      {p.tags && p.tags.length > 0 && (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-3">
                          {p.tags[0]}
                        </span>
                      )}
                      <h2 className="text-lg font-heading font-semibold text-card-foreground group-hover:text-primary transition-colors leading-snug">
                        {p.title}
                      </h2>
                      {p.excerpt && (
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-3">{p.excerpt}</p>
                      )}
                      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                        {p.published_at && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(p.published_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {readTime(p.content)}
                        </span>
                      </div>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                        Read More <ArrowRight size={14} />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default Blog;
