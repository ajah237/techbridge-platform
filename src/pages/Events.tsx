import { useEffect, useState, useMemo } from "react";
import { splitEvents } from "@/lib/eventStatus";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, MapPin, Users, Wifi, DollarSign, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { withBreadcrumbs } from "@/lib/breadcrumb";
import type { Tables } from "@/integrations/supabase/types";
import { Constants } from "@/integrations/supabase/types";

type Event = Tables<"events">;

const EVENT_TYPES = Constants.public.Enums.event_type;

const Events = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .in("status", ["published", "ongoing", "completed"])
        .order("start_date", { ascending: true });
      setEvents(data ?? []);
      setLoading(false);
    };
    fetchEvents();
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchRegistrations = async () => {
      const { data } = await supabase
        .from("event_registrations")
        .select("event_id")
        .eq("user_id", user.id);
      setRegisteredIds(new Set((data ?? []).map((r) => r.event_id)));
    };
    fetchRegistrations();
  }, [user]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    events.forEach((e) => e.tags?.forEach((t) => { if (t && t.trim()) s.add(t); }));
    return Array.from(s).sort();
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || e.title.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q);
      const matchesType = typeFilter === "all" || e.event_type === typeFilter;
      const matchesTag = tagFilter === "all" || e.tags?.includes(tagFilter);
      const lq = locationFilter.trim().toLowerCase();
      const matchesLocation = !lq || e.location?.toLowerCase().includes(lq) || (e.is_virtual && "virtual".includes(lq));
      const ts = e.start_date ? new Date(e.start_date).getTime() : null;
      const fromOk = !dateFrom || (ts !== null && ts >= new Date(dateFrom).getTime());
      const toOk = !dateTo || (ts !== null && ts <= new Date(dateTo).getTime() + 86399999);
      return matchesSearch && matchesType && matchesTag && matchesLocation && fromOk && toOk;
    });
  }, [events, search, typeFilter, tagFilter, locationFilter, dateFrom, dateTo]);

  const { current, past } = useMemo(() => splitEvents(filtered), [filtered]);

  const hasActiveFilters = search || typeFilter !== "all" || tagFilter !== "all" || locationFilter || dateFrom || dateTo;

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

  const renderCard = (event: (typeof events)[number]) => {
                const isPast = past.includes(event);
                const isRegistered = registeredIds.has(event.id);
                return (
                  <Card key={event.id} className="group shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 border-border/50 bg-card flex flex-col">
                    <CardContent className="p-6 flex flex-col flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${typeColor(event.event_type)}`}>{event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}</span>
                        <Badge variant={event.status === "ongoing" ? "default" : "secondary"}>{isPast ? "past" : event.status}</Badge>
                      </div>
                      <h2 className="text-lg font-heading font-semibold text-card-foreground group-hover:text-primary transition-colors">
                        <Link to={`/events/${event.slug}`} className="focus-visible:outline-none focus-visible:underline">
                          {event.title}
                        </Link>
                      </h2>
                      {event.description && <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">{event.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}</p>}
                      <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                        {event.start_date && (
                          <div className="flex items-center gap-2"><Calendar size={14} />{new Date(event.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{event.end_date && ` – ${new Date(event.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}</div>
                        )}
                        {event.location && <div className="flex items-center gap-2"><MapPin size={14} /> {event.location}</div>}
                        {event.is_virtual && <div className="flex items-center gap-2"><Wifi size={14} /> Virtual Event</div>}
                        {event.max_participants && <div className="flex items-center gap-2"><Users size={14} /> {event.max_participants} spots</div>}
                        {event.registration_fee && Number(event.registration_fee) > 0 && <div className="flex items-center gap-2"><DollarSign size={14} /> ${Number(event.registration_fee).toFixed(2)}</div>}
                      </div>
                      {event.tags && event.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">{event.tags.map((tag) => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}</div>
                      )}
                      {isPast ? (
                        <Button asChild variant="outline" size="sm" className="mt-5 w-full">
                          <Link to={`/events/${event.slug}`}>View event</Link>
                        </Button>
                      ) : (
                        <Button
                          asChild
                          className={`mt-5 w-full gap-2 ${isRegistered ? "" : "bg-gradient-primary text-primary-foreground hover:opacity-90"}`}
                          variant={isRegistered ? "outline" : "default"}
                          size="sm"
                        >
                          <Link to={`/events/${event.slug}`}>
                            {isRegistered ? "✓ Registered · View Event" : "View & Register"}
                          </Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
};

  const jsonLd = withBreadcrumbs(
    {
      "@type": "CollectionPage",
      name: "TechBridge Events",
      description: "Upcoming hackathons, bootcamps, workshops and tech events.",
      url: "https://techbridgehub.lovable.app/events",
    },
    [ { name: "Home", path: "/" }, { name: "Events", path: "/events" } ],
  );

  return (
    <main className="pt-20">
      <SEO title="Events" description="Register for hackathons, bootcamps, workshops, and more. Build skills, win prizes, and connect with the tech community." jsonLd={jsonLd} />

      <section className="py-14 sm:py-20 bg-gradient-hero dark">
        <div className="container mx-auto px-4 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-primary/20 text-primary mb-4">Events</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground">Events</h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Register for hackathons, bootcamps, workshops, and more. Build skills, win prizes, and connect with the tech community.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-20">
        <div className="container mx-auto px-4">
          {/* Search & Filters */}
          <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input placeholder="Search events..." aria-label="Search events" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Input placeholder="Location (e.g. Lagos, virtual)" aria-label="Filter by location" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger aria-label="Filter by category"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" aria-label="From date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <div className="flex gap-2">
              <Input type="date" aria-label="To date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              {hasActiveFilters && (
                <Button variant="ghost" size="icon" aria-label="Clear filters" onClick={() => { setSearch(""); setTypeFilter("all"); setTagFilter("all"); setLocationFilter(""); setDateFrom(""); setDateTo(""); }}><X className="h-4 w-4" /></Button>
              )}
            </div>
            {allTags.length > 0 && (
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="sm:col-span-2 lg:col-span-2" aria-label="Filter by tag"><SelectValue placeholder="Tag" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {allTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">{hasActiveFilters ? "No events match your filters." : "No events yet."}</div>
          ) : (
            <>
              <h2 className="text-2xl font-heading font-bold mb-6">Current &amp; upcoming</h2>
              {current.length === 0 ? (
                <p className="text-muted-foreground py-6">{hasActiveFilters ? "No current events match your filters." : "No upcoming events at the moment — check back soon."}</p>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{current.map(renderCard)}</div>
              )}
              {past.length > 0 && (
                <div id="past-events" className="mt-16 scroll-mt-24">
                  <h2 className="text-2xl font-heading font-bold mb-2">Past events</h2>
                  <p className="text-muted-foreground mb-6">Earlier programmes, kept for reference.</p>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-90">{past.map(renderCard)}</div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
};

export default Events;
