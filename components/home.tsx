"use client";
import Hero from "@/components/hero";
import { Section } from "@/components/visuals/ui";
import { type Locale } from "@/lib/i18n";

export default function Home({ locale }: { locale: Locale }) {

  return (
    <Section>
      <Hero locale={locale} />
    </Section>
  );
}
