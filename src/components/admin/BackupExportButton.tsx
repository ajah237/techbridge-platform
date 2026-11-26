import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  Database,
  FileJson,
  RotateCcw,
  Sparkles,
  Calendar,
  Users,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/auditLog";
import {
  parseBackupJsonPayload,
  restoreLocalBackup,
  type RestoreBackupResult,
} from "@/integrations/supabase/localBackend";

/**
 * Complete Backup Export & Restore / Bootcamp Data Recovery component.
 * Exports all admin-visible tables into a single JSON file, and allows the admin
 * to upload or paste any previous backup JSON file to preview and restore tables
 * (events/bootcamps, programs, categories, registrations, participants, certificates,
 * projects, blog posts, profiles, settings, etc.).
 */
export const BACKUP_TABLES = [
  "events",
  "event_programs",
  "event_categories",
  "category_fee_tiers",
  "event_registrations",
  "team_registrations",
  "registration_participants",
  "registration_payments",
  "registration_events",
  "event_feedback",
  "event_people",
  "event_announcements",
  "sponsorships",
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
  "contact_submissions",
  "content_reports",
  "points_log",
  "badges",
  "user_badges",
  "auth_audit_log",
  "admin_audit_log",
  "booking_events",
] as const;

const BOOTCAMP_CORE_TABLES = new Set([
  "events",
  "event_programs",
  "event_categories",
  "category_fee_tiers",
  "event_registrations",
  "team_registrations",
  "registration_participants",
  "registration_payments",
  "event_feedback",
  "event_people",
  "event_announcements",
  "certificates",
  "projects",
  "profiles",
]);

const BackupExportButton = () => {
  const [busyExport, setBusyExport] = useState(false);
  const [busyRestore, setBusyRestore] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [exportedAt, setExportedAt] = useState<string | null>(null);
  const [parsedTables, setParsedTables] = useState<Record<string, any[]> | null>(null);
  const [selectedTables, setSelectedTables] = useState<Record<string, boolean>>({});
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [preserveCameroonContact, setPreserveCameroonContact] = useState(true);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pastedJson, setPastedJson] = useState("");
  const [lastResult, setLastResult] = useState<RestoreBackupResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const runExport = async () => {
    setBusyExport(true);
    const bundle: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      schema_version: 2,
    };
    const failed: string[] = [];
    for (const table of BACKUP_TABLES) {
      const { data, error } = await supabase.from(table as never).select("*").limit(10000);
      if (error) {
        failed.push(table);
        continue;
      }
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
      tables: BACKUP_TABLES.length,
      failed,
    });
    setBusyExport(false);
    if (failed.length) toast.warning(`Exported with ${failed.length} table(s) skipped`);
    else toast.success("Full JSON backup downloaded");
  };

  const loadBackupJsonString = (rawText: string, sourceLabel: string) => {
    try {
      const parsed = JSON.parse(rawText);
      const { exportedAt: exp, tables } = parseBackupJsonPayload(parsed);
      const tableKeys = Object.keys(tables);
      if (tableKeys.length === 0) {
        toast.error("No valid table arrays were found in this JSON file.");
        return;
      }
      const nextSelected: Record<string, boolean> = {};
      for (const k of tableKeys) {
        nextSelected[k] = tables[k].length > 0;
      }
      setFileName(sourceLabel);
      setExportedAt(exp);
      setParsedTables(tables);
      setSelectedTables(nextSelected);
      setLastResult(null);
      const totalRows = Object.values(tables).reduce((sum, arr) => sum + arr.length, 0);
      toast.success(`Loaded backup "${sourceLabel}" (${totalRows} records across ${tableKeys.length} tables)`);
    } catch (err: any) {
      toast.error(err?.message || "Could not parse JSON file. Please verify it is valid JSON.");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    loadBackupJsonString(text, file.name);
    e.target.value = "";
  };

  const selectAllTables = (checked: boolean) => {
    if (!parsedTables) return;
    const next: Record<string, boolean> = {};
    for (const k of Object.keys(parsedTables)) {
      next[k] = checked && parsedTables[k].length > 0;
    }
    setSelectedTables(next);
  };

  const selectBootcampTablesOnly = () => {
    if (!parsedTables) return;
    const next: Record<string, boolean> = {};
    for (const k of Object.keys(parsedTables)) {
      next[k] = BOOTCAMP_CORE_TABLES.has(k) && parsedTables[k].length > 0;
    }
    setSelectedTables(next);
    toast.info("Selected bootcamp, event, registration, participant, and certificate tables.");
  };

  const runRestore = async () => {
    if (!parsedTables) return;
    const activeTables = Object.keys(parsedTables).filter(
      (k) => selectedTables[k] && (parsedTables[k]?.length ?? 0) > 0,
    );
    if (activeTables.length === 0) {
      toast.error("Please select at least one non-empty table to restore.");
      return;
    }

    setBusyRestore(true);
    try {
      // 1. Restore directly into the resilient local database (instant & complete)
      const result = restoreLocalBackup(parsedTables, {
        mode: restoreMode,
        tables: activeTables,
        preserveCameroonContact,
      });

      // 2. Also upsert through the Supabase client so any connected remote instance receives the rows
      for (const table of activeTables) {
        const rows = parsedTables[table];
        if (!rows || rows.length === 0) continue;
        await supabase.from(table as never).upsert(rows as never, { onConflict: "id" });
      }

      setLastResult(result);
      toast.success(
        `Restored ${result.totalRows} records across ${Object.keys(result.restoredTables).length} tables!`,
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to restore backup.");
    } finally {
      setBusyRestore(false);
    }
  };

  const detectedBootcamps =
    parsedTables?.events?.filter(
      (e) =>
        String(e?.event_type || "").toLowerCase() === "bootcamp" ||
        String(e?.title || "").toLowerCase().includes("bootcamp"),
    ) ?? [];

  const detectedEvents = parsedTables?.events ?? [];

  return (
    <div className="space-y-6">
      {/* Export & Upload buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={runExport} disabled={busyExport} className="gap-2">
          {busyExport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {busyExport ? "Exporting…" : "Download Backup (JSON)"}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="gap-2 bg-gradient-primary text-primary-foreground"
        >
          <Upload className="h-4 w-4" />
          Upload Backup JSON to Restore
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowPasteBox((v) => !v)}
          className="gap-1.5 text-xs"
        >
          <FileJson className="h-4 w-4" />
          {showPasteBox ? "Hide Paste JSON" : "Or Paste Raw Backup JSON"}
        </Button>
      </div>

      {/* Optional Paste JSON box */}
      {showPasteBox && (
        <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/20">
          <Label className="text-xs font-medium">
            Paste your backup JSON content below (full backup object or an array of events/bootcamps):
          </Label>
          <Textarea
            rows={6}
            value={pastedJson}
            onChange={(e) => setPastedJson(e.target.value)}
            placeholder='{"exported_at": "...", "events": [...], "event_registrations": [...]}'
            className="font-mono text-xs"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => loadBackupJsonString(pastedJson, "Pasted Backup JSON")}
            disabled={!pastedJson.trim()}
          >
            Inspect Pasted JSON
          </Button>
        </div>
      )}

      {/* Loaded Backup Preview & Restore Controls */}
      {parsedTables && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h4 className="font-heading font-bold text-sm flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Backup Loaded: <span className="text-primary">{fileName}</span>
              </h4>
              {exportedAt && (
                <p className="text-xs text-muted-foreground">
                  Snapshot exported at: {new Date(exportedAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => selectAllTables(true)}>
                Select All
              </Button>
              <Button type="button" variant="secondary" size="sm" className="h-7 text-xs gap-1" onClick={selectBootcampTablesOnly}>
                <Sparkles className="h-3 w-3" /> Bootcamps &amp; Events Only
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => selectAllTables(false)}>
                Clear
              </Button>
            </div>
          </div>

          {/* Highlight detected bootcamps & events inside the backup file */}
          {detectedEvents.length > 0 && (
            <div className="rounded-lg bg-background/80 border border-border/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  Found {detectedEvents.length} Event(s) in Backup ({detectedBootcamps.length} Bootcamp
                  {detectedBootcamps.length === 1 ? "" : "s"}):
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detectedEvents.slice(0, 12).map((ev: any, idx: number) => (
                  <Badge key={ev.id || idx} variant="secondary" className="text-xs">
                    {ev.title || ev.slug || `Event #${idx + 1}`} ({ev.event_type || "event"})
                  </Badge>
                ))}
                {detectedEvents.length > 12 && (
                  <Badge variant="outline" className="text-xs">
                    +{detectedEvents.length - 12} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Table selection grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1">
            {Object.entries(parsedTables).map(([table, rows]) => {
              const count = rows?.length ?? 0;
              const checked = !!selectedTables[table];
              return (
                <label
                  key={table}
                  className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs cursor-pointer transition-colors ${
                    checked ? "border-primary/50 bg-background" : "border-border/50 bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={count === 0}
                      onChange={(e) =>
                        setSelectedTables((prev) => ({
                          ...prev,
                          [table]: e.target.checked,
                        }))
                      }
                      className="rounded border-border"
                    />
                    <span className="font-mono truncate">{table}</span>
                  </div>
                  <Badge variant={count > 0 ? "default" : "outline"} className="text-[10px] shrink-0">
                    {count}
                  </Badge>
                </label>
              );
            })}
          </div>

          {/* Restore Options */}
          <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Restore Mode</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={restoreMode === "merge" ? "default" : "outline"}
                  onClick={() => setRestoreMode("merge")}
                  className="text-xs flex-1"
                >
                  Merge &amp; Recover (Safe)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={restoreMode === "replace" ? "destructive" : "outline"}
                  onClick={() => setRestoreMode("replace")}
                  className="text-xs flex-1"
                >
                  Overwrite Selected Tables
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {restoreMode === "merge"
                  ? "Keeps existing events and merges/updates records from your backup JSON."
                  : "Replaces the selected tables with the exact rows from your backup JSON."}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 p-3">
              <div>
                <Label className="text-xs font-semibold">Keep Yaoundé Contact Info</Label>
                <p className="text-[11px] text-muted-foreground">
                  Preserve +237 6 92 16 96 74, bfozoh@gmail.com &amp; Yaoundé, Cameroon even if backup has old contact settings.
                </p>
              </div>
              <Switch checked={preserveCameroonContact} onCheckedChange={setPreserveCameroonContact} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              onClick={runRestore}
              disabled={busyRestore}
              className="gap-2 bg-gradient-primary text-primary-foreground"
            >
              {busyRestore ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {busyRestore ? "Restoring Data…" : "Restore Selected Data Now"}
            </Button>
          </div>
        </div>
      )}

      {/* Post-Restore Confirmation Banner */}
      {lastResult && (
        <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-heading font-bold text-sm text-foreground">
                Backup Restored Successfully — {lastResult.totalRows} Records Recovered
              </h4>
              <p className="text-xs text-muted-foreground">
                Recovered{" "}
                <strong>
                  {lastResult.eventsRecovered} event(s) ({lastResult.bootcampsRecovered} bootcamp
                  {lastResult.bootcampsRecovered === 1 ? "" : "s"})
                </strong>{" "}
                across {Object.keys(lastResult.restoredTables).length} table(s).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm" variant="secondary" className="gap-1.5 text-xs">
              <Link to="/admin/events">
                <Calendar className="h-3.5 w-3.5" /> View Recovered Bootcamps &amp; Events
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
              <Link to="/admin/registrations">
                <Users className="h-3.5 w-3.5" /> View Recovered Registrations
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
              <Link to="/admin/certificates">
                <Award className="h-3.5 w-3.5" /> View Recovered Certificates
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupExportButton;
