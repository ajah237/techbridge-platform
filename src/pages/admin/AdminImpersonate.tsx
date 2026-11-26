import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { logAdminAction } from "@/lib/auditLog";
import { isUuid } from "@/lib/utils";
import { ArrowLeft, Star, MessageSquare, Lock } from "lucide-react";

type Profile = { user_id: string; full_name: string | null; email: string | null; avatar_url: string | null; university: string | null; bio: string | null };
type Reg = { id: string; event_id: string; status: string; registered_at: string };
type Cert = { id: string; certificate_number: string; recipient_name: string; issued_at: string; event_id: string };
type Project = { id: string; title: string; status: string; created_at: string };
type Badge = { id: string; badge_id: string; awarded_at: string };
type Pt = { id: string; points: number; reason: string; created_at: string };
type MentReq = { id: string; mentor_id: string; mentee_id: string; status: string; created_at: string; message: string | null };
type Review = { id: string; mentor_id: string; reviewer_id: string; rating: number; content: string | null; created_at: string };
type Thread = { id: string; title: string; reply_count: number; created_at: string };
type Reply = { id: string; thread_id: string; content: string; created_at: string };

const AdminImpersonate = () => {
  const { userId } = useParams<{ userId: string }>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [points, setPoints] = useState<Pt[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [mentReqs, setMentReqs] = useState<MentReq[]>([]);
  const [reviewsGiven, setReviewsGiven] = useState<Review[]>([]);
  const [reviewsReceived, setReviewsReceived] = useState<Review[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [mentLimit, setMentLimit] = useState(5);
  const [reviewLimit, setReviewLimit] = useState(5);
  const [threadLimit, setThreadLimit] = useState(5);
  const [replyLimit, setReplyLimit] = useState(5);

  useEffect(() => {
    if (!userId || !isUuid(userId)) {
      setLoading(false);
      setProfile(null);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      const [pRes, rRes, cRes, prRes, bRes, ptRes, mrRes, rgRes, rrRes, tRes, rpRes] = await Promise.all([
        supabase.from("profiles").select("user_id,full_name,email,avatar_url,university,bio").eq("user_id", userId).maybeSingle(),
        supabase.from("event_registrations").select("*").eq("user_id", userId).order("registered_at", { ascending: false }),
        supabase.from("certificates").select("*").eq("user_id", userId).order("issued_at", { ascending: false }),
        supabase.from("projects").select("id,title,status,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("user_badges").select("*").eq("user_id", userId),
        supabase.from("points_log").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
        supabase.from("mentorship_requests").select("*").or(`mentor_id.eq.${userId},mentee_id.eq.${userId}`).order("created_at", { ascending: false }),
        supabase.from("mentor_reviews").select("*").eq("reviewer_id", userId).order("created_at", { ascending: false }),
        supabase.from("mentor_reviews").select("*").eq("mentor_id", userId).order("created_at", { ascending: false }),
        supabase.from("forum_threads").select("id,title,reply_count,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
        supabase.from("forum_replies").select("id,thread_id,content,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      ]);
      if (!active) return;
      const prof = (pRes.data as Profile) ?? null;
      setProfile(prof);
      if (prof) {
        logAdminAction("user.impersonate_view", "user", userId, prof.email ?? prof.full_name ?? null);
      }
      setRegs((rRes.data ?? []) as Reg[]);
      setCerts((cRes.data ?? []) as Cert[]);
      setProjects((prRes.data ?? []) as Project[]);
      setBadges((bRes.data ?? []) as Badge[]);
      const pts = (ptRes.data ?? []) as Pt[];
      setPoints(pts);
      setTotalPoints(pts.reduce((s, p) => s + p.points, 0));
      setMentReqs((mrRes.data ?? []) as MentReq[]);
      setReviewsGiven((rgRes.data ?? []) as Review[]);
      setReviewsReceived((rrRes.data ?? []) as Review[]);
      setThreads((tRes.data ?? []) as Thread[]);
      setReplies((rpRes.data ?? []) as Reply[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
    </div>
  );
  if (!profile) return <p className="text-muted-foreground">User not found.</p>;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="rounded-lg border-2 border-dashed border-amber-500/60 bg-amber-500/10 p-3 flex items-start sm:items-center gap-2 text-xs sm:text-sm">
        <Lock size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 sm:mt-0 shrink-0" />
        <span><strong>Read-only debug view.</strong> No mutations are sent. RLS still enforces admin scope on every query.</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {(profile.full_name ?? "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-heading font-bold truncate">{profile.full_name || "(no name)"}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{profile.email}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1 self-start sm:self-auto" asChild>
          <Link to="/admin/users"><ArrowLeft size={14} /> Back to users</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Events", value: regs.length },
          { label: "Certificates", value: certs.length },
          { label: "Projects", value: projects.length },
          { label: "Points", value: totalPoints },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Mentorships", value: mentReqs.length },
          { label: "Reviews given", value: reviewsGiven.length },
          { label: "Reviews received", value: reviewsReceived.length },
          { label: "Forum posts", value: threads.length + replies.length },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-2">
            <h2 className="font-semibold mb-2">Event registrations</h2>
            {regs.length === 0 ? <p className="text-sm text-muted-foreground">None</p> : regs.slice(0, 10).map((r) => (
              <div key={r.id} className="flex justify-between text-sm border-b border-border last:border-0 pb-1">
                <span className="truncate">{r.event_id.slice(0, 8)}…</span>
                <Badge variant="outline" className="text-xs">{r.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <h2 className="font-semibold mb-2">Projects</h2>
            {projects.length === 0 ? <p className="text-sm text-muted-foreground">None</p> : projects.map((p) => (
              <div key={p.id} className="flex justify-between text-sm border-b border-border last:border-0 pb-1">
                <span className="truncate">{p.title}</span>
                <Badge variant="outline" className="text-xs">{p.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <h2 className="font-semibold mb-2">Certificates</h2>
            {certs.length === 0 ? <p className="text-sm text-muted-foreground">None</p> : certs.map((c) => (
              <div key={c.id} className="flex justify-between text-sm border-b border-border last:border-0 pb-1">
                <span className="truncate">{c.certificate_number}</span>
                <span className="text-xs text-muted-foreground">{new Date(c.issued_at).toLocaleDateString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <h2 className="font-semibold mb-2">Recent points</h2>
            {points.length === 0 ? <p className="text-sm text-muted-foreground">None</p> : points.slice(0, 10).map((p) => (
              <div key={p.id} className="flex justify-between text-sm border-b border-border last:border-0 pb-1">
                <span className="truncate">{p.reason}</span>
                <span className="font-medium">+{p.points}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-2">
            <h2 className="font-semibold mb-2 flex items-center justify-between">
              <span>Mentorship requests</span>
              <span className="text-xs font-normal text-muted-foreground">{mentReqs.length}</span>
            </h2>
            {mentReqs.length === 0 ? <p className="text-sm text-muted-foreground">None</p> : mentReqs.slice(0, mentLimit).map((m) => (
              <div key={m.id} className="flex justify-between items-center gap-2 text-sm border-b border-border last:border-0 pb-1">
                <span className="truncate min-w-0">
                  {m.mentor_id === userId ? "as mentor" : "as mentee"} · {new Date(m.created_at).toLocaleDateString()}
                </span>
                <Badge variant="outline" className="text-xs shrink-0">{m.status}</Badge>
              </div>
            ))}
            {mentReqs.length > mentLimit && (
              <Button size="sm" variant="ghost" className="w-full mt-2" onClick={() => setMentLimit((n) => n + 10)}>
                Load more ({mentReqs.length - mentLimit} remaining)
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <h2 className="font-semibold mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2"><Star size={14} /> Mentor reviews</span>
              <span className="text-xs font-normal text-muted-foreground">{reviewsGiven.length + reviewsReceived.length}</span>
            </h2>
            {reviewsGiven.length === 0 && reviewsReceived.length === 0 ? (
              <p className="text-sm text-muted-foreground">None</p>
            ) : (
              <>
                {reviewsReceived.slice(0, reviewLimit).map((r) => (
                  <div key={r.id} className="text-sm border-b border-border last:border-0 pb-1">
                    <div className="flex justify-between"><span>Received</span><span>{"★".repeat(r.rating)}</span></div>
                    {r.content && <p className="text-xs text-muted-foreground truncate">{r.content}</p>}
                  </div>
                ))}
                {reviewsGiven.slice(0, reviewLimit).map((r) => (
                  <div key={r.id} className="text-sm border-b border-border last:border-0 pb-1">
                    <div className="flex justify-between"><span>Given</span><span>{"★".repeat(r.rating)}</span></div>
                    {r.content && <p className="text-xs text-muted-foreground truncate">{r.content}</p>}
                  </div>
                ))}
                {(reviewsReceived.length > reviewLimit || reviewsGiven.length > reviewLimit) && (
                  <Button size="sm" variant="ghost" className="w-full mt-2" onClick={() => setReviewLimit((n) => n + 5)}>
                    Load more
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardContent className="p-4 space-y-2">
            <h2 className="font-semibold mb-2 flex items-center gap-2"><MessageSquare size={14} /> Forum activity</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Threads ({threads.length})</p>
                {threads.length === 0 ? <p className="text-sm text-muted-foreground">None</p> : threads.slice(0, threadLimit).map((t) => (
                  <div key={t.id} className="flex justify-between gap-2 text-sm border-b border-border last:border-0 py-1">
                    <span className="truncate min-w-0">{t.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{t.reply_count} replies</span>
                  </div>
                ))}
                {threads.length > threadLimit && (
                  <Button size="sm" variant="ghost" className="w-full mt-2" onClick={() => setThreadLimit((n) => n + 5)}>
                    Load more
                  </Button>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Replies ({replies.length})</p>
                {replies.length === 0 ? <p className="text-sm text-muted-foreground">None</p> : replies.slice(0, replyLimit).map((r) => (
                  <div key={r.id} className="text-sm border-b border-border last:border-0 py-1">
                    <p className="line-clamp-2">{r.content}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
                {replies.length > replyLimit && (
                  <Button size="sm" variant="ghost" className="w-full mt-2" onClick={() => setReplyLimit((n) => n + 5)}>
                    Load more
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminImpersonate;