import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import logoUrl from "@/assets/logo.png";
import dtechAsset from "@/assets/dtech-logo.png.asset.json";
import stampAsset from "@/assets/techbridge-stamp.png.asset.json";

export const DEFAULT_STAMP_URL = stampAsset.url;

export type CertificateProps = {
  recipientName: string;
  programTitle: string;
  /** e.g. "Hackathon", "Mentorship Program", "Workshop completion" */
  programType?: string;
  issuedAt: string | Date;
  certificateNumber: string;
  /** Optional second line of context, e.g. "with distinction", duration, score */
  description?: string;
  /** Issuing organization */
  organization?: string;
  /** Verification URL printed at the bottom */
  verifyUrl?: string;
  /** Signatories */
  signatories?: { name: string; title: string }[];
  /** When set, shows a clear REVOKED overlay across the certificate */
  revoked?: boolean;
  revokedReason?: string | null;
  /** Optional template overrides (from certificate_templates) */
  logoOverrideUrl?: string | null;
  /** Partner logo shown alongside the issuing organization */
  partnerLogoUrl?: string | null;
  /** Official stamp / seal image */
  stampUrl?: string | null;
  /** Stamp transform controls */
  stampScale?: number;
  stampRotation?: number;
  stampOffsetX?: number;
  stampOffsetY?: number;
  stampOpacity?: number;
  headingText?: string | null;
  bodyIntro?: string | null;
  footerLine?: string | null;
  /** Reissue provenance printed in the footer */
  reissueCount?: number;
  replacesNumber?: string | null;
  reissuedAt?: string | Date | null;
};

/**
 * A4 landscape printable certificate. Print with a 0 margin for full bleed.
 * Wrap with a media-print stylesheet or call window.print() from a parent.
 */
const Certificate = forwardRef<HTMLDivElement, CertificateProps>(function Certificate(
  {
    recipientName,
    programTitle,
    programType = "Program of Excellence",
    issuedAt,
    certificateNumber,
    description,
    organization = "TechBridge",
    verifyUrl,
    signatories = [
      { name: "TechBridge Team", title: "Program Lead" },
      { name: "Board of Directors", title: "Verified by" },
    ],
    revoked = false,
    revokedReason,
    logoOverrideUrl,
    partnerLogoUrl = dtechAsset.url,
    // No digital seal by default — space is reserved so the certificate can be
    // stamped and signed by hand after printing. Pass `stampUrl` to opt back in.
    stampUrl = null,
    stampScale = 1,
    stampRotation = 0,
    stampOffsetX = 0,
    stampOffsetY = 0,
    stampOpacity = 0.9,
    headingText,
    bodyIntro,
    footerLine,
    reissueCount = 0,
    replacesNumber,
    reissuedAt,
  },
  ref
) {
  const issued = typeof issuedAt === "string" ? new Date(issuedAt) : issuedAt;
  const reissued = reissuedAt ? (typeof reissuedAt === "string" ? new Date(reissuedAt) : reissuedAt) : null;
  const gold = "hsl(var(--cert-gold))";
  const goldSoft = "hsl(var(--cert-gold-soft))";
  const navy = "hsl(var(--cert-navy))";
  const ink = "hsl(var(--cert-ink))";
  const muted = "hsl(var(--cert-muted))";

  /** Avoids "CERTIFICATE / CERTIFICATE OF …" duplication when a template heading is set. */
  const subheading = (headingText?.trim().replace(/^certificate\s+/i, "") || `of ${programType}`).trim();

  /** Auto-fit typography so long names / long citations never escape the sheet. */
  const nameLen = recipientName.trim().length;
  const nameSize = nameLen > 46 ? 26 : nameLen > 34 ? 32 : nameLen > 24 ? 38 : 46;
  const citation = [
    programTitle,
    description || "",
    footerLine || "",
  ].join(" ").length;
  const bodySize = citation > 620 ? 10.5 : citation > 420 ? 12 : citation > 260 ? 13.5 : 15;
  const bodyLead = citation > 420 ? 1.5 : 1.65;

  const Fretwork = ({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) => {
    const flipX = corner === "tr" || corner === "br";
    const flipY = corner === "bl" || corner === "br";
    return (
      <svg
        width="72"
        height="72"
        viewBox="0 0 72 72"
        aria-hidden
        className="absolute"
        style={{
          top: corner.startsWith("t") ? "13mm" : "auto",
          bottom: corner.startsWith("b") ? "13mm" : "auto",
          left: corner.endsWith("l") ? "13mm" : "auto",
          right: corner.endsWith("r") ? "13mm" : "auto",
          transform: `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`,
        }}
      >
        <g fill="none" stroke={gold} strokeWidth="1.4">
          <path d="M0 30 L0 0 L30 0" />
          <path d="M8 34 L8 8 L34 8" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="25" y="14" width="5" height="5" />
          <rect x="14" y="25" width="5" height="5" />
          <path d="M38 3 L52 3 M3 38 L3 52" strokeWidth="1" />
        </g>
      </svg>
    );
  };

  return (
    <div
      ref={ref}
      data-cert-sheet
      className="relative mx-auto overflow-hidden"
      style={{
        width: "297mm",
        height: "210mm",
        flexShrink: 0,
        background: "hsl(var(--cert-paper))",
        color: ink,
        boxShadow: "0 30px 80px -30px hsl(var(--cert-navy) / 0.35)",
      }}
    >
      {/* Engraved guilloche watermark */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.05,
          backgroundImage:
            `repeating-linear-gradient(45deg, ${navy} 0 0.6px, transparent 0.6px 7px), repeating-linear-gradient(-45deg, ${navy} 0 0.6px, transparent 0.6px 7px)`,
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          inset: 0,
          background: `radial-gradient(circle at 50% 45%, hsl(var(--cert-gold) / 0.10), transparent 58%)`,
        }}
      />

      {/* Ribbon flourishes */}
      <svg
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        viewBox="0 0 1123 794"
        preserveAspectRatio="none"
      >
        <g>
          <path d="M0 0 H330 C250 120 120 190 0 236 Z" fill="hsl(var(--cert-navy-deep))" />
          <path d="M0 22 C170 60 300 130 372 0 H330 C262 108 140 178 0 220 Z" fill="hsl(var(--cert-azure))" opacity="0.95" />
          <path d="M0 66 C180 96 320 158 402 0 H372 C300 132 168 62 0 44 Z" fill={goldSoft} opacity="0.9" />
          <path d="M0 92 C186 118 330 176 424 0 H402 C320 160 180 98 0 74 Z" fill={gold} opacity="0.75" />
        </g>
        <g transform="rotate(180 561.5 397) scale(0.46)" opacity="0.9">
          <path d="M0 0 H330 C250 120 120 190 0 236 Z" fill="hsl(var(--cert-navy-deep))" />
          <path d="M0 22 C170 60 300 130 372 0 H330 C262 108 140 178 0 220 Z" fill="hsl(var(--cert-azure))" opacity="0.95" />
          <path d="M0 66 C180 96 320 158 402 0 H372 C300 132 168 62 0 44 Z" fill={goldSoft} opacity="0.9" />
          <path d="M0 92 C186 118 330 176 424 0 H402 C320 160 180 98 0 74 Z" fill={gold} opacity="0.75" />
        </g>
      </svg>

      {/* Double gold frame */}
      <div className="absolute pointer-events-none" style={{ inset: "10mm", border: `1.6px solid ${gold}` }} />
      <div className="absolute pointer-events-none" style={{ inset: "12mm", border: `0.6px solid hsl(var(--cert-gold) / 0.55)` }} />
      <Fretwork corner="tl" />
      <Fretwork corner="tr" />
      <Fretwork corner="bl" />
      <Fretwork corner="br" />

      {/* Content */}
      <div className="relative h-full w-full flex flex-col items-center text-center" style={{ padding: "19mm 24mm 17mm" }}>
        {/* Header — issuer marks */}
        <div className="flex items-center justify-center gap-5">
          <img
            src={logoOverrideUrl || logoUrl}
            alt={`${organization} logo`}
            crossOrigin="anonymous"
            className="h-12 w-12 rounded-full object-contain p-1"
            style={{ background: "hsl(var(--cert-paper))", boxShadow: `0 0 0 1.5px ${gold}` }}
          />
          <div className="text-left leading-tight">
            <p className="font-heading text-[15px] uppercase" style={{ letterSpacing: "0.34em", color: navy }}>
              {organization}
            </p>
            <p className="text-[8px] uppercase" style={{ letterSpacing: "0.3em", color: muted }}>
              Institute of Technology & Innovation
            </p>
          </div>
          {partnerLogoUrl ? (
            <>
              <span className="h-9 w-px" style={{ background: `hsl(var(--cert-gold) / 0.6)` }} aria-hidden />
              <img
                src={partnerLogoUrl}
                alt="D-TECH partner logo"
            className="h-11 w-auto object-contain"
                loading="eager"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.style.display = "none";
                  (img.previousElementSibling as HTMLElement | null)?.style.setProperty("display", "none");
                }}
              />
            </>
          ) : null}
        </div>

        {/* Centred body */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center w-full">
        {/* Title block */}
        <div>
          <h1
            className="font-serif"
            style={{ color: navy, fontSize: "58px", lineHeight: 1, letterSpacing: "0.16em", fontWeight: 500 }}
          >
            CERTIFICATE
          </h1>
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className="h-px w-20" style={{ background: `linear-gradient(90deg, transparent, ${gold})` }} />
            <p className="font-serif text-[15px] uppercase" style={{ letterSpacing: "0.42em", color: ink }}>
              {subheading}
            </p>
            <span className="h-px w-20" style={{ background: `linear-gradient(270deg, transparent, ${gold})` }} />
          </div>
        </div>

        {/* Recipient */}
        <p className="mt-7 font-serif italic text-[14px]" style={{ color: muted }}>
          {bodyIntro || "This certificate is proudly presented to"}
        </p>
        <p
          className="mt-2 font-serif max-w-[190mm] px-2 break-words"
          style={{ color: ink, fontSize: `${nameSize}px`, lineHeight: 1.15, letterSpacing: "0.01em" }}
        >
          {recipientName}
        </p>
        <div
          className="mt-2 h-[1.5px]"
          style={{ width: "58%", background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }}
        />

        {/* Citation */}
        <p
          className="mt-4 max-w-[186mm] font-serif overflow-hidden"
          style={{ fontSize: `${bodySize}px`, lineHeight: bodyLead, color: ink, maxHeight: "52mm" }}
        >
          has successfully completed <span style={{ fontWeight: 600 }}>{programTitle}</span>
          {description ? <> — <span className="italic">{description}</span></> : null}
          {footerLine
            ? <>. {footerLine}</>
            : <>, demonstrating exemplary commitment, technical mastery and professional excellence throughout the programme.</>}
        </p>
        </div>

        {/* Footer — signatures, seal, verification */}
        <div className="relative w-full grid grid-cols-3 items-end gap-6">
          <div className="text-left">
            <p className="font-serif text-[13px] pb-1" style={{ minWidth: "42mm", borderBottom: `1px solid ${navy}` }}>
              {issued.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p className="mt-1 text-[8px] uppercase" style={{ letterSpacing: "0.28em", color: muted }}>
              Date of issue
            </p>
            {signatories[0] && (
              <div className="mt-5">
                <p className="font-serif text-[13px] pb-1" style={{ minWidth: "42mm", borderBottom: `1px solid ${navy}` }}>
                  {signatories[0].name}
                </p>
                <p className="mt-1 text-[8px] uppercase" style={{ letterSpacing: "0.28em", color: muted }}>
                  {signatories[0].title}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center">
            {stampUrl ? (
              <img
                src={stampUrl}
                alt=""
                aria-hidden
                className="h-[26mm] w-[26mm] object-contain pointer-events-none"
                style={{
                  opacity: stampOpacity,
                  transform: `translate(${stampOffsetX}px, ${stampOffsetY}px) rotate(${stampRotation}deg) scale(${stampScale})`,
                  transformOrigin: "center",
                }}
              />
            ) : (
              /* Reserved clear area for the physical stamp / seal. */
              <div className="h-[22mm] w-[26mm]" aria-hidden />
            )}
            {verifyUrl && (
              <div className="mt-1 p-1" style={{ background: "hsl(var(--cert-paper))", border: `1px solid hsl(var(--cert-gold) / 0.7)` }}>
                <QRCodeSVG value={verifyUrl} size={58} level="M" includeMargin={false} />
              </div>
            )}
            <p className="mt-1.5 text-[9px] font-mono" style={{ letterSpacing: "0.1em", color: navy }}>
              {certificateNumber}
            </p>
            {verifyUrl && (
              <p className="text-[7px]" style={{ letterSpacing: "0.12em", color: muted }}>
                Scan to verify · {verifyUrl.replace(/^https?:\/\//, "")}
              </p>
            )}
            {reissueCount > 0 && (
              <p className="mt-0.5 text-[7px] uppercase" style={{ letterSpacing: "0.18em", color: muted }}>
                Reissued copy {reissueCount > 1 ? `(No. ${reissueCount})` : ""}
                {replacesNumber ? ` · replaces ${replacesNumber}` : ""}
                {reissued ? ` · ${reissued.toLocaleDateString()}` : ""}
              </p>
            )}
          </div>

          <div className="text-right">
            {signatories[1] && (
              <div className="inline-block text-left">
                <p className="font-serif text-[13px] pb-1" style={{ minWidth: "42mm", borderBottom: `1px solid ${navy}` }}>
                  {signatories[1].name}
                </p>
                <p className="mt-1 text-[8px] uppercase" style={{ letterSpacing: "0.28em", color: muted }}>
                  {signatories[1].title}
                </p>
              </div>
            )}
            {signatories[2] && (
              <div className="mt-5 inline-block text-left">
                <p className="font-serif text-[13px] pb-1" style={{ minWidth: "42mm", borderBottom: `1px solid ${navy}` }}>
                  {signatories[2].name}
                </p>
                <p className="mt-1 text-[8px] uppercase" style={{ letterSpacing: "0.28em", color: muted }}>
                  {signatories[2].title}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {revoked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="px-10 py-4 border-4 font-heading font-extrabold tracking-[0.3em] text-5xl"
            style={{
              transform: "rotate(-18deg)",
              color: "hsl(0 84% 45%)",
              borderColor: "hsl(0 84% 45%)",
              background: "hsl(0 84% 50% / 0.06)",
            }}
          >
            REVOKED
            {revokedReason ? (
              <div className="mt-1 text-xs font-medium tracking-normal opacity-80">{revokedReason}</div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
});

export default Certificate;
