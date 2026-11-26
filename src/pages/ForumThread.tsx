import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowUp, Pin, Lock, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import SEO from "@/components/SEO";
import ReportDialog from "@/components/ReportDialog";

type Thread = {
  id: string;
  category_id: string;
  user_id: string;
  title: string;
  content: string;
  pinned: boolean;
  locked: boolean;
  view_count: number;
  reply_count: number;
  created_at: string;
  author?: { full_name: string | null; avatar_url: string | null };
  category?: { name: string; slug: string };
};
type Reply = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: { full_name: string | null; avatar_url: string | null };
};

const ForumThread = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdminRole();
  const [thread, setThread] = useState<Thread | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [voteCount, setVoteCount] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    const { data: t } = await supabase.from("forum_threads").select("*").eq("id", id).maybeSingle();
    if (!t) {
      setThread(null);
      setLoading(false);
      return;
    }
    const tt = t as unknown as Thread;
    const [authRes, catRes, replyRes, voteRes, countRes] = await Promise.all([
      supabase.rpc("get_public_profiles", { _user_ids: [tt.user_id] }),
      supabase.from("forum_categories").select("name,slug").eq("id", tt.category_id).maybeSingle(),
      supabase.from("forum_replies").select("*").eq("thread_id", id).order("created_at"),
      user ? supabase.from("forum_votes").select("user_id").eq("thread_id", id).eq("user_id", user.id) : Promise.resolve({ data: [] }),
      supabase.rpc("get_thread_vote_count", { _thread_id: id }),
    ]);
    tt.author = (authRes.data?.[0] ?? null) as any;
    tt.category = catRes.data as any;
    setThread(tt);

    const list = (replyRes.data ?? []) as unknown as Reply[];
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.rpc("get_public_profiles", { _user_ids: ids });
      const map = new Map((profs ?? []).map((p) => [p.user_id, p]));
      list.forEach((r) => (r.author = map.get(r.user_id) as any));
    }
    setReplies(list);

    const votes = (voteRes.data ?? []) as { user_id: string }[];
    setVoteCount(Number(countRes.data ?? 0));
    setHasVoted(!!user && votes.some((v) => v.user_id === user.id));
    setLoading(false);
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  useEffect(() => {
    if (!id) return;
    supabase.rpc("increment_thread_view", { _thread_id: id });
  }, [id]);

  const toggleVote = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!thread) return;
    if (hasVoted) {
      await supabase.from("forum_votes" as any).delete().eq("thread_id", thread.id).eq("user_id", user.id);
      setHasVoted(false); setVoteCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from("forum_votes" as any).insert({ thread_id: thread.id, user_id: user.id });
      setHasVoted(true); setVoteCount((c) => c + 1);
    }
  };

  const reply = async () => {
    if (!user || !thread || !text.trim()) return;
    if (thread.locked) return toast.error("Thread is locked");
    setPosting(true);
    const { error } = await supabase.from("forum_replies" as any).insert({
      thread_id: thread.id,
      user_id: user.id,
      content: text.trim(),
    });
    setPosting(false);
    if (error) return toast.error(error.message);
    setText("");
    toast.success("Reply posted! +2 points");
    load();
  };

  const togglePin = async () => {
    if (!thread || !isAdmin) return;
    await supabase.from("forum_threads" as any).update({ pinned: !thread.pinned }).eq("id", thread.id);
    toast.success(thread.pinned ? "Unpinned" : "Pinned");
    load();
  };
  const toggleLock = async () => {
    if (!thread || !isAdmin) return;
    await supabase.from("forum_threads" as any).update({ locked: !thread.locked }).eq("id", thread.id);
    toast.success(thread.locked ? "Unlocked" : "Locked");
    load();
  };
  const deleteThread = async () => {
    if (!thread) return;
    if (!confirm("Delete this thread and all replies?")) return;
    const { error } = await supabase.from("forum_threads" as any).delete().eq("id", thread.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    navigate("/forum");
  };

  const saveReplyEdit = async (rid: string) => {
    if (!editText.trim()) return;
    const { error } = await supabase.from("forum_replies" as any).update({ content: editText.trim() }).eq("id", rid);
    if (error) return toast.error(error.message);
    setEditingReplyId(null);
    load();
  };
  const deleteReply = async (rid: string) => {
    if (!confirm("Delete this reply?")) return;
    const { error } = await supabase.from("forum_replies" as any).delete().eq("id", rid);
    if (error) return toast.error(error.message);
    load();
  };

  if (loading) return <main className="pt-24 pb-12 container mx-auto px-4 text-center text-muted-foreground">Loading…</main>;
  if (!thread) {
    return (
      <main className="pt-24 pb-12 container mx-auto px-4 text-center space-y-3">
        <h1 className="text-2xl font-heading font-bold">Thread not found</h1>
        <p className="text-sm text-muted-foreground">This discussion may have been removed.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/forum"><ArrowLeft className="h-4 w-4 mr-1" /> Back to forum</Link>
        </Button>
      </main>
    );
  }

  const canModifyThread = user && (user.id === thread.user_id || isAdmin);

  return (
    <main className="pt-24 pb-12 min-h-dvh container mx-auto px-4 max-w-3xl">
      <SEO title={`${thread.title} — Forum`} description={thread.content.slice(0, 160)} />

      <Link to={thread.category ? `/forum/c/${thread.category.slug}` : "/forum"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> {thread.category?.name ?? "Forum"}
      </Link>

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {thread.pinned && <Badge variant="secondary" className="gap-1"><Pin className="h-3 w-3" /> Pinned</Badge>}
                {thread.locked && <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> Locked</Badge>}
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-bold">{thread.title}</h1>
            </div>
            <Button onClick={toggleVote} variant={hasVoted ? "default" : "outline"} size="sm" className="gap-1 shrink-0">
              <ArrowUp className={cn("h-4 w-4", hasVoted && "fill-current")} /> {voteCount}
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            {thread.author?.avatar_url ? (
              <img src={thread.author.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
            ) : (
              <div className="h-6 w-6 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
                {(thread.author?.full_name || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="font-medium text-foreground">{thread.author?.full_name || "User"}</span>
            <span>·</span>
            <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}</span>
            <span>·</span>
            <span>{thread.view_count} views</span>
          </div>

          <p className="whitespace-pre-wrap leading-relaxed">{thread.content}</p>

          {(canModifyThread || isAdmin) && (
            <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
              {isAdmin && (
                <>
                  <Button size="sm" variant="outline" onClick={togglePin}>
                    <Pin className="h-3.5 w-3.5 mr-1" /> {thread.pinned ? "Unpin" : "Pin"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={toggleLock}>
                    <Lock className="h-3.5 w-3.5 mr-1" /> {thread.locked ? "Unlock" : "Lock"}
                  </Button>
                </>
              )}
              {canModifyThread && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={deleteThread}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete thread
                </Button>
              )}
              {user && user.id !== thread.user_id && !isAdmin && (
                <ReportDialog contentType="forum_thread" contentId={thread.id} className="ml-auto" />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <h2 className="text-lg font-heading font-bold mb-3">{replies.length} {replies.length === 1 ? "reply" : "replies"}</h2>

      <div className="space-y-3 mb-6">
        {replies.map((r) => {
          const canEdit = user && user.id === r.user_id;
          const canDel = user && (user.id === r.user_id || isAdmin);
          return (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {r.author?.avatar_url ? (
                    <img src={r.author.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0">
                      {(r.author?.full_name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{r.author?.full_name || "User"}</span>
                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                        {r.updated_at !== r.created_at && <span className="text-xs text-muted-foreground italic">(edited)</span>}
                      </div>
                      <div className="flex gap-1">
                        {canEdit && editingReplyId !== r.id && (
                          <button type="button" aria-label="Edit reply" onClick={() => { setEditingReplyId(r.id); setEditText(r.content); }} className="text-muted-foreground hover:text-foreground">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDel && editingReplyId !== r.id && (
                          <button type="button" aria-label="Delete reply" onClick={() => deleteReply(r.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {user && user.id !== r.user_id && editingReplyId !== r.id && (
                          <ReportDialog contentType="forum_reply" contentId={r.id} />
                        )}
                      </div>
                    </div>
                    {editingReplyId === r.id ? (
                      <div className="space-y-2">
                        <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveReplyEdit(r.id)}><Check className="h-3 w-3 mr-1" />Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingReplyId(null)}><X className="h-3 w-3 mr-1" />Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">{r.content}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {thread.locked ? (
        <Card className="p-4 text-center text-sm text-muted-foreground">
          <Lock className="h-4 w-4 inline mr-1" /> This thread is locked. No new replies allowed.
        </Card>
      ) : user ? (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your reply…"
              aria-label="Write your reply"
              rows={4}
              maxLength={10000}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{text.length}/10000</span>
              <Button onClick={reply} disabled={posting || !text.trim()} className="bg-gradient-primary text-primary-foreground">
                Post reply
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-4 text-center text-sm text-muted-foreground">
          <Link to="/auth" className="text-primary hover:underline font-medium">Sign in</Link> to reply.
        </Card>
      )}
    </main>
  );
};

export default ForumThread;