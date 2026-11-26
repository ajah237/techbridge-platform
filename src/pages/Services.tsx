import { Code, Globe, Smartphone, Users, BookOpen, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SectionHeading from "@/components/SectionHeading";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { withBreadcrumbs } from "@/lib/breadcrumb";

const services = [
  { icon: Code, title: "Software Development", desc: "End-to-end custom software solutions for businesses, from requirement analysis to deployment and maintenance." },
  { icon: Globe, title: "Web Development", desc: "Modern, responsive websites and web applications built with cutting-edge frameworks and best practices." },
  { icon: Smartphone, title: "Mobile App Development", desc: "Native and cross-platform mobile applications for iOS and Android with seamless user experiences." },
  { icon: Users, title: "Tech Consulting", desc: "Strategic technology advisory services to help organizations make informed digital transformation decisions." },
  { icon: BookOpen, title: "Digital Training", desc: "Customized corporate training programs in programming, cloud computing, AI/ML, and emerging technologies." },
  { icon: Zap, title: "Hackathon Organization", desc: "Full-service hackathon planning and execution for universities, corporates, and government institutions." },
];

const Services = () => (
  <main className="pt-20">
    <SEO
      title="Services — Software, Web, Mobile & Hackathons"
      description="Custom software, web & mobile development, tech consulting, digital training, and full-service hackathon organization for organizations of every size."
        jsonLd={withBreadcrumbs(
          {
            "@type": "ItemList",
            name: "TechBridge Services",
            itemListElement: services.map((s, i) => ({
              "@type": "Service",
              position: i + 1,
              name: s.title,
              description: s.desc,
              provider: { "@type": "Organization", name: "TechBridge" },
            })),
          },
          [ { name: "Home", path: "/" }, { name: "Services", path: "/services" } ],
        )}
    />
    <section className="py-14 sm:py-20 bg-gradient-hero dark">
      <div className="container mx-auto px-4 text-center">
        <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-primary/20 text-primary mb-4">Services</span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground">Our Services</h1>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
          Professional technology services to help your organization innovate and grow.
        </p>
      </div>
    </section>

    <section className="py-12 sm:py-20">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s) => (
            <Card key={s.title} className="group shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 border-border/50 bg-card">
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4">
                  <s.icon size={22} className="text-primary-foreground" />
                </div>
                <h2 className="text-lg font-heading font-semibold text-card-foreground group-hover:text-primary transition-colors">{s.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="text-center mt-12">
          <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground hover:opacity-90 gap-2">
            <Link to="/contact">
              Get a Quote <ArrowRight size={18} />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  </main>
);

export default Services;
