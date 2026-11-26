import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ShieldCheck, Lock, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { verifyAdminMfaCode } from "@/integrations/supabase/localBackend";

interface MfaChallengeProps {
  open: boolean;
  onVerified: () => void;
  onCancel: () => void;
}

/**
 * Step-up MFA dialog for the System Admin Dashboard (/admin):
 * Requires the 6-digit Admin Security PIN (or enrolled Authenticator code).
 * Session automatically expires when the browser tab closes or after 30 minutes of inactivity.
 */
export const MfaChallenge = ({ open, onVerified, onCancel }: MfaChallengeProps) => {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (open) {
      setCode("");
    }
  }, [open]);

  const verify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    const ok = verifyAdminMfaCode(code, user?.id);
    setLoading(false);

    if (!ok) {
      setAttempts((a) => a + 1);
      toast.error("Invalid 6-digit Admin Security PIN. Please try again.");
      setCode("");
      return;
    }

    toast.success("Admin MFA verified (active for 30 minutes of activity).");
    onVerified();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl font-heading">
            Admin Multi-Factor Verification
          </DialogTitle>
          <DialogDescription className="text-center">
            Enter your <strong>6-digit Admin Security PIN</strong> to unlock the System Admin Dashboard for{" "}
            <span className="font-medium text-foreground">{user?.email}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={verify} className="space-y-5 pt-2">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(val) => setCode(val.replace(/\D/g, ""))}
              autoFocus
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg font-bold" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <div className="rounded-lg bg-muted/50 border border-border/60 p-3 text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Lock className="h-3.5 w-3.5 text-primary" />
              Session Security Policy
            </div>
            <p>
              This admin session automatically locks when you close the browser tab or after{" "}
              <strong>30 minutes of inactivity</strong>.
            </p>
            {attempts > 0 && (
              <p className="text-primary pt-1 flex items-center gap-1">
                <KeyRound className="h-3.5 w-3.5" />
                You can view or change your 6-digit Admin Security PIN under{" "}
                <Link to="/account/security" className="underline font-medium">
                  Account Security
                </Link>
                .
              </p>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
              Return to Site
            </Button>
            <Button
              type="submit"
              disabled={loading || code.length !== 6}
              className="bg-gradient-primary text-primary-foreground"
            >
              {loading ? "Verifying…" : "Unlock Admin Dashboard"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MfaChallenge;
