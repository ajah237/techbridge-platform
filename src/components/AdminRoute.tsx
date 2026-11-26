import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import MfaChallenge from "@/components/MfaChallenge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import {
  ADMIN_MFA_TIMEOUT_MS,
  isAdminMfaVerified,
  touchAdminMfaActivity,
} from "@/integrations/supabase/localBackend";

/**
 * Gates the /admin section on:
 *   1. Authenticated user
 *   2. Strict `admin` role (only bfozoh@gmail.com, ajahbefere@gmail.com, or manually promoted admins)
 *   3. 6-Digit Admin Security PIN (MFA) verification with 30-minute inactivity & tab-close auto-lock
 */
const AdminRoute = ({ children }: { children: React.ReactNode; requireMfa?: boolean }) => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const { isAdmin, loading: roleLoading } = useAdminRole();
  const navigate = useNavigate();
  const [mfaVerified, setMfaVerified] = useState(false);

  useEffect(() => {
    if (!userId || !isAdmin) {
      setMfaVerified(false);
      return;
    }
    const verified = isAdminMfaVerified(userId);
    setMfaVerified(verified);
  }, [userId, isAdmin]);

  // Monitor activity and enforce 30-minute inactivity timeout while inside /admin
  useEffect(() => {
    if (!userId || !isAdmin || !mfaVerified) return;

    const onActivity = () => {
      if (!isAdminMfaVerified(userId)) {
        setMfaVerified(false);
      } else {
        touchAdminMfaActivity(userId);
      }
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));

    const interval = window.setInterval(() => {
      if (!isAdminMfaVerified(userId)) {
        setMfaVerified(false);
      }
    }, Math.min(30_000, ADMIN_MFA_TIMEOUT_MS));

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      window.clearInterval(interval);
    };
  }, [userId, isAdmin, mfaVerified]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth?redirect=/admin" replace />;

  if (!isAdmin) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 bg-background">
        <div className="max-w-md text-center space-y-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-8">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-heading font-bold">Access Restricted — System Administrators Only</h1>
          <p className="text-sm text-muted-foreground">
            Your account (<strong>{user.email}</strong>) is registered as a standard participant and does not have
            permission to access the TechBridge System Admin Dashboard.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button asChild variant="outline" className="gap-1.5">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" /> Go to My Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!mfaVerified) {
    return (
      <MfaChallenge
        open
        onVerified={() => setMfaVerified(true)}
        onCancel={() => navigate("/dashboard", { replace: true })}
      />
    );
  }

  return <>{children}</>;
};

export default AdminRoute;
