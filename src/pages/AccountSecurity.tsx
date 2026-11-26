import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Loader2, KeyRound, Lock, ArrowRight } from "lucide-react";
import SEO from "@/components/SEO";
import DOMPurify from "dompurify";
import {
  updateAdminMfaPin,
  isAdminMfaVerified,
  lockAdminMfaSession,
  getMfaLockoutState,
} from "@/integrations/supabase/localBackend";

type Factor = { id: string; status: string; friendly_name?: string | null };

const AccountSecurity = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdminRole();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin 6-Digit PIN state — NEVER reveals current PIN in cleartext; requires Current PIN to change
  const [currentPinInput, setCurrentPinInput] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [mfaActive, setMfaActive] = useState(false);

  // Enrollment flow state
  const [enrolling, setEnrolling] = useState(false);
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const loadFactors = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error(error.message);
    } else {
      setFactors(data.totp ?? []);
    }
    if (user?.id) {
      setMfaActive(isAdminMfaVerified(user.id));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFactors();
  }, [user?.id]);

  const handleUpdatePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(currentPinInput)) {
      toast.error("You must enter your CURRENT 6-digit Admin Security PIN to authorize this change.");
      return;
    }
    if (!/^\d{6}$/.test(newPin)) {
      toast.error("Your new Admin Security PIN must be exactly 6 digits (0-9).");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("New PIN and confirmation PIN do not match.");
      return;
    }
    try {
      updateAdminMfaPin(currentPinInput, newPin, user?.id);
      setMfaActive(true);
      setCurrentPinInput("");
      setNewPin("");
      setConfirmPin("");
      toast.success("6-digit Admin Security PIN updated securely!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update PIN.");
    }
  };

  const handleLockSession = () => {
    lockAdminMfaSession(user?.id);
    setMfaActive(false);
    toast.info("Admin MFA session locked. Your 6-digit PIN will be required next time you open /admin.");
  };

  const startEnroll = async () => {
    if (isAdmin && !isAdminMfaVerified(user?.id)) {
      toast.error("Please unlock your Admin MFA session at /admin with your current 6-digit PIN before enrolling a new 2FA device.");
      return;
    }
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `TechBridge ${new Date().toLocaleDateString()}`,
    });
    if (error) {
      setEnrolling(false);
      toast.error(error.message);
      return;
    }
    setEnrollFactorId(data.id);
    setQrSvg(data.totp.qr_code);
    setSecret(data.totp.secret);
  };

  const cancelEnroll = async () => {
    const idToRemove = enrollFactorId;
    setEnrolling(false);
    setEnrollFactorId(null);
    setQrSvg(null);
    setSecret(null);
    setCode("");
    if (idToRemove) {
      await supabase.auth.mfa.unenroll({ factorId: idToRemove }).catch(() => {});
      loadFactors();
    }
  };

  const finishEnroll = async () => {
    if (!enrollFactorId || code.length !== 6) return;
    setVerifying(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrollFactorId });
    if (chErr || !ch) {
      setVerifying(false);
      toast.error(chErr?.message ?? "Could not start challenge.");
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: enrollFactorId,
      challengeId: ch.id,
      code,
    });
    setVerifying(false);
    if (error) {
      toast.error(error.message);
      setCode("");
      return;
    }
    toast.success("Two-factor authentication enabled.");
    setEnrolling(false);
    setEnrollFactorId(null);
    setQrSvg(null);
    setSecret(null);
    setCode("");
    loadFactors();
  };

  const removeFactor = async (id: string) => {
    if (isAdmin && !isAdminMfaVerified(user?.id)) {
      toast.error("Unlock your Admin MFA session first to remove an authenticator.");
      return;
    }
    if (!confirm("Remove this authenticator? You'll need to enroll again to re-enable 2FA.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Authenticator removed.");
    loadFactors();
  };

  const verified = factors.filter((f) => f.status === "verified");
  const lockout = getMfaLockoutState(user?.id);

  return (
    <main className="pt-24 pb-16 min-h-dvh container max-w-2xl space-y-6">
      <SEO title="Account security" description="Manage two-factor authentication and session security for your TechBridge account." noIndex />
      <div>
        <h1 className="text-3xl font-heading font-bold mb-2">Account Security &amp; MFA</h1>
        <p className="text-muted-foreground">
          Manage your multi-factor authentication and session security for TechBridge.
        </p>
      </div>

      {isAdmin && (
        <Card className="border-primary/40">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                System Admin 6-Digit Security PIN (MFA)
              </CardTitle>
              <Badge variant={mfaActive ? "default" : "secondary"}>
                {mfaActive ? "Session Unlocked (30m timeout)" : "Session Locked"}
              </Badge>
            </div>
            <CardDescription>
              Your Admin PIN is stored as a salted SHA-256 cryptographic digest and can never be viewed in plaintext.
              Changing your PIN requires verifying your <strong>current 6-digit PIN</strong> first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 border border-border/60 p-3">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-foreground">Cryptographic PIN Status</p>
                <p className="text-xs text-muted-foreground">
                  Active (Salted SHA-256 Hash • 5-attempt brute-force lockout • 30m inactivity lock)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {mfaActive && (
                  <Button type="button" variant="outline" size="sm" onClick={handleLockSession} className="gap-1.5">
                    <Lock className="h-3.5 w-3.5" /> Lock Admin Session Now
                  </Button>
                )}
                <Button asChild size="sm" className="gap-1.5 bg-gradient-primary text-primary-foreground">
                  <Link to="/admin">
                    Open Admin Dashboard <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>

            <form onSubmit={handleUpdatePin} className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-border/50">
              <div className="space-y-1.5">
                <Label className="text-xs">Current 6-Digit PIN (Required)</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  disabled={lockout.locked}
                  placeholder="Current 6 digits"
                  value={currentPinInput}
                  onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="font-mono tracking-widest"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">New 6-Digit PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  disabled={lockout.locked}
                  placeholder="New 6 digits"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="font-mono tracking-widest"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Confirm New PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  disabled={lockout.locked}
                  placeholder="Repeat new 6 digits"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="font-mono tracking-widest"
                />
              </div>
              <div className="sm:col-span-3 flex justify-end">
                <Button
                  type="submit"
                  disabled={
                    lockout.locked ||
                    currentPinInput.length !== 6 ||
                    newPin.length !== 6 ||
                    confirmPin.length !== 6
                  }
                >
                  Verify Current PIN &amp; Save New Admin PIN
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Two-factor authentication (TOTP Authenticator App)
          </CardTitle>
          <CardDescription>
            Pair an authenticator app like 1Password, Authy, or Google Authenticator (requires unlocked Admin MFA session).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : verified.length === 0 && !enrolling ? (
            <Button variant="outline" onClick={startEnroll}>Enable Authenticator App (2FA)</Button>
          ) : null}

          {verified.map((f) => (
            <div key={f.id} className="flex items-center justify-between border rounded-md p-3">
              <div>
                <div className="font-medium">{f.friendly_name || "Authenticator"}</div>
                <div className="text-xs text-muted-foreground">Status: {f.status}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeFactor(f.id)} className="text-destructive">
                <ShieldOff className="h-4 w-4 mr-1" /> Remove
              </Button>
            </div>
          ))}

          {enrolling && qrSvg && (
            <div className="space-y-4 border-t pt-4">
              <p className="text-sm">Scan this QR code with your authenticator app:</p>
              <div className="flex justify-center bg-white p-4 rounded-md">
                {qrSvg.startsWith("data:image/") ? (
                  <img src={qrSvg} alt="2FA TOTP QR Code" className="h-44 w-44" />
                ) : (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(qrSvg, { USE_PROFILES: { svg: true } }),
                    }}
                  />
                )}
              </div>
              {secret && (
                <p className="text-xs text-muted-foreground text-center">
                  Or enter this code manually: <code className="font-mono">{secret}</code>
                </p>
              )}
              <p className="text-sm">Enter your current 6-digit Admin Security PIN to confirm enrollment:</p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode} aria-label="6-digit verification code">
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={cancelEnroll}>
                  Cancel
                </Button>
                <Button onClick={finishEnroll} disabled={verifying || code.length !== 6}>
                  {verifying ? "Verifying…" : "Verify & enable"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default AccountSecurity;
