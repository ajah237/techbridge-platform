import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SiteSettings = {
  contact_email: string;
  contact_phone: string;
  office_address: string;
  twitter_url: string;
  linkedin_url: string;
  github_url: string;
  youtube_url: string;
};

const defaults: SiteSettings = {
  contact_email: "bfozoh@gmail.com",
  contact_phone: "+237 6 92 16 96 74",
  office_address: "Yaoundé, Cameroon",
  twitter_url: "https://twitter.com/techbridge",
  linkedin_url: "https://www.linkedin.com/company/techbridge",
  github_url: "https://github.com/ajah237/techbridge-platform",
  youtube_url: "https://www.youtube.com/@techbridge",
};

export const useSiteSettings = () => {
  const [settings, setSettings] = useState<SiteSettings>(defaults);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from("site_settings").select("*").eq("id", "global").maybeSingle();
      if (!active) return;
      if (data) {
        setSettings({
          contact_email: data.contact_email ?? defaults.contact_email,
          contact_phone: data.contact_phone ?? defaults.contact_phone,
          office_address: data.office_address ?? defaults.office_address,
          twitter_url: data.twitter_url ?? defaults.twitter_url,
          linkedin_url: data.linkedin_url ?? defaults.linkedin_url,
          github_url: data.github_url ?? defaults.github_url,
          youtube_url: data.youtube_url ?? defaults.youtube_url,
        });
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return { settings, loading };
};
