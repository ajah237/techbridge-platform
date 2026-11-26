import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { sendRegistrationEmail } from "@/lib/registrationEmail";
import { Check, ChevronLeft, ChevronRight, Copy, Loader2, Plus, Trash2, Users } from "lucide-react";
import {
  PAYMENT_METHODS,
  formatMoney,
  isRegistrationOpen,
  resolveFeeTier,
  type EventCategory,
  type FeeTier,
} from "@/lib/registration";
import type { Tables } from "@/integrations/supabase/types";
import { isHttpUrl, safeHref } from "@/lib/utils";

type Event = Tables<"events">;

interface PersonDraft {
  full_name: string;
  email: string;
  phone: string;
  gender: string;
  date_of_birth: string;
  class_level: string;
  department: string;
}

const blankPerson = (): PersonDraft => ({
  full_name: "", email: "", phone: "", gender: "", date_of_birth: "", class_level: "", department: "",
});

const STEP_TITLES = [
  "Event",
  "Category",
  "Institution",
  "Team",
  "Participants",
  "Mentor",
  "Payment",
  "Review",
  "Done",
] as const;

const EventRegister = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [events, setEvents] = useState<Event[]>([]);
  const [event, setEvent] = useState<Event | null>(null);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [tiers, setTiers] = useState<FeeTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [step, setStep] = useState(slug ? 2 : 1);
  const [categoryId, setCategoryId] = useState(params.get("category") ?? "");
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [result, setResult] = useState<{ team_code: string | null; reference: string | null } | null>(null);

  const [institution, setInstitution] = useState({ name: "", type: "", town: "", region: "", address: "" });
  const [team, setTeam] = useState({ name: "", notes: "" });
  const [members, setMembers] = useState<PersonDraft[]>([blankPerson(), blankPerson(), blankPerson()]);
  const [mentor, setMentor] = useState<PersonDraft>(blankPerson());
  const [payment, setPayment] = useState({ method: "mobile_money", transaction_reference: "", payer_name: "", payer_phone: "", proof_url: "" });
  const [declaration, setDeclaration] = useState(false);

  // Load events (for step 1) and the selected event with its categories.
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const { data: evs } = await supabase
        .from("events")
        .select("*")
        .in("status", ["published", "ongoing"])
        .order("start_date", { ascending: true });
      setEvents(evs ?? []);
      const target = slug ? (evs ?? []).find((e) => e.slug === slug) ?? null : null;
      setEvent(target);
      if (target) {
        const { data: cats } = await supabase
          .from("event_categories")
          .select("*")
          .eq("event_id", target.id)
          .eq("is_active", true)
          .order("sort_order");
        setCategories(cats ?? []);
        const ids = (cats ?? []).map((c) => c.id);
        if (ids.length) {
          const { data: ft } = await supabase.from("category_fee_tiers").select("*").in("category_id", ids);
          setTiers(ft ?? []);
        } else {
          setTiers([]);
        }
      }
      setLoading(false);
    };
    run();
  }, [slug]);

  const category = useMemo(() => categories.find((c) => c.id === categoryId) ?? null, [categories, categoryId]);
  const categoryTiers = useMemo(
    () => tiers.filter((t) => t.category_id === categoryId),
    [tiers, categoryId],
  );
  const activeTier = useMemo(() => resolveFeeTier(categoryTiers), [categoryTiers]);
  const needsMentor = category?.requires_teacher_mentor ?? false;
  const min = category?.min_team_size ?? 1;
  const max = category?.max_team_size ?? 5;
  const currency = category?.currency ?? "FCFA";

  const steps = useMemo(
    () => [1, 2, 3, 4, 5, ...(needsMentor ? [6] : []), 7, 8, 9],
    [needsMentor],
  );

  const goNext = () => {
    const i = steps.indexOf(step);
    setStep(steps[Math.min(i + 1, steps.length - 1)]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goBack = () => {
    const i = steps.indexOf(step);
    setStep(steps[Math.max(i - 1, 0)]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Persist / refresh the draft row so a team can resume later.
  const saveDraft = useCallback(async () => {
    if (!user || !event || !category) return null;
    const payload = {
      event_id: event.id,
      category_id: category.id,
      created_by: user.id,
      team_name: team.name || null,
      institution_name: institution.name || null,
      institution_type: institution.type || null,
      institution_town: institution.town || null,
      institution_region: institution.region || null,
      institution_address: institution.address || null,
      fee_tier_id: activeTier?.id ?? null,
      fee_tier_label: activeTier?.label ?? null,
      fee_amount: activeTier ? Number(activeTier.amount) : 0,
      currency,
      notes: team.notes || null,
      current_step: step,
    };
    if (registrationId) {
      const { error } = await supabase.from("team_registrations").update(payload).eq("id", registrationId);
      if (error) { toast.error(error.message); return null; }
      return registrationId;
    }
    const { data, error } = await supabase.from("team_registrations").insert(payload).select("id").maybeSingle();
    if (error) { toast.error(error.message); return null; }
    setRegistrationId(data?.id ?? null);
    return data?.id ?? null;
  }, [user, event, category, team, institution, activeTier, currency, step, registrationId]);

  const validateStep = (): string | null => {
    if (step === 2 && !category) return "Choose a category to continue.";
    if (step === 3 && category?.requires_institution && !institution.name.trim())
      return `Enter the ${category.institution_label?.toLowerCase() ?? "institution"} name.`;
    if (step === 4 && !team.name.trim()) return "Give your team a name.";
    if (step === 5) {
      const filled = members.filter((m) => m.full_name.trim());
      if (filled.length < min) return `This category needs at least ${min} participants.`;
      if (filled.length > max) return `Maximum ${max} participants for this category.`;
      if (!filled[0]?.email.trim()) return "The team leader needs an email address.";
      if (category?.requires_class_level && filled.some((m) => !m.class_level.trim()))
        return "Enter the class / level for every participant.";
    }
    if (step === 6 && needsMentor) {
      if (!mentor.full_name.trim()) return "Enter the teacher mentor's name.";
      if (!mentor.phone.trim() && !mentor.email.trim()) return "Add a phone number or email for the mentor.";
    }
    if (step === 7) {
      const free = !activeTier || Number(activeTier.amount) === 0;
      if (!free && payment.method !== "cash" && payment.method !== "waiver" && !payment.transaction_reference.trim())
        return "Enter the payment transaction reference.";
      if (payment.proof_url.trim() && !isHttpUrl(payment.proof_url))
        return "Payment proof link must start with http:// or https://.";
    }
    if (step === 8 && !declaration) return "Accept the declaration to submit.";
    return null;
  };

  const handleNext = async () => {
    const err = validateStep();
    if (err) return toast.error(err);
    setSaving(true);
    if (step >= 2 && step <= 7) await saveDraft();
    setSaving(false);
    goNext();
  };

  const handleSubmit = async () => {
    const err = validateStep();
    if (err) return toast.error(err);
    if (!user || !event || !category) return;
    setSaving(true);
    const id = await saveDraft();
    if (!id) { setSaving(false); return; }

    const filled = members.filter((m) => m.full_name.trim());
    await supabase.from("registration_participants").delete().eq("registration_id", id);
    const rows = [
      ...filled.map((m, i) => ({
        registration_id: id,
        full_name: m.full_name.trim(),
        role: (i === 0 ? "leader" : "member") as "leader" | "member",
        email: m.email.trim() || null,
        phone: m.phone.trim() || null,
        gender: m.gender || null,
        date_of_birth: m.date_of_birth || null,
        class_level: m.class_level.trim() || null,
        department: m.department.trim() || null,
        is_leader: i === 0,
        sort_order: i,
      })),
      ...(needsMentor && mentor.full_name.trim()
        ? [{
            registration_id: id,
            full_name: mentor.full_name.trim(),
            role: "teacher_mentor" as const,
            email: mentor.email.trim() || null,
            phone: mentor.phone.trim() || null,
            gender: mentor.gender || null,
            department: mentor.department.trim() || null,
            is_leader: false,
            sort_order: 99,
          }]
        : []),
    ];
    const { error: pErr } = await supabase.from("registration_participants").insert(rows);
    if (pErr) { setSaving(false); return toast.error(pErr.message); }

    const amount = activeTier ? Number(activeTier.amount) : 0;
    const free = amount === 0 || payment.method === "waiver";
    await supabase.from("registration_payments").insert({
      registration_id: id,
      method: payment.method,
      transaction_reference: payment.transaction_reference.trim() || null,
      amount,
      currency,
      payer_name: payment.payer_name.trim() || null,
      payer_phone: payment.payer_phone.trim() || null,
      proof_url: safeHref(payment.proof_url) ?? null,
      status: free ? "pending" : "pending",
    });

    const nextStatus = free || payment.method === "cash"
      ? ("payment_pending" as const)
      : ("payment_verification" as const);

    const { data: updated, error } = await supabase
      .from("team_registrations")
      .update({ status: nextStatus, declaration_accepted: true, current_step: 9 })
      .eq("id", id)
      .select("team_code, reference")
      .maybeSingle();
    setSaving(false);
    if (error) return toast.error(error.message);
    setResult({ team_code: updated?.team_code ?? null, reference: updated?.reference ?? null });
    setStep(9);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.success("Registration submitted!");
    sendRegistrationEmail(id).then((ok) => ok && toast.info("Confirmation email sent to your inbox"));
  };

  if (authLoading || loading) {
    return (
      <main className="pt-24 pb-20">
        <div className="container mx-auto flex justify-center px-4 py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="pt-24 pb-20">
        <SEO title="Register a team" description="Sign in to register your team for a TechBridge competition." noIndex />
        <div className="container mx-auto max-w-lg px-4">
          <Card>
            <CardContent className="space-y-4 p-6 text-center">
              <h1 className="font-heading text-2xl font-bold">Sign in to register</h1>
              <p className="text-sm text-muted-foreground">
                Team registrations are tied to an account so you can track your status, payment and corrections.
              </p>
              <Button asChild className="w-full bg-gradient-primary text-primary-foreground">
                <Link to={`/auth?redirect=${encodeURIComponent(window.location.pathname)}`}>Sign in / Create account</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const open = event ? isRegistrationOpen(event, category) : true;
  const stepIndex = steps.indexOf(step);

  const person = (p: PersonDraft, set: (patch: Partial<PersonDraft>) => void, opts?: { leader?: boolean }) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label className="text-xs">Full name *</Label>
        <Input value={p.full_name} onChange={(e) => set({ full_name: e.target.value })} />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Email {opts?.leader ? "*" : ""}</Label>
        <Input type="email" value={p.email} onChange={(e) => set({ email: e.target.value })} />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Phone</Label>
        <Input value={p.phone} onChange={(e) => set({ phone: e.target.value })} />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Gender</Label>
        <Select value={p.gender || undefined} onValueChange={(v) => set({ gender: v })}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="other">Prefer not to say</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Date of birth</Label>
        <Input type="date" value={p.date_of_birth} onChange={(e) => set({ date_of_birth: e.target.value })} />
      </div>
      {category?.requires_class_level ? (
        <div className="grid gap-1.5">
          <Label className="text-xs">Class / level *</Label>
          <Input placeholder="e.g. Form 5" value={p.class_level} onChange={(e) => set({ class_level: e.target.value })} />
        </div>
      ) : (
        <div className="grid gap-1.5">
          <Label className="text-xs">Department / faculty</Label>
          <Input value={p.department} onChange={(e) => set({ department: e.target.value })} />
        </div>
      )}
    </div>
  );

  return (
    <main className="pt-20 pb-20">
      <SEO
        title={event ? `Register — ${event.title}` : "Register a team"}
        description="Complete your team registration in a few guided steps."
        noIndex
      />

      <section className="bg-gradient-hero dark py-10 sm:py-14">
        <div className="container mx-auto px-4">
          <span className="mb-3 inline-block rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary">
            Team registration
          </span>
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl md:text-4xl">
            {event?.title ?? "Choose an event"}
          </h1>
          {category && (
            <p className="mt-2 text-sm text-muted-foreground">
              {category.name}
              {category.competition_date && ` · ${new Date(category.competition_date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
            </p>
          )}
        </div>
      </section>

      <div className="container mx-auto max-w-3xl px-4">
        {/* Progress rail */}
        <div className="sticky top-16 z-10 -mx-4 mb-6 overflow-x-auto border-b bg-background/95 px-4 py-3 backdrop-blur">
          <div className="sm:hidden">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{STEP_TITLES[steps[stepIndex] - 1]}</span>
              <span className="text-muted-foreground">Step {stepIndex + 1} of {steps.length}</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
            </div>
          </div>
          <ol className="hidden min-w-max items-center gap-1.5 text-xs sm:flex">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-1.5">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors ${
                    i < stepIndex
                      ? "border-primary bg-primary text-primary-foreground"
                      : i === stepIndex
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {i < stepIndex ? <Check size={12} /> : i + 1}
                </span>
                <span className={i === stepIndex ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {STEP_TITLES[s - 1]}
                </span>
                {i < steps.length - 1 && <span className="mx-1 h-px w-4 bg-border" />}
              </li>
            ))}
          </ol>
        </div>

        <Card className="shadow-card">
          <CardContent className="space-y-5 p-5 sm:p-6">
            {/* 1 — Event */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="font-heading text-lg font-semibold">Select an event</h2>
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open events right now.</p>
                ) : (
                  <div className="grid gap-3">
                    {events.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => navigate(`/events/${e.slug}/register`)}
                        className="rounded-lg border p-4 text-left transition-all hover:border-primary hover:bg-muted/40"
                      >
                        <p className="font-medium">{e.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.start_date ? new Date(e.start_date).toLocaleDateString() : "Dates to be announced"}
                          {e.location ? ` · ${e.location}` : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2 — Category */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-heading text-lg font-semibold">Select your category</h2>
                {!open && (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                    Registration for this event is currently closed.
                  </p>
                )}
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This event has no team categories. <Link to={`/events/${slug}`} className="text-primary hover:underline">Back to event</Link>
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {categories.map((c) => {
                      const ct = tiers.filter((t) => t.category_id === c.id);
                      const at = resolveFeeTier(ct);
                      const selected = categoryId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCategoryId(c.id)}
                          className={`rounded-lg border p-4 text-left transition-all ${selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/60 hover:bg-muted/40"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{c.name}</p>
                              {c.description && <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>}
                            </div>
                            {selected && <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            {c.competition_date && (
                              <Badge variant="outline">
                                {new Date(c.competition_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                              </Badge>
                            )}
                            <Badge variant="outline" className="gap-1"><Users size={11} /> {c.min_team_size}–{c.max_team_size} members</Badge>
                            {at && <Badge>{at.label}: {formatMoney(Number(at.amount), at.currency)}</Badge>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 3 — Institution */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="font-heading text-lg font-semibold">{category?.institution_label ?? "Institution"} information</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label className="text-xs">{category?.institution_label ?? "Institution"} name {category?.requires_institution ? "*" : ""}</Label>
                    <Input value={institution.name} onChange={(e) => setInstitution({ ...institution, name: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Type</Label>
                    <Input placeholder="Public / private / faith-based" value={institution.type} onChange={(e) => setInstitution({ ...institution, type: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Town / city</Label>
                    <Input value={institution.town} onChange={(e) => setInstitution({ ...institution, town: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Region</Label>
                    <Input value={institution.region} onChange={(e) => setInstitution({ ...institution, region: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Address</Label>
                    <Input value={institution.address} onChange={(e) => setInstitution({ ...institution, address: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            {/* 4 — Team */}
            {step === 4 && (
              <div className="space-y-4">
                <h2 className="font-heading text-lg font-semibold">Team information</h2>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Team name *</Label>
                  <Input value={team.name} onChange={(e) => setTeam({ ...team, name: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Anything we should know? (optional)</Label>
                  <Textarea rows={3} value={team.notes} onChange={(e) => setTeam({ ...team, notes: e.target.value })} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Teams in this category must have between {min} and {max} participants.
                </p>
              </div>
            )}

            {/* 5 — Participants */}
            {step === 5 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-lg font-semibold">Participants</h2>
                  <Button type="button" size="sm" variant="outline" className="gap-1"
                    disabled={members.length >= max}
                    onClick={() => setMembers((m) => [...m, blankPerson()])}>
                    <Plus size={14} /> Add member
                  </Button>
                </div>
                {members.map((m, i) => (
                  <div key={i} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={i === 0 ? "default" : "secondary"}>{i === 0 ? "Team leader" : `Member ${i + 1}`}</Badge>
                      {i >= min && (
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                          aria-label={`Remove member ${i + 1}`}
                          onClick={() => setMembers((arr) => arr.filter((_, idx) => idx !== i))}>
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                    {person(m, (patch) => setMembers((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it))), { leader: i === 0 })}
                  </div>
                ))}
              </div>
            )}

            {/* 6 — Mentor */}
            {step === 6 && needsMentor && (
              <div className="space-y-4">
                <h2 className="font-heading text-lg font-semibold">Teacher mentor</h2>
                <p className="text-xs text-muted-foreground">
                  A supervising teacher is required for this category. They will receive event communications alongside the team leader.
                </p>
                <div className="rounded-lg border p-4">
                  {person(mentor, (patch) => setMentor({ ...mentor, ...patch }))}
                </div>
              </div>
            )}

            {/* 7 — Payment */}
            {step === 7 && (
              <div className="space-y-4">
                <h2 className="font-heading text-lg font-semibold">Payment</h2>
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Applicable fee tier</span>
                    <span className="font-medium">{activeTier?.label ?? "Free entry"}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-muted-foreground">Amount due</span>
                    <span className="font-heading text-lg font-bold">{formatMoney(activeTier ? Number(activeTier.amount) : 0, currency)}</span>
                  </div>
                  {categoryTiers.length > 1 && (
                    <ul className="mt-3 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                      {categoryTiers.map((t) => (
                        <li key={t.id} className="flex justify-between">
                          <span>{t.label}{t.closes_at ? ` — until ${new Date(t.closes_at).toLocaleDateString()}` : ""}</span>
                          <span>{formatMoney(Number(t.amount), t.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {Array.isArray((event as any)?.payment_instructions) && (event as any).payment_instructions.length > 0 ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
                    <p className="font-medium">Send your fee to one of these accounts</p>
                    <ul className="mt-2 space-y-2">
                      {((event as any).payment_instructions as any[]).map((p, i) => (
                        <li key={i} className="rounded-md border bg-card p-3">
                          <div className="font-medium">{p.method}</div>
                          {p.account_name && <div className="text-muted-foreground">Account name: <span className="text-foreground">{p.account_name}</span></div>}
                          {p.account_number && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              Number: <span className="font-mono text-foreground">{p.account_number}</span>
                              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Copy ${p.method} number`}
                                onClick={() => { navigator.clipboard?.writeText(p.account_number); toast.success("Copied"); }}>
                                <Copy size={14} />
                              </Button>
                            </div>
                          )}
                          {p.note && <div className="mt-1 text-xs text-muted-foreground">{p.note}</div>}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">After paying, enter the transaction details below.</p>
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                    Payment account details will be shared by the organisers{(event as any)?.contact_email ? ` — contact ${(event as any).contact_email}` : ""}.
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Payment method</Label>
                    <Select value={payment.method} onValueChange={(v) => setPayment({ ...payment, method: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Transaction reference</Label>
                    <Input value={payment.transaction_reference} onChange={(e) => setPayment({ ...payment, transaction_reference: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Payer name</Label>
                    <Input value={payment.payer_name} onChange={(e) => setPayment({ ...payment, payer_name: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Payer phone</Label>
                    <Input value={payment.payer_phone} onChange={(e) => setPayment({ ...payment, payer_phone: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label className="text-xs">Link to payment proof (optional)</Label>
                    <Input placeholder="https://…" value={payment.proof_url} onChange={(e) => setPayment({ ...payment, proof_url: e.target.value })} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Organisers verify every payment manually. Your registration moves to <strong>Approved</strong> once verified.
                </p>
              </div>
            )}

            {/* 8 — Review */}
            {step === 8 && (
              <div className="space-y-4">
                <h2 className="font-heading text-lg font-semibold">Review & declaration</h2>
                <dl className="divide-y rounded-lg border text-sm">
                  {[
                    ["Event", event?.title],
                    ["Category", category?.name],
                    [category?.institution_label ?? "Institution", institution.name || "—"],
                    ["Team", team.name],
                    ["Participants", members.filter((m) => m.full_name.trim()).map((m) => m.full_name).join(", ")],
                    ...(needsMentor ? [["Teacher mentor", mentor.full_name] as const] : []),
                    ["Fee", `${activeTier?.label ?? "Free"} — ${formatMoney(activeTier ? Number(activeTier.amount) : 0, currency)}`],
                    ["Payment", PAYMENT_METHODS.find((m) => m.value === payment.method)?.label ?? payment.method],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:justify-between">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium sm:max-w-[60%] sm:text-right">{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
                <label className="flex items-start gap-3 rounded-lg border p-4 text-sm">
                  <Checkbox checked={declaration} onCheckedChange={(v) => setDeclaration(Boolean(v))} className="mt-0.5" />
                  <span>
                    I confirm that the information provided is accurate, that all listed participants are eligible for this
                    category, and that our team accepts the event rules, code of conduct and the organisers' decisions.
                  </span>
                </label>
              </div>
            )}

            {/* 9 — Confirmation */}
            {step === 9 && (
              <div className="space-y-5 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h2 className="font-heading text-xl font-bold">Registration submitted</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Keep your Team ID and reference — organisers use them for all follow-up.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[["Team ID", result?.team_code], ["Reference", result?.reference]].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg border bg-muted/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className="mt-1 font-heading text-lg font-bold tracking-wider">{value ?? "—"}</p>
                      {value && (
                        <Button size="sm" variant="ghost" className="mt-1 h-7 gap-1 text-xs"
                          onClick={() => { navigator.clipboard.writeText(String(value)); toast.success("Copied"); }}>
                          <Copy size={12} /> Copy
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <ol className="space-y-2 rounded-lg border p-4 text-left text-sm">
                  <p className="font-medium">Path to approval</p>
                  {["Registration received — confirmation email sent", "Organisers verify your payment", "Team approved — email + Team Portal update", "Submit your project when submissions open"].map((t, i) => (
                    <li key={i} className="flex gap-2 text-muted-foreground"><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${i === 0 ? "bg-primary text-primary-foreground" : "border"}`}>{i === 0 ? <Check size={11} /> : i + 1}</span>{t}</li>
                  ))}
                </ol>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <Button type="button" variant="outline" onClick={() => {
                    // Teachers: register another team from the same school, keeping school + mentor details.
                    setRegistrationId(null); setResult(null); setTeam({ name: "", notes: "" });
                    setMembers([blankPerson(), blankPerson(), blankPerson()]); setDeclaration(false);
                    setPayment({ method: "mobile_money", transaction_reference: "", payer_name: payment.payer_name, payer_phone: payment.payer_phone, proof_url: "" });
                    setStep(4); window.scrollTo({ top: 0, behavior: "smooth" });
                  }}>
                    <Plus size={16} /> Register another team from this school
                  </Button>
                  <Button asChild className="bg-gradient-primary text-primary-foreground">
                    <Link to="/team-portal">Track my registration</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to={`/events/${event?.slug ?? ""}`}>Back to event page</Link>
                  </Button>
                </div>
              </div>
            )}

            {/* Navigation */}
            {step !== 9 && (
              <div className="flex items-center justify-between border-t pt-4">
                <Button type="button" variant="ghost" className="gap-1" onClick={goBack} disabled={stepIndex === 0}>
                  <ChevronLeft size={16} /> Back
                </Button>
                {step === 8 ? (
                  <Button type="button" className="gap-1 bg-gradient-primary text-primary-foreground" onClick={handleSubmit} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check size={16} />} Submit registration
                  </Button>
                ) : (
                  <Button type="button" className="gap-1" onClick={handleNext} disabled={saving || (step === 2 && !open)}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Continue <ChevronRight size={16} />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default EventRegister;
