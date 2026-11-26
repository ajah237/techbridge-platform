import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { logAdminAction } from "@/lib/auditLog";
import { Plus, Pencil, Trash2, Send } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/RichTextEditor";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Tables } from "@/integrations/supabase/types";

type BlogPost = Tables<"blog_posts">;

const blogStatuses = ["draft", "scheduled", "published", "archived"] as const;

const emptyForm: {
  title: string; slug: string; content: string; excerpt: string;
  status: typeof blogStatuses[number]; tags: string; cover_image_url: string; scheduled_for: string;
} = {
  title: "",
  slug: "",
  content: "",
  excerpt: "",
  status: "draft",
  tags: "",
  cover_image_url: "",
  scheduled_for: "",
};

const AdminBlog = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setPosts(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleSave = async () => {
    const slug = form.slug || generateSlug(form.title);
    const isScheduled = (form.status as string) === "scheduled";
    if (isScheduled && !form.scheduled_for) {
      return toast.error("Pick a scheduled date/time");
    }
    if (isScheduled && new Date(form.scheduled_for) <= new Date()) {
      return toast.error("Scheduled time must be in the future");
    }
    const existingPost = editingId ? posts.find((p) => p.id === editingId) : null;
    const payload = {
      title: form.title,
      slug,
      content: form.content || null,
      excerpt: form.excerpt || null,
      status: form.status,
      cover_image_url: form.cover_image_url || null,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : [],
      published_at:
        (form.status as string) === "published"
          ? existingPost?.published_at ?? new Date().toISOString()
          : null,
      scheduled_for: isScheduled ? new Date(form.scheduled_for).toISOString() : null,
    };

    if (editingId) {
      const { error } = await supabase.from("blog_posts").update(payload).eq("id", editingId);
      if (error) return toast.error(error.message);
      await logAdminAction("blog.updated", "blog", editingId, payload.title, { status: payload.status });
      toast.success("Post updated!");
    } else {
      const { data: created, error } = await supabase.from("blog_posts").insert(payload).select("id").maybeSingle();
      if (error) return toast.error(error.message);
      await logAdminAction("blog.created", "blog", created?.id ?? null, payload.title, { status: payload.status });
      toast.success("Post created!");
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    fetchPosts();
  };

  const handleEdit = (post: BlogPost) => {
    setEditingId(post.id);
    setForm({
      title: post.title,
      slug: post.slug,
      content: post.content ?? "",
      excerpt: post.excerpt ?? "",
      status: post.status as typeof emptyForm.status,
      tags: post.tags?.join(", ") ?? "",
      cover_image_url: post.cover_image_url ?? "",
      scheduled_for: (post as any).scheduled_for
        ? new Date((post as any).scheduled_for).toISOString().slice(0, 16)
        : "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    const target = posts.find((p) => p.id === id);
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      await logAdminAction("blog.deleted", "blog", id, target?.title ?? null);
      toast.success("Post deleted");
      fetchPosts();
    }
  };

  const handlePublishNow = async (id: string) => {
    const target = posts.find((p) => p.id === id);
    if (!confirm(`Publish "${target?.title}" now?`)) return;
    const { error } = await supabase
      .from("blog_posts")
      .update({ status: "published", published_at: new Date().toISOString(), scheduled_for: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    await logAdminAction("blog.published_now", "blog", id, target?.title ?? null, { from: "scheduled" });
    toast.success("Post published");
    fetchPosts();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">Blog Posts</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-primary-foreground gap-2">
              <Plus size={16} /> New Post
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Post" : "Create Post"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="My Blog Post" />
              </div>
              <div className="grid gap-2">
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated" />
              </div>
              <div className="grid gap-2">
                <Label>Excerpt</Label>
                <Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} placeholder="Brief summary..." />
              </div>
              <div className="grid gap-2">
                <Label>Content</Label>
                <RichTextEditor
                  content={form.content}
                  onChange={(html) => setForm({ ...form, content: html })}
                  placeholder="Write your blog post..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {blogStatuses.map((s) => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Cover Image</Label>
                  <ImageUpload
                    bucket="blog-images"
                    folder="covers"
                    value={form.cover_image_url || undefined}
                    onUpload={(url) => setForm({ ...form, cover_image_url: url })}
                    onRemove={() => setForm({ ...form, cover_image_url: "" })}
                  />
                </div>
              </div>
              {form.status === "scheduled" && (
                <div className="grid gap-2">
                  <Label>Publish at *</Label>
                  <Input
                    type="datetime-local"
                    value={form.scheduled_for}
                    onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Auto-publishes within ~1 minute of this time.</p>
                </div>
              )}
              <div className="grid gap-2">
                <Label>Tags (comma separated)</Label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Tech, Innovation" />
              </div>
              <Button onClick={handleSave} className="bg-gradient-primary text-primary-foreground">
                {editingId ? "Update Post" : "Create Post"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No blog posts yet. Create your first post to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{post.title}</h3>
                    <Badge variant={post.status === "published" ? "default" : "secondary"}>{post.status}</Badge>
                    {post.status === "scheduled" && (post as any).scheduled_for && (
                      <span className="text-xs text-muted-foreground">
                        → {new Date((post as any).scheduled_for).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {post.excerpt || "No excerpt"}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 self-end sm:self-auto">
                  {post.status === "scheduled" && (
                    <Button size="sm" variant="outline" onClick={() => handlePublishNow(post.id)} className="gap-1">
                      <Send size={14} /> <span className="hidden sm:inline">Publish now</span>
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(post)}
                    aria-label={`Edit ${post.title}`}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => handleDelete(post.id)}
                    aria-label={`Delete ${post.title}`}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminBlog;
