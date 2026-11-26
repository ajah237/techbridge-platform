import { useCallback, useRef, useState } from "react";
import { exportCertificateBatch, type BatchItem, type BatchItemStatus } from "@/lib/certificateExport";

export interface ExportJobItem {
  certificateNumber: string;
  status: BatchItemStatus;
  error?: string;
}

export interface ExportJob {
  id: string;
  mode: "files" | "zip";
  state: "running" | "completed" | "cancelled" | "failed";
  total: number;
  done: number;
  items: ExportJobItem[];
  startedAt: number;
  finishedAt?: number;
  message?: string;
}

/**
 * Runs certificate batch exports as a cancellable background job with live status,
 * so admins can keep browsing while large selections render.
 */
export function useCertificateExportJob() {
  const [job, setJob] = useState<ExportJob | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (items: BatchItem[], mode: "files" | "zip", zipName?: string) => {
      if (items.length === 0) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const id = `job-${Date.now()}`;

      setJob({
        id,
        mode,
        state: "running",
        total: items.length,
        done: 0,
        startedAt: Date.now(),
        items: items.map((i) => ({ certificateNumber: i.certificateNumber, status: "queued" as BatchItemStatus })),
      });

      try {
        const result = await exportCertificateBatch(items, {
          mode,
          zipName,
          signal: controller.signal,
          onProgress: (done) => setJob((j) => (j && j.id === id ? { ...j, done } : j)),
          onItem: (certificateNumber, status, error) =>
            setJob((j) =>
              j && j.id === id
                ? {
                    ...j,
                    items: j.items.map((it) =>
                      it.certificateNumber === certificateNumber ? { ...it, status, error } : it,
                    ),
                  }
                : j,
            ),
        });
        setJob((j) =>
          j && j.id === id
            ? {
                ...j,
                state: result.failed.length && !result.succeeded ? "failed" : "completed",
                done: j.total,
                finishedAt: Date.now(),
                message: result.failed.length
                  ? `${result.succeeded} exported · ${result.failed.length} failed`
                  : `${result.succeeded} certificate${result.succeeded > 1 ? "s" : ""} exported`,
              }
            : j,
        );
        return result;
      } catch (err) {
        const cancelled = err instanceof DOMException && err.name === "AbortError";
        setJob((j) =>
          j && j.id === id
            ? {
                ...j,
                state: cancelled ? "cancelled" : "failed",
                finishedAt: Date.now(),
                message: cancelled ? "Export cancelled" : "Export failed — try a smaller batch",
              }
            : j,
        );
      } finally {
        abortRef.current = null;
      }
    },
    [],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);
  const dismiss = useCallback(() => setJob(null), []);

  return { job, start, cancel, dismiss, isRunning: job?.state === "running" };
}
