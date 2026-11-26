import { createElement } from "react";
import { createRoot } from "react-dom/client";
import Certificate, { type CertificateProps } from "@/components/Certificate";
import {
  auditCertificateLayout,
  validateCertificatePdf,
  formatValidation,
  type ValidationResult,
} from "@/lib/certificateValidation";

/** True A4 landscape in CSS pixels (96dpi) — every export is rendered at this exact size. */
export const A4_LANDSCAPE_PX = { width: (297 * 96) / 25.4, height: (210 * 96) / 25.4 };

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** html2canvas cannot paint cross-origin images, so inline them as data URLs first. */
const dataUrlCache = new Map<string, string>();

async function inlineRemoteImages(host: HTMLElement) {
  const imgs = Array.from(host.querySelectorAll("img")).filter((img) => {
    if (!img.src || img.src.startsWith("data:")) return false;
    try {
      return new URL(img.src, location.href).origin !== location.origin;
    } catch {
      return false;
    }
  });
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.src;
      try {
        let dataUrl = dataUrlCache.get(src);
        if (!dataUrl) {
          const res = await fetch(src, { mode: "cors", cache: "force-cache" });
          const blob = await res.blob();
          dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
          dataUrlCache.set(src, dataUrl);
        }
        img.src = dataUrl;
      } catch {
        /* leave original src — html2canvas will simply skip it */
      }
    })
  );
}

async function waitForAssets(host: HTMLElement) {
  try {
    await (document as unknown as { fonts?: FontFaceSet }).fonts?.ready;
  } catch {
    /* fonts API unavailable */
  }
  await inlineRemoteImages(host);
  await Promise.all(
    Array.from(host.querySelectorAll("img")).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          })
    )
  );
  await nextFrame();
}

/**
 * Renders a certificate off-screen at full A4 landscape size and returns a landscape PDF blob.
 * Rendering off-screen (never scaled) guarantees identical layout for single and batch exports.
 */
export async function renderCertificatePdf(
  props: CertificateProps & { certificateNumber: string },
  opts: { onValidation?: (layout: ValidationResult, pdf: ValidationResult) => void } = {}
): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${A4_LANDSCAPE_PX.width}px;height:${A4_LANDSCAPE_PX.height}px;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    root.render(createElement(Certificate, props));
    await nextFrame();
    await waitForAssets(host);

    const sheet = (host.firstElementChild as HTMLElement) ?? host;
    // Pre-flight: margins, QR placement, text overflow, logo decoding.
    const layout = auditCertificateLayout(sheet, { expectQr: !!props.verifyUrl });
    const canvas = await html2canvas(sheet, {
      scale: 2.5,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: Math.round(A4_LANDSCAPE_PX.width),
      height: Math.round(A4_LANDSCAPE_PX.height),
      windowWidth: Math.round(A4_LANDSCAPE_PX.width),
      windowHeight: Math.round(A4_LANDSCAPE_PX.height),
    });

    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, 297, 210, undefined, "FAST");
    pdf.setProperties({
      title: `TechBridge Certificate ${props.certificateNumber}`,
      subject: props.programTitle,
      author: props.organization ?? "TechBridge",
      keywords: props.certificateNumber,
    });
    const blob = pdf.output("blob");
    // Post-flight: page size, orientation, rotation flag, payload sanity.
    const pdfCheck = await validateCertificatePdf(blob, { expectedPages: 1 });
    opts.onValidation?.(layout, pdfCheck);
    if (!pdfCheck.ok) {
      throw new Error(`Certificate PDF failed validation:\n${formatValidation(pdfCheck)}`);
    }
    if (!layout.ok) {
      console.warn(`Certificate layout issues for ${props.certificateNumber}:\n${formatValidation(layout)}`);
    }
    return blob;
  } finally {
    root.unmount();
    host.remove();
  }
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export type BatchItem = CertificateProps & { certificateNumber: string };

export type BatchItemStatus = "queued" | "rendering" | "done" | "failed";

/**
 * Exports many certificates. `mode: "files"` saves one landscape PDF per certificate,
 * `mode: "zip"` bundles them into a single archive.
 *
 * Runs cooperatively: each certificate is rendered in its own task and the loop yields
 * to the browser between items, so the admin UI stays responsive for large selections.
 * Pass an `AbortSignal` to cancel a running job.
 */
export async function exportCertificateBatch(
  items: BatchItem[],
  opts: {
    mode: "files" | "zip";
    zipName?: string;
    onProgress?: (done: number, total: number, current: string) => void;
    onItem?: (certificateNumber: string, status: BatchItemStatus, error?: string) => void;
    signal?: AbortSignal;
  }
) {
  const pdfs: { name: string; blob: Blob }[] = [];
  const failures: string[] = [];
  for (let i = 0; i < items.length; i++) {
    if (opts.signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
    const item = items[i];
    opts.onProgress?.(i, items.length, item.certificateNumber);
    opts.onItem?.(item.certificateNumber, "rendering");
    const safeCertNum = item.certificateNumber.replace(/[^a-zA-Z0-9._-]/g, "_");
    const name = `certificate-${safeCertNum}.pdf`;
    try {
      const blob = await renderCertificatePdf(item);
      if (opts.mode === "files") {
        triggerDownload(blob, name);
        // Stagger so browsers don't drop concurrent downloads.
        await new Promise((r) => setTimeout(r, 350));
      } else {
        pdfs.push({ name, blob });
      }
      opts.onItem?.(item.certificateNumber, "done");
    } catch (err) {
      failures.push(item.certificateNumber);
      opts.onItem?.(item.certificateNumber, "failed", err instanceof Error ? err.message : "Render failed");
    }
    // Yield so paints, clicks and scrolling are not blocked between renders.
    await new Promise((r) => setTimeout(r, 0));
    opts.onProgress?.(i + 1, items.length, "");
  }

  if (opts.mode === "zip" && pdfs.length > 0) {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    pdfs.forEach((p) => zip.file(p.name, p.blob));
    const archive = await zip.generateAsync({ type: "blob" });
    triggerDownload(archive, opts.zipName || `techbridge-certificates-${Date.now()}.zip`);
  }

  opts.onProgress?.(items.length, items.length, "");
  return { succeeded: items.length - failures.length, failed: failures };
}
