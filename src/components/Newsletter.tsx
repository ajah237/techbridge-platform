import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SectionHeading from "@/components/SectionHeading";
import { checkRateLimit, recordAttempt } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().email().max(255) });

const Newsletter = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) { toast.error("Please enter a valid email address."); return; }
    const rl = checkRateLimit("newsletter:" + parsed.data.email);
    if (!rl.allowed) { toast.error(`Try again in ${rl.retryAfterSeconds}s.`); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from("newsletter_subscribers").insert({ email: parsed.data.email, source: "homepage" });
      if (error && !error.message.toLowerCase().includes("duplicate")) throw error;
      recordAttempt("newsletter:" + parsed.data.email);
      toast.success("You're subscribed! Welcome aboard.");
      setEmail("");
    } catch (err: any) {
      toast.error(err.message ?? "Subscription failed.");
    } finally { setLoading(false); }
  };

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <SectionHeading badge="Stay Updated" title="Join the TechBridge Newsletter" description="Get the latest on hackathons, bootcamps, and opportunities delivered to your inbox." />
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              required
              placeholder="your@email.com"
              aria-label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-4 py-3 rounded-lg border border-border bg-card text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
            <Button type="submit" disabled={loading} className="bg-gradient-primary text-primary-foreground hover:opacity-90 px-6">
              {loading ? "Subscribing…" : "Subscribe"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default Newsletter;
