import { CheckCircle2, FileArchive, FileDown, Loader2, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { ExportJob } from "@/hooks/useCertificateExportJob";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

interface Props {
  job: ExportJob | null;
  onCancel: () => void;
  onDismiss: () => void;
}

/** Floating background-job status card for certificate batch exports. */
const CertificateJobPanel = ({ job, onCancel, onDismiss }: Props) => {
  const reduced = usePrefersReducedMotion();
  if (!job) return null;

  const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
  const failed = job.items.filter((i) => i.status === "failed");
  const running = job.state === "running";
  const current = job.items.find((i) => i.status === "rendering");

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-20 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border/60 bg-card/95 p-4 shadow-elevated backdrop-blur sm:bottom-6",
        !reduced && "animate-fade-in",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {running ? (
            <Loader2 size={16} className={cn("text-primary", !reduced && "animate-spin")} />
          ) : job.state === "completed" ? (
            <CheckCircle2 size={16} className="text-emerald-600" />
          ) : (
            <XCircle size={16} className="text-destructive" />
          )}
          {job.mode === "zip" ? <FileArchive size={14} /> : <FileDown size={14} />}
          Certificate export
        </div>
        {!running && (
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onDismiss} aria-label="Dismiss export status">
            <X size={14} />
          </Button>
        )}
      </div>

      <Progress value={pct} className="mt-3 h-1.5" />
      <p className="mt-2 text-xs text-muted-foreground">
        {running
          ? `Rendering A4 landscape PDFs — ${job.done} of ${job.total}${current ? ` · ${current.certificateNumber}` : ""}`
          : job.message}
      </p>

      {failed.length > 0 && (
        <div className="mt-2 space-y-1">
          <Badge variant="destructive">{failed.length} failed</Badge>
          <ul className="max-h-24 overflow-y-auto text-xs text-muted-foreground">
            {failed.map((f) => (
              <li key={f.certificateNumber} className="font-mono">{f.certificateNumber}</li>
            ))}
          </ul>
        </div>
      )}

      {running && (
        <Button size="sm" variant="outline" className="mt-3 w-full" onClick={onCancel}>
          Cancel export
        </Button>
      )}
    </div>
  );
};

export default CertificateJobPanel;
