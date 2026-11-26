import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertCircle, Info, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";

type State = "loading" | "ok" | "already" | "invalid" | "error" | "locked";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LS_KEY = "unsub_attempts_v1";
const MAX_INVALID = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 min
const LOCKOUT_MS = 30 * 60 * 1000; // 30 min

type AttemptState = { count: number; firstAt: number; lockedUntil: number };

const readAttempts = (): AttemptState => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { count: 0, firstAt: 0, lockedUntil: 0 };
    return JSON.parse(raw) as AttemptState;
  } catch { return { count: 0, firstAt: 0, lockedUntil: 0 }; }
};
const writeAttempts = (a: AttemptState) => { try { localStorage.setItem(LS_KEY, JSON.stringify(a)); } catch {} };
const clearAttempts = () => { try { localStorage.removeItem(LS_KEY); } catch {} };

const COPY: Record<Exclude<State, "loading">, { title: string; body: string; tone: "success" | "info" | "error" }> = {
  ok: { title: "You're unsubscribed", body: "We've removed you from the TechBridge newsletter. You can resubscribe any time.", tone: "success" },
  already: { title: "Already unsubscribed", body: "This email was already opted out — no further action needed.", tone: "info" },
  invalid: { title: "Invalid or expired link", body: "This unsubscribe link is invalid. If you keep receiving emails, contact support.", tone: "error" },
  error: { title: "Something went wrong", body: "We couldn't process the unsubscribe right now. Please try again in a moment.", tone: "error" },
  locked: { title: "Too many attempts", body: "You've tried too many invalid unsubscribe links. Please wait a bit and try again, or contact support.", tone: "error" },
};

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");
  const [retryIn, setRetryIn] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const attempts = readAttempts();
      const now = Date.now();
      if (attempts.lockedUntil && now < attempts.lockedUntil) {
        setRetryIn(Math.ceil((attempts.lockedUntil - now) / 1000));
        setState("locked");
        return;
      }
      if (!token || !UUID_RE.test(token)) { setState("invalid"); return; }
      const { data, error } = await supabase.rpc("unsubscribe_newsletter", { _token: token });
      if (error) { setState("error"); return; }
      const result = String(data ?? "");
      if (result === "ok" || result === "already") {
        clearAttempts();
        setState(result);
        return;
      }
      if (result === "invalid") {
        const fresh = !attempts.firstAt || now - attempts.firstAt > WINDOW_MS ? { count: 1, firstAt: now, lockedUntil: 0 } : { ...attempts, count: attempts.count + 1 };
        if (fresh.count >= MAX_INVALID) {
          fresh.lockedUntil = now + LOCKOUT_MS;
          writeAttempts(fresh);
          setRetryIn(Math.ceil(LOCKOUT_MS / 1000));
          setState("locked");
          return;
        }
        writeAttempts(fresh);
        setState("invalid");
        return;
      }
      setState("error");
    })();
  }, [token]);

  const minutes = Math.ceil(retryIn / 60);

  return (
    <main className="pt-24 pb-20 min-h-dvh bg-background">
      <SEO title="Email preferences" description="Manage your TechBridge email subscription preferences." noIndex />
      <div className="container mx-auto px-4 max-w-xl">
        <div className="bg-card border border-border rounded-2xl shadow-card p-8 text-center">
          {state === "loading" ? (
            <>
              <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin mb-4" />
              <h1 className="text-2xl font-heading font-bold mb-2">Processing your request…</h1>
              <p className="text-muted-foreground text-sm">Verifying your unsubscribe token.</p>
            </>
          ) : (
            <>
              {COPY[state].tone === "success" && <CheckCircle2 className="h-10 w-10 mx-auto text-primary mb-4" />}
              {COPY[state].tone === "info" && <Info className="h-10 w-10 mx-auto text-muted-foreground mb-4" />}
              {COPY[state].tone === "error" && <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-4" />}
              <h1 className="text-2xl font-heading font-bold mb-2">{COPY[state].title}</h1>
              <p className="text-muted-foreground text-sm">{COPY[state].body}</p>
              {state === "locked" && retryIn > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Try again in ~{minutes} min.</p>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Status: <code className="font-mono">{state}</code>
              </p>
            </>
          )}
          <Link to="/" className="inline-block mt-6 text-primary hover:underline text-sm">← Back to TechBridge</Link>
        </div>
      </div>
    </main>
  );
};

export default Unsubscribe;