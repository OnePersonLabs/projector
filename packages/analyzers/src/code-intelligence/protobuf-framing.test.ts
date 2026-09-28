import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { boundedProtobufFrames } from "./protobuf-framing.js";

function varint(value: number): number[] {
  const bytes: number[] = [];
  do {
    const low = value % 128;
    value = Math.floor(value / 128);
    bytes.push(value === 0 ? low : low | 128);
  } while (value > 0);
  return bytes;
}

describe("protobuf frame budget", () => {
  it("accepts a frame larger than the former fixed cap when declared", async () => {
    const size = 9 * 1024 * 1024;
    const encoded = Buffer.concat([
      Buffer.from([0x0a, ...varint(size)]),
      Buffer.alloc(size, 0x61),
    ]);
    const frames = boundedProtobufFrames(
      encoded,
      createHash("sha256"),
      encoded.length,
      size,
    );
    const first = await frames.next();
    expect(first.done).toBe(false);
    if (first.done) throw new Error("Protobuf frame was not decoded");
    expect(first.value.value.byteLength).toBe(size);
    expect((await frames.next()).done).toBe(true);
  });
});
