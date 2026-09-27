import { describe, expect, it } from "vitest";

import { canonicalJson, hashFramedCanonicalJsonChunks, hashFramedDomain } from "./canonical-json.js";

describe("streamed canonical JSON hashing", () => {
  it("preserves framed hashes across arbitrary UTF-16 chunk boundaries", () => {
    for (const value of ["", "quotes\"\\\n\r\t\0", "é漢😀\ud800\udfff", { z: [null, 42], a: "😀" }]) {
      const json = canonicalJson(value);
      expect(hashFramedCanonicalJsonChunks("compatibility", () => json.split("")))
        .toBe(hashFramedDomain("compatibility", value));
    }
  });
});
