import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";

const COOKIE_KEY = "tb_cookie_consent";

type ConsentValue = "accepted" | "declined" | null;

const CookieConsent = () => {
  const [consent, setConsent] = useState<ConsentValue>(() => {
    try {
      return localStorage.getItem(COOKIE_KEY) as ConsentValue;
    } catch {
      return null;
    }
  });

  if (consent) return null;

  const handleChoice = (value: "accepted" | "declined") => {
    try { localStorage.setItem(COOKIE_KEY, value); } catch {}
    setConsent(value);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-fade-in">
      <div className="container mx-auto max-w-3xl">
        <div className="rounded-xl border border-border bg-card shadow-elevated p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Shield size={20} className="text-primary shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-muted-foreground">
            We use essential cookies to keep TechBridge running smoothly. By accepting, you also allow optional analytics cookies to help us improve. Read our{" "}
            <Link to="/privacy" className="text-primary hover:underline font-medium">
              Privacy Policy
            </Link>{" "}
            for details.
          </div>
          <div className="flex gap-2 shrink-0 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-initial"
              onClick={() => handleChoice("declined")}
            >
              Decline
            </Button>
            <Button
              size="sm"
              className="flex-1 sm:flex-initial bg-gradient-primary text-primary-foreground hover:opacity-90"
              onClick={() => handleChoice("accepted")}
            >
              Accept
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
