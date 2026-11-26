import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import DOMPurify from "dompurify";

type Factor = { id: string; status: string; friendly_name?: string | null };

const AccountSecurity = () => {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);

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
    setLoading(false);
  };

  useEffect(() => {
    loadFactors();
  }, []);

  const startEnroll = async () => {
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

  return (
    <main className="pt-24 pb-16 min-h-dvh container max-w-2xl">
      <SEO title="Account security" description="Manage two-factor authentication and session security for your TechBridge account." noIndex />
      <h1 className="text-3xl font-heading font-bold mb-2">Account security</h1>
      <p className="text-muted-foreground mb-8">Add an extra layer of protection with two-factor authentication.</p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Two-factor authentication (TOTP)
          </CardTitle>
          <CardDescription>
            Use an authenticator app like 1Password, Authy, or Google Authenticator. Required for admin actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : verified.length === 0 && !enrolling ? (
            <Button onClick={startEnroll}>Enable 2FA</Button>
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
              <p className="text-sm">Enter the 6-digit code from the app:</p>
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
