import { Link } from "react-router-dom";
import { Mail, MapPin, Phone, Rss, Smartphone } from "lucide-react";
import logo from "@/assets/logo.png";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { settings } = useSiteSettings();
  const { t } = useTranslation();
  return (
  <footer className="bg-gradient-hero text-foreground dark border-t border-border/20">
    <div className="container mx-auto px-4 py-12 sm:py-16">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <img src={logo} alt="TechBridge logo" className="h-9 w-9 rounded-lg object-cover" />
            <span className="font-heading font-bold text-xl text-foreground">
              TECHBRIDGE
            </span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("footer.tagline")}
          </p>
        </div>
        <div>
          <h3 className="font-heading font-semibold text-foreground mb-4">{t("footer.quickLinks")}</h3>
          <div className="flex flex-col gap-2">
            {[
              { key: "about", to: "/about" },
              { key: "programs", to: "/programs" },
              { key: "projects", to: "/projects" },
              { key: "services", to: "/services" },
              { key: "blog", to: "/blog" },
              { key: "contact", to: "/contact" },
            ].map((l) => (
              <Link key={l.key} to={l.to} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {t(`nav.${l.key}`)}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-heading font-semibold text-foreground mb-4">{t("footer.programs")}</h3>
          <div className="flex flex-col gap-2">
            {[
              { label: t("footer.hackathons"), to: "/events?type=hackathon" },
              { label: t("footer.bootcamps"), to: "/events?type=bootcamp" },
              { label: t("footer.internships"), to: "/programs" },
              { label: t("footer.workshops"), to: "/events?type=workshop" },
              { label: t("footer.innovation"), to: "/projects" },
            ].map((p) => (
              <Link key={p.label} to={p.to} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {p.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-heading font-semibold text-foreground mb-4">{t("nav.contact")}</h3>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail size={16} className="text-[hsl(230,80%,70%)]" /> {settings.contact_email}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone size={16} className="text-[hsl(230,80%,70%)]" /> {settings.contact_phone}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin size={16} className="text-[hsl(230,80%,70%)]" /> {settings.office_address.split("\n")[0]}
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-[hsl(222,20%,18%)] mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-sm text-muted-foreground">© 2026 TechBridge. {t("footer.rights")}</p>
        <div className="flex gap-6">
          <Link to="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">{t("footer.privacy")}</Link>
          <Link to="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">{t("footer.terms")}</Link>
          <Link to="/install" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
            <Smartphone size={14} /> {t("footer.install")}
          </Link>
          <a
            href={`${import.meta.env.VITE_SUPABASE_URL || "https://rmtusfikecejennwrkxr.supabase.co"}/functions/v1/rss`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <Rss size={14} /> RSS
          </a>
        </div>
      </div>
    </div>
  </footer>
  );
};

export default Footer;
