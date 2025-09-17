import { deflate, inflate } from "pako";

export function base64urlEncode(buf: Uint8Array): string {
  let str = typeof Buffer !== "undefined" ? Buffer.from(buf).toString("base64") : btoa(String.fromCharCode(...buf));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
export function base64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = typeof Buffer !== "undefined" ? Buffer.from(s, "base64") : Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  return bin instanceof Uint8Array ? bin : new Uint8Array(bin as any);
}

export function compressToParam(text: string): string {
  const data = new TextEncoder().encode(text);
  const gz = deflate(data, { level: 6 });
  return base64urlEncode(gz);
}
export function decompressFromParam(param: string): string {
  const raw = base64urlDecode(param);
  const dec = inflate(raw);
  return new TextDecoder().decode(dec);
}
