import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import {
  A4_LANDSCAPE_PT,
  readPdfGeometry,
  validatePdfBytes,
  validateCertificatePdf,
} from "@/lib/certificateValidation";

const bytesOf = (pdf: jsPDF) => new Uint8Array(pdf.output("arraybuffer"));

const makePdf = (opts: { orientation: "landscape" | "portrait"; pages?: number }) => {
  const pdf = new jsPDF({ orientation: opts.orientation, unit: "mm", format: "a4" });
  for (let i = 1; i < (opts.pages ?? 1); i++) pdf.addPage("a4", opts.orientation);
  pdf.setFontSize(24);
  pdf.text("CERTIFICATE", 20, 40);
  return pdf;
};

describe("certificate PDF geometry", () => {
  it("reads A4 landscape geometry from generated PDFs", () => {
    const geo = readPdfGeometry(bytesOf(makePdf({ orientation: "landscape" })));
    expect(geo).not.toBeNull();
    expect(geo!.rotation).toBe(0);
    expect(geo!.width).toBeCloseTo(A4_LANDSCAPE_PT.width, 0);
    expect(geo!.height).toBeCloseTo(A4_LANDSCAPE_PT.height, 0);
    expect(geo!.width).toBeGreaterThan(geo!.height);
  });

  it("accepts a true A4 landscape export", () => {
    const res = validatePdfBytes(bytesOf(makePdf({ orientation: "landscape" })), { expectedPages: 1 });
    expect(res.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(res.ok).toBe(true);
    expect(res.meta.landscapeA4).toBe(true);
  });

  it("rejects a portrait export", () => {
    const res = validatePdfBytes(bytesOf(makePdf({ orientation: "portrait" })));
    expect(res.ok).toBe(false);
    expect(res.issues.map((i) => i.code)).toContain("orientation");
    expect(res.issues.map((i) => i.code)).toContain("page_size");
  });

  it("flags a wrong page count", () => {
    const res = validatePdfBytes(bytesOf(makePdf({ orientation: "landscape", pages: 2 })), { expectedPages: 1 });
    expect(res.issues.map((i) => i.code)).toContain("page_count");
  });

  it("rejects non-PDF payloads", async () => {
    const res = await validateCertificatePdf(new Blob(["not a pdf"], { type: "application/pdf" }));
    expect(res.ok).toBe(false);
    expect(res.issues[0].code).toBe("pdf_unreadable");
  });

  it("flags an explicit /Rotate flag", () => {
    const raw = bytesOf(makePdf({ orientation: "landscape" }));
    const patched = new TextEncoder().encode(
      new TextDecoder("latin1").decode(raw).replace("/MediaBox", "/Rotate 90\n/MediaBox")
    );
    const res = validatePdfBytes(patched);
    expect(res.issues.map((i) => i.code)).toContain("rotation");
  });
});
