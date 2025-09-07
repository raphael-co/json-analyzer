import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/app/globals.css";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/toast";
import { getDict, type Locale, defaultLocale } from "@/lib/i18n";
import { DOMAIN } from "@/lib/site";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(DOMAIN),
  applicationName: "Raphael Comandon — Développeur Full-Stack",
  description:
    "Développeur Full-Stack spécialisé en React, Next.js, Node.js et TypeScript. Découvrez mon portfolio, mes projets et contactez-moi pour vos missions web et mobiles.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon-32x32.png",
  },
  openGraph: {
    type: "website",
    url: DOMAIN,
    siteName: "Raphael Comandon — Portfolio",
  },
  twitter: {
    card: "summary_large_image",
  },
};

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

function resolveLocale(l: string): Locale {
  return l === "fr" || l === "en" ? l : defaultLocale;
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale: raw } = await params;
  const locale = resolveLocale(raw);
  const dict = getDict(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ToastProvider>
            <Navbar dict={dict} locale={locale} />
            <main className="min-h-[83vh]">{children}</main>
            <Footer />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

export function generateStaticParams() {
  return [{ locale: "fr" }, { locale: "en" }];
}
