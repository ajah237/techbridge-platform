import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { MessageSquare, Trash2, Pencil, X, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

type Comment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: { full_name: string | null; avatar_url: string | null };
};

interface Props {
  projectId: string;
  projectOwnerId: string;
}

const ProjectComments = ({ projectId, projectOwnerId }: Props) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("project_comments" as any)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    const list = ((data as any) ?? []) as Comment[];
    const ids = Array.from(new Set(list.map((c) => c.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.rpc("get_public_profiles", { _user_ids: ids });
      const map = new Map((profs ?? []).map((p) => [p.user_id, p]));
      list.forEach((c) => (c.author = map.get(c.user_id) as any));
    }
    setComments(list);
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const submit = async () => {
    if (!user || !text.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("project_comments" as any).insert({
      project_id: projectId,
      user_id: user.id,
      content: text.trim(),
    });
    setPosting(false);
    if (error) return toast.error(error.message);
    setText("");
    toast.success("Comment posted");
    load();
  };

  const saveEdit = async (id: string) => {
    if (!editText.trim()) return;
    const { error } = await supabase
      .from("project_comments" as any)
      .update({ content: editText.trim() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setEditingId(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this comment?")) return;
    const { error } = await supabase.from("project_comments" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const canDelete = (c: Comment) =>
    user && (user.id === c.user_id || user.id === projectOwnerId);

  return (
    <section className="mt-12 pt-8 border-t border-border">
      <h2 className="text-xl font-heading font-bold flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5 text-primary" />
        Comments ({comments.length})
      </h2>

      {user ? (
        <div className="mb-6 space-y-2">
          <Textarea
            placeholder="Share your thoughts on this project..."
            aria-label="Share your thoughts on this project"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={3}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{text.length}/2000</span>
            <Button onClick={submit} disabled={posting || !text.trim()} size="sm" className="bg-gradient-primary text-primary-foreground">
              Post comment
            </Button>
          </div>
        </div>
      ) : (
        <Card className="p-4 mb-6 text-center text-sm text-muted-foreground">
          <Link to="/auth" className="text-primary hover:underline font-medium">Sign in</Link> to leave a comment.
        </Card>
      )}

      {comments.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No comments yet — be the first to start the discussion!</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex gap-3">
                {c.author?.avatar_url ? (
                  <img src={c.author.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-sm font-semibold shrink-0">
                    {(c.author?.full_name || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{c.author?.full_name || "User"}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                      {c.updated_at !== c.created_at && (
                        <span className="text-xs text-muted-foreground italic">(edited)</span>
                      )}
                    </div>
                    {user?.id === c.user_id && editingId !== c.id && (
                      <button type="button" aria-label="Edit comment" onClick={() => { setEditingId(c.id); setEditText(c.content); }} className="text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete(c) && editingId !== c.id && (
                      <button type="button" aria-label="Delete comment" onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {editingId === c.id ? (
                    <div className="space-y-2">
                      <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(c.id)}><Check className="h-3 w-3 mr-1" />Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3 w-3 mr-1" />Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};

export default ProjectComments;