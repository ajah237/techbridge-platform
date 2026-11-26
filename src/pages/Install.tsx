import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Smartphone, Download, Apple, Chrome, CheckCircle2 } from "lucide-react";
import SEO from "@/components/SEO";

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const Install = () => {
  const [deferred, setDeferred] = useState<DeferredPrompt | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as DeferredPrompt);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };

  return (
    <main className="pt-20 min-h-dvh">
      <SEO
        title="Install TechBridge"
        description="Install the TechBridge app on your phone or desktop for faster access to events, blog posts, and your dashboard."
      />

      <section className="py-14 sm:py-20 bg-gradient-hero dark">
        <div className="container mx-auto px-4 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-primary/20 text-primary mb-4">
            <Smartphone size={14} /> Mobile & Desktop App
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground">
            Install TechBridge
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Add TechBridge to your home screen for one-tap access, a full-screen experience, and faster loads.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-20">
        <div className="container mx-auto px-4 max-w-3xl space-y-6">
          {installed ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="mx-auto mb-4 text-primary" size={48} />
                <h2 className="text-xl font-heading font-semibold mb-2">You're all set!</h2>
                <p className="text-muted-foreground">
                  TechBridge is installed. Look for the icon on your home screen or app drawer.
                </p>
              </CardContent>
            </Card>
          ) : deferred ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Download className="mx-auto mb-4 text-primary" size={40} />
                <h2 className="text-xl font-heading font-semibold mb-2">Ready to install</h2>
                <p className="text-sm text-muted-foreground mb-5">
                  Your browser supports one-click install. Tap below to add TechBridge to your device.
                </p>
                <Button
                  onClick={handleInstall}
                  size="lg"
                  className="bg-gradient-primary text-primary-foreground hover:opacity-90 gap-2"
                >
                  <Download size={18} /> Install Now
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="p-6 sm:p-8 space-y-3">
              <div className="flex items-center gap-2">
                <Chrome className="text-primary" size={20} />
                <h3 className="font-heading font-semibold">Android & Desktop (Chrome / Edge)</h3>
              </div>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pl-5">
                <li>Open <strong>techbridgehub.lovable.app</strong> in Chrome or Edge.</li>
                <li>Tap the menu (⋮) in the top-right corner.</li>
                <li>Choose <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                <li>Confirm — TechBridge will appear in your app drawer.</li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 sm:p-8 space-y-3">
              <div className="flex items-center gap-2">
                <Apple className="text-primary" size={20} />
                <h3 className="font-heading font-semibold">iPhone & iPad (Safari)</h3>
              </div>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pl-5">
                <li>Open <strong>techbridgehub.lovable.app</strong> in Safari (not Chrome).</li>
                <li>Tap the <strong>Share</strong> button (the square with an upward arrow).</li>
                <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
                <li>Tap <strong>"Add"</strong> in the top-right corner.</li>
              </ol>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center">
            Note: install prompts only appear once the app is opened directly in your mobile browser
            (not inside another app like the Lovable editor preview).
          </p>
        </div>
      </section>
    </main>
  );
};

export default Install;