import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type ContentType = "forum_thread" | "forum_reply" | "blog_comment" | "project";

const REASONS = [
  "Spam or misleading",
  "Harassment or hate",
  "Sexual or graphic content",
  "Violates community guidelines",
  "Off-topic",
  "Other",
];

interface Props {
  contentType: ContentType;
  contentId: string;
  /** Render as small icon by default. Pass children to use custom trigger label. */
  children?: React.ReactNode;
  /** Optional className for the trigger button */
  className?: string;
}

const ReportDialog = ({ contentType, contentId, children, className }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!reason) return toast.error("Pick a reason");
    setSubmitting(true);
    const { error } = await supabase.from("content_reports").insert({
      reporter_id: user.id,
      content_type: contentType,
      content_id: contentId,
      reason,
      details: details.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Report submitted. Thanks for helping keep TechBridge safe.");
    setOpen(false);
    setDetails("");
  };

  if (!user) {
    return (
      <Link
        to="/auth"
        className={"inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive " + (className ?? "")}
        aria-label="Sign in to report"
        title="Sign in to report"
      >
        <Flag size={12} /> {children ?? "Report"}
      </Link>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={"inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive " + (className ?? "")}
          aria-label="Report content"
          title="Report content"
        >
          <Flag size={12} /> {children ?? "Report"}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report content</DialogTitle>
          <DialogDescription>
            Our moderators review every report. Please add detail so we can act quickly.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Details (optional)</Label>
            <Textarea
              rows={4}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="What should the moderator know?"
              maxLength={1000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            {submitting ? "Submitting…" : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;