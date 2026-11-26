import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, Save } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { DEFAULT_STAMP_URL } from "@/components/Certificate";
import CertificatePreviewStage from "@/components/admin/CertificatePreviewStage";
import { useAuth } from "@/contexts/AuthContext";

const AdminCertificateTemplate = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [primaryColor, setPrimaryColor] = useState("#4f46e5");
  const [accentColor, setAccentColor] = useState("#a78bfa");
  const [headingText, setHeadingText] = useState("");
  const [bodyIntro, setBodyIntro] = useState("");
  const [footerLine, setFooterLine] = useState("");
  const [sig1Name, setSig1Name] = useState("");
  const [sig1Title, setSig1Title] = useState("");
  const [sig2Name, setSig2Name] = useState("");
  const [sig2Title, setSig2Title] = useState("");
  const [stampUrl, setStampUrl] = useState<string>("");
  const [stampScale, setStampScale] = useState(1);
  const [stampRotation, setStampRotation] = useState(0);
  const [stampOffsetX, setStampOffsetX] = useState(0);
  const [stampOffsetY, setStampOffsetY] = useState(0);
  const [stampOpacity, setStampOpacity] = useState(0.9);

  const load = async () => {
    const { data } = await supabase.from("certificate_templates" as any).select("*").eq("id", "default").maybeSingle();
    const t: any = data;
    if (t) {
      setLogoUrl(t.logo_url || "");
      setPrimaryColor(t.primary_color || "#4f46e5");
      setAccentColor(t.accent_color || "#a78bfa");
      setHeadingText(t.heading_text || "");
      setBodyIntro(t.body_intro || "");
      setFooterLine(t.footer_line || "");
      const sigs: { name: string; title: string }[] = t.default_signatories || [];
      setSig1Name(sigs[0]?.name || "");
      setSig1Title(sigs[0]?.title || "");
      setSig2Name(sigs[1]?.name || "");
      setSig2Title(sigs[1]?.title || "");
      setStampUrl(t.stamp_url || "");
      setStampScale(Number(t.stamp_scale ?? 1));
      setStampRotation(Number(t.stamp_rotation ?? 0));
      setStampOffsetX(Number(t.stamp_offset_x ?? 0));
      setStampOffsetY(Number(t.stamp_offset_y ?? 0));
      setStampOpacity(Number(t.stamp_opacity ?? 0.9));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const ALLOWED_IMAGE_TYPES: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };
  const MAX_ASSET_BYTES = 5 * 1024 * 1024;

  const validateImageFile = (file: File): string | null => {
    const ext = ALLOWED_IMAGE_TYPES[file.type];
    if (!ext) {
      toast.error("Please upload a PNG, JPEG, or WebP image (SVG is not permitted).");
      return null;
    }
    if (file.size > MAX_ASSET_BYTES) {
      toast.error("Image must be 5 MB or smaller.");
      return null;
    }
    return ext;
  };

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = validateImageFile(file);
    if (!ext) { e.target.value = ""; return; }
    const path = `template/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("certificate-assets").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("certificate-assets").getPublicUrl(path);
    setLogoUrl(data.publicUrl);
    toast.success("Logo uploaded");
  };

  const handleStamp = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = validateImageFile(file);
    if (!ext) { e.target.value = ""; return; }
    const path = `template/stamp-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("certificate-assets").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("certificate-assets").getPublicUrl(path);
    setStampUrl(data.publicUrl);
    toast.success("Stamp uploaded");
  };

  const save = async () => {
    setSaving(true);
    const default_signatories = [
      sig1Name ? { name: sig1Name, title: sig1Title } : null,
      sig2Name ? { name: sig2Name, title: sig2Title } : null,
    ].filter(Boolean);
    const { error } = await supabase.from("certificate_templates" as any).upsert({
      id: "default",
      logo_url: logoUrl || null,
      primary_color: primaryColor,
      accent_color: accentColor,
      heading_text: headingText || null,
      body_intro: bodyIntro || null,
      footer_line: footerLine || null,
      default_signatories,
      stamp_url: stampUrl || null,
      stamp_scale: stampScale,
      stamp_rotation: stampRotation,
      stamp_offset_x: stampOffsetX,
      stamp_offset_y: stampOffsetY,
      stamp_opacity: stampOpacity,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Template saved");
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Certificate Template</h1>
        <p className="text-sm text-muted-foreground">Customize the logo, colors, and copy that appear on every certificate.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-5 grid gap-4">
            <div className="grid gap-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                {logoUrl ? <img src={logoUrl} alt="Logo" className="h-14 w-14 rounded-full object-contain ring-2 ring-primary/30 bg-background p-1" /> : null}
                <label className="inline-flex items-center gap-2 text-sm border rounded-md px-3 py-2 cursor-pointer hover:bg-muted">
                  <Upload size={14} /> Upload
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogo} />
                </label>
                {logoUrl && <Button variant="ghost" size="sm" onClick={() => setLogoUrl("")}>Reset</Button>}
              </div>
              <Input placeholder="Or paste image URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Primary color</Label>
                <Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10" />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Accent color</Label>
                <Input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-10" />
              </div>
            </div>

            <div className="grid gap-1">
              <Label className="text-xs">Heading text (above name)</Label>
              <Input value={headingText} onChange={(e) => setHeadingText(e.target.value)} placeholder="e.g. Certificate of Completion" />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Body intro line</Label>
              <Input value={bodyIntro} onChange={(e) => setBodyIntro(e.target.value)} placeholder="This is to proudly certify that" />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Footer line</Label>
              <Textarea value={footerLine} onChange={(e) => setFooterLine(e.target.value)} placeholder="In recognition of outstanding achievement…" rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label className="text-xs">Default signatory 1 name</Label>
                <Input value={sig1Name} onChange={(e) => setSig1Name(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Title</Label>
                <Input value={sig1Title} onChange={(e) => setSig1Title(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Default signatory 2 name</Label>
                <Input value={sig2Name} onChange={(e) => setSig2Name(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Title</Label>
                <Input value={sig2Title} onChange={(e) => setSig2Title(e.target.value)} />
              </div>
            </div>

            <Button onClick={save} disabled={saving} className="bg-gradient-primary text-primary-foreground gap-2">
              <Save size={14} /> {saving ? "Saving…" : "Save template"}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-5 grid gap-4 md:grid-cols-2">
            <div className="grid gap-3">
              <Label>Official stamp / seal</Label>
              <div className="flex items-center gap-3">
                <img
                  src={stampUrl || DEFAULT_STAMP_URL}
                  alt="Certificate stamp preview"
                  className="h-20 w-20 object-contain rounded bg-background border p-1"
                />
                <div className="grid gap-2">
                  <label className="inline-flex items-center gap-2 text-sm border rounded-md px-3 py-2 cursor-pointer hover:bg-muted w-fit">
                    <Upload size={14} /> Upload stamp
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleStamp} />
                  </label>
                  {stampUrl && (
                    <Button variant="ghost" size="sm" className="w-fit" onClick={() => setStampUrl("")}>
                      Use default TechBridge seal
                    </Button>
                  )}
                </div>
              </div>
              <Input placeholder="Or paste stamp image URL" value={stampUrl} onChange={(e) => setStampUrl(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Transparent PNG works best. The stamp sits in the signature area, bottom-right of the certificate.
              </p>
            </div>

            <div className="grid gap-4 content-start">
              <div className="grid gap-1">
                <Label className="text-xs">Scale — {stampScale.toFixed(2)}×</Label>
                <Slider min={0.4} max={2.5} step={0.05} value={[stampScale]} onValueChange={(v) => setStampScale(v[0])} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Rotation — {stampRotation}°</Label>
                <Slider min={-180} max={180} step={1} value={[stampRotation]} onValueChange={(v) => setStampRotation(v[0])} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Horizontal position — {stampOffsetX}px</Label>
                <Slider min={-200} max={120} step={1} value={[stampOffsetX]} onValueChange={(v) => setStampOffsetX(v[0])} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Vertical position — {stampOffsetY}px</Label>
                <Slider min={-160} max={80} step={1} value={[stampOffsetY]} onValueChange={(v) => setStampOffsetY(v[0])} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Opacity — {Math.round(stampOpacity * 100)}%</Label>
                <Slider min={0.1} max={1} step={0.05} value={[stampOpacity]} onValueChange={(v) => setStampOpacity(v[0])} />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => { setStampScale(1); setStampRotation(0); setStampOffsetX(0); setStampOffsetY(0); setStampOpacity(0.9); }}
              >
                Reset stamp placement
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <Label className="mb-3 inline-block">Interactive preview</Label>
            <CertificatePreviewStage
              stampOffsetX={stampOffsetX}
              stampOffsetY={stampOffsetY}
              onStampOffsetChange={(x, y) => { setStampOffsetX(x); setStampOffsetY(y); }}
              certificate={{
                recipientName: "Sample Recipient",
                programTitle: "TechBridge Program",
                programType: "Program of Excellence",
                issuedAt: new Date(),
                certificateNumber: "TB-XXXX-XXXX-XXXX",
                verifyUrl: `${window.location.origin}/verify/TB-XXXX-XXXX-XXXX`,
                logoOverrideUrl: logoUrl || null,
                headingText: headingText || null,
                bodyIntro: bodyIntro || null,
                footerLine: footerLine || null,
                stampUrl: stampUrl || undefined,
                stampScale,
                stampRotation,
                stampOpacity,
                signatories: [
                  sig1Name ? { name: sig1Name, title: sig1Title } : { name: "TechBridge Team", title: "Program Lead" },
                  sig2Name ? { name: sig2Name, title: sig2Title } : { name: "Board of Directors", title: "Verified by" },
                ],
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminCertificateTemplate;