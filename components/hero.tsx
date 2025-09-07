"use client";

import * as React from "react";
import { Suspense } from "react";
import { motion } from "framer-motion";

import { Section } from "@/components/visuals/ui";
import { getDict, type Locale } from "@/lib/i18n";
import { usePathname, useSearchParams } from "next/navigation";
import DottedRadialGridCanvas from "@/components/visuals/DottedRadialGridCanvas";
import JsonAnalyzer, { safeDecode } from "@/components/tools/JsonAnalyzer";
import JsonExplorer from "@/components/tools/JsonExplorer";
import Reveal from "./reveal";

export default function HeroJson({ locale }: { locale: Locale }) {
  const dict = getDict(locale);

  return (
    <Section bleed className="relative overflow-hidden">
      <DottedRadialGridCanvas
        className="z-0"
        density={24}
        baseRadius={1.6}
        hoverBoost={2.25}
        influenceRadius={190}
        fadeStop="76%"
        followDamping={0.16}
        alphaLight={0.94}
        alphaDark={0.45}
        darkGlow={0.8}
      />

      <Suspense
        fallback={
          <div className="relative z-10 grid min-h-[60vh] place-items-center px-4 py-24">
            <div className="w-full">
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="text-4xl font-bold tracking-tight md:text-5xl"
              >
                {dict["json.hero_title"]}
              </motion.h1>
              <p className="mt-4 text-balance text-lg opacity-60">
                {dict["json.hero_loading"]}
              </p>
            </div>
          </div>
        }
      >
        <HeroJsonInner locale={locale} dict={dict} />
      </Suspense>
    </Section>
  );
}

function HeroJsonInner({ locale, dict }: { locale: Locale; dict: ReturnType<typeof getDict> }) {
  const pathname = usePathname();
  const search = useSearchParams();

  const segments = pathname?.split("/") || [];
  const currentLocale: Locale =
    segments[1] === "en" || segments[1] === "fr" ? (segments[1] as Locale) : locale;

  const initialJsonText = React.useMemo(() => {
    const raw = search?.get("json");
    if (!raw) return "";
    const decoded = safeDecode(raw);
    try {
      const parsed = JSON.parse(decoded);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return decoded;
    }
  }, [search]);

  const [parsed, setParsed] = React.useState<unknown | null>(null);

  return (
    <div className="relative z-10 grid min-h-[60vh] place-items-center px-4 py-24">
      <div className="w-full flex flex-col items-center justify-center gap-6">
        <Reveal
          variant="slide-down"
          className="text-4xl font-bold tracking-tight md:text-5xl"
        >
          {dict["json.hero_title"]}
        </Reveal>

        <Reveal
          variant="slide-down"
          className="mt-4 text-balance text-lg opacity-80"
        >
          {dict["json.hero_desc"]}
        </Reveal>

        <Reveal className="w-full" variant="slide-up" distance={150} delay={0.1}>
          <JsonAnalyzer
            initialText={initialJsonText}
            onParsed={({ value }) => setParsed(value)}
            locale={currentLocale}
          />
        </Reveal>
        <Reveal variant="slide-up" className="w-full" distance={150} delay={0.2}>
          <JsonExplorer value={parsed} locale={currentLocale} />
        </Reveal>
      </div>
    </div>
  );
}
