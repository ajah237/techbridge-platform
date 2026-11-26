import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Calendar, MapPin, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import { withBreadcrumbs } from "@/lib/breadcrumb";
import { stripHtml } from "@/lib/utils";

type ProgramRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  event_type: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  is_virtual: boolean | null;
  max_participants: number | null;
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "TBA";

const Programs = () => {
  const [params] = useSearchParams();
  const typeFilter = params.get("type");
  const [items, setItems] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let q = supabase
      .from("events")
      .select("id,title,slug,description,event_type,start_date,end_date,location,is_virtual,max_participants")
      .eq("status", "published")
      .order("start_date", { ascending: true });
    if (typeFilter) q = q.eq("event_type", typeFilter as any);
    q.then(({ data }) => { setItems(data ?? []); setLoading(false); });
  }, [typeFilter]);

  return (
    <main className="pt-20">
      <SEO
        title="Programs — Hackathons, Bootcamps & Internships"
        description="Discover hackathons, bootcamps, internships, and workshops to launch and accelerate your tech career with TechBridge."
        jsonLd={withBreadcrumbs(
          {
            "@type": "ItemList",
            name: "TechBridge Programs",
            itemListElement: items.slice(0, 20).map((p, i) => ({
              "@type": "Course",
              position: i + 1,
              name: p.title,
              description: stripHtml(p.description) || undefined,
              url: `https://techbridgehub.lovable.app/events/${p.slug}`,
              provider: { "@type": "Organization", name: "TechBridge" },
            })),
          },
          [ { name: "Home", path: "/" }, { name: "Programs", path: "/programs" } ],
        )}
      />
      <section className="py-14 sm:py-20 bg-gradient-hero dark">
        <div className="container mx-auto px-4 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-primary/20 text-primary mb-4">Programs</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground">Explore Our Programs</h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            From hackathons to internships, find the perfect program to accelerate your tech career.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-20">
        <div className="container mx-auto px-4">
          {loading ? (
            <p className="text-center text-muted-foreground">Loading programs…</p>
          ) : items.length === 0 ? (
            <div className="text-center text-muted-foreground">
              <p>No programs available yet.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/events">Browse all events</Link>
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((p) => (
                <Card key={p.id} className="group shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 border-border/50 bg-card flex flex-col">
                  <CardContent className="p-6 flex flex-col flex-1">
                    <span className="self-start px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-4 capitalize">{p.event_type}</span>
                    <h2 className="text-lg font-heading font-semibold text-card-foreground group-hover:text-primary transition-colors">{p.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1 line-clamp-3">{stripHtml(p.description)}</p>
                    <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2"><Calendar size={14} /> {fmt(p.start_date)}{p.end_date ? ` – ${fmt(p.end_date)}` : ""}</div>
                      <div className="flex items-center gap-2"><MapPin size={14} /> {p.is_virtual ? "Online" : p.location ?? "TBA"}</div>
                      {p.max_participants && <div className="flex items-center gap-2"><Users size={14} /> {p.max_participants} spots</div>}
                    </div>
                    <Button asChild className="mt-5 w-full bg-gradient-primary text-primary-foreground hover:opacity-90 gap-2" size="sm">
                      <Link to={`/events/${p.slug}`}>
                        View & Apply <ArrowRight size={14} />
                      </Link>
                    </Button>
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

export default Programs;
