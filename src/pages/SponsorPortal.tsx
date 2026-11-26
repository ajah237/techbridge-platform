import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Handshake } from "lucide-react";
import { formatMoney } from "@/lib/registration";
import SponsorTeamsView from "@/components/sponsor/SponsorTeamsView";
import type { Tables } from "@/integrations/supabase/types";

type Sp = Tables<"sponsorships"> & { events?: { title: string } | null };

const SponsorPortal = () => {
  const { user } = useAuth();
  const [list, setList] = useState<Sp[] | null>(null);
  const [sel, setSel] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("sponsorships").select("*, events(title)").eq("sponsor_user_id", user.id).neq("status", "cancelled")
      .then(({ data }) => { setList((data ?? []) as Sp[]); if (data?.length) setSel(data[0].id); });
  }, [user]);

  const sp = list?.find((s) => s.id === sel);

  return (
    <main className="pt-20">
      <SEO title="Sponsor Portal" description="View registered teams and review submissions for the events you sponsor." noIndex />
      <section className="py-10 bg-gradient-hero dark">
        <div className="container mx-auto px-4 max-w-5xl">
          <h1 className="text-3xl sm:text-4xl font-heading font-bold text-foreground flex items-center gap-3"><Handshake /> Sponsor Portal</h1>
          <p className="mt-2 text-muted-foreground">Thank you for supporting young innovators.</p>
        </div>
      </section>
      <section className="py-8">
        <div className="container mx-auto px-4 max-w-5xl space-y-6">
          {!list ? <Skeleton className="h-40" /> : list.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Your account isn't linked to a sponsorship yet. Please contact the organisers.</CardContent></Card>
          ) : (
            <>
              {list.length > 1 && (
                <Select value={sel} onValueChange={setSel}>
                  <SelectTrigger className="sm:w-96"><SelectValue /></SelectTrigger>
                  <SelectContent>{list.map((s) => <SelectItem key={s.id} value={s.id}>{s.events?.title} · {s.sponsor_name}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {sp && (
                <>
                  <Card><CardContent className="p-5 flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">{sp.events?.title}</p>
                      <p className="text-xl font-heading font-bold text-foreground">{sp.sponsor_name}</p>
                      <p className="text-sm text-muted-foreground capitalize">{sp.tier} sponsor · {formatMoney(Number(sp.amount), sp.currency)}</p>
                    </div>
                    <Badge className="capitalize h-fit">{sp.status}</Badge>
                  </CardContent></Card>
                  {sp.can_review ? <SponsorTeamsView eventId={sp.event_id} mode="sponsor" /> : <p className="text-sm text-muted-foreground">Team review access is not enabled for this sponsorship.</p>}
                </>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
};

export default SponsorPortal;
