import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Star, MessageSquareQuote, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type Review = {
  id: string;
  mentor_id: string;
  reviewer_id: string;
  rating: number;
  content: string | null;
  created_at: string;
  reviewer?: { full_name: string | null; avatar_url: string | null };
};

interface Props {
  mentorUserId: string;
  mentorName: string;
}

const MentorReviews = ({ mentorUserId, mentorName }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data } = await supabase.rpc("get_mentor_reviews_public", { _mentor_id: mentorUserId });
    const list = ((data ?? []) as any[]).map((r) => ({
      ...r, mentor_id: mentorUserId, reviewer_id: r.is_mine && user ? user.id : "",
      reviewer: r.is_mine ? { full_name: "You", avatar_url: null } : { full_name: "Verified mentee", avatar_url: null },
    })) as Review[];
    setReviews(list);
    if (user) {
      const mine = list.find((r) => r.reviewer_id === user.id) ?? null;
      setMyReview(mine);
      if (mine) {
        setRating(mine.rating);
        setContent(mine.content ?? "");
      }
      // eligibility: accepted mentorship request
      const { data: mr } = await supabase
        .from("mentorship_requests")
        .select("id")
        .eq("mentor_id", mentorUserId)
        .eq("mentee_id", user.id)
        .eq("status", "accepted")
        .limit(1);
      setCanReview((mr ?? []).length > 0);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open, user?.id, mentorUserId]);

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    if (myReview) {
      const { error } = await supabase
        .from("mentor_reviews" as any)
        .update({ rating, content: content.trim() || null })
        .eq("id", myReview.id);
      setSubmitting(false);
      if (error) return toast.error(error.message);
      toast.success("Review updated");
    } else {
      const { error } = await supabase
        .from("mentor_reviews" as any)
        .insert({ mentor_id: mentorUserId, reviewer_id: user.id, rating, content: content.trim() || null });
      setSubmitting(false);
      if (error) return toast.error(error.message);
      toast.success("Thanks for your review!");
    }
    load();
  };

  const remove = async () => {
    if (!myReview) return;
    if (!confirm("Delete your review?")) return;
    const { error } = await supabase.from("mentor_reviews" as any).delete().eq("id", myReview.id);
    if (error) return toast.error(error.message);
    setMyReview(null);
    setRating(5);
    setContent("");
    load();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs gap-1 h-auto py-1 px-2">
          <MessageSquareQuote className="h-3 w-3" /> Reviews
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reviews for {mentorName}</DialogTitle>
        </DialogHeader>

        {canReview && (
          <Card className="p-4 space-y-3">
            <p className="text-sm font-medium">{myReview ? "Update your review" : "Leave a review"}</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
                  <Star className={cn("h-6 w-6 transition-colors", n <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Share your experience (optional)..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={1500}
              rows={3}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={submit} disabled={submitting} className="bg-gradient-primary text-primary-foreground">
                {myReview ? "Update" : "Submit"}
              </Button>
              {myReview && (
                <Button size="sm" variant="ghost" onClick={remove}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              )}
            </div>
          </Card>
        )}
        {user && !canReview && !myReview && (
          <p className="text-xs text-muted-foreground italic">
            Only mentees with an accepted mentorship request can leave a review.
          </p>
        )}

        <div className="space-y-3">
          {reviews.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No reviews yet.</p>
          )}
          {reviews.map((r) => (
            <Card key={r.id} className="p-3">
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  {r.reviewer?.avatar_url ? (
                    <img src={r.reviewer.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                      {(r.reviewer?.full_name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">{r.reviewer?.full_name || "Anonymous"}</p>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</p>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={cn("h-3.5 w-3.5", n <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                  ))}
                </div>
              </div>
              {r.content && <p className="text-sm text-muted-foreground mt-2">{r.content}</p>}
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MentorReviews;