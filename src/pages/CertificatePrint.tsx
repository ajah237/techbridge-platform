import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Certificate from "@/components/Certificate";
import { useCertificateTemplate } from "@/hooks/useCertificateTemplate";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, ShieldCheck, Download } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { auditCertificateLayout, validateCertificatePdf, formatValidation } from "@/lib/certificateValidation";

interface CertData {
  certificate_number: string;
  recipient_name: string;
  issued_at: string;
  event_title: string | null;
  program_type?: string | null;
  description?: string | null;
  signatories?: { name: string; title: string }[] | null;
  revoked_at?: string | null;
  revoked_reason?: string | null;
}

const CertificatePrint = () => {
  const { certificateNumber } = useParams<{ certificateNumber: string }>();
  const [cert, setCert] = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const certRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { template } = useCertificateTemplate();
  const [reissues, setReissues] = useState<
    { previous_number: string; new_number: string; reason: string | null; created_at: string }[]
  >([]);

  useEffect(() => {
    (async () => {
      if (!certificateNumber) { setNotFound(true); setLoading(false); return; }
      const { data, error } = await supabase.rpc("verify_certificate", {
        _certificate_number: certificateNumber,
      });
      if (error || !data || data.length === 0) { setNotFound(true); setLoading(false); return; }
      setCert(data[0] as CertData);
      setLoading(false);
      const { data: hist } = await supabase.rpc("certificate_reissue_history", {
        _certificate_number: certificateNumber,
      });
      setReissues((hist as any) ?? []);
    })();
  }, [certificateNumber]);

  // Fit the fixed A4-landscape sheet into the viewport without distorting it.
  const A4_W_PX = (297 * 96) / 25.4;
  const A4_H_PX = (210 * 96) / 25.4;
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / A4_W_PX));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cert]);

  const verifyUrl = typeof window !== "undefined" && certificateNumber
    ? `${window.location.origin}/verify/${certificateNumber}`
    : undefined;

  const handleDownloadPdf = async () => {
    if (!certRef.current || !cert) return;
    setDownloading(true);
    const scaleEl = scaleRef.current;
    const prevTransform = scaleEl?.style.transform ?? "";
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      // Render at true A4 landscape size so the PDF layout is never squeezed.
      if (scaleEl) scaleEl.style.transform = "scale(1)";
      const layout = auditCertificateLayout(certRef.current, { expectQr: !!verifyUrl });
      if (!layout.ok) console.warn(`Certificate layout issues:\n${formatValidation(layout)}`);
      const canvas = await html2canvas(certRef.current, {
        scale: 3,
        width: Math.round(A4_W_PX),
        height: Math.round(A4_H_PX),
        windowWidth: Math.round(A4_W_PX),
        windowHeight: Math.round(A4_H_PX),
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: false,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      pdf.addImage(imgData, "PNG", 0, 0, 297, 210, undefined, "FAST");
      pdf.setProperties({
        title: `TechBridge Certificate ${cert.certificate_number}`,
        subject: cert.event_title || "TechBridge Program",
        author: "TechBridge",
        keywords: cert.certificate_number,
      });
      const check = await validateCertificatePdf(pdf.output("blob"), { expectedPages: 1 });
      if (!check.ok) {
        toast.error(`Export blocked — ${check.issues[0]?.message ?? "PDF failed validation"}`);
        return;
      }
      pdf.save(`certificate-${cert.certificate_number}.pdf`);
      toast.success("Certificate downloaded — verified A4 landscape");
    } catch (err) {
      console.error(err);
      toast.error("Could not generate PDF. Try Print as PDF instead.");
    } finally {
      if (scaleEl) scaleEl.style.transform = prevTransform;
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </main>
    );
  }

  if (notFound || !cert) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-heading font-bold">Certificate not found</h1>
        <p className="text-muted-foreground">The certificate number could not be verified.</p>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/"><ArrowLeft size={16}/> Home</Link>
        </Button>
      </main>
    );
  }

  // Only trust database values and the global template (never URL query parameter overrides)
  const programType = cert.program_type || "Program of Excellence";
  const description = cert.description || undefined;
  const signatories =
    Array.isArray(cert.signatories) && cert.signatories.length > 0
      ? cert.signatories
      : undefined;
  const revoked = !!cert.revoked_at;
  const latestReissue = reissues.length ? reissues[reissues.length - 1] : null;

  return (
    <main className="min-h-dvh bg-muted/30 pt-24 pb-6 sm:pb-10 px-2 sm:px-6 print:pt-0">
      <SEO
        title={`Certificate ${cert.certificate_number} — Print`}
        description={`Print-ready certificate for ${cert.recipient_name}${cert.event_title ? ` — ${cert.event_title}` : ""}.`}
      />
      <style>{`
        @page { size: A4 landscape; margin: 0; }
        @media print {
          html, body { background: white !important; }
          .no-print { display: none !important; }
          .print-area { box-shadow: none !important; margin: 0 !important; }
          .cert-fit { width: 297mm !important; height: 210mm !important; overflow: visible !important; }
          .cert-scale { transform: none !important; }
        }
      `}</style>

      <div className="no-print max-w-[297mm] mx-auto mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link to={`/verify/${cert.certificate_number}`}>
            <ShieldCheck size={16}/> Verify page
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/"><ArrowLeft size={16}/> Home</Link>
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
            <Printer size={16}/> Print
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-gradient-primary text-primary-foreground"
            onClick={handleDownloadPdf}
            disabled={downloading}
          >
            <Download size={16}/> {downloading ? "Preparing…" : "Download PDF"}
          </Button>
        </div>
      </div>

      {revoked && (
        <div className="no-print max-w-[297mm] mx-auto mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          This certificate was <strong>revoked</strong> on{" "}
          {new Date(cert.revoked_at!).toLocaleDateString()}
          {cert.revoked_reason ? ` — ${cert.revoked_reason}` : ""}.
        </div>
      )}

      <div
        ref={wrapRef}
        className="print-area cert-fit mx-auto overflow-hidden"
        style={{ maxWidth: "297mm", width: "100%", height: A4_H_PX * scale }}
      >
        <div
          ref={scaleRef}
          className="cert-scale"
          style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: A4_W_PX, height: A4_H_PX }}
        >
          <Certificate
            ref={certRef}
          recipientName={cert.recipient_name}
          programTitle={cert.event_title || "TechBridge Program"}
          programType={programType}
          description={description}
          issuedAt={cert.issued_at}
          certificateNumber={cert.certificate_number}
          verifyUrl={verifyUrl}
          signatories={signatories || (template?.default_signatories?.length ? template.default_signatories : undefined)}
          logoOverrideUrl={template?.logo_url || null}
          stampUrl={template?.stamp_url || undefined}
          stampScale={template?.stamp_scale ?? 1}
          stampRotation={template?.stamp_rotation ?? 0}
          stampOffsetX={template?.stamp_offset_x ?? 0}
          stampOffsetY={template?.stamp_offset_y ?? 0}
          stampOpacity={template?.stamp_opacity ?? 0.9}
          headingText={template?.heading_text || null}
          bodyIntro={template?.body_intro || null}
          footerLine={template?.footer_line || null}
          revoked={revoked}
          revokedReason={cert.revoked_reason || undefined}
          reissueCount={reissues.length}
          replacesNumber={latestReissue?.previous_number || null}
            reissuedAt={latestReissue?.created_at || null}
          />
        </div>
      </div>
    </main>
  );
};

export default CertificatePrint;
