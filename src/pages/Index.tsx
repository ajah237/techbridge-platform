import { useEffect, useState } from "react";
import { ArrowRight, Users, Globe, Trophy, Laptop, Calendar, Zap, Code, Sparkles, Star, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SectionHeading from "@/components/SectionHeading";
import { Link } from "react-router-dom";
import Newsletter from "@/components/Newsletter";
import LatestBlogCarousel from "@/components/LatestBlogCarousel";
import { splitEvents } from "@/lib/eventStatus";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";

const stats = [
  { icon: Users, value: "10,000+", label: "Participants" },
  { icon: Trophy, value: "150+", label: "Hackathons" },
  { icon: Globe, value: "45+", label: "Countries" },
  { icon: Laptop, value: "500+", label: "Projects Built" },
];


const testimonials = [
  { name: "Sarah Chen", role: "Software Engineer at Google", text: "TechBridge's hackathon changed my career trajectory. I built my first AI project and got noticed by recruiters." },
  { name: "James Okafor", role: "Founder, DevConnect", text: "The bootcamp gave me the skills and network to launch my startup. The mentorship was world-class." },
  { name: "Priya Sharma", role: "Data Scientist", text: "I went from knowing nothing about ML to winning a hackathon prize. TechBridge makes tech accessible." },
];

const sponsors = ["Microsoft", "Google", "AWS", "Meta", "GitHub", "Stripe"];

type EventRow = { id: string; title: string; slug: string; event_type: string; start_date: string | null; end_date: string | null; location: string | null; is_virtual: boolean | null };

const Index = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  useEffect(() => {
    supabase
      .from("events")
      .select("id,title,slug,event_type,start_date,end_date,location,is_virtual")
      .in("status", ["published", "ongoing"])
      .order("start_date", { ascending: true })
      .then(({ data }) => setEvents(splitEvents((data ?? []) as EventRow[]).current.slice(0, 3)));
  }, []);

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "TBA";

  return (
  <main>
    <SEO
      title="TechBridge — Hackathons & Bootcamps"
      description="Join hackathons, bootcamps, and workshops. Build skills, win prizes, and connect with the tech community across Africa and beyond."
    />
    {/* Hero */}
    <section className="relative min-h-dvh flex items-center overflow-hidden dark">
      <picture>
        <source srcSet="/hero-bg.webp" type="image/webp" />
        <img
          src="/hero-bg.webp"
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
          width={1920}
          height={1080}
          fetchPriority="high"
          loading="eager"
          decoding="async"
        />
      </picture>
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(222,47%,6%)/0.82] via-[hsl(222,47%,6%)/0.72] to-[hsl(222,47%,6%)]" />
      <div className="container mx-auto px-4 relative z-10 pt-20 pb-16 sm:pt-24 sm:pb-20">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-primary/20 text-primary mb-6">
            <Sparkles size={14} /> Applications Open for 2026 Programs
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-heading font-bold leading-[1.1]">
            <span className="text-foreground">Build the Future</span>
            <br />
            <span className="text-gradient">with TechBridge</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-foreground/85 max-w-xl leading-relaxed animate-fade-in" style={{ animationDelay: "0.2s" }}>
            Join hackathons, bootcamps, and innovation programs that transform aspiring developers into industry-ready professionals.
          </p>
          <div className="flex flex-wrap gap-4 mt-8 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground hover:opacity-90 gap-2 text-base px-8">
              <Link to="/events">
                Join a Hackathon <ArrowRight size={18} />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-border text-foreground hover:bg-muted gap-2 text-base">
              <Link to="/programs">
                Explore Programs <ChevronRight size={18} />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>

    {/* Stats */}
    <section className="py-16 bg-gradient-card border-y border-border/50">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center animate-count-up">
              <s.icon className="mx-auto mb-3 text-primary" size={28} aria-hidden />
              <div className="text-3xl md:text-4xl font-heading font-bold text-foreground">{s.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Upcoming Events */}
    <section className="py-20">
      <div className="container mx-auto px-4">
        <SectionHeading badge="Upcoming" title="Featured Events" description="Don't miss out on our next big opportunity to learn, build, and grow." />
        {events.length === 0 ? (
          <p className="text-center text-muted-foreground">No upcoming events yet — check back soon. <Link to="/events#past-events" className="text-primary underline">See past events</Link></p>
        ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {events.map((e) => (
            <Card key={e.id} className="group shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 border-border/50 bg-card">
              <CardContent className="p-6">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-4">
                  {e.event_type}
                </span>
                <h3 className="text-lg font-heading font-semibold text-card-foreground group-hover:text-primary transition-colors">{e.title}</h3>
                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2"><Calendar size={14} /> {fmtDate(e.start_date)}</div>
                  <div className="flex items-center gap-2"><Globe size={14} /> {e.is_virtual ? "Online" : e.location ?? "TBA"}</div>
                </div>
                <Button asChild className="mt-5 w-full bg-gradient-primary text-primary-foreground hover:opacity-90 gap-2" size="sm">
                  <Link to={`/events/${e.slug}`}>
                    View Event <ArrowRight size={14} />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        )}
        <div className="text-center mt-10">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/events">
              View All Events <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      </div>
    </section>

    {/* What We Do */}
    <section className="py-20 bg-gradient-card border-y border-border/50">
      <div className="container mx-auto px-4">
        <SectionHeading badge="What We Do" title="Empowering the Next Generation" description="From hackathons to internships, we provide the platform for tech talent to thrive." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: "Hackathons", desc: "48-hour innovation sprints where teams build real products solving real problems." },
            { icon: Code, title: "Bootcamps", desc: "Intensive training programs in full-stack development, AI, and cloud computing." },
            { icon: Laptop, title: "Internships", desc: "Hands-on industry experience with leading tech companies and startups." },
            { icon: Users, title: "Mentorship", desc: "1-on-1 guidance from experienced developers and industry professionals." },
            { icon: Trophy, title: "Competitions", desc: "Innovation challenges with prizes, recognition, and career opportunities." },
            { icon: Star, title: "Community", desc: "A global network of builders, dreamers, and innovators pushing boundaries." },
          ].map((item) => (
            <Card key={item.title} className="shadow-card hover:shadow-elevated transition-all duration-300 border-border/50 bg-card">
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4">
                  <item.icon size={22} className="text-primary-foreground" />
                </div>
                <h3 className="font-heading font-semibold text-card-foreground text-lg">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>

    <LatestBlogCarousel />

    {/* Testimonials */}
    <section className="py-20">
      <div className="container mx-auto px-4">
        <SectionHeading badge="Testimonials" title="Voices from the Community" description="Hear from the builders and innovators who transformed their careers with TechBridge." />
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <Card key={t.name} className="shadow-card border-border/50 bg-card">
              <CardContent className="p-6">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={16} className="fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed italic">"{t.text}"</p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-heading font-bold text-sm">
                    {t.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-card-foreground">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>

    {/* Sponsors */}
    <section className="py-16 bg-gradient-card border-y border-border/50">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">Trusted by leading organizations</p>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-14">
          {sponsors.map((s) => (
            <span key={s} className="text-xl md:text-2xl font-heading font-bold text-muted-foreground hover:text-primary transition-colors cursor-default">
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>

    <Newsletter />
  </main>
  );
};

export default Index;
