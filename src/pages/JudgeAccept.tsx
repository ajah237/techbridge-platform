import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gavel } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";

type Inv = {
  id: string;
  event_id: string;
  name: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  event_title: string | null;
  event_slug: string | null;
};

const JudgeAccept = () => {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const nav = useNavigate();
  const [inv, setInv] = useState<Inv | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase.rpc("get_judge_invitation", { _token: token });
      const row = Array.isArray(data) && data.length ? (data[0] as unknown as Inv) : null;
      setInv(row);
      setLoading(false);
    })();
  }, [token]);

  const accept = async () => {
    if (!user || !inv || !token) return;
    setAccepting(true);
    const { error } = await supabase.rpc("accept_judge_invitation", { _token: token });
    setAccepting(false);
    if (error) return toast.error(error.message);
    toast.success("Invitation accepted");
    if (inv.event_slug) nav(`/events/${inv.event_slug}`);
  };

  if (loading) return <main className="pt-24 pb-12 container mx-auto px-4 text-center text-muted-foreground">Loading invitation…</main>;

  if (!inv) return (
    <main className="pt-24 pb-12 container mx-auto px-4 max-w-lg">
      <Card><CardContent className="p-8 text-center">
        <h1 className="text-xl font-heading font-bold mb-2">Invitation not found</h1>
        <p className="text-sm text-muted-foreground">The link is invalid or has expired.</p>
      </CardContent></Card>
    </main>
  );

  return (
    <main className="pt-24 pb-12 container mx-auto px-4 max-w-lg">
      <SEO title="Judge invitation" description="Accept your TechBridge judging invitation" />
      <Card><CardContent className="p-8 text-center space-y-4">
        <Gavel className="h-12 w-12 mx-auto text-primary" />
        <h1 className="text-2xl font-heading font-bold">You're invited to judge</h1>
        {inv.event_title && <p className="text-muted-foreground">{inv.event_title}</p>}

        {inv.revoked_at ? (
          <p className="text-destructive text-sm">This invitation has been revoked.</p>
        ) : inv.accepted_at ? (
          <p className="text-emerald-600 text-sm">This invitation has already been accepted.</p>
        ) : !user ? (
          <div className="space-y-3">
            <p className="text-sm">Sign in to accept this invitation.</p>
            <Button asChild className="bg-gradient-primary text-primary-foreground">
              <Link to={`/auth?redirect=${encodeURIComponent(`/judge/accept/${token}`)}`}>Sign in to continue</Link>
            </Button>
          </div>
        ) : (
          <Button onClick={accept} disabled={accepting} className="bg-gradient-primary text-primary-foreground">
            {accepting ? "Accepting…" : "Accept invitation"}
          </Button>
        )}
      </CardContent></Card>
    </main>
  );
};

export default JudgeAccept;