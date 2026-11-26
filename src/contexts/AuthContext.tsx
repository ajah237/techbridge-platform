import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Auto sign-out after this much inactivity (no mouse/keyboard/touch).
// Tokens auto-refresh while the tab is active; idle users get a clean
// log-out rather than indefinite session retention.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_THROTTLE_MS = 5_000;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;
      sessionRef.current = nextSession;
      setSession(nextSession);
      setUser((prev) => {
        const nextUser = nextSession?.user ?? null;
        if (prev?.id === nextUser?.id && prev?.updated_at === nextUser?.updated_at) {
          return prev;
        }
        return nextUser;
      });
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        applySession(nextSession);
      },
    );

    // Refresh the session when the tab regains focus, throttled to
    // avoid racing the Supabase auth-token lock on rapid focus changes.
    let lastVisibleCheck = 0;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastVisibleCheck < 30_000) return;
      lastVisibleCheck = now;
      supabase.auth.getSession();
    };
    document.addEventListener("visibilitychange", onVisible);

    // Idle auto-signout: reset timer on user activity (throttled); if it fires
    // while a session is active, sign out and toast the user.
    let lastActivityReset = 0;
    const scheduleIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(async () => {
        if (sessionRef.current) {
          await supabase.auth.signOut({ scope: "local" });
          toast.info("Signed out due to inactivity.");
        }
      }, IDLE_TIMEOUT_MS);
    };

    const resetIdleTimer = () => {
      const now = Date.now();
      if (now - lastActivityReset < ACTIVITY_THROTTLE_MS) return;
      lastActivityReset = now;
      scheduleIdleTimer();
    };

    const activityEvents = ["mousedown", "keydown", "touchstart", "scroll"] as const;
    activityEvents.forEach((ev) =>
      window.addEventListener(ev, resetIdleTimer, { passive: true }),
    );
    scheduleIdleTimer();

    // Sync sign-out across tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("sb-") && e.key.endsWith("-auth-token") && !e.newValue) {
        applySession(null);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("storage", onStorage);
      activityEvents.forEach((ev) =>
        window.removeEventListener(ev, resetIdleTimer),
      );
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  const signOut = async () => {
    // Global scope revokes refresh tokens on the server across all devices;
    // fall back to local sign-out if offline.
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      await supabase.auth.signOut({ scope: "local" });
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
