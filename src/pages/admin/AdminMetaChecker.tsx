import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

const SITE_URL = "https://techbridgehub.lovable.app";

type Severity = "ok" | "warn" | "fail";
interface Finding { severity: Severity; label: string; detail?: string; }

function pick(html: string, re: RegExp) {
  const m = html.match(re);
  return m ? m[1].trim() : "";
}

function analyze(html: string, url: string): { findings: Finding[]; jsonLd: any[]; og: Record<string, string> } {
  const findings: Finding[] = [];

  const title = pick(html, /<title[^>]*>([^<]*)<\/title>/i);
  const description = pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const canonical = pick(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const viewport = pick(html, /<meta[^>]+name=["']viewport["'][^>]+content=["']([^"']+)["']/i);
  const h1Count = (html.match(/<h1\b/gi) || []).length;

  if (!title) findings.push({ severity: "fail", label: "Missing <title>" });
  else if (title.length > 60) findings.push({ severity: "warn", label: `Title too long (${title.length} chars)`, detail: title });
  else findings.push({ severity: "ok", label: `Title (${title.length} chars)`, detail: title });

  if (!description) findings.push({ severity: "fail", label: "Missing meta description" });
  else if (description.length > 160) findings.push({ severity: "warn", label: `Description too long (${description.length})`, detail: description });
  else findings.push({ severity: "ok", label: `Description (${description.length} chars)`, detail: description });

  if (!canonical) findings.push({ severity: "warn", label: "Missing canonical link" });
  else findings.push({ severity: "ok", label: "Canonical", detail: canonical });

  if (!viewport) findings.push({ severity: "warn", label: "Missing viewport meta" });
  if (h1Count === 0) findings.push({ severity: "fail", label: "No <h1> on page" });
  else if (h1Count > 1) findings.push({ severity: "warn", label: `Multiple <h1> tags (${h1Count})` });
  else findings.push({ severity: "ok", label: "Single <h1>" });

  // OG / Twitter
  const og: Record<string, string> = {};
  const ogRe = /<meta[^>]+property=["'](og:[^"']+)["'][^>]+content=["']([^"']*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = ogRe.exec(html))) og[m[1]] = m[2];
  const twRe = /<meta[^>]+name=["'](twitter:[^"']+)["'][^>]+content=["']([^"']*)["']/gi;
  while ((m = twRe.exec(html))) og[m[1]] = m[2];

  ["og:title", "og:description", "og:image", "og:url", "og:type"].forEach((k) => {
    if (!og[k]) findings.push({ severity: "warn", label: `Missing ${k}` });
  });
  if (!og["twitter:card"]) findings.push({ severity: "warn", label: "Missing twitter:card" });

  // JSON-LD
  const jsonLd: any[] = [];
  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = ldRe.exec(html))) {
    try { jsonLd.push(JSON.parse(m[1].trim())); }
    catch (e: any) { findings.push({ severity: "fail", label: "Invalid JSON-LD", detail: String(e?.message ?? e) }); }
  }
  if (jsonLd.length === 0) findings.push({ severity: "warn", label: "No JSON-LD structured data" });
  else {
    jsonLd.forEach((block) => {
      const arr = Array.isArray(block) ? block : [block];
      arr.forEach((b: any) => {
        if (!b["@context"]) findings.push({ severity: "warn", label: "JSON-LD missing @context" });
        if (!b["@type"]) findings.push({ severity: "warn", label: "JSON-LD missing @type" });
      });
    });
    findings.push({ severity: "ok", label: `${jsonLd.length} JSON-LD block(s) parsed` });
  }

  return { findings, jsonLd, og };
}

const SeverityIcon = ({ s }: { s: Severity }) =>
  s === "ok" ? <CheckCircle2 className="h-4 w-4 text-[hsl(150,60%,40%)]" />
  : s === "warn" ? <AlertTriangle className="h-4 w-4 text-[hsl(30,90%,45%)]" />
  : <XCircle className="h-4 w-4 text-destructive" />;

const AdminMetaChecker = () => {
  const [path, setPath] = useState("/");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof analyze> | null>(null);
  const [checkedUrl, setCheckedUrl] = useState<string>("");

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const url = path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : "/" + path}`;
    setCheckedUrl(url);
    try {
      const res = await fetch(url, { headers: { Accept: "text/html" } });
      const html = await res.text();
      setResult(analyze(html, url));
    } catch (e: any) {
      setError(e?.message ?? "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  const counts = result?.findings.reduce((acc, f) => { acc[f.severity]++; return acc; }, { ok: 0, warn: 0, fail: 0 } as Record<Severity, number>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Metadata Checker</h1>
        <p className="text-sm text-muted-foreground">Validate JSON-LD, OG tags, and page metadata before publishing.</p>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label>Page path or URL</Label>
            <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/ or /events or full URL" />
          </div>
          <Button onClick={run} disabled={loading} className="bg-gradient-primary text-primary-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Check
          </Button>
        </CardContent>
      </Card>

      {error && <Card><CardContent className="p-4 text-destructive text-sm">Error: {error}</CardContent></Card>}

      {result && (
        <>
          <Card>
            <CardContent className="p-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground truncate">{checkedUrl}</span>
              <div className="flex gap-2 ml-auto">
                <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-[hsl(150,60%,40%)]" />{counts?.ok} OK</Badge>
                <Badge variant="outline" className="gap-1"><AlertTriangle className="h-3.5 w-3.5 text-[hsl(30,90%,45%)]" />{counts?.warn} Warn</Badge>
                <Badge variant="outline" className="gap-1"><XCircle className="h-3.5 w-3.5 text-destructive" />{counts?.fail} Fail</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h2 className="font-heading font-semibold mb-2">Findings</h2>
              {result.findings.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-sm border-b last:border-0 pb-2 last:pb-0">
                  <SeverityIcon s={f.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{f.label}</p>
                    {f.detail && <p className="text-muted-foreground text-xs break-all">{f.detail}</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <h2 className="font-heading font-semibold mb-2">Open Graph / Twitter</h2>
                {Object.keys(result.og).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No OG/Twitter tags detected.</p>
                ) : (
                  <dl className="text-xs grid gap-1">
                    {Object.entries(result.og).map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[140px_1fr] gap-2">
                        <dt className="font-mono text-muted-foreground">{k}</dt>
                        <dd className="break-all">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h2 className="font-heading font-semibold mb-2">JSON-LD ({result.jsonLd.length})</h2>
                {result.jsonLd.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No JSON-LD blocks found.</p>
                ) : (
                  <pre className="text-[11px] bg-muted p-2 rounded max-h-96 overflow-auto">{JSON.stringify(result.jsonLd, null, 2)}</pre>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminMetaChecker;