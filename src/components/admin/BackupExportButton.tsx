import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/auditLog";

/**
 * One-click backup export: dumps user-visible tables the admin has read
 * access to into a single JSON file. Uses PostgREST — RLS still applies,
 * so admins get the admin-scoped rows and nothing beyond.
 */
const TABLES = [
  "events",
  "event_programs",
  "event_registrations",
  "event_feedback",
  "projects",
  "blog_posts",
  "blog_comments",
  "forum_categories",
  "forum_threads",
  "forum_replies",
  "mentor_profiles",
  "mentor_bookings",
  "mentor_reviews",
  "certificates",
  "profiles",
  "user_roles",
  "site_settings",
  "about_team_members",
  "newsletter_subscribers",
  "content_reports",
  "auth_audit_log",
  "admin_audit_log",
  "booking_events",
] as const;

const BackupExportButton = () => {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const bundle: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      schema_version: 1,
    };
    const failed: string[] = [];
    for (const table of TABLES) {
      const { data, error } = await supabase.from(table as never).select("*").limit(10000);
      if (error) { failed.push(table); continue; }
      bundle[table] = data ?? [];
    }
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `techbridge-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    await logAdminAction("backup.export", "settings", null, "Full JSON backup", {
      tables: TABLES.length,
      failed,
    });
    setBusy(false);
    if (failed.length) toast.warning(`Exported with ${failed.length} table(s) skipped`);
    else toast.success("Backup downloaded");
  };

  return (
    <Button type="button" variant="outline" onClick={run} disabled={busy} className="gap-2">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {busy ? "Exporting…" : "Download backup (JSON)"}
    </Button>
  );
};

export default BackupExportButton;