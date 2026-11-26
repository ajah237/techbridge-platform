// Helpers for building schema.org BreadcrumbList JSON-LD nodes.
const SITE = "https://techbridgehub.lovable.app";

export type Crumb = { name: string; path: string };

export const breadcrumbList = (crumbs: Crumb[]) => ({
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map((c, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: c.name,
    item: `${SITE}${c.path.startsWith("/") ? c.path : `/${c.path}`}`,
  })),
});

/** Wraps page-level JSON-LD with a BreadcrumbList under @graph. */
export const withBreadcrumbs = (
  primary: Record<string, unknown>,
  crumbs: Crumb[],
) => ({
  "@context": "https://schema.org",
  "@graph": [
    // strip @context from nested node
    Object.fromEntries(Object.entries(primary).filter(([k]) => k !== "@context")),
    breadcrumbList(crumbs),
  ],
});