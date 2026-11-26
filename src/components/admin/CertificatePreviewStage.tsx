import { useCallback, useEffect, useRef, useState } from "react";
import Certificate, { type CertificateProps } from "@/components/Certificate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Move, RotateCcw, ScanLine } from "lucide-react";
import {
  auditCertificateLayout,
  A4_LANDSCAPE_PX,
  type ValidationResult,
} from "@/lib/certificateValidation";

interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  certificate: CertificateProps & { certificateNumber: string };
  /** Stamp offsets in sheet pixels — dragging the stamp zone updates these. */
  stampOffsetX: number;
  stampOffsetY: number;
  onStampOffsetChange: (x: number, y: number) => void;
  className?: string;
}

const DEFAULT_SIGNATURE_ZONE: Zone = { x: 0.66, y: 0.7, w: 0.22, h: 0.16 };

/**
 * Interactive A4-landscape certificate preview with draggable stamp and
 * signature safe zones, plus an on-demand layout validation pass so alignment
 * can be confirmed before any download.
 */
const CertificatePreviewStage = ({
  certificate,
  stampOffsetX,
  stampOffsetY,
  onStampOffsetChange,
  className,
}: Props) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.42);
  const [showZones, setShowZones] = useState(true);
  const [sigZone, setSigZone] = useState<Zone>(DEFAULT_SIGNATURE_ZONE);
  const [audit, setAudit] = useState<ValidationResult | null>(null);
  const drag = useRef<{ kind: "stamp" | "signature"; startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(0.62, el.clientWidth / A4_LANDSCAPE_PX.width));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onPointerDown = (kind: "stamp" | "signature") => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      baseX: kind === "stamp" ? stampOffsetX : sigZone.x,
      baseY: kind === "stamp" ? stampOffsetY : sigZone.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    if (d.kind === "stamp") {
      onStampOffsetChange(Math.round(d.baseX + dx), Math.round(d.baseY + dy));
    } else {
      setSigZone((z) => ({
        ...z,
        x: Math.min(1 - z.w, Math.max(0, d.baseX + dx / A4_LANDSCAPE_PX.width)),
        y: Math.min(1 - z.h, Math.max(0, d.baseY + dy / A4_LANDSCAPE_PX.height)),
      }));
    }
  };

  const endDrag = () => {
    drag.current = null;
  };

  const nudge = (kind: "stamp" | "signature", dx: number, dy: number) => {
    if (kind === "stamp") onStampOffsetChange(stampOffsetX + dx, stampOffsetY + dy);
    else
      setSigZone((z) => ({
        ...z,
        x: Math.min(1 - z.w, Math.max(0, z.x + dx / A4_LANDSCAPE_PX.width)),
        y: Math.min(1 - z.h, Math.max(0, z.y + dy / A4_LANDSCAPE_PX.height)),
      }));
  };

  const runAudit = useCallback(() => {
    if (!sheetRef.current) return;
    setAudit(auditCertificateLayout(sheetRef.current, { expectQr: !!certificate.verifyUrl }));
  }, [certificate.verifyUrl]);

  const errors = audit?.issues.filter((i) => i.severity === "error") ?? [];
  const warnings = audit?.issues.filter((i) => i.severity === "warning") ?? [];

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowZones((s) => !s)}>
          <Move size={14} /> {showZones ? "Hide safe zones" : "Show safe zones"}
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={runAudit}>
          <ScanLine size={14} /> Validate layout
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => {
            onStampOffsetChange(0, 0);
            setSigZone(DEFAULT_SIGNATURE_ZONE);
            setAudit(null);
          }}
        >
          <RotateCcw size={14} /> Reset zones
        </Button>
        <Badge variant="secondary" className="ml-auto font-mono text-xs">
          A4 landscape · {Math.round(scale * 100)}%
        </Badge>
      </div>

      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-lg border bg-muted/30"
        style={{ height: A4_LANDSCAPE_PX.height * scale }}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: A4_LANDSCAPE_PX.width,
            height: A4_LANDSCAPE_PX.height,
          }}
        >
          <Certificate ref={sheetRef} {...certificate} stampOffsetX={stampOffsetX} stampOffsetY={stampOffsetY} />

          {showZones && (
            <>
              {/* Printable safe margin guide (10mm) */}
              <div
                aria-hidden
                className="pointer-events-none absolute border-2 border-dashed border-primary/40"
                style={{ inset: `${(10 * 96) / 25.4}px` }}
              />
              {/* Draggable stamp safe zone — centred signature band */}
              <button
                type="button"
                aria-label="Drag stamp safe zone"
                onPointerDown={onPointerDown("stamp")}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 10 : 2;
                  if (e.key === "ArrowLeft") nudge("stamp", -step, 0);
                  if (e.key === "ArrowRight") nudge("stamp", step, 0);
                  if (e.key === "ArrowUp") nudge("stamp", 0, -step);
                  if (e.key === "ArrowDown") nudge("stamp", 0, step);
                }}
                className="absolute cursor-grab rounded-md border-2 border-dashed border-accent bg-accent/10 text-[11px] font-semibold uppercase tracking-widest text-accent active:cursor-grabbing"
                style={{
                  width: (30 * 96) / 25.4,
                  height: (30 * 96) / 25.4,
                  left: A4_LANDSCAPE_PX.width * 0.5 - (15 * 96) / 25.4 + stampOffsetX,
                  top: A4_LANDSCAPE_PX.height * 0.66 + stampOffsetY,
                  touchAction: "none",
                }}
              >
                Stamp
              </button>
              {/* Draggable signature safe zone */}
              <button
                type="button"
                aria-label="Drag signature safe zone"
                onPointerDown={onPointerDown("signature")}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 10 : 2;
                  if (e.key === "ArrowLeft") nudge("signature", -step, 0);
                  if (e.key === "ArrowRight") nudge("signature", step, 0);
                  if (e.key === "ArrowUp") nudge("signature", 0, -step);
                  if (e.key === "ArrowDown") nudge("signature", 0, step);
                }}
                className="absolute cursor-grab rounded-md border-2 border-dashed border-primary bg-primary/10 text-[11px] font-semibold uppercase tracking-widest text-primary active:cursor-grabbing"
                style={{
                  left: sigZone.x * A4_LANDSCAPE_PX.width,
                  top: sigZone.y * A4_LANDSCAPE_PX.height,
                  width: sigZone.w * A4_LANDSCAPE_PX.width,
                  height: sigZone.h * A4_LANDSCAPE_PX.height,
                  touchAction: "none",
                }}
              >
                Signature
              </button>
            </>
          )}
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Drag the dashed zones (or focus one and use the arrow keys) to confirm alignment. The stamp zone updates the saved
        stamp position; the signature zone is a print guide for hand-signing.
      </p>

      {audit && (
        <div
          className={`mt-3 rounded-md border p-3 text-sm ${
            errors.length ? "border-destructive/40 bg-destructive/10" : "border-primary/30 bg-primary/5"
          }`}
        >
          <p className="flex items-center gap-2 font-medium">
            {errors.length ? (
              <>
                <AlertTriangle size={15} className="text-destructive" /> {errors.length} layout issue
                {errors.length > 1 ? "s" : ""} found
              </>
            ) : (
              <>
                <CheckCircle2 size={15} className="text-primary" /> Layout valid — A4 landscape, margins, QR and text all
                within bounds
              </>
            )}
          </p>
          {[...errors, ...warnings].length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {[...errors, ...warnings].slice(0, 8).map((i, idx) => (
                <li key={`${i.code}-${idx}`}>{i.message}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            {audit.meta.widthPx}×{audit.meta.heightPx}px · {String(audit.meta.textNodes)} text nodes ·{" "}
            {audit.meta.qr ? "QR present" : "no QR"}
          </p>
        </div>
      )}
    </div>
  );
};

export default CertificatePreviewStage;
