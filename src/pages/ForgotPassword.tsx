import { useState } from "react";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { checkRateLimit, recordAttempt } from "@/lib/rate-limit";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = `pwreset:${email.toLowerCase()}`;
    const gate = checkRateLimit(key);
    if (!gate.allowed) {
      const mins = Math.ceil((gate.retryAfterSeconds || 0) / 60);
      toast.error(`Too many requests. Try again in ${mins} minute${mins > 1 ? "s" : ""}.`);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      recordAttempt(key);
      toast.error(error.message);
    } else {
      recordAttempt(key);
      setSent(true);
      toast.success("Check your email for reset instructions.");
    }
    setLoading(false);
  };

  return (
    <main className="pt-20 min-h-dvh flex items-center justify-center">
      <SEO title="Forgot password" noIndex />
      <div className="absolute inset-0 bg-gradient-hero -z-10" />
      <Card className="w-full max-w-md mx-4 shadow-elevated border-border/50 bg-card">
        <CardContent className="p-8">
          <Link to="/auth" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft size={14} /> Back to login
          </Link>
          <h1 className="text-2xl font-heading font-bold text-card-foreground mb-2">Reset Password</h1>
          <p className="text-sm text-muted-foreground mb-6">Enter your email and we'll send you reset instructions.</p>

          {sent ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              We've sent a reset link to <strong className="text-foreground">{email}</strong>. Check your inbox.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3.5 text-muted-foreground" />
                <input
                  required
                  type="email"
                  placeholder="Email"
                  aria-label="Email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90" size="lg">
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default ForgotPassword;
