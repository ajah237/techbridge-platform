import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CertificateTemplate {
  id: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  heading_text: string | null;
  body_intro: string | null;
  footer_line: string | null;
  default_signatories: { name: string; title: string }[];
  stamp_url: string | null;
  stamp_scale: number | null;
  stamp_rotation: number | null;
  stamp_offset_x: number | null;
  stamp_offset_y: number | null;
  stamp_opacity: number | null;
}

export function useCertificateTemplate() {
  const [template, setTemplate] = useState<CertificateTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("certificate_templates")
        .select("*")
        .eq("id", "default")
        .maybeSingle();
      if (!active) return;
      setTemplate((data as unknown as CertificateTemplate) ?? null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return { template, loading };
}
