import type { Metadata } from "next";

import { getDict, type Locale } from "@/lib/i18n";
import Home from "@/components/home";
import { DOMAIN } from "@/lib/site";

type PageProps = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const title =
    locale === "fr"
      ? "Raphael Comandon — Développeur Full-Stack (React, Next.js, Node.js)"
      : "Raphael Comandon — Full-Stack Developer (React, Next.js, Node.js)";
  const description =
    locale === "fr"
      ? "Portfolio et CV : projets, expérience, contact. Spécialiste React/Next.js, Node.js et TypeScript."
      : "Portfolio & resume: projects, experience, contact. React/Next.js, Node.js and TypeScript specialist.";

  const basePath = locale === "fr" ? "/fr" : "/en";

  return {
    title,
    description,
    alternates: {
      canonical: `${DOMAIN}${basePath}`,
      languages: {
        fr: `${DOMAIN}/fr`,
        en: `${DOMAIN}/en`,
        "x-default": `${DOMAIN}/fr`,
      },
    },
    openGraph: {
      url: `${DOMAIN}${basePath}`,
      title,
      description,
      images: [
        {
          url: `${DOMAIN}${basePath}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: locale === "fr" ? "fr_FR" : "en_US",
      siteName: "Raphael Comandon — Portfolio",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${DOMAIN}${basePath}/opengraph-image`],
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  const dict = getDict(locale);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${DOMAIN}/#raphael`,
        "name": "Raphael Comandon",
        "jobTitle": "Full-Stack Developer",
        "url": DOMAIN,
        "sameAs": [
          "https://github.com/raphaelcomandon",
          "https://www.linkedin.com/in/raphaelcomandon"
        ]
      },
      {
        "@type": "WebSite",
        "@id": `${DOMAIN}/#website`,
        "url": DOMAIN,
        "name": "Raphael Comandon — Portfolio",
        "potentialAction": {
          "@type": "SearchAction",
          "target": `${DOMAIN}/search?q={query}`,
          "query-input": "required name=query"
        }
      }
    ]
  };

  return (
    <>
      <Home locale={locale} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
