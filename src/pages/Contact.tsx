import { Mail, Phone, MapPin, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SectionHeading from "@/components/SectionHeading";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { checkRateLimit, recordAttempt } from "@/lib/rate-limit";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import SEO from "@/components/SEO";
import { withBreadcrumbs } from "@/lib/breadcrumb";
import { safeHref } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  subject: z.string().trim().min(2).max(150),
  message: z.string().trim().min(10).max(2000),
});

const Contact = () => {
  const { settings } = useSiteSettings();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const SOCIALS: Record<string, string> = {
    Twitter: settings.twitter_url,
    LinkedIn: settings.linkedin_url,
    GitHub: settings.github_url,
    YouTube: settings.youtube_url,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your inputs.");
      return;
    }
    const rl = checkRateLimit("contact:" + parsed.data.email);
    if (!rl.allowed) { toast.error(`Please wait ${rl.retryAfterSeconds}s before sending again.`); return; }
    recordAttempt("contact:" + parsed.data.email);

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("contact-submit", {
        body: { ...parsed.data, sourcePath: window.location.pathname },
      });
      if (error) {
        const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
        console.error("contact-submit failed:", details);
        let msg = "We couldn't send your message. Please try again or email us directly.";
        try {
          const parsedErr = JSON.parse(details ?? "{}");
          if (typeof parsedErr?.error === "string") msg = parsedErr.error;
        } catch { /* keep default message */ }
        toast.error(msg);
        return;
      }
      if (!(data as { ok?: boolean } | null)?.ok) {
        toast.error("We couldn't send your message. Please try again.");
        return;
      }
      toast.success("Message sent! We'll get back to you shortly.");
      setForm({ name: "", email: "", subject: "", message: "" });
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="pt-20">
      <SEO
        title="Contact TechBridge — Partnerships & Support"
        description="Reach the TechBridge team for partnerships, event hosting, sponsorships, or general questions. We respond within one business day."
        jsonLd={withBreadcrumbs(
          {
            "@type": "LocalBusiness",
            name: "TechBridge",
            url: "https://techbridgehub.lovable.app/contact",
            email: settings.contact_email,
            telephone: settings.contact_phone,
            address: { "@type": "PostalAddress", streetAddress: settings.office_address },
          },
          [ { name: "Home", path: "/" }, { name: "Contact", path: "/contact" } ],
        )}
      />
      <section className="py-14 sm:py-20 bg-gradient-hero dark">
        <div className="container mx-auto px-4 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-primary/20 text-primary mb-4">Contact</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground">Get in Touch</h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Have a question, partnership inquiry, or just want to say hello? We'd love to hear from you.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Contact Info */}
            <div className="space-y-6">
              {[
              { icon: Mail, label: "Email", value: settings.contact_email },
              { icon: Phone, label: "Phone", value: settings.contact_phone },
              { icon: MapPin, label: "Office", value: settings.office_address },
              ].map((c) => (
                <Card key={c.label} className="shadow-card border-border/50 bg-card">
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-gradient-primary flex items-center justify-center">
                      <c.icon size={18} className="text-primary-foreground" aria-hidden />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-card-foreground">{c.label}</div>
                      <div className="text-sm text-muted-foreground whitespace-pre-line">{c.value}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <div>
                <h3 className="font-heading font-semibold text-foreground mb-3">Follow Us</h3>
                <div className="flex gap-3">
                  {Object.entries(SOCIALS)
                    .filter(([, url]) => safeHref(url))
                    .map(([s, url]) => (
                      <a key={s} href={safeHref(url)} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                        {s}
                      </a>
                    ))}
                </div>
              </div>
            </div>

            {/* Form */}
            <Card className="lg:col-span-2 shadow-card border-border/50 bg-card">
              <CardContent className="p-6 md:p-8">
                <h2 className="text-xl font-heading font-bold text-card-foreground mb-6">Send us a message</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <input
                      required
                      aria-label="Your name"
                      placeholder="Your Name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    />
                    <input
                      required
                      type="email"
                      aria-label="Your email"
                      placeholder="Your Email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    />
                  </div>
                  <input
                    required
                    aria-label="Subject"
                    placeholder="Subject"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                  <textarea
                    required
                    aria-label="Your message"
                    rows={5}
                    placeholder="Your Message"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none"
                  />
                  <Button type="submit" size="lg" disabled={sending} aria-busy={sending} className="bg-gradient-primary text-primary-foreground hover:opacity-90 gap-2">
                    {sending ? "Sending…" : "Send Message"} <Send size={16} aria-hidden />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Contact;
