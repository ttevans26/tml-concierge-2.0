import { Helmet } from "react-helmet-async";

interface SeoHeadProps {
  title: string;
  description?: string;
  path: string;
  ogType?: "website" | "article";
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  noindex?: boolean;
}

const SITE = "https://tmlconcierge.com";

/**
 * Per-route head: unique title + description, self-referencing canonical and og:url.
 * Sitewide og:* tags in index.html remain as the fallback for non-JS crawlers.
 */
export default function SeoHead({
  title,
  description,
  path,
  ogType = "website",
  jsonLd,
  noindex,
}: SeoHeadProps) {
  const url = `${SITE}${path.startsWith("/") ? path : `/${path}`}`;
  const fullTitle = title.length > 60 ? title.slice(0, 57) + "…" : title;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      {noindex && <meta name="robots" content="noindex,follow" />}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}