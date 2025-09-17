import { describe, it, expect } from "vitest";
import { compressToParam, decompressFromParam } from "../lib/share";

describe("share param", () => {
  it("roundtrips", () => {
    const text = JSON.stringify({ a: 1, b: [1,2,3], s: "hé" });
    const p = compressToParam(text);
    const out = decompressFromParam(p);
    expect(out).toBe(text);
  });
});
