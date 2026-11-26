import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/EmptyState";
import SectionHeading from "@/components/SectionHeading";
import {
  Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious,
} from "@/components/ui/carousel";
import { ArrowRight, CalendarDays, Clock, Newspaper, Search, X } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

type PostRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  tags: string[] | null;
  content: string | null;
};

const LatestBlogCarousel = () => {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    supabase
      .from("blog_posts")
      .select("id,title,slug,excerpt,cover_image_url,published_at,tags,content")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(9)
      .then(({ data }) => {
        setPosts((data ?? []) as PostRow[]);
        setLoading(false);
      });
  }, []);

  const readTime = (c: string | null) =>
    Math.max(1, Math.round((c?.replace(/<[^>]*>/g, " ").trim().split(/\s+/).length ?? 0) / 220));

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((p) => p.tags?.forEach((t) => t?.trim() && counts.set(t, (counts.get(t) ?? 0) + 1)));
    return Array.from(counts.keys()).sort();
  }, [posts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      const matchesTag = !tag || p.tags?.includes(tag);
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        (p.excerpt ?? "").toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q));
      return matchesTag && matchesSearch;
    });
  }, [posts, search, tag]);

  const hasFilters = !!search.trim() || !!tag;

  if (!loading && posts.length === 0) return null;

  return (
    <section className="py-16 sm:py-20" aria-labelledby="latest-blog-heading">
      <div className="container mx-auto px-4">
        <SectionHeading
          headingId="latest-blog-heading"
          badge="From the blog"
          title="Latest Stories & Insights"
          description="Tutorials, community spotlights and programme updates from the TechBridge team."
        />

        {/* Search & category filters */}
        {!loading && (
          <div className="mb-6 flex flex-col gap-3 sm:mb-8">
            <div className="relative sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search articles…"
                aria-label="Search latest articles"
                className="pl-9"
              />
            </div>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter articles by category">
                <button type="button" onClick={() => setTag(null)} aria-pressed={!tag}>
                  <Badge variant={tag ? "outline" : "default"} className="cursor-pointer px-3 py-1">All</Badge>
                </button>
                {categories.map((c) => (
                  <button key={c} type="button" onClick={() => setTag(tag === c ? null : c)} aria-pressed={tag === c}>
                    <Badge variant={tag === c ? "default" : "outline"} className="cursor-pointer px-3 py-1">{c}</Badge>
                  </button>
                ))}
                {hasFilters && (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => { setSearch(""); setTag(null); }}>
                    <X size={12} /> Clear
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-44 w-full rounded-xl" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Newspaper}
            title="No matching articles"
            description="Try a different search term or clear the category filter to see all the latest stories."
            action={
              <Button variant="outline" onClick={() => { setSearch(""); setTag(null); }}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <Carousel opts={{ align: "start", loop: filtered.length > 3, duration: reduced ? 0 : 25 }} className="w-full">
            <CarouselContent className="-ml-4">
              {filtered.map((p) => (
                <CarouselItem key={p.id} className="pl-4 basis-full sm:basis-1/2 lg:basis-1/3">
                  <Link
                    to={`/blog/${p.slug}`}
                    className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={`Read ${p.title}`}
                  >
                    <Card
                      className={cn(
                        "h-full overflow-hidden border-border/50 bg-card shadow-card hover:shadow-elevated",
                        !reduced && "transition-all duration-300 hover:-translate-y-1",
                      )}
                    >
                      <div className="relative h-44 overflow-hidden bg-muted">
                        {p.cover_image_url ? (
                          <img
                            src={p.cover_image_url}
                            alt={p.title}
                            loading="lazy"
                            decoding="async"
                            className={cn(
                              "h-full w-full object-cover",
                              !reduced && "transition-transform duration-500 group-hover:scale-105",
                            )}
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-primary opacity-80" aria-hidden />
                        )}
                        {p.tags?.[0] && (
                          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-primary backdrop-blur">
                            {p.tags[0]}
                          </span>
                        )}
                      </div>
                      <CardContent className="p-5 flex flex-col">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {p.published_at && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays size={12} /> {fmt(p.published_at)}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} /> {readTime(p.content)} min read
                          </span>
                        </div>
                        <h3 className="mt-2 font-heading text-lg font-semibold text-card-foreground line-clamp-2 group-hover:text-primary">
                          {p.title}
                        </h3>
                        {p.excerpt && (
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                            {p.excerpt}
                          </p>
                        )}
                        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                          Read article
                          <ArrowRight size={14} className={cn(!reduced && "transition-transform group-hover:translate-x-1")} />
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:flex -left-4" />
            <CarouselNext className="hidden sm:flex -right-4" />
          </Carousel>
        )}

        <div className="mt-8 flex flex-col items-center gap-2 sm:mt-10">
          <Button asChild variant="outline" className="w-full gap-2 sm:w-auto">
            <Link to="/blog">
              Browse all articles <ArrowRight size={16} />
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground sm:hidden">Swipe to see more stories</p>
        </div>
      </div>
    </section>
  );
};

export default LatestBlogCarousel;
