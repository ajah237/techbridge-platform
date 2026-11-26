import { useEffect, useState } from "react";
import { Target, Eye, Users, Calendar, FolderKanban, GraduationCap, Linkedin, Twitter, Mail, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import SectionHeading from "@/components/SectionHeading";
import SEO from "@/components/SEO";
import { withBreadcrumbs } from "@/lib/breadcrumb";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";
import { safeHref } from "@/lib/utils";

const DEFAULT_TAGLINE =
  "TechBridge is a global technology organization empowering the next generation of innovators through hands-on programs, mentorship, and community.";
const DEFAULT_MISSION =
  "To bridge the digital skills gap by providing accessible, high-quality technology education and innovation opportunities for students and young professionals worldwide.";
const DEFAULT_VISION =
  "A world where every aspiring technologist has the resources, mentorship, and community to turn ideas into impact — regardless of background or geography.";

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
  bio: string | null;
  photo_url: string | null;
  initials: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  email: string | null;
}

interface StatLabels {
  participants_label?: string;
  events_label?: string;
  projects_label?: string;
  mentors_label?: string;
}

interface StatValues {
  participants?: number;
  events?: number;
  projects?: number;
  mentors?: number;
}

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

const About = () => {
  const [tagline, setTagline] = useState(DEFAULT_TAGLINE);
  const [mission, setMission] = useState(DEFAULT_MISSION);
  const [vision, setVision] = useState(DEFAULT_VISION);
  const [story, setStory] = useState<string>("");
  const [statLabels, setStatLabels] = useState<StatLabels>({
    participants_label: "Participants Trained",
    events_label: "Events Organized",
    projects_label: "Projects Submitted",
    mentors_label: "Active Mentors",
  });
  const [statValues, setStatValues] = useState<StatValues>({});
  const [team, setTeam] = useState<TeamMember[]>([]);

  useEffect(() => {
    (async () => {
      const [settingsRes, teamRes, statsRes] = await Promise.all([
        supabase
          .from("site_settings")
          .select("about_hero_tagline, about_mission, about_vision, about_story, about_stats")
          .eq("id", "global")
          .maybeSingle(),
        supabase
          .from("about_team_members_public" as any)
          .select("*")
          .order("sort_order", { ascending: true }),
        supabase.rpc("get_about_stats" as any),
      ]);
      const sd: any = settingsRes.data ?? {};
      if (sd.about_hero_tagline?.trim()) setTagline(sd.about_hero_tagline);
      if (sd.about_mission?.trim()) setMission(sd.about_mission);
      if (sd.about_vision?.trim()) setVision(sd.about_vision);
      if (sd.about_story) setStory(sd.about_story);
      if (sd.about_stats) setStatLabels({ ...statLabels, ...sd.about_stats });
      setTeam(((teamRes.data ?? []) as any[]) as TeamMember[]);
      if (statsRes.data) setStatValues(statsRes.data as StatValues);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString() : "—");
  const impact = [
    { icon: Users, val: fmt(statValues.participants), lab: statLabels.participants_label || "Participants" },
    { icon: Calendar, val: fmt(statValues.events), lab: statLabels.events_label || "Events" },
    { icon: FolderKanban, val: fmt(statValues.projects), lab: statLabels.projects_label || "Projects" },
    { icon: GraduationCap, val: fmt(statValues.mentors), lab: statLabels.mentors_label || "Mentors" },
  ];

  return (
  <main className="pt-20">
    <SEO
      title="About TechBridge — Our Mission & Team"
      description="Learn how TechBridge bridges the digital skills gap with hackathons, bootcamps, and mentorship for innovators across 45+ countries."
      jsonLd={withBreadcrumbs(
        { "@type": "AboutPage", name: "About TechBridge", url: "https://techbridgehub.lovable.app/about" },
        [ { name: "Home", path: "/" }, { name: "About", path: "/about" } ],
      )}
    />
    {/* Hero */}
    <section className="py-14 sm:py-20 bg-gradient-hero dark">
      <div className="container mx-auto px-4 text-center">
        <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-primary/20 text-primary mb-4">About Us</span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground">Bridging Talent & Technology</h1>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto leading-relaxed whitespace-pre-line">
          {tagline}
        </p>
      </div>
    </section>

    {/* Mission & Vision */}
    <section className="py-12 sm:py-20">
      <div className="container mx-auto px-4 grid md:grid-cols-2 gap-8">
        <Card className="shadow-card border-border/50 bg-card">
          <CardContent className="p-8">
            <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4">
              <Target size={22} className="text-primary-foreground" />
            </div>
            <h2 className="text-xl font-heading font-bold text-card-foreground">Our Mission</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed whitespace-pre-line">{mission}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-border/50 bg-card">
          <CardContent className="p-8">
            <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4">
              <Eye size={22} className="text-primary-foreground" />
            </div>
            <h2 className="text-xl font-heading font-bold text-card-foreground">Our Vision</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed whitespace-pre-line">{vision}</p>
          </CardContent>
        </Card>
      </div>
    </section>

    {/* Our Story */}
    {story && story.replace(/<[^>]*>/g, "").trim() && (
      <section className="py-12 sm:py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <BookOpen size={18} className="text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-heading font-bold text-foreground">Our Story</h2>
          </div>
          <div
            className="prose prose-sm sm:prose max-w-none prose-headings:text-foreground prose-headings:font-heading prose-p:text-muted-foreground prose-a:text-primary prose-strong:text-foreground prose-blockquote:border-primary/30"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(story) }}
          />
        </div>
      </section>
    )}

    {/* Impact */}
    <section className="py-12 sm:py-20 bg-gradient-card border-y border-border/50">
      <div className="container mx-auto px-4">
        <SectionHeading badge="Impact" title="Our Numbers Tell the Story" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {impact.map((s) => (
            <div key={s.lab} className="text-center">
              <s.icon className="mx-auto mb-3 text-primary" size={28} />
              <div className="text-3xl font-heading font-bold text-foreground">{s.val}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.lab}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Team */}
    <section className="py-12 sm:py-20">
      <div className="container mx-auto px-4">
        <SectionHeading badge="Leadership" title="Meet the Team" description="Passionate leaders driving innovation and education across the globe." />
        {team.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground italic">Team profiles coming soon.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((m) => (
              <Card key={m.id} className="shadow-card border-border/50 bg-card text-center">
                <CardContent className="p-6">
                  {m.photo_url ? (
                    <img
                      src={m.photo_url}
                      alt={m.full_name}
                      loading="lazy"
                      className="h-20 w-20 rounded-full object-cover mx-auto mb-4 ring-2 ring-primary/30"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-heading font-bold text-2xl mx-auto mb-4">
                      {m.initials || initialsOf(m.full_name)}
                    </div>
                  )}
                  <h2 className="font-heading font-semibold text-card-foreground">{m.full_name}</h2>
                  <p className="text-sm text-primary mt-1">{m.role}</p>
                  {m.bio && (
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-4">{m.bio}</p>
                  )}
                  {(safeHref(m.linkedin_url) || safeHref(m.twitter_url) || m.email) && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      {safeHref(m.linkedin_url) && (
                        <a href={safeHref(m.linkedin_url)} target="_blank" rel="noopener noreferrer" aria-label={`${m.full_name} on LinkedIn`} className="text-muted-foreground hover:text-primary">
                          <Linkedin size={16} />
                        </a>
                      )}
                      {safeHref(m.twitter_url) && (
                        <a href={safeHref(m.twitter_url)} target="_blank" rel="noopener noreferrer" aria-label={`${m.full_name} on Twitter`} className="text-muted-foreground hover:text-primary">
                          <Twitter size={16} />
                        </a>
                      )}
                      {m.email && (
                        <a href={`mailto:${m.email}`} aria-label={`Email ${m.full_name}`} className="text-muted-foreground hover:text-primary">
                          <Mail size={16} />
                        </a>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  </main>
  );
};

export default About;
