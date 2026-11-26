import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ShieldCheck, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getMfaLockoutState, verifyAdminMfaCode } from "@/integrations/supabase/localBackend";

interface MfaChallengeProps {
  open: boolean;
  onVerified: () => void;
  onCancel: () => void;
}

/**
 * Hardened Step-up MFA dialog for the System Admin Dashboard (/admin):
 * - Verifies the 6-digit Admin Security PIN against a salted SHA-256 hash.
 * - Enforces a 15-minute brute-force lockout after 5 failed attempts.
 * - Grants an unforgeable in-memory cryptographic session token that expires on tab close or 30m inactivity.
 */
export const MfaChallenge = ({ open, onVerified, onCancel }: MfaChallengeProps) => {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockout, setLockout] = useState(() => getMfaLockoutState(user?.id));

  useEffect(() => {
    if (open) {
      setCode("");
      setErrorMsg(null);
      setLockout(getMfaLockoutState(user?.id));
    }
  }, [open, user?.id]);

  const verify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    const res = verifyAdminMfaCode(code, user?.id);
    setLoading(false);
    setLockout(getMfaLockoutState(user?.id));

    if (!res.ok) {
      setErrorMsg(res.error || "Invalid 6-digit Admin Security PIN.");
      toast.error(res.error || "Invalid 6-digit Admin Security PIN.");
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
              disabled={lockout.locked}
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

          {errorMsg && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="rounded-lg bg-muted/50 border border-border/60 p-3 text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Lock className="h-3.5 w-3.5 text-primary" />
              Cryptographic MFA &amp; Brute-Force Protection
            </div>
            <p>
              Protected by SHA-256 PIN verification, a 5-attempt / 15-minute brute-force lockout, and automatic
              30-minute inactivity &amp; tab-close session lock.
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
              Return to Site
            </Button>
            <Button
              type="submit"
              disabled={loading || lockout.locked || code.length !== 6}
              className="bg-gradient-primary text-primary-foreground"
            >
              {loading ? "Verifying…" : lockout.locked ? "Temporarily Locked" : "Unlock Admin Dashboard"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MfaChallenge;
