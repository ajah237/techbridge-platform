import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { logAdminAction } from "@/lib/auditLog";
import { Check, X, AlertOctagon, Trash2, ExternalLink } from "lucide-react";

type CommentStatus = "pending" | "approved" | "spam" | "rejected";
type Comment = {
  id: string; post_id: string; author_name: string; author_email: string;
  content: string; status: CommentStatus; created_at: string;
};
type Post = { id: string; title: string; slug: string };

const AdminComments = () => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [posts, setPosts] = useState<Record<string, Post>>({});
  const [tab, setTab] = useState<CommentStatus>("pending");

  const load = async () => {
    const [cRes, pRes] = await Promise.all([
      supabase.from("blog_comments").select("id,post_id,author_name,author_email,content,status,created_at").order("created_at", { ascending: false }),
      supabase.from("blog_posts").select("id,title,slug"),
    ]);
    setComments((cRes.data ?? []) as Comment[]);
    const map: Record<string, Post> = {};
    (pRes.data ?? []).forEach((p) => { map[p.id] = p as Post; });
    setPosts(map);
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: CommentStatus) => {
    const target = comments.find((c) => c.id === id);
    const { error } = await supabase.from("blog_comments").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    await logAdminAction(`comment.${status}`, "comment", id, target?.author_name ?? null, { post_id: target?.post_id, status });
    toast.success(`Marked ${status}`);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this comment permanently?")) return;
    const target = comments.find((c) => c.id === id);
    const { error } = await supabase.from("blog_comments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAdminAction("comment.deleted", "comment", id, target?.author_name ?? null, { post_id: target?.post_id });
    toast.success("Deleted");
    load();
  };

  const counts = {
    pending: comments.filter((c) => c.status === "pending").length,
    approved: comments.filter((c) => c.status === "approved").length,
    spam: comments.filter((c) => c.status === "spam").length,
    rejected: comments.filter((c) => c.status === "rejected").length,
  };

  const filtered = comments.filter((c) => c.status === tab);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Comment Moderation</h1>
        <p className="text-sm text-muted-foreground">Approve, reject, or mark comments as spam.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as CommentStatus)}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
          <TabsTrigger value="spam">Spam ({counts.spam})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-6 space-y-3">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No {tab} comments.</p>
          ) : (
            filtered.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4 sm:p-5 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{c.author_name} <span className="text-muted-foreground font-normal">&lt;{c.author_email}&gt;</span></p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleString()} on{" "}
                        {posts[c.post_id] ? (
                          <a href={`/blog/${posts[c.post_id].slug}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                            {posts[c.post_id].title} <ExternalLink size={10} />
                          </a>
                        ) : "(post)"}
                      </p>
                    </div>
                    <Badge variant={c.status === "approved" ? "default" : c.status === "spam" ? "destructive" : "secondary"}>{c.status}</Badge>
                  </div>
                  <p className="text-sm whitespace-pre-line break-words">{c.content}</p>
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    {c.status !== "approved" && (
                      <Button size="sm" onClick={() => setStatus(c.id, "approved")} className="gap-1"><Check size={14} /> Approve</Button>
                    )}
                    {c.status !== "rejected" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "rejected")} className="gap-1"><X size={14} /> Reject</Button>
                    )}
                    {c.status !== "spam" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "spam")} className="gap-1"><AlertOctagon size={14} /> Spam</Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => remove(c.id)} className="gap-1 ml-auto"><Trash2 size={14} /> Delete</Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminComments;