import { DOMAIN } from "@/lib/site";
import type { MetadataRoute } from "next";


const locales = ["fr", "en"] as const;
const baseRoutes = [""];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const items: MetadataRoute.Sitemap = [];

  for (const route of baseRoutes) {
    for (const locale of locales) {
      const url = `${DOMAIN}/${locale}${route}`;
      const alternates: Record<string, string> = {};
      for (const alt of locales) {
        alternates[alt] = `${DOMAIN}/${alt}${route}`;
      }
      alternates["x-default"] = `${DOMAIN}/fr${route}`;

      items.push({
        url,
        lastModified: now,
        changeFrequency: "monthly",
        priority: route === "" ? 1 : 0.7,
        alternates: {
          languages: alternates,
        },
      });
    }
  }

  return items;
}
