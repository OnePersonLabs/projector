import { describe, expect, it } from "vitest";
import { assertBoundedObservationData } from "./data-bound.js";

it("accounts for deep plain data without an implicit nesting ceiling", () => {
  let value: unknown = "leaf";
  for (let depth = 0; depth < 600; depth += 1) value = { child: value };
  const measured = assertBoundedObservationData(value, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  expect(measured).toBeGreaterThan(256);
  expect(() => assertBoundedObservationData(value, measured - 1, Number.POSITIVE_INFINITY)).toThrow(/derived-data limit/u);
});

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
