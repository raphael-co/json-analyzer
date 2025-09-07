import { ImageResponse } from "next/og";
import { getDict, type Locale, locales, defaultLocale } from "@/lib/i18n";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: { locale: Locale } };

function t(dict: Record<string, string>, key: string, fallback: string) {
  return dict[key] ?? fallback;
}

export default async function OG({ params }: Props) {
  const rawLocale = params?.locale ?? defaultLocale;
  const locale: Locale = (locales as readonly Locale[]).includes(rawLocale)
    ? rawLocale
    : defaultLocale;

  const dict = getDict(locale);
  const isFr = locale === "fr";

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const domainLabel = SITE_URL.replace(/^https?:\/\//, "").replace(/\/+$/, "");

  const title = t(
    dict,
    "og.title",
    isFr ? "Raphael Comandon — json-analyzer" : "Raphael Comandon — json-analyzer"
  );

  const subtitle = t(dict, "og.subtitle", "React • Next.js • Node.js • TypeScript");
  const leftCta = t(dict, "og.cta_left", isFr ? "Analyse JSON" : "JSON Analysis");
  const rightCta = t(dict, "og.cta_right", isFr ? "Dispo pour missions" : "Available for projects");

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px",
          background: "linear-gradient(135deg, #0ea5e9 0%, #1e293b 60%)",
          position: "relative",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(800px 400px at 20% 15%, rgba(255,255,255,0.12), transparent 60%), radial-gradient(800px 400px at 80% 85%, rgba(14,165,233,0.25), transparent 60%)",
          }}
        />

        <div
          style={{
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 26,
            fontWeight: 700,
            color: "rgba(255,255,255,0.9)",
            letterSpacing: 0.4,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: "rgba(255,255,255,0.9)",
            }}
          />
          {domainLabel}
        </div>

        <div style={{ zIndex: 2, display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "white",
              lineHeight: 1.08,
              textShadow: "0 2px 12px rgba(0,0,0,0.25)",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 500,
              color: "rgba(255,255,255,0.92)",
            }}
          >
            {subtitle}
          </div>
        </div>

        <div
          style={{
            zIndex: 2,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.18)",
              fontSize: 26,
              color: "rgba(255,255,255,0.95)",
              fontWeight: 700,
              backdropFilter: "blur(2px)",
            }}
          >
            {leftCta}
          </div>

          <div
            style={{
              fontSize: 24,
              color: "rgba(255,255,255,0.9)",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(30,41,59,0.35)",
            }}
          >
            {rightCta}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
