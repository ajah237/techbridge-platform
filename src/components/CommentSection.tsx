import { useEffect, useState } from "react";
import { z } from "zod";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { MessageCircle, Reply } from "lucide-react";
import { checkRateLimit, recordAttempt } from "@/lib/rate-limit";

const COMMENT_MIN_DWELL_MS = 4000; // bots typically submit instantly

// Spam scoring: returns score 0–10, ≥4 = suspicious, ≥7 = block outright
const SPAM_TERMS = [
  "viagra", "cialis", "casino", "loan offer", "crypto giveaway",
  "free bitcoin", "make money fast", "weight loss pill", "porn",
  "escort", "sex chat", "buy followers", "seo service",
];
const SUSPICIOUS_TLDS = [".ru", ".cn", ".tk", ".top", ".click", ".loan", ".work", ".xyz"];
const URL_RE = /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+|\b[a-z0-9-]+\.(com|net|org|io|co|biz|info|ru|cn|tk|top|click|loan|xyz|work|me)\b/gi;

const scoreSpam = (text: string, name: string) => {
  let score = 0;
  const lower = text.toLowerCase();
  const trimmed = text.trim();

  // Keyword hits
  for (const term of SPAM_TERMS) if (lower.includes(term)) score += 3;

  // Link analysis
  const urls = lower.match(URL_RE) || [];
  if (urls.length === 1) score += 1;
  if (urls.length === 2) score += 3;
  if (urls.length >= 3) score += 6;
  for (const u of urls) {
    if (SUSPICIOUS_TLDS.some((t) => u.endsWith(t) || u.includes(t + "/"))) score += 3;
    if (/bit\.ly|tinyurl|t\.co|goo\.gl|is\.gd|ow\.ly/.test(u)) score += 3;
  }

  // Excessive repetition (e.g. "buy buy buy buy")
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length > 4) {
    const counts: Record<string, number> = {};
    words.forEach((w) => { counts[w] = (counts[w] || 0) + 1; });
    const maxRep = Math.max(...Object.values(counts));
    if (maxRep / words.length > 0.4) score += 3;
  }

  // ALL CAPS shouting
  const letters = trimmed.replace(/[^a-zA-Z]/g, "");
  if (letters.length > 20 && letters === letters.toUpperCase()) score += 2;

  // Name contains URL
  if (/https?:|www\./i.test(name)) score += 4;

  // Very short comment with a link
  if (trimmed.length < 30 && urls.length > 0) score += 2;

  // Non-ASCII heavy + links (common spam pattern)
  const nonAscii = (trimmed.match(/[^\x00-\x7F]/g) || []).length;
  if (nonAscii / Math.max(1, trimmed.length) > 0.5 && urls.length > 0) score += 2;

  return score;
};

type Comment = {
  id: string; post_id: string; parent_id: string | null;
  author_name: string; content: string;
  created_at: string; status: string;
};

const schema = z.object({
  author_name: z.string().trim().min(1).max(80),
  author_email: z.string().trim().email().max(255),
  content: z.string().trim().min(2).max(4000),
  website: z.string().max(0, { message: "Spam detected" }).optional(), // honeypot
});

const CommentSection = ({ postId }: { postId: string }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formOpenedAt] = useState(() => Date.now());
  const [form, setForm] = useState({
    author_name: "",
    author_email: "",
    content: "",
    website: "", // honeypot — must stay empty
  });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("blog_comments_public" as any)
        .select("id,post_id,parent_id,author_name,content,created_at,status")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      setComments(((data ?? []) as unknown) as Comment[]);
      setLoading(false);
    };
    load();

    // Prefill from logged-in user
    if (user) {
      supabase.from("profiles").select("full_name,email").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => {
          if (data) setForm((f) => ({ ...f, author_name: data.full_name || f.author_name, author_email: data.email || f.author_email }));
        });
    }
  }, [postId, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    // Dwell-time check: bots submit instantly
    if (Date.now() - formOpenedAt < COMMENT_MIN_DWELL_MS) {
      toast.error("Please take a moment to review your comment before submitting.");
      return;
    }

    // Per-email AND per-post rate limit (whichever trips first)
    const emailKey = `comment:email:${parsed.data.author_email.toLowerCase()}`;
    const postKey = `comment:post:${postId}:${parsed.data.author_email.toLowerCase()}`;
    for (const key of [emailKey, postKey]) {
      const rl = checkRateLimit(key);
      if (!rl.allowed) {
        toast.error(`Too many comments. Try again in ${Math.ceil((rl.retryAfterSeconds ?? 60) / 60)} min.`);
        return;
      }
    }

    const spamScore = scoreSpam(parsed.data.content, parsed.data.author_name);
    if (spamScore >= 7) {
      // Hard block — don't even hit the DB
      toast.error("Your comment looks like spam and was not submitted.");
      recordAttempt(emailKey);
      recordAttempt(postKey);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("blog_comments").insert({
      post_id: postId,
      parent_id: replyTo,
      author_name: parsed.data.author_name,
      author_email: parsed.data.author_email,
      content: parsed.data.content,
      status: "pending", // trigger enforces this anyway
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    recordAttempt(emailKey);
    recordAttempt(postKey);
    toast.success(
      spamScore >= 4
        ? "Comment submitted — it will be reviewed by a moderator."
        : "Thanks! Your comment is pending review."
    );
    setForm({ ...form, content: "" });
    setReplyTo(null);
  };

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  const initials = (name: string) => name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const renderComment = (c: Comment, depth = 0) => (
    <div key={c.id} className={depth > 0 ? "ml-8 sm:ml-12" : ""}>
      <div className="flex gap-3 py-4 border-b border-border/50 last:border-0">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(c.author_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium text-sm text-foreground">{c.author_name}</span>
            <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed whitespace-pre-line break-words">
            {c.content}
          </p>
          {depth === 0 && (
            <button type="button" onClick={() => setReplyTo(c.id)} className="mt-2 text-xs text-primary hover:underline flex items-center gap-1">
              <Reply size={12} /> Reply
            </button>
          )}
        </div>
      </div>
      {repliesOf(c.id).map((r) => renderComment(r, depth + 1))}
    </div>
  );

  return (
    <section className="mt-12 pt-8 border-t border-border">
      <h2 className="text-xl font-heading font-bold mb-6 flex items-center gap-2">
        <MessageCircle size={20} /> Comments {comments.length > 0 && <span className="text-muted-foreground text-base">({comments.length})</span>}
      </h2>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : topLevel.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-8">Be the first to comment.</p>
      ) : (
        <div className="mb-8">{topLevel.map((c) => renderComment(c))}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-muted/30 p-4 sm:p-6 rounded-lg">
        <h3 className="font-heading font-semibold">
          {replyTo ? "Reply to comment" : "Leave a comment"}
        </h3>
        {replyTo && (
          <button type="button" onClick={() => setReplyTo(null)} className="text-xs text-muted-foreground hover:text-foreground">
            Cancel reply
          </button>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="c-name">Name *</Label>
            <Input id="c-name" required maxLength={80} value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="c-email">Email *</Label>
            <Input id="c-email" type="email" required maxLength={255} value={form.author_email} onChange={(e) => setForm({ ...form, author_email: e.target.value })} />
            <p className="text-[10px] text-muted-foreground mt-1">Not published.</p>
          </div>
        </div>
        {/* Honeypot field for bots */}
        <div aria-hidden className="absolute left-[-9999px]">
          <label htmlFor="c-website">Website</label>
          <input id="c-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="c-content">Comment *</Label>
          <Textarea id="c-content" rows={4} maxLength={4000} required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <p className="text-[10px] text-muted-foreground mt-1">Comments are reviewed before publishing.</p>
        </div>
        <Button type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Submit comment"}</Button>
      </form>
    </section>
  );
};

export default CommentSection;