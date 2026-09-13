import { describe, expect, it } from "vitest";
import { assertBoundedObservationData } from "./data-bound.js";

describe("observation transfer accounting", () => {
  it("measures UTF-8 JSON bytes without first serializing the entire result", () => {
    const value = { ascii: "quoted\"slash\\\n", unicode: "π😀\ud800", values: [1, -2.5, null, true, undefined], skipped: undefined };
    const bytes = Buffer.byteLength(JSON.stringify(value));
    expect(assertBoundedObservationData(value, bytes, Date.now() + 1000)).toBe(bytes);
    expect(() => assertBoundedObservationData(value, bytes - 1, Date.now() + 1000)).toThrow(/derived-data limit/u);
  });

  it("rejects accessors without executing their code", () => {
    let executed = false;
    const value = { get source() { executed = true; return "unsafe"; } };
    expect(() => assertBoundedObservationData(value, 1024, Date.now() + 1000)).toThrow(/accessors/u);
    expect(executed).toBe(false);
  });
});
