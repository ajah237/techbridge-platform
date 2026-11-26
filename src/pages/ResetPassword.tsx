import { useState, useEffect } from "react";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      setReady(true);
    }
    // Also listen for auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully!");
      navigate("/profile");
    }
    setLoading(false);
  };

  return (
    <main className="pt-20 min-h-dvh flex items-center justify-center">
      <SEO title="Reset password" noIndex />
      <div className="absolute inset-0 bg-gradient-hero -z-10" />
      <Card className="w-full max-w-md mx-4 shadow-elevated border-border/50 bg-card">
        <CardContent className="p-8">
          <h1 className="text-2xl font-heading font-bold text-card-foreground mb-2">Set New Password</h1>
          {!ready ? (
            <p className="text-sm text-muted-foreground">Invalid or expired reset link.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3.5 text-muted-foreground" />
                <input
                  required
                  type="password"
                  placeholder="New password (min 6 characters)"
                  aria-label="New password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90" size="lg">
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default ResetPassword;
