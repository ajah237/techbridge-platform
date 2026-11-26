import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, MapPin, Users, Wifi, DollarSign, ArrowLeft, Clock, Tag, CalendarPlus, Trophy, Gavel, Handshake, ListChecks, Sparkles, ScrollText, HelpCircle, Mail, Phone, Building2, Ticket } from "lucide-react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import SocialShare from "@/components/SocialShare";
import EventTeams from "@/components/EventTeams";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { buildIcs, downloadIcs } from "@/lib/ics";
import type { Tables } from "@/integrations/supabase/types";
import { QRCodeSVG } from "qrcode.react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { formatMoney, resolveFeeTier, isRegistrationOpen, type EventCategory, type FeeTier } from "@/lib/registration";
import { buildMilestones, eventMode, EVENT_MODE_LABEL } from "@/lib/eventTimeline";
import KeyDatesTimeline from "@/components/KeyDatesTimeline";
import { safeHref } from "@/lib/utils";

type Event = Tables<"events">;
type Program = Tables<"event_programs">;

const EventDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [regStatus, setRegStatus] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [registeredProgramId, setRegisteredProgramId] = useState<string | null>(null);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [tiersByCategory, setTiersByCategory] = useState<Record<string, FeeTier[]>>({});

  useEffect(() => {
    const fetchEvent = async () => {
      if (!slug) return;
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("slug", slug)
        .in("status", ["published", "ongoing", "completed"])
        .maybeSingle();
      setEvent(data);
      setLoading(false);

      if (data) {
        const { count } = await supabase
          .from("event_registrations")
          .select("*", { count: "exact", head: true })
          .eq("event_id", data.id);
        setParticipantCount(count ?? 0);

        const { data: progs } = await supabase
          .from("event_programs")
          .select("*")
          .eq("event_id", data.id)
          .order("sort_order", { ascending: true });
        setPrograms(progs ?? []);

        const { data: cats } = await supabase
          .from("event_categories")
          .select("*")
          .eq("event_id", data.id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true });
        setCategories(cats ?? []);

        if (cats?.length) {
          const { data: tiers } = await supabase
            .from("category_fee_tiers")
            .select("*")
            .in("category_id", cats.map((c) => c.id))
            .order("sort_order", { ascending: true });
          const grouped: Record<string, FeeTier[]> = {};
          (tiers ?? []).forEach((t) => {
            grouped[t.category_id] = [...(grouped[t.category_id] ?? []), t];
          });
          setTiersByCategory(grouped);
        }
      }
    };
    fetchEvent();
  }, [slug]);

  useEffect(() => {
    if (!user || !event) return;
    const check = async () => {
      const { data } = await supabase
        .from("event_registrations")
        .select("id, participant_id, status, program_id")
        .eq("event_id", event.id)
        .eq("user_id", user.id)
        .maybeSingle();
      setIsRegistered(!!data);
      setParticipantId((data as any)?.participant_id ?? null);
      setRegStatus((data as any)?.status ?? null);
      setRegisteredProgramId((data as any)?.program_id ?? null);
    };
    check();
  }, [user, event]);

  const handleRegister = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!event) return;
    if (programs.length > 0 && !selectedProgramId) {
      toast.error("Please select a program first.");
      return;
    }
    setRegistering(true);
    const { data: inserted, error } = await supabase
      .from("event_registrations")
      .insert({
        event_id: event.id,
        user_id: user.id,
        program_id: selectedProgramId || null,
      })
      .select("participant_id, status")
      .maybeSingle();
    if (error) {
      toast.error(error.message.includes("duplicate") ? "You're already registered!" : error.message);
    } else {
      const pid = (inserted as any)?.participant_id ?? null;
      const st = (inserted as any)?.status ?? "registered";
      setParticipantId(pid);
      setRegStatus(st);
      setRegisteredProgramId(selectedProgramId || null);
      if (st === "waitlisted") {
        toast.success("Event is full — you've been added to the waitlist. We'll notify you if a spot opens.");
      } else {
        toast.success(pid ? `Registered! Participant ID: ${String(pid).slice(0,8).toUpperCase()}` : "Successfully registered!");
      }
      setIsRegistered(true);
      setParticipantCount((c) => c + 1);

      supabase.from("notifications").insert({
        user_id: user.id,
        title: "Event Registration Confirmed",
        message: `You've successfully registered for ${event.title}.`,
        type: "event_registration",
        link: "/dashboard",
      });

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile?.email) {
        supabase.functions.invoke("send-notification", {
          body: {
            type: "event_registration",
            recipientEmail: profile.email,
            recipientName: profile.full_name || "Participant",
            data: {
              eventTitle: event.title,
              eventDate: event.start_date
                ? new Date(event.start_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                : undefined,
              eventLocation: event.location,
              participantId: pid ? String(pid).toUpperCase() : undefined,
              isVirtual: event.is_virtual ?? false,
              eventUrl: typeof window !== "undefined" ? window.location.href : undefined,
            },
          },
        });
      }
    }
    setRegistering(false);
  };

  const handleAddToCalendar = () => {
    if (!event) return;
    const ics = buildIcs({
      uid: event.id,
      title: event.title,
      description: event.description || "",
      location: event.is_virtual ? "Virtual" : event.location,
      startDate: event.start_date,
      endDate: event.end_date,
      url: typeof window !== "undefined" ? window.location.href : undefined,
    });
    downloadIcs(`${event.slug || "event"}.ics`, ics);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (loading) {
    return (
      <main className="pt-20">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-12 w-full mb-6" />
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-40 w-full" />
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="pt-20">
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-heading font-bold text-foreground mb-4">Event Not Found</h1>
          <p className="text-muted-foreground mb-6">The event you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate("/events")} variant="outline">
            <ArrowLeft size={16} /> Back to Events
          </Button>
        </div>
      </main>
    );
  }

  const spotsLeft = event.max_participants ? event.max_participants - participantCount : null;
  const isFull = spotsLeft !== null && spotsLeft <= 0;
  const registrationOpen = isRegistrationOpen(event as any);
  const canRegister = !isRegistered && registrationOpen && ["published", "ongoing"].includes(event.status);
  const rules = Array.isArray((event as any).rules) ? ((event as any).rules as string[]) : [];
  const timeline = Array.isArray((event as any).timeline)
    ? ((event as any).timeline as Array<{ date?: string; title?: string }>)
    : [];
  const faqs = Array.isArray((event as any).faqs)
    ? ((event as any).faqs as Array<{ question?: string; answer?: string }>)
    : [];

  const siteUrl = "https://techbridgehub.lovable.app";
  const eventNode = {
    "@type": "Event",
    name: event.title,
    description: event.description?.replace(/<[^>]*>/g, "").slice(0, 200) || "",
    startDate: event.start_date || undefined,
    endDate: event.end_date || undefined,
    location: event.is_virtual
      ? { "@type": "VirtualLocation", url: window.location.href }
      : event.location ? { "@type": "Place", name: event.location } : undefined,
    image: event.image_url || undefined,
    eventAttendanceMode: `https://schema.org/${eventMode(event) === "online" ? "Online" : eventMode(event) === "hybrid" ? "Mixed" : "Offline"}EventAttendanceMode`,
    organizer: { "@type": "Organization", name: "TechBridge", url: siteUrl },
  };
  const breadcrumbNode = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Events", item: `${siteUrl}/events` },
      { "@type": "ListItem", position: 3, name: event.title, item: `${siteUrl}/events/${event.slug}` },
    ],
  };
  const eventJsonLd = { "@context": "https://schema.org", "@graph": [eventNode, breadcrumbNode] };

  return (
    <main className="pt-20">
      <SEO
        title={event.title}
        description={event.description?.replace(/<[^>]*>/g, "").slice(0, 160) || `${event.title} - TechBridge Event`}
        image={
          (event as any).og_image_url ||
          event.image_url ||
          `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/og-event?slug=${encodeURIComponent(event.slug)}`
        }
        type="article"
        jsonLd={eventJsonLd}
      />
      {/* Hero */}
      <section className="py-16 bg-gradient-hero dark">
        <div className="container mx-auto px-4 max-w-4xl">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground mb-6 -ml-2"
            onClick={() => navigate("/events")}
          >
            <ArrowLeft size={16} /> All Events
          </Button>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${typeColor(event.event_type)}`}>
              {event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}
            </span>
            <Badge variant={event.status === "ongoing" ? "default" : "secondary"}>
              {event.status}
            </Badge>
          </div>
          <h1 className="text-3xl md:text-5xl font-heading font-bold text-foreground leading-tight">
            {event.title}
          </h1>
          {(event as any).theme && (
            <p className="mt-3 text-base sm:text-lg text-primary font-medium flex items-center gap-2">
              <Sparkles size={18} /> {(event as any).theme}
            </p>
          )}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-muted-foreground">
            {event.start_date && (
              <span className="flex items-center gap-2">
                <Calendar size={18} /> {formatDate(event.start_date)}
                {event.end_date && ` – ${formatDate(event.end_date)}`}
              </span>
            )}
            {eventMode(event) !== "online" && ((event as any).venue || event.location) && (
              <span className="flex items-center gap-2">
                <Building2 size={18} /> {(event as any).venue || event.location}
              </span>
            )}
            <Badge variant="outline" className="w-fit"><Wifi size={14} className="mr-1" /> {EVENT_MODE_LABEL[eventMode(event)]}</Badge>
          </div>
          {categories.length > 0 && registrationOpen && (
            <Button
              className="mt-6 bg-gradient-primary text-primary-foreground hover:opacity-90"
              onClick={() => navigate(`/events/${event.slug}/register`)}
            >
              <Ticket size={16} className="mr-2" /> Register Now
            </Button>
          )}
        </div>
      </section>

      {/* Content */}
      <section className="py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Main content */}
            <div className="md:col-span-2 space-y-8">
              {event.image_url && (
                <img
                  src={event.image_url}
                  alt={event.title}
                  className="w-full rounded-xl object-cover max-h-96"
                  loading="lazy"
                />
              )}

              <div>
                <h2 className="text-xl font-heading font-semibold text-foreground mb-3">About This Event</h2>
                <article
                  className="prose prose-sm sm:prose lg:prose-lg max-w-none text-muted-foreground prose-headings:font-heading prose-headings:text-foreground prose-p:text-muted-foreground prose-p:leading-relaxed prose-a:text-primary prose-strong:text-foreground prose-li:text-muted-foreground prose-blockquote:border-primary/30"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(event.description || "<p>No description provided.</p>") }}
                />
              </div>

              {categories.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Event at a glance">
                  {[
                    { label: "Dates", value: event.start_date ? `${new Date(event.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}${event.end_date ? ` – ${new Date(event.end_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}` : "TBA" },
                    { label: "Venue", value: (event as any).venue || event.location || EVENT_MODE_LABEL[eventMode(event)] },
                    { label: "Team size", value: `${Math.min(...categories.map((c) => c.min_team_size))}–${Math.max(...categories.map((c) => c.max_team_size))} members` },
                    { label: "Fee from", value: (() => { const all = Object.values(tiersByCategory).flat().map((t) => Number(t.amount)); return all.length ? formatMoney(Math.min(...all), categories[0].currency) : "Free"; })() },
                  ].map((f) => (
                    <div key={f.label} className="rounded-xl border border-border bg-card p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{f.label}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{f.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {categories.length > 0 && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
                  <h2 className="text-lg font-heading font-semibold text-foreground mb-3">How registration works</h2>
                  <ol className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    {[
                      "Teacher or team leader creates an account and registers the team",
                      "Add the school, 3–5 students and the supervising teacher",
                      "Pay the current fee tier and enter the transaction reference",
                      "Organisers verify payment and approve — you get an email at each step",
                    ].map((t, i) => (
                      <li key={i} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{i + 1}</span>{t}</li>
                    ))}
                  </ol>
                  <p className="mt-3 text-xs text-muted-foreground">Teachers can register several teams from one account — each team gets its own Team ID.</p>
                </div>
              )}

              {buildMilestones(event, categories as any).length > 0 && (
                <div id="key-dates">
                  <h2 className="text-xl font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Clock size={20} className="text-primary" /> Key dates
                  </h2>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <KeyDatesTimeline items={buildMilestones(event, categories as any)} />
                  </div>
                </div>
              )}

              {(event as any).overview && (
                <div>
                  <h2 className="text-xl font-heading font-semibold text-foreground mb-3">Overview</h2>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-line">
                    {(event as any).overview}
                  </p>
                </div>
              )}

              {categories.length > 0 && (
                <div>
                  <h2 className="text-xl font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Ticket size={18} className="text-primary" /> Categories &amp; Registration Fees
                  </h2>
                  <div className="grid gap-4">
                    {categories.map((c) => {
                      const tiers = tiersByCategory[c.id] ?? [];
                      const current = resolveFeeTier(tiers);
                      return (
                        <div key={c.id} className="rounded-xl border border-border bg-card p-5">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h3 className="font-heading font-semibold text-foreground">{c.name}</h3>
                              {c.competition_date && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {formatDate(c.competition_date)}
                                </p>
                              )}
                            </div>
                            <Badge variant="outline">
                              Teams of {c.min_team_size}–{c.max_team_size}
                            </Badge>
                          </div>
                          {c.description && (
                            <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
                          )}
                          {c.eligibility && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Eligibility: </span>{c.eligibility}
                            </p>
                          )}
                          {tiers.length > 0 && (
                            <div className="mt-4 grid sm:grid-cols-3 gap-2">
                              {tiers.map((t) => (
                                <div
                                  key={t.id}
                                  className={`rounded-lg border p-3 ${
                                    current?.id === t.id ? "border-primary bg-primary/5" : "border-border"
                                  }`}
                                >
                                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.label}</p>
                                  <p className="text-sm font-semibold text-foreground">
                                    {formatMoney(Number(t.amount), t.currency)}
                                  </p>
                                  {current?.id === t.id && (
                                    <p className="text-[11px] text-primary mt-0.5">Current rate</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {c.registration_deadline && (
                            <p className="mt-3 text-xs text-muted-foreground">
                              Registration closes {formatDate(c.registration_deadline)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {rules.length > 0 && (
                <div>
                  <h2 className="text-xl font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                    <ScrollText size={18} className="text-primary" /> Rules
                  </h2>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {rules.map((r, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {timeline.length > 0 && (
                <div>
                  <h2 className="text-xl font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Clock size={18} className="text-primary" /> Timeline
                  </h2>
                  <ol className="space-y-3 border-l border-border pl-4">
                    {timeline.map((t, i) => (
                      <li key={i} className="relative">
                        <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-primary" />
                        <p className="text-sm font-medium text-foreground">{t.title}</p>
                        {t.date && <p className="text-xs text-muted-foreground">{t.date}</p>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}



              {/* Schedule */}
              {event.start_date && (
                <div>
                  <h2 className="text-xl font-heading font-semibold text-foreground mb-3">Schedule</h2>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                      <Clock size={18} className="text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Starts</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(event.start_date)} at {formatTime(event.start_date)}
                        </p>
                      </div>
                    </div>
                    {event.end_date && (
                      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                        <Clock size={18} className="text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-foreground">Ends</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(event.end_date)} at {formatTime(event.end_date)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {event.tags && event.tags.length > 0 && (
                <div>
                  <h2 className="text-xl font-heading font-semibold text-foreground mb-3">Tags</h2>
                  <div className="flex flex-wrap gap-2">
                    {event.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="gap-1">
                        <Tag size={12} /> {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray((event as any).schedule) && (event as any).schedule.length > 0 && (
                <div>
                  <h2 className="text-xl font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                    <ListChecks size={18} className="text-primary" /> Full Schedule
                  </h2>
                  <ol className="space-y-2 border-l border-border pl-4">
                    {((event as any).schedule as Array<{time?: string; title?: string; description?: string}>).map((s, i) => (
                      <li key={i} className="relative">
                        <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-primary" />
                        <p className="text-sm font-medium text-foreground">{s.time}{s.time && s.title ? " — " : ""}{s.title}</p>
                        {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {Array.isArray((event as any).prizes) && (event as any).prizes.length > 0 && (
                <div>
                  <h2 className="text-xl font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Trophy size={18} className="text-primary" /> Prizes
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {((event as any).prizes as Array<{place?: string; title?: string; value?: string}>).map((p, i) => (
                      <div key={i} className="rounded-lg border border-border bg-card p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.place || `Prize ${i + 1}`}</p>
                        <p className="font-semibold text-foreground">{p.title}</p>
                        {p.value && <p className="text-sm text-primary mt-1">{p.value}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray((event as any).judges) && (event as any).judges.length > 0 && (
                <div>
                  <h2 className="text-xl font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Gavel size={18} className="text-primary" /> Judges
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {((event as any).judges as Array<{name?: string; title?: string; role?: string; bio?: string; photo?: string; avatar_url?: string}>).map((j, i) => {
                      const photo = j.avatar_url || j.photo;
                      const roleTitle = j.role || j.title;
                      return (
                        <div key={i} className="flex gap-3 rounded-lg border border-border bg-card p-4">
                          {photo && <img src={photo} alt={j.name || "Judge"} loading="lazy" className="w-12 h-12 rounded-full object-cover shrink-0" />}
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{j.name}</p>
                            {roleTitle && <p className="text-xs text-muted-foreground">{roleTitle}</p>}
                            {j.bio && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{j.bio}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {Array.isArray((event as any).sponsors) && (event as any).sponsors.length > 0 && (
                <div>
                  <h2 className="text-xl font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Handshake size={18} className="text-primary" /> Sponsors
                  </h2>
                  <div className="flex flex-wrap gap-4 items-center">
                    {((event as any).sponsors as Array<{name?: string; logo?: string; logo_url?: string; url?: string}>).map((s, i) => {
                      const logo = s.logo_url || s.logo;
                      const safeUrl = safeHref(s.url);
                      const inner = logo
                        ? <img src={logo} alt={s.name || "Sponsor"} loading="lazy" className="h-12 max-w-[160px] object-contain" />
                        : <span className="text-sm font-medium text-foreground">{s.name}</span>;
                      return safeUrl ? (
                        <a key={i} href={safeUrl} target="_blank" rel="noopener noreferrer" className="opacity-80 hover:opacity-100 transition">{inner}</a>
                      ) : (
                        <div key={i}>{inner}</div>
                      );
                    })}
                  </div>
                </div>
              )}

              {faqs.length > 0 && (
                <div>
                  <h2 className="text-xl font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                    <HelpCircle size={18} className="text-primary" /> Frequently Asked Questions
                  </h2>
                  <Accordion type="single" collapsible className="w-full">
                    {faqs.map((f, i) => (
                      <AccordionItem key={i} value={`faq-${i}`}>
                        <AccordionTrigger className="text-left text-sm">{f.question}</AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground">{f.answer}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}

              {((event as any).contact_email || (event as any).contact_phone) && (
                <div>
                  <h2 className="text-xl font-heading font-semibold text-foreground mb-3">Contact the organisers</h2>
                  <div className="flex flex-col sm:flex-row gap-3 text-sm">
                    {(event as any).contact_email && (
                      <a href={`mailto:${(event as any).contact_email}`} className="flex items-center gap-2 text-primary hover:underline">
                        <Mail size={16} /> {(event as any).contact_email}
                      </a>
                    )}
                    {(event as any).contact_phone && (
                      <a href={`tel:${(event as any).contact_phone}`} className="flex items-center gap-2 text-primary hover:underline">
                        <Phone size={16} /> {(event as any).contact_phone}
                      </a>
                    )}
                  </div>
                </div>
              )}


              <div className="mt-6 pt-6 border-t border-border">
                <SocialShare title={event.title} description={event.description?.replace(/<[^>]*>/g, "").slice(0, 100) || undefined} />
              </div>

              {event.event_type === "hackathon" && (
                <div className="mt-6 pt-6 border-t border-border">
                  <EventTeams eventId={event.id} />
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-6 space-y-4 sticky top-24">
                <div className="space-y-3 text-sm">
                  {event.location && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin size={16} className="text-primary shrink-0" /> {event.location}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Wifi size={16} className="text-primary shrink-0" /> {EVENT_MODE_LABEL[eventMode(event)]}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users size={16} className="text-primary shrink-0" />
                    {participantCount} registered
                    {event.max_participants && ` / ${event.max_participants} spots`}
                  </div>
                  {event.registration_fee && Number(event.registration_fee) > 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign size={16} className="text-primary shrink-0" />
                      ${Number(event.registration_fee).toFixed(2)}
                    </div>
                  )}
                </div>

                {spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 10 && (
                  <p className="text-xs font-medium text-destructive">
                    Only {spotsLeft} spot{spotsLeft > 1 ? "s" : ""} left!
                  </p>
                )}

                {programs.length > 0 && !isRegistered && (
                  <div className="grid gap-2">
                    <Label className="text-xs">Choose your program</Label>
                    <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                      <SelectTrigger><SelectValue placeholder="Select a program" /></SelectTrigger>
                      <SelectContent>
                        {programs.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}{p.capacity ? ` · ${p.capacity} seats` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedProgramId && programs.find((p) => p.id === selectedProgramId)?.description && (
                      <p className="text-[11px] text-muted-foreground">
                        {programs.find((p) => p.id === selectedProgramId)?.description}
                      </p>
                    )}
                  </div>
                )}
                {isRegistered && registeredProgramId && (
                  <div className="text-xs text-muted-foreground">
                    Program: <span className="font-medium text-foreground">
                      {programs.find((p) => p.id === registeredProgramId)?.name || "—"}
                    </span>
                  </div>
                )}

                {categories.length > 0 ? (
                  <div className="grid gap-2">
                    <Button
                      className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90"
                      disabled={!registrationOpen}
                      onClick={() => navigate(`/events/${event.slug}/register`)}
                    >
                      <Ticket size={16} className="mr-2" />
                      {registrationOpen ? "Register a team" : "Registration closed"}
                    </Button>
                    <p className="text-[11px] text-muted-foreground">
                      Team registration in {categories.length} categor{categories.length > 1 ? "ies" : "y"} — you'll pick a category, add your institution, team and participants, then pay.
                    </p>
                  </div>
                ) : (
                  <Button
                    className={`w-full ${canRegister ? "bg-gradient-primary text-primary-foreground hover:opacity-90" : ""}`}
                    variant={isRegistered ? "outline" : "default"}
                    disabled={!canRegister || registering}
                    onClick={handleRegister}
                  >
                    {registering
                      ? "Registering..."
                      : isRegistered
                      ? regStatus === "waitlisted" ? "✓ On Waitlist" : "✓ Registered"
                      : isFull
                      ? "Join Waitlist"
                      : "Register Now"}
                  </Button>
                )}

                {isRegistered && participantId && (
                  <div className="rounded-lg bg-muted/50 p-4 text-center space-y-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {regStatus === "waitlisted" ? "Waitlist Pass" : "Your Participant ID"}
                      </p>
                      <p className="font-mono text-sm font-semibold text-foreground select-all">
                        {String(participantId).slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    {regStatus !== "waitlisted" && (
                      <>
                        <div className="flex justify-center bg-white p-3 rounded-md">
                          <QRCodeSVG value={String(participantId)} size={140} level="M" />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Show this QR code at check-in.
                        </p>
                      </>
                    )}
                    {regStatus === "waitlisted" && (
                      <p className="text-[11px] text-muted-foreground">
                        You'll be auto-promoted when a spot opens up.
                      </p>
                    )}
                  </div>
                )}

                {event.event_type === "hackathon" && (
                  <Button variant="outline" className="w-full gap-2" onClick={() => navigate(`/events/${event.slug}/results`)}>
                    <Trophy size={16} /> Live judging results
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleAddToCalendar}
                  disabled={!event.start_date}
                  title={!event.start_date ? "No date set for this event" : "Download .ics calendar invite"}
                >
                  <CalendarPlus size={16} /> Add to calendar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

const typeColor = (t: string) => {
  const map: Record<string, string> = {
    hackathon: "bg-[hsl(280,60%,50%)]/10 text-[hsl(280,60%,50%)]",
    bootcamp: "bg-[hsl(200,80%,50%)]/10 text-[hsl(200,80%,50%)]",
    workshop: "bg-[hsl(150,60%,40%)]/10 text-[hsl(150,60%,40%)]",
    webinar: "bg-[hsl(30,80%,50%)]/10 text-[hsl(30,80%,50%)]",
    conference: "bg-primary/10 text-primary",
    meetup: "bg-[hsl(340,70%,50%)]/10 text-[hsl(340,70%,50%)]",
  };
  return map[t] || "bg-primary/10 text-primary";
};

export default EventDetail;
