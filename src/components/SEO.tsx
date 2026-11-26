import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  jsonLd?: Record<string, unknown>;
  noIndex?: boolean;
  /** Article-specific social metadata — used for blog posts. */
  publishedTime?: string | null;
  modifiedTime?: string | null;
  author?: string | null;
  tags?: string[] | null;
  imageAlt?: string | null;
}

const SITE = "TechBridge";
const DEFAULT_DESC = "Join hackathons, bootcamps, and workshops. Build skills, win prizes, and connect with the tech community across Africa.";
const SITE_URL = "https://techbridgehub.lovable.app";
const DEFAULT_IMG = `${SITE_URL}/pwa-icon-512.png`;

/** Sitewide identity nodes emitted on every public page. */
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const organizationNode = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: SITE,
  alternateName: "TechBridge Hub",
  url: `${SITE_URL}/`,
  logo: {
    "@type": "ImageObject",
    url: `${SITE_URL}/pwa-icon-512.png`,
    width: 512,
    height: 512,
  },
  description:
    "Tech NGO empowering innovators through hackathons, bootcamps, internships, and digital skills training.",
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: `${SITE_URL}/contact`,
      availableLanguage: ["en", "fr"],
    },
  ],
};

const webSiteNode = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: SITE,
  url: `${SITE_URL}/`,
  description: DEFAULT_DESC,
  inLanguage: ["en", "fr"],
  publisher: { "@id": ORGANIZATION_ID },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

/** Merges the page's JSON-LD with the sitewide Organization + WebSite nodes into one @graph. */
const buildGraph = (pageJsonLd?: Record<string, unknown>) => {
  const stripContext = (node: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(node).filter(([k]) => k !== "@context"));

  const pageNodes: Record<string, unknown>[] = [];
  if (pageJsonLd) {
    const graph = (pageJsonLd as { "@graph"?: unknown })["@graph"];
    if (Array.isArray(graph)) {
      for (const node of graph) {
        if (node && typeof node === "object") pageNodes.push(stripContext(node as Record<string, unknown>));
      }
    } else {
      pageNodes.push(stripContext(pageJsonLd));
    }
  }

  return {
    "@context": "https://schema.org",
    "@graph": [organizationNode, webSiteNode, ...pageNodes],
  };
};

const SEO = ({
  title,
  description = DEFAULT_DESC,
  image = DEFAULT_IMG,
  url,
  type = "website",
  jsonLd,
  noIndex = false,
  publishedTime,
  modifiedTime,
  author,
  tags,
  imageAlt,
}: SEOProps) => {
  // Avoid double-branding when the page title already contains the brand name.
  const fullTitle = title
    ? (title.toLowerCase().includes(SITE.toLowerCase()) ? title : `${title} | ${SITE}`)
    : SITE;
  const ogTitle = fullTitle.length > 60 ? `${fullTitle.slice(0, 57)}…` : fullTitle;
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  const canonical = url || `${SITE_URL}${path}`;
  const absImage = image.startsWith("http") ? image : `${SITE_URL}${image.startsWith("/") ? "" : "/"}${image}`;
  // Locale alternates — site ships English + French via i18n. Same URL serves both,
  // x-default points to the canonical English path for crawlers without a language hint.
  const alternates = [
    { hreflang: "en", href: canonical },
    { hreflang: "fr", href: canonical },
    { hreflang: "x-default", href: canonical },
  ];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {!noIndex && alternates.map((a) => (
        <link key={a.hreflang} rel="alternate" hrefLang={a.hreflang} href={a.href} />
      ))}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:title" content={ogTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absImage} />
      <meta property="og:image:alt" content={imageAlt || ogTitle} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE} />
      {type === "article" && publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {type === "article" && modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
      {type === "article" && author && <meta property="article:author" content={author} />}
      {type === "article" && tags?.map((t) => (
        <meta key={t} property="article:tag" content={t} />
      ))}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={ogTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absImage} />
      <meta name="twitter:image:alt" content={imageAlt || ogTitle} />
      {type === "article" && author && <meta name="author" content={author} />}
      {!noIndex && (
        <script type="application/ld+json">
          {JSON.stringify(buildGraph(jsonLd)).replace(/</g, "\\u003c")}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
