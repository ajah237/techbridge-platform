import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, Clock, Rocket, CheckCircle2, Circle, Ticket, Building2, Award } from "lucide-react";
import {
  STATUS_LABEL, STATUS_VARIANT, formatMoney,
  type RegistrationStatus, type TeamRegistration, type RegistrationParticipant,
} from "@/lib/registration";
import SubmissionPanel, { submissionStatus } from "@/components/team/SubmissionPanel";
import KeyDatesTimeline from "@/components/KeyDatesTimeline";
import { buildMilestones } from "@/lib/eventTimeline";
import type { Tables } from "@/integrations/supabase/types";

type Ev = Tables<"events">;
type Cat = Tables<"event_categories">;
type Project = Tables<"projects">;

const FLOW: RegistrationStatus[] = ["draft", "submitted", "payment_pending", "payment_verification", "approved"];

const TeamPortal = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [regs, setRegs] = useState<TeamRegistration[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [events, setEvents] = useState<Record<string, Ev>>({});
  const [cats, setCats] = useState<Record<string, Cat>>({});
  const [participants, setParticipants] = useState<RegistrationParticipant[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [certs, setCerts] = useState<{ certificate_number: string; recipient_name: string; event_id: string }[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from("certificates").select("certificate_number, recipient_name, event_id").eq("user_id", user.id).is("revoked_at", null)
      .then(({ data }) => setCerts(data ?? []));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("team_registrations")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });
      const list = data ?? [];
      setRegs(list);
      if (list.length) setSelectedId(list[0].id);
      const evIds = [...new Set(list.map((r) => r.event_id))];
      const catIds = [...new Set(list.map((r) => r.category_id).filter(Boolean))] as string[];
      const [evRes, catRes, projRes] = await Promise.all([
        evIds.length ? supabase.from("events").select("*").in("id", evIds) : Promise.resolve({ data: [] as Ev[] }),
        catIds.length ? supabase.from("event_categories").select("*").in("id", catIds) : Promise.resolve({ data: [] as Cat[] }),
        supabase.from("projects").select("*").eq("user_id", user.id),
      ]);
      setEvents(Object.fromEntries((evRes.data ?? []).map((e) => [e.id, e])));
      setCats(Object.fromEntries((catRes.data ?? []).map((c) => [c.id, c])));
      setProjects(projRes.data ?? []);
      setLoading(false);
    })();
  }, [user]);

  // Live status: reflect organiser approvals / payment verification without a refresh.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`team-regs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "team_registrations", filter: `created_by=eq.${user.id}` },
        (payload) => {
          const row = payload.new as (typeof regs)[number];
          setRegs((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...row } : r)));
          toast.info(`Registration status updated: ${STATUS_LABEL[row.status as RegistrationStatus] ?? row.status}`);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (!selectedId) return;
    supabase
      .from("registration_participants")
      .select("*")
      .eq("registration_id", selectedId)
      .order("sort_order", { ascending: true })
      .then(({ data }) => setParticipants(data ?? []));
  }, [selectedId]);

  const reg = regs.find((r) => r.id === selectedId);
  const ev = reg ? events[reg.event_id] : undefined;
  const cat = reg?.category_id ? cats[reg.category_id] : undefined;
  const project = useMemo(
    () => (reg ? projects.find((p) => p.registration_id === reg.id) ?? projects.find((p) => !p.registration_id && p.event_id === reg.event_id) : undefined),
    [projects, reg],
  );
  const timeline = Array.isArray((ev as any)?.timeline)
    ? ((ev as any).timeline as Array<{ date?: string; title?: string }>)
    : [];

  const canSubmit = reg?.status === "approved";

  if (loading) {
    return (
      <main className="pt-20 container mx-auto px-4 py-10 max-w-5xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  return (
    <main className="pt-20">
      <SEO title="Team Portal" description="View your team, registration status, event timeline and submit your project." noIndex />
      <section className="py-10 sm:py-14 bg-gradient-hero dark">
        <div className="container mx-auto px-4 max-w-5xl">
          <h1 className="text-3xl sm:text-4xl font-heading font-bold text-foreground">Team Portal</h1>
          <p className="mt-2 text-muted-foreground">Your team, status, timeline and project — all in one place.</p>
        </div>
      </section>

      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4 max-w-5xl space-y-6">
          {regs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <Ticket className="mx-auto text-primary" size={32} />
                <p className="text-muted-foreground">You haven't registered a team yet.</p>
                <Button asChild className="bg-gradient-primary text-primary-foreground"><Link to="/events">Browse events</Link></Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {regs.length > 1 && (
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger className="sm:w-96"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {regs.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.team_name || "Untitled team"} · {events[r.event_id]?.title ?? "Event"} · {submissionStatus(projects.find((p) => p.registration_id === r.id)).label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {reg && (
                <>
                  {/* Overview */}
                  <Card>
                    <CardContent className="p-5 sm:p-6 grid gap-4 sm:grid-cols-[1fr_auto] items-start">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{ev?.title}</p>
                        <h2 className="text-2xl font-heading font-bold text-foreground break-words">{reg.team_name || "Untitled team"}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{cat?.name}</p>
                        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                          {reg.team_code && <span>Team ID: <span className="font-mono font-semibold text-foreground">{reg.team_code}</span></span>}
                          {reg.reference && <span>Ref: <span className="font-mono text-foreground">{reg.reference}</span></span>}
                          {reg.fee_amount != null && <span>Fee: <span className="text-foreground">{formatMoney(Number(reg.fee_amount), reg.currency)}</span></span>}
                        </div>
                      </div>
                      <Badge variant={STATUS_VARIANT[reg.status as RegistrationStatus]} className="w-fit">
                        {STATUS_LABEL[reg.status as RegistrationStatus]}
                      </Badge>
                    </CardContent>
                  </Card>

                  {/* Status tracker */}
                  <Card>
                    <CardHeader><CardTitle className="text-lg">Registration progress</CardTitle></CardHeader>
                    <CardContent>
                      {reg.status === "rejected" || reg.status === "withdrawn" ? (
                        <p className="text-sm text-destructive">
                          This registration was {STATUS_LABEL[reg.status as RegistrationStatus].toLowerCase()}.
                          {reg.review_notes && <> Note from organisers: {reg.review_notes}</>}
                        </p>
                      ) : (
                        <ol className="grid gap-3 sm:grid-cols-5">
                          {FLOW.map((s, i) => {
                            const done = FLOW.indexOf(reg.status as RegistrationStatus) >= i;
                            return (
                              <li key={s} className="flex sm:flex-col items-center sm:text-center gap-2">
                                {done ? <CheckCircle2 className="text-primary shrink-0" size={20} /> : <Circle className="text-muted-foreground shrink-0" size={20} />}
                                <span className={`text-xs ${done ? "text-foreground font-medium" : "text-muted-foreground"}`}>{STATUS_LABEL[s]}</span>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                      {reg.status === "draft" && ev && (
                        <Button asChild size="sm" variant="outline" className="mt-4">
                          <Link to={`/events/${ev.slug}/register`}>Continue registration</Link>
                        </Button>
                      )}
                      {reg.review_notes && reg.status !== "rejected" && (
                        <p className="mt-4 text-sm text-muted-foreground"><span className="font-medium text-foreground">Organiser note:</span> {reg.review_notes}</p>
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Team */}
                    <Card>
                      <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users size={18} className="text-primary" /> Team members</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        {reg.institution_name && (
                          <p className="text-sm text-muted-foreground flex items-center gap-2"><Building2 size={14} /> {reg.institution_name}{reg.institution_town ? `, ${reg.institution_town}` : ""}</p>
                        )}
                        {participants.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No participants added yet.</p>
                        ) : (
                          <ul className="divide-y divide-border">
                            {participants.map((p) => (
                              <li key={p.id} className="py-2 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{p.full_name}</p>
                                  {p.email && <p className="text-xs text-muted-foreground truncate">{p.email}</p>}
                                </div>
                                <Badge variant="outline" className="capitalize shrink-0">{p.is_leader ? "Leader" : String(p.role).replace("_", " ")}</Badge>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>

                    {/* Timeline */}
                    <Card>
                      <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Clock size={18} className="text-primary" /> Event timeline</CardTitle></CardHeader>
                      <CardContent>
                        <KeyDatesTimeline items={buildMilestones(ev, cat ? [cat] : [])} />
                        <ol className="space-y-3 border-l border-border pl-4 mt-4">
                          {timeline.map((t, i) => (
                            <li key={i} className="relative"><span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-muted-foreground" /><p className="text-sm font-medium text-foreground">{t.title}</p>{t.date && <p className="text-xs text-muted-foreground">{t.date}</p>}</li>
                          ))}
                        </ol>
                      </CardContent>
                    </Card>
                  </div>

                  {certs.filter((c) => c.event_id === reg.event_id).length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Award size={18} className="text-primary" /> Certificates</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {certs.filter((c) => c.event_id === reg.event_id).map((c) => (
                          <div key={c.certificate_number} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                            <div><p className="font-medium">{c.recipient_name}</p><p className="font-mono text-xs text-muted-foreground">{c.certificate_number}</p></div>
                            <Button asChild size="sm" variant="outline"><Link to={`/certificate/${c.certificate_number}/print`}>View & download</Link></Button>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Project */}
                  <Card>
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Rocket size={18} className="text-primary" /> Project submission</CardTitle></CardHeader>
                    <CardContent>
                      {user && (
                        <SubmissionPanel
                          userId={user.id}
                          registrationId={reg.id}
                          registrationApproved={canSubmit}
                          event={ev}
                          project={project}
                          onProject={(np) => setProjects((ps) => [...ps.filter((x) => x.id !== np.id), np])}
                        />
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
};

export default TeamPortal;
