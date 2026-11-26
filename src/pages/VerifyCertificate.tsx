import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, ArrowLeft, Printer, Search, Ban, History } from "lucide-react";
import SEO from "@/components/SEO";
import { useAdminRole } from "@/hooks/useAdminRole";

interface CertificateData {
  certificate_number: string;
  recipient_name: string;
  issued_at: string;
  event_title: string | null;
  program_type?: string | null;
  description?: string | null;
  revoked_at?: string | null;
  revoked_reason?: string | null;
}

interface Suggestion {
  certificate_number: string;
  recipient_name: string;
  issued_at: string;
  revoked: boolean;
}

const CERT_PATTERN = /^TB-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

const VerifyCertificate = () => {
  const { certificateNumber } = useParams<{ certificateNumber: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAdminRole();
  const [cert, setCert] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(!!certificateNumber);
  const [notFound, setNotFound] = useState(false);

  // Search form
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const [reissues, setReissues] = useState<
    { previous_number: string; new_number: string; reason: string | null; created_at: string }[]
  >([]);

  useEffect(() => {
    setNotFound(false);
    setCert(null);
    setReissues([]);
    if (!certificateNumber) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let active = true;
    const verify = async () => {
      const { data, error: rpcError } = await supabase.rpc("verify_certificate", {
        _certificate_number: certificateNumber,
      });
      if (!active) return;
      if (rpcError || !data || data.length === 0) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setCert(data[0] as CertificateData);
      setLoading(false);
      const { data: hist } = await supabase.rpc("certificate_reissue_history", {
        _certificate_number: certificateNumber,
      });
      if (active) setReissues((hist as any) ?? []);
    };
    verify();
    return () => {
      active = false;
    };
  }, [certificateNumber]);

  // Debounced suggestions (admins only to prevent enumerating other users' certificates)
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!isAdmin || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.rpc("search_certificates", { _q: query.trim(), _limit: 6 });
      setSuggestions(((data ?? []) as any[]).map((d) => ({ ...d, revoked: d.is_revoked ?? d.revoked })));
      setSearching(false);
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, isAdmin]);

  const validation = useMemo(() => {
    const v = query.trim();
    if (!v) return null;
    if (v.length < 3) return "Type at least 3 characters to search.";
    if (v.length > 32) return "Certificate number is too long.";
    return null;
  }, [query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = query.trim().toUpperCase();
    if (!v) { setError("Please enter a certificate number."); return; }
    if (!CERT_PATTERN.test(v)) {
      setError("Format should be TB-XXXX-XXXX-XXXX.");
      return;
    }
    setError(null);
    setShowSuggestions(false);
    navigate(`/verify/${v}`);
  };

  const isRevoked = !!cert?.revoked_at;

  return (
    <main className="pt-20 min-h-dvh">
      <SEO
        title={cert ? `Verify ${cert.certificate_number}` : "Verify a TechBridge Certificate"}
        description={cert ? `Authenticity check for certificate ${cert.certificate_number} issued to ${cert.recipient_name}.` : "Confirm the authenticity of any TechBridge certificate by entering its number."}
      />
      <section className="py-16 sm:py-20 bg-gradient-hero dark">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground">
            Certificate Verification
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Enter a certificate number to confirm its authenticity.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 max-w-xl mx-auto relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setError(null); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="TB-XXXX-XXXX-XXXX"
                  aria-label="Certificate number"
                  aria-invalid={!!error}
                  aria-describedby={error ? "cert-error" : undefined}
                  className="pl-9 h-11 bg-background/95"
                  autoComplete="off"
                />
              </div>
              <Button type="submit" className="h-11 bg-gradient-primary text-primary-foreground gap-2">
                <Search size={16} /> Verify
              </Button>
            </div>

            {/* Inline validation/error */}
            {(error || validation) && (
              <p id="cert-error" className="mt-2 text-left text-sm text-destructive">
                {error || validation}
              </p>
            )}

            {/* Suggestions */}
            {showSuggestions && query.trim().length >= 3 && (
              <div className="absolute z-10 left-0 right-0 mt-2 rounded-md border bg-popover text-popover-foreground shadow-elevated overflow-hidden text-left">
                {searching ? (
                  <p className="p-3 text-sm text-muted-foreground">Searching…</p>
                ) : suggestions.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">No matches yet.</p>
                ) : (
                  suggestions.map((s) => (
                    <button
                      key={s.certificate_number}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); navigate(`/verify/${s.certificate_number}`); }}
                      className="w-full px-3 py-2 hover:bg-accent flex items-center justify-between gap-3 border-b last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm truncate">{s.certificate_number}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.recipient_name}</p>
                      </div>
                      {s.revoked ? (
                        <span className="text-[10px] font-semibold uppercase text-destructive flex items-center gap-1">
                          <Ban size={12}/> Revoked
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(s.issued_at).toLocaleDateString()}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </form>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4 max-w-lg">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !certificateNumber ? null : notFound ? (
            <Card className="border-destructive/30">
              <CardContent className="py-12 text-center space-y-4">
                <XCircle className="mx-auto text-destructive" size={48} />
                <h2 className="text-xl font-heading font-bold text-destructive">Certificate Not Found</h2>
                <p className="text-muted-foreground">
                  The certificate number <strong className="font-mono break-all">{certificateNumber}</strong> could not be verified.
                </p>
                <Button asChild variant="outline" className="gap-2 mt-4">
                  <Link to="/"><ArrowLeft size={16}/> Back to Home</Link>
                </Button>
              </CardContent>
            </Card>
          ) : cert ? (
            <Card className={isRevoked ? "border-destructive/40 shadow-elevated" : "border-primary/30 shadow-elevated"}>
              <CardContent className="py-8 text-center space-y-6">
                {isRevoked ? (
                  <>
                    <Ban className="mx-auto text-destructive" size={56} />
                    <div>
                      <h2 className="text-xl font-heading font-bold text-destructive">⚠ Certificate Revoked</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        This certificate was revoked on {new Date(cert.revoked_at!).toLocaleDateString()} and is no longer valid.
                      </p>
                      {cert.revoked_reason && (
                        <p className="text-sm mt-2"><span className="text-muted-foreground">Reason: </span>{cert.revoked_reason}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle className="mx-auto text-[hsl(150,60%,40%)]" size={56} />
                    <div>
                      <h2 className="text-xl font-heading font-bold text-[hsl(150,60%,40%)]">✓ Certificate Verified</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        This certificate is authentic and was issued by TechBridge.
                      </p>
                    </div>
                  </>
                )}

                <div className="space-y-3 text-left bg-muted/50 rounded-lg p-5">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Recipient</p>
                    <p className="font-semibold text-foreground">{cert.recipient_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Certificate Number</p>
                    <p className="font-mono text-sm text-foreground break-all">{cert.certificate_number}</p>
                  </div>
                  {cert.event_title && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Program</p>
                      <p className="font-semibold text-foreground">{cert.event_title}</p>
                      {cert.program_type && <p className="text-xs text-muted-foreground">{cert.program_type}</p>}
                    </div>
                  )}
                  {cert.description && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Notes</p>
                      <p className="text-sm text-foreground">{cert.description}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Issued On</p>
                    <p className="text-sm text-foreground">
                      {new Date(cert.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>
                  {reissues.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <History size={12} /> Reissue history
                      </p>
                      <ol className="mt-1 space-y-1">
                        {reissues.map((r) => (
                          <li key={`${r.previous_number}-${r.created_at}`} className="text-xs text-foreground">
                            <span className="font-mono">{r.previous_number}</span> →{" "}
                            <span className="font-mono font-semibold">{r.new_number}</span>
                            <span className="text-muted-foreground">
                              {" "}· {new Date(r.created_at).toLocaleDateString()}
                              {r.reason ? ` — ${r.reason}` : ""}
                            </span>
                          </li>
                        ))}
                      </ol>
                      <p className="text-xs text-muted-foreground mt-1">
                        Retired numbers above are superseded by the current number.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild variant="outline" className="gap-2">
                    <Link to="/"><ArrowLeft size={16}/> Home</Link>
                  </Button>
                  <Button asChild className="gap-2 bg-gradient-primary text-primary-foreground">
                    <Link to={`/certificate/${cert.certificate_number}/print`}>
                      <Printer size={16}/> View / Download Certificate
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>
    </main>
  );
};

export default VerifyCertificate;
