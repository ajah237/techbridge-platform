import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";

interface MfaChallengeProps {
  open: boolean;
  onVerified: () => void;
  onCancel: () => void;
}

/**
 * Step-up authentication dialog: prompts the user for a TOTP code
 * from their authenticator app and elevates the session to AAL2.
 */
export const MfaChallenge = ({ open, onVerified, onCancel }: MfaChallengeProps) => {
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode("");
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        toast.error("Could not load MFA factors.");
        onCancel();
        return;
      }
      const totp = data.totp?.find((f) => f.status === "verified");
      if (!totp) {
        toast.error("No verified authenticator found.");
        onCancel();
        return;
      }
      setFactorId(totp.id);
    })();
  }, [open, onCancel]);

  const verify = async () => {
    if (!factorId || code.length !== 6) return;
    setLoading(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !ch) {
      setLoading(false);
      toast.error(chErr?.message ?? "Challenge failed.");
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: ch.id,
      code,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      setCode("");
      return;
    }
    onVerified();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Two-factor verification</DialogTitle>
          <DialogDescription>
            Enter the 6-digit code from your authenticator app to continue.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-4">
          <InputOTP maxLength={6} value={code} onChange={setCode}>
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button onClick={verify} disabled={loading || code.length !== 6}>
            {loading ? "Verifying…" : "Verify"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MfaChallenge;