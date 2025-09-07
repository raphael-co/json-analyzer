import { NextResponse, NextRequest } from "next/server";
import { locales, defaultLocale } from "./lib/i18n";

function getLocale(request: NextRequest) {
  const header = request.headers.get("accept-language") || "";
  const preferred = header.split(",")[0]?.split("-")[0];
  if (locales.includes(preferred as any)) return preferred;
  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".")) {
    return;
  }
  const hasLocale = locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (!hasLocale) {
    const locale = getLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/((?!_next|.*\..*).*)"],
};
