import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ExternalLink } from "lucide-react";

const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

const buildUrl = (slug: string, bust: number) =>
  `https://${projectId}.supabase.co/functions/v1/og-event?slug=${encodeURIComponent(slug)}&v=${bust}`;

const AdminOgPreview = () => {
  const [params, setParams] = useSearchParams();
  const initial = params.get("slug") ?? "";
  const [slug, setSlug] = useState(initial);
  const [activeSlug, setActiveSlug] = useState(initial);
  const [bust, setBust] = useState(() => Date.now());
  const [event, setEvent] = useState<{ title: string; og_image_url: string | null; image_url: string | null } | null>(null);
  const [suggestions, setSuggestions] = useState<{ slug: string; title: string }[]>([]);

  useEffect(() => {
    supabase.from("events").select("slug, title").order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setSuggestions(data ?? []));
  }, []);

  useEffect(() => {
    if (!activeSlug) { setEvent(null); return; }
    supabase.from("events").select("title, og_image_url, image_url").eq("slug", activeSlug).maybeSingle()
      .then(({ data }) => setEvent(data as any));
  }, [activeSlug]);

  const load = () => {
    setActiveSlug(slug.trim());
    setBust(Date.now());
    setParams({ slug: slug.trim() });
  };

  const url = activeSlug ? buildUrl(activeSlug, bust) : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">OG Image Preview</h1>
        <p className="text-sm text-muted-foreground">Test the generated social-share image for any event slug before publishing.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Event slug</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 grid gap-1">
              <Label htmlFor="og-slug" className="sr-only">Slug</Label>
              <Input id="og-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-event-slug" onKeyDown={(e) => e.key === "Enter" && load()} />
            </div>
            <Button onClick={load} disabled={!slug.trim()}>Preview</Button>
            <Button variant="outline" onClick={() => setBust(Date.now())} disabled={!activeSlug} aria-label="Refresh preview">
              <RefreshCw size={16} />
            </Button>
          </div>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s.slug} type="button" onClick={() => { setSlug(s.slug); setActiveSlug(s.slug); setBust(Date.now()); setParams({ slug: s.slug }); }}>
                  <Badge variant="outline" className="cursor-pointer hover:bg-muted">{s.slug}</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {activeSlug && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Preview
              {event?.og_image_url
                ? <Badge>custom upload</Badge>
                : <Badge variant="secondary">auto-generated</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg overflow-hidden border bg-muted aspect-[1200/630]">
              <img src={url} alt={`OG card for ${activeSlug}`} className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground break-all">
              <code className="px-2 py-1 rounded bg-muted">{url}</code>
              <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                Open <ExternalLink size={12} />
              </a>
            </div>
            {event && (
              <p className="text-xs text-muted-foreground">
                Source: <strong>{event.title}</strong>
                {event.og_image_url ? " — using custom OG upload" : " — using generated branded card"}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminOgPreview;