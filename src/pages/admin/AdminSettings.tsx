import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import { Mail, Phone, MapPin } from "lucide-react";
import AboutTeamEditor from "@/components/admin/AboutTeamEditor";
import RichTextEditor from "@/components/RichTextEditor";
import BackupExportButton from "@/components/admin/BackupExportButton";

type Settings = {
  contact_email: string | null;
  contact_phone: string | null;
  office_address: string | null;
  twitter_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  youtube_url: string | null;
  weekly_digest_enabled: boolean;
  auto_issue_certificates: boolean;
  about_hero_tagline: string | null;
  about_mission: string | null;
  about_vision: string | null;
  about_story: string | null;
  about_stats: {
    participants_label?: string;
    events_label?: string;
    projects_label?: string;
    mentors_label?: string;
  } | null;
};

const empty: Settings = {
  contact_email: "bfozoh@gmail.com",
  contact_phone: "+237 6 92 16 96 74",
  office_address: "Yaoundé, Cameroon",
  twitter_url: "https://twitter.com/techbridge",
  linkedin_url: "https://www.linkedin.com/company/techbridge",
  github_url: "https://github.com/ajah237/techbridge-platform",
  youtube_url: "https://www.youtube.com/@techbridge",
  weekly_digest_enabled: true,
  auto_issue_certificates: true,
  about_hero_tagline: "", about_mission: "", about_vision: "",
  about_story: "",
  about_stats: {
    participants_label: "Participants Trained",
    events_label: "Events Organized",
    projects_label: "Projects Submitted",
    mentors_label: "Active Mentors",
  },
};

const optionalUrl = z.string().trim().max(500).url("Must be a valid URL").or(z.literal(""));
const schema = z.object({
  contact_email: z.string().trim().email("Invalid email").max(255),
  contact_phone: z.string().trim().min(5, "Too short").max(40),
  office_address: z.string().trim().min(3).max(300),
  twitter_url: optionalUrl,
  linkedin_url: optionalUrl,
  github_url: optionalUrl,
  youtube_url: optionalUrl,
});
type FieldErrors = Partial<Record<keyof Settings, string>>;

/** Phone: keep digits and a leading +; collapse separators. */
const normalizePhone = (raw: string): string => {
  if (!raw) return "";
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return "";
  return (hasPlus ? "+" : "") + digits;
};

/** URL: trim, lowercase host, default to https://, drop trailing slash. */
const canonicalizeUrl = (raw: string): string => {
  const v = (raw ?? "").trim();
  if (!v) return "";
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withProto);
    u.host = u.host.toLowerCase();
    let out = u.toString();
    if (out.endsWith("/") && u.pathname === "/") out = out.slice(0, -1);
    return out;
  } catch { return v; }
};

const URL_KEYS = ["twitter_url", "linkedin_url", "github_url", "youtube_url"] as const;

const normalizeSettings = (s: Settings): Settings => ({
  ...s,
  contact_email: (s.contact_email ?? "").trim().toLowerCase(),
  contact_phone: normalizePhone(s.contact_phone ?? ""),
  office_address: (s.office_address ?? "").trim(),
  twitter_url: canonicalizeUrl(s.twitter_url ?? ""),
  linkedin_url: canonicalizeUrl(s.linkedin_url ?? ""),
  github_url: canonicalizeUrl(s.github_url ?? ""),
  youtube_url: canonicalizeUrl(s.youtube_url ?? ""),
  weekly_digest_enabled: !!s.weekly_digest_enabled,
  auto_issue_certificates: !!s.auto_issue_certificates,
  about_hero_tagline: (s.about_hero_tagline ?? "").trim(),
  about_mission: (s.about_mission ?? "").trim(),
  about_vision: (s.about_vision ?? "").trim(),
  about_story: (s.about_story ?? "").trim(),
  about_stats: s.about_stats ?? empty.about_stats,
});

const AdminSettings = () => {
  const [s, setS] = useState<Settings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("site_settings").select("*").eq("id", "global").maybeSingle();
      if (data) setS(data as any);
      setLoading(false);
    })();
  }, []);

  const normalized = normalizeSettings(s);

  const validate = (target: Settings): FieldErrors => {
    const parsed = schema.safeParse({
      contact_email: target.contact_email ?? "",
      contact_phone: target.contact_phone ?? "",
      office_address: target.office_address ?? "",
      twitter_url: target.twitter_url ?? "",
      linkedin_url: target.linkedin_url ?? "",
      github_url: target.github_url ?? "",
      youtube_url: target.youtube_url ?? "",
    });
    if (parsed.success) return {};
    const out: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0] as keyof Settings;
      if (!out[k]) out[k] = issue.message;
    }
    return out;
  };

  const save = async () => {
    const payload = normalizeSettings(s);
    const errs = validate(payload);
    setErrors(errs);
    if (Object.keys(errs).length) { toast.error("Please fix the highlighted fields."); return; }
    setSaving(true);
    const { error } = await supabase.from("site_settings").update({
      ...payload, updated_at: new Date().toISOString(),
    }).eq("id", "global");
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setS(payload); // reflect saved canonical form
    const { logAdminAction } = await import("@/lib/auditLog");
    await logAdminAction("settings.updated", "settings", null, "Site settings", {
      fields: Object.keys(payload),
    });
    toast.success("Settings saved.");
  };

  if (loading) return <div className="p-6">Loading…</div>;

  type StringKey = "contact_email" | "contact_phone" | "office_address" | "twitter_url" | "linkedin_url" | "github_url" | "youtube_url";
  const field = (k: StringKey, label: string, type = "text") => (
    <div className="space-y-2">
      <Label>{label}</Label>
      {k === "office_address" ? (
        <Textarea rows={3} value={(s[k] as string) ?? ""} onChange={(e) => { setS({ ...s, [k]: e.target.value }); setErrors({ ...errors, [k]: undefined }); }} aria-invalid={!!errors[k]} />
      ) : (
        <Input type={type} value={(s[k] as string) ?? ""} onChange={(e) => { setS({ ...s, [k]: e.target.value }); setErrors({ ...errors, [k]: undefined }); }} aria-invalid={!!errors[k]} />
      )}
      {errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>}
    </div>
  );

  const socials: Array<[StringKey, string]> = [
    ["twitter_url", "Twitter"],
    ["linkedin_url", "LinkedIn"],
    ["github_url", "GitHub"],
    ["youtube_url", "YouTube"],
  ];

  return (
    <div className="grid lg:grid-cols-[1fr,360px] gap-6 max-w-6xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold">Site Settings</h1>
          <p className="text-sm text-muted-foreground">Edit public TechBridge contact details and social links. Inputs are normalized on save (phones → digits, URLs → https://).</p>
        </div>
        <Card>
          <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {field("contact_email", "Email", "email")}
            {field("contact_phone", "Phone")}
            {field("office_address", "Office Address")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Social Links</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {field("twitter_url", "Twitter URL", "url")}
            {field("linkedin_url", "LinkedIn URL", "url")}
            {field("github_url", "GitHub URL", "url")}
            {field("youtube_url", "YouTube URL", "url")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Automations</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label className="text-sm font-medium">Weekly digest cron</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  When enabled, the scheduled <code>weekly-digest</code> function processes subscribers. When off, calls return early — no redeploy needed.
                </p>
              </div>
              <Switch
                checked={!!s.weekly_digest_enabled}
                onCheckedChange={(v) => setS({ ...s, weekly_digest_enabled: v })}
              />
            </div>
            <div className="flex items-start justify-between gap-4 pt-4 border-t">
              <div>
                <Label className="text-sm font-medium">Auto-issue certificates on event completion</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  When an event status changes to <code>completed</code>, all registered participants are marked attended and issued a certificate automatically.
                </p>
              </div>
              <Switch
                checked={!!s.auto_issue_certificates}
                onCheckedChange={(v) => setS({ ...s, auto_issue_certificates: v })}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>About Page</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Hero tagline</Label>
              <Textarea
                rows={2}
                value={s.about_hero_tagline ?? ""}
                onChange={(e) => setS({ ...s, about_hero_tagline: e.target.value })}
                placeholder="Short paragraph under the About hero title."
              />
            </div>
            <div className="space-y-2">
              <Label>Mission statement</Label>
              <Textarea
                rows={4}
                value={s.about_mission ?? ""}
                onChange={(e) => setS({ ...s, about_mission: e.target.value })}
                placeholder="What TechBridge is here to do."
              />
            </div>
            <div className="space-y-2">
              <Label>Vision statement</Label>
              <Textarea
                rows={4}
                value={s.about_vision ?? ""}
                onChange={(e) => setS({ ...s, about_vision: e.target.value })}
                placeholder="The future TechBridge is building toward."
              />
            </div>
            <div className="space-y-2">
              <Label>Our Story (rich text)</Label>
              <p className="text-xs text-muted-foreground">Long-form narrative shown in the "Our Story" section of the public About page.</p>
              <RichTextEditor
                content={s.about_story ?? ""}
                onChange={(html) => setS({ ...s, about_story: html })}
                placeholder="Tell the TechBridge story…"
              />
            </div>
            <div className="space-y-2 pt-4 border-t">
              <Label className="text-base">Impact Stat Labels</Label>
              <p className="text-xs text-muted-foreground">
                Numbers are pulled live from the database. Edit only the labels shown beneath each number.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {([
                  ["participants_label", "Participants label"],
                  ["events_label", "Events label"],
                  ["projects_label", "Projects label"],
                  ["mentors_label", "Mentors label"],
                ] as const).map(([k, lbl]) => (
                  <div key={k} className="space-y-1">
                    <Label className="text-xs">{lbl}</Label>
                    <Input
                      value={(s.about_stats as any)?.[k] ?? ""}
                      onChange={(e) =>
                        setS({ ...s, about_stats: { ...(s.about_stats ?? {}), [k]: e.target.value } })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t">
              <AboutTeamEditor />
            </div>
          </CardContent>
        </Card>
        <Button onClick={save} disabled={saving} className="bg-gradient-primary text-primary-foreground">
          {saving ? "Saving…" : "Save Settings"}
        </Button>

        <Card id="backup-restore">
          <CardHeader>
            <CardTitle>Backup, Export &amp; Restore (Bootcamp Data Recovery)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Download a full JSON snapshot of all tables, or upload/paste a previous backup JSON file to recover past bootcamps, events, participant registrations, certificates, and profiles.
            </p>
          </CardHeader>
          <CardContent>
            <BackupExportButton />
          </CardContent>
        </Card>
      </div>

      <aside className="lg:sticky lg:top-6 self-start">
        <Card>
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
            <p className="text-xs text-muted-foreground">Exactly what will be saved (after normalization).</p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-start gap-2"><Mail className="h-4 w-4 mt-0.5 text-primary" /><span className="break-all">{normalized.contact_email || <em className="text-muted-foreground">email…</em>}</span></div>
            <div className="flex items-start gap-2"><Phone className="h-4 w-4 mt-0.5 text-primary" /><span>{normalized.contact_phone || <em className="text-muted-foreground">phone…</em>}</span></div>
            <div className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-primary" /><span className="whitespace-pre-line">{normalized.office_address || <em className="text-muted-foreground">address…</em>}</span></div>
            <div className="pt-3 border-t">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Socials</p>
              <div className="flex flex-wrap gap-2">
                {socials.map(([k, label]) => {
                  const v = (normalized[k] ?? "").trim();
                  return v ? (
                    <a key={k} href={v} target="_blank" rel="noopener noreferrer" className="px-3 py-1 rounded-md bg-muted text-xs hover:bg-primary/10 hover:text-primary transition-colors">{label}</a>
                  ) : (
                    <span key={k} className="px-3 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground">{label}</span>
                  );
                })}
              </div>
              {URL_KEYS.some(k => ((s[k] as string) ?? "") !== ((normalized[k] as string) ?? "")) || normalizePhone(s.contact_phone ?? "") !== (s.contact_phone ?? "").trim() ? (
                <p className="mt-3 text-[11px] text-muted-foreground italic">Some values will be cleaned up on save.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
};

export default AdminSettings;