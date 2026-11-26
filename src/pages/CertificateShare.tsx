import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import SEO from "@/components/SEO";

type State =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "ok"; certificateNumber: string; recipientName: string };

/** Resolves a secure emailed certificate link into the print/download view. */
const CertificateShare = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    (async () => {
      if (!token) { setState({ kind: "invalid" }); return; }
      const { data, error } = await supabase.rpc("resolve_certificate_share" as never, {
        _token: token,
      } as never);
      const rows = (data as unknown as {
        certificate_number: string | null;
        recipient_name: string | null;
        expired: boolean;
      }[]) ?? [];
      if (error || rows.length === 0) { setState({ kind: "invalid" }); return; }
      const row = rows[0];
      if (row.expired || !row.certificate_number) { setState({ kind: "expired" }); return; }
      setState({
        kind: "ok",
        certificateNumber: row.certificate_number,
        recipientName: row.recipient_name ?? "",
      });
    })();
  }, [token]);

  useEffect(() => {
    if (state.kind === "ok") {
      window.location.replace(`/certificate/${state.certificateNumber}/print`);
    }
  }, [state]);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-4 p-8 text-center">
      <SEO title="Certificate download" noIndex />
      {state.kind === "loading" && (
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      )}
      {state.kind === "ok" && (
        <p className="text-muted-foreground">Opening your certificate…</p>
      )}
      {(state.kind === "invalid" || state.kind === "expired") && (
        <>
          <ShieldAlert className="h-10 w-10 text-destructive" aria-hidden />
          <h1 className="text-2xl font-heading font-bold">
            {state.kind === "expired" ? "This link has expired" : "Invalid download link"}
          </h1>
          <p className="text-muted-foreground max-w-md">
            {state.kind === "expired"
              ? "Certificate download links are valid for 30 days. Ask the TechBridge team to send you a fresh link."
              : "We could not match this link to a certificate. Check that you copied the full URL from your email."}
          </p>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/"><ArrowLeft size={16} /> Home</Link>
          </Button>
        </>
      )}
    </main>
  );
};

export default CertificateShare;