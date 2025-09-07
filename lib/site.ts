export const DOMAIN =
  process.env.NEXT_PUBLIC_DOMAIN && process.env.NEXT_PUBLIC_DOMAIN.trim().length > 0
    ? process.env.NEXT_PUBLIC_DOMAIN.replace(/\/+$/, "")
    : "http://localhost:3000";
