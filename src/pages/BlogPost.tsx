import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, ArrowLeft, Clock, Tag, User } from "lucide-react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import SocialShare from "@/components/SocialShare";
import CommentSection from "@/components/CommentSection";
import RelatedPosts from "@/components/RelatedPosts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import SEO from "@/components/SEO";
import type { Tables } from "@/integrations/supabase/types";

type BlogPostType = Tables<"blog_posts">;

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) return;
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      setPost(data);

      if (data?.id) {
        supabase.rpc("increment_blog_view", { _post_id: data.id }).then(() => {});
      }

      if (data?.author_id) {
        const { data: profiles } = await supabase.rpc("get_public_profiles", {
          _user_ids: [data.author_id],
        });
        setAuthorName(profiles?.[0]?.full_name || null);
      }
      setLoading(false);
    };
    fetchPost();
  }, [slug]);

  const readTime = (text: string | null) => {
    if (!text) return "1 min";
    const words = text.trim().split(/\s+/).length;
    return `${Math.max(1, Math.ceil(words / 200))} min read`;
  };

  if (loading) {
    return (
      <main className="pt-20">
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-12 w-full mb-6" />
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-96 w-full" />
        </div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="pt-20">
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-heading font-bold text-foreground mb-4">Post Not Found</h1>
          <p className="text-muted-foreground mb-6">This blog post doesn't exist or hasn't been published yet.</p>
          <Button onClick={() => navigate("/blog")} variant="outline">
            <ArrowLeft size={16} /> Back to Blog
          </Button>
        </div>
      </main>
    );
  }

  const siteUrl = "https://techbridgehub.lovable.app";
  const articleNode = {
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || "",
    image: post.cover_image_url || undefined,
    datePublished: post.published_at || post.created_at,
    dateModified: post.updated_at || post.published_at || post.created_at,
    author: authorName ? { "@type": "Person", name: authorName } : { "@type": "Organization", name: "TechBridge" },
    publisher: {
      "@type": "Organization",
      name: "TechBridge",
      logo: { "@type": "ImageObject", url: `${siteUrl}/pwa-icon-512.png` },
    },
    mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
  };
  const breadcrumbNode = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${siteUrl}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: `${siteUrl}/blog/${post.slug}` },
    ],
  };
  const articleJsonLd = { "@context": "https://schema.org", "@graph": [articleNode, breadcrumbNode] };
  const ogImage = post.cover_image_url ||
    `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/og-post?slug=${encodeURIComponent(post.slug)}`;

  return (
    <main className="pt-20">
      <SEO
        title={post.title}
        description={post.excerpt || `Read ${post.title} on TechBridge`}
        image={ogImage}
        imageAlt={post.title}
        type="article"
        jsonLd={articleJsonLd}
        publishedTime={post.published_at || post.created_at}
        modifiedTime={post.updated_at || post.published_at || post.created_at}
        author={authorName || "TechBridge"}
        tags={post.tags}
      />
      {/* Hero */}
      <section className="py-16 bg-gradient-hero dark">
        <div className="container mx-auto px-4 max-w-3xl">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground mb-6 -ml-2"
            onClick={() => navigate("/blog")}
          >
            <ArrowLeft size={16} /> All Posts
          </Button>

          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 text-primary">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <h1 className="text-3xl md:text-5xl font-heading font-bold text-foreground leading-tight">
            {post.title}
          </h1>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {authorName && (
              <span className="flex items-center gap-1.5">
                <User size={14} /> {authorName}
              </span>
            )}
            {post.published_at && (
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                {new Date(post.published_at).toLocaleDateString("en-US", {
                  month: "long", day: "numeric", year: "numeric",
                })}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock size={14} /> {readTime(post.content)}
            </span>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          {post.cover_image_url && (
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="w-full rounded-xl object-cover max-h-[28rem] mb-10"
              loading="lazy"
            />
          )}

          {post.excerpt && (
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 italic border-l-4 border-primary/30 pl-4">
              {post.excerpt}
            </p>
          )}

          <article
            className="prose prose-sm sm:prose lg:prose-lg max-w-none text-foreground prose-headings:font-heading prose-headings:text-foreground prose-p:text-muted-foreground prose-p:leading-relaxed prose-a:text-primary prose-strong:text-foreground prose-blockquote:border-primary/30 prose-code:text-primary prose-img:rounded-xl"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content || "<p>No content available.</p>") }}
          />

          {post.tags && post.tags.length > 0 && (
            <div className="mt-12 pt-8 border-t border-border">
              <div className="flex flex-wrap items-center gap-2">
                <Tag size={16} className="text-muted-foreground" />
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <Button onClick={() => navigate("/blog")} variant="outline" className="gap-2">
              <ArrowLeft size={16} /> Back to Blog
            </Button>
            <SocialShare title={post.title} description={post.excerpt || undefined} />
          </div>

          <CommentSection postId={post.id} />

          <RelatedPosts currentId={post.id} tags={post.tags} />
        </div>
      </section>
    </main>
  );
};

export default BlogPost;
