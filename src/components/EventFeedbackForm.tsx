import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Star, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Props = { eventId: string; eventTitle: string };

const EventFeedbackForm = ({ eventId, eventTitle }: Props) => {
  const { user } = useAuth();
  const [registered, setRegistered] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [content, setContent] = useState("");
  const [recommend, setRecommend] = useState(true);
  const [anonymous, setAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const [{ data: reg }, { data: fb }] = await Promise.all([
        supabase.from("event_registrations").select("id").eq("event_id", eventId).eq("user_id", user.id).maybeSingle(),
        supabase.from("event_feedback").select("id").eq("event_id", eventId).eq("user_id", user.id).maybeSingle(),
      ]);
      setRegistered(!!reg);
      setSubmitted(!!fb);
      setLoading(false);
    })();
  }, [user, eventId]);

  if (loading) return null;
  if (!user || !registered) return null;

  if (submitted) {
    return (
      <Card className="mt-8 bg-muted/30">
        <CardContent className="p-6 flex items-center gap-3 text-sm">
          <CheckCircle2 className="text-primary h-5 w-5" />
          <span>Thanks for your feedback on <strong>{eventTitle}</strong>.</span>
        </CardContent>
      </Card>
    );
  }

  const submit = async () => {
    if (rating < 1) return toast.error("Please pick a star rating.");
    if (content.length > 2000) return toast.error("Comment too long.");
    setSaving(true);
    const { error } = await supabase.from("event_feedback").insert({
      event_id: eventId,
      user_id: user.id,
      rating,
      content: content.trim() || null,
      would_recommend: recommend,
      anonymous,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setSubmitted(true);
    toast.success("Thanks for sharing your feedback!");
  };

  return (
    <Card className="mt-10">
      <CardHeader>
        <CardTitle className="text-lg">Share your feedback</CardTitle>
        <p className="text-sm text-muted-foreground">
          Help the organizers improve future events. Visible to admins only.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label className="text-sm">Overall rating</Label>
          <div className="flex gap-1 mt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i} type="button"
                onClick={() => setRating(i)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(0)}
                aria-label={`${i} star${i > 1 ? "s" : ""}`}
                className="p-1"
              >
                <Star
                  size={28}
                  className={i <= (hover || rating) ? "fill-primary text-primary" : "text-muted-foreground/40"}
                />
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="fb-comment" className="text-sm">Comments (optional)</Label>
          <Textarea
            id="fb-comment" rows={4} value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What went well? What could be better?"
            maxLength={2000} className="mt-2"
          />
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch id="fb-rec" checked={recommend} onCheckedChange={setRecommend} />
            <Label htmlFor="fb-rec" className="text-sm cursor-pointer">I'd recommend this event</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="fb-anon" checked={anonymous} onCheckedChange={setAnonymous} />
            <Label htmlFor="fb-anon" className="text-sm cursor-pointer">Submit anonymously</Label>
          </div>
        </div>
        <Button onClick={submit} disabled={saving} className="bg-gradient-primary text-primary-foreground">
          {saving ? "Submitting…" : "Submit feedback"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default EventFeedbackForm;