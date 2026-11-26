/**
 * Certificate export validation.
 *
 * Two layers:
 *  1. `auditCertificateLayout` — DOM-level checks on a rendered certificate sheet
 *     (margins, QR placement, text overflow, logo rendering) before rasterising.
 *  2. `validateCertificatePdf` — byte-level checks on the produced PDF
 *     (page size, rotation, page count) so a download can never come out
 *     portrait, cropped or mis-scaled.
 */

export const A4_LANDSCAPE_PT = { width: 841.89, height: 595.28 };
/** True A4 landscape in CSS px at 96dpi. */
export const A4_LANDSCAPE_PX = { width: (297 * 96) / 25.4, height: (210 * 96) / 25.4 };
/** Printable safe margin of the sheet in mm (matches the outer gold frame). */
export const SAFE_MARGIN_MM = 10;
const MM_TO_PX = 96 / 25.4;

export interface ValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  meta: Record<string, string | number | boolean>;
}

const issue = (code: string, message: string, severity: ValidationIssue["severity"] = "error"): ValidationIssue => ({
  code,
  message,
  severity,
});

const result = (issues: ValidationIssue[], meta: ValidationResult["meta"] = {}): ValidationResult => ({
  ok: issues.every((i) => i.severity !== "error"),
  issues,
  meta,
});

/* ------------------------------------------------------------------ *
 * PDF byte-level validation
 * ------------------------------------------------------------------ */

export interface PdfGeometry {
  pageCount: number;
  /** MediaBox width/height in PDF points for the first page. */
  width: number;
  height: number;
  rotation: number;
}

const latin1Decoder = new TextDecoder("latin1");

function latin1(bytes: Uint8Array): string {
  return latin1Decoder.decode(bytes);
}

/** Reads page geometry straight from the PDF page dictionaries (they are never compressed by jsPDF). */
export function readPdfGeometry(bytes: Uint8Array): PdfGeometry | null {
  const src = latin1(bytes);
  if (!src.startsWith("%PDF-")) return null;

  const boxes = [...src.matchAll(/\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/g)];
  if (boxes.length === 0) return null;
  const [, x0, y0, x1, y1] = boxes[0].map(Number) as unknown as number[];

  const rotate = src.match(/\/Rotate\s+(-?\d+)/);
  const counts = [...src.matchAll(/\/Type\s*\/Page[^s]/g)].length;

  return {
    pageCount: Math.max(counts, boxes.length),
    width: Math.abs(Number(x1) - Number(x0)),
    height: Math.abs(Number(y1) - Number(y0)),
    rotation: rotate ? ((Number(rotate[1]) % 360) + 360) % 360 : 0,
  };
}

export function validatePdfBytes(bytes: Uint8Array, opts: { expectedPages?: number } = {}): ValidationResult {
  const geo = readPdfGeometry(bytes);
  if (!geo) return result([issue("pdf_unreadable", "The generated file is not a readable PDF document.")]);

  const issues: ValidationIssue[] = [];
  const tol = 2; // points
  const isA4Landscape =
    Math.abs(geo.width - A4_LANDSCAPE_PT.width) <= tol && Math.abs(geo.height - A4_LANDSCAPE_PT.height) <= tol;

  if (!isA4Landscape) {
    issues.push(
      issue(
        "page_size",
        `Page is ${geo.width.toFixed(1)}×${geo.height.toFixed(1)}pt, expected A4 landscape (841.9×595.3pt).`
      )
    );
  }
  if (geo.width <= geo.height) {
    issues.push(issue("orientation", "Page is not landscape — width must exceed height."));
  }
  if (geo.rotation !== 0) {
    issues.push(issue("rotation", `Page carries a /Rotate ${geo.rotation} flag; exports must be unrotated.`));
  }
  if (opts.expectedPages && geo.pageCount !== opts.expectedPages) {
    issues.push(
      issue("page_count", `PDF has ${geo.pageCount} page(s), expected ${opts.expectedPages}.`, "warning")
    );
  }
  if (bytes.byteLength < 5_000) {
    issues.push(issue("payload_size", "PDF payload is suspiciously small — artwork may not have rendered.", "warning"));
  }

  return result(issues, {
    pageCount: geo.pageCount,
    widthPt: Number(geo.width.toFixed(2)),
    heightPt: Number(geo.height.toFixed(2)),
    rotation: geo.rotation,
    bytes: bytes.byteLength,
    landscapeA4: isA4Landscape,
  });
}

export async function validateCertificatePdf(
  blob: Blob,
  opts: { expectedPages?: number } = {}
): Promise<ValidationResult> {
  const buf =
    typeof blob.arrayBuffer === "function"
      ? await blob.arrayBuffer()
      : await new Response(blob).arrayBuffer(); // jsdom Blob fallback
  const bytes = new Uint8Array(buf);
  return validatePdfBytes(bytes, opts);
}

/* ------------------------------------------------------------------ *
 * DOM layout audit
 * ------------------------------------------------------------------ */

export interface LayoutAuditOptions {
  /** Expect a QR code to be present (only when the certificate has a verify URL). */
  expectQr?: boolean;
  /** Tolerance in px for elements straying past the safe margin. */
  tolerancePx?: number;
}

/**
 * Audits a rendered certificate sheet element (unscaled, 297×210mm).
 * Pure DOM reads — safe to call right before rasterising.
 */
export function auditCertificateLayout(sheet: HTMLElement, opts: LayoutAuditOptions = {}): ValidationResult {
  const { expectQr = true, tolerancePx = 2 } = opts;
  const issues: ValidationIssue[] = [];
  const rect = sheet.getBoundingClientRect();

  const dim = (actual: number, expected: number) => Math.abs(actual - expected) <= 4;
  if (!dim(rect.width, A4_LANDSCAPE_PX.width) || !dim(rect.height, A4_LANDSCAPE_PX.height)) {
    issues.push(
      issue(
        "sheet_size",
        `Sheet measures ${rect.width.toFixed(0)}×${rect.height.toFixed(0)}px, expected ${A4_LANDSCAPE_PX.width.toFixed(
          0
        )}×${A4_LANDSCAPE_PX.height.toFixed(0)}px (A4 landscape).`
      )
    );
  }
  if (rect.width <= rect.height) {
    issues.push(issue("sheet_orientation", "Rendered sheet is not landscape."));
  }

  const safe = SAFE_MARGIN_MM * MM_TO_PX;
  const bounds = {
    left: rect.left + safe - tolerancePx,
    right: rect.right - safe + tolerancePx,
    top: rect.top + safe - tolerancePx,
    bottom: rect.bottom - safe + tolerancePx,
  };

  // Text nodes must stay inside the safe margin and must not clip their content.
  const texts = Array.from(sheet.querySelectorAll<HTMLElement>("h1, p, span"));
  for (const el of texts) {
    if (!el.textContent?.trim()) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.left < bounds.left || r.right > bounds.right || r.top < bounds.top || r.bottom > bounds.bottom) {
      issues.push(
        issue("text_outside_margin", `Text "${el.textContent.trim().slice(0, 40)}" crosses the ${SAFE_MARGIN_MM}mm safe margin.`)
      );
    }
    if (el.scrollHeight - el.clientHeight > 2 || el.scrollWidth - el.clientWidth > 2) {
      issues.push(issue("text_overflow", `Text "${el.textContent.trim().slice(0, 40)}" is clipped by its container.`));
    }
  }

  // Logos must have decoded.
  const imgs = Array.from(sheet.querySelectorAll("img")).filter((i) => i.style.display !== "none");
  for (const img of imgs) {
    if (img.naturalWidth === 0 || img.naturalHeight === 0) {
      issues.push(issue("image_unrendered", `Image "${img.alt || img.src.slice(-32)}" failed to render.`, "warning"));
    }
  }

  // QR must exist, be square-ish and sit in the lower-centre band.
  const qr = sheet.querySelector<SVGElement>("svg[height][width][viewBox]:not([aria-hidden])") ??
    sheet.querySelector<SVGElement>("canvas, svg.qr");
  const qrEl = qr ?? sheet.querySelector<SVGElement>("svg:not([aria-hidden])");
  if (expectQr) {
    if (!qrEl) {
      issues.push(issue("qr_missing", "No QR code found on the certificate."));
    } else {
      const q = qrEl.getBoundingClientRect();
      const cx = (q.left + q.right) / 2 - rect.left;
      const cy = (q.top + q.bottom) / 2 - rect.top;
      if (Math.abs(q.width - q.height) > 3) {
        issues.push(issue("qr_aspect", "QR code is not square — it may not scan reliably."));
      }
      if (q.width < 40) issues.push(issue("qr_too_small", "QR code is smaller than the 40px scannable minimum."));
      if (cx < rect.width * 0.35 || cx > rect.width * 0.65) {
        issues.push(issue("qr_position_x", "QR code is not horizontally centred in the signature band."));
      }
      if (cy < rect.height * 0.55) {
        issues.push(issue("qr_position_y", "QR code sits above the signature band."));
      }
      if (
        q.left < bounds.left || q.right > bounds.right || q.top < bounds.top || q.bottom > bounds.bottom
      ) {
        issues.push(issue("qr_outside_margin", "QR code crosses the safe margin."));
      }
    }
  }

  return result(issues, {
    widthPx: Number(rect.width.toFixed(1)),
    heightPx: Number(rect.height.toFixed(1)),
    textNodes: texts.length,
    images: imgs.length,
    qr: !!qrEl,
  });
}

export function formatValidation(r: ValidationResult): string {
  if (r.issues.length === 0) return "All checks passed.";
  return r.issues.map((i) => `${i.severity === "error" ? "✕" : "!"} ${i.message}`).join("\n");
}
