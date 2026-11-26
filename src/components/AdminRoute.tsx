import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { supabase } from "@/integrations/supabase/client";
import MfaChallenge from "@/components/MfaChallenge";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

/**
 * Gates the admin section on:
 *   1. Authenticated user
 *   2. `admin` role
 *   3. AAL2 session if the user has a verified TOTP factor
 */
const AdminRoute = ({ children, requireMfa = false }: { children: React.ReactNode; requireMfa?: boolean }) => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const { isAdmin, loading: roleLoading } = useAdminRole();
  const [aalChecked, setAalChecked] = useState(false);
  const [needsStepUp, setNeedsStepUp] = useState(false);
  const [hasFactor, setHasFactor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId || !isAdmin) {
      setAalChecked(false);
      setNeedsStepUp(false);
      setHasFactor(false);
      return;
    }
    setAalChecked(false);
    (async () => {
      try {
        const [{ data: aalData }, { data: factorsData }] = await Promise.all([
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.mfa.listFactors(),
        ]);
        if (cancelled) return;
        const verifiedTotp = factorsData?.totp?.some((f) => f.status === "verified") ?? false;
        setHasFactor(verifiedTotp);
        const currentLevel = aalData?.currentLevel ?? "aal1";
        setNeedsStepUp(verifiedTotp && currentLevel !== "aal2");
      } catch (err) {
        console.error("[AdminRoute] MFA check error:", err);
      } finally {
        if (!cancelled) setAalChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isAdmin]);

  if (authLoading || roleLoading || (user && isAdmin && !aalChecked)) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  if (needsStepUp) {
    return (
      <MfaChallenge
        open
        onVerified={() => setNeedsStepUp(false)}
        onCancel={() => {
          window.location.href = "/";
        }}
      />
    );
  }

  if (requireMfa && !hasFactor) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <ShieldAlert className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-xl font-heading font-bold">Two-factor authentication required</h1>
          <p className="text-sm text-muted-foreground">
            Admins must enable an authenticator app before accessing the admin area.
          </p>
          <Button asChild>
            <Link to="/account/security">Enable 2FA</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;
