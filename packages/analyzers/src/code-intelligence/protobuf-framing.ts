import type { Hash } from "node:crypto";

async function* chunks(
  source: Uint8Array | AsyncIterable<Uint8Array>,
): AsyncGenerator<Uint8Array> {
  if (source instanceof Uint8Array) {
    for (let offset = 0; offset < source.length; offset += 1024 * 1024)
      yield source.subarray(offset, offset + 1024 * 1024);
  } else
    for await (const chunk of source)
      for (let offset = 0; offset < chunk.length; offset += 1024 * 1024)
        yield chunk.subarray(offset, offset + 1024 * 1024);
}

/** Reads protobuf fields without retaining an entire multi-document artifact. */
export async function* boundedProtobufFrames(
  source: Uint8Array | AsyncIterable<Uint8Array>,
  digest: Hash,
  maxArtifact: number,
  maxFrame: number,
): AsyncGenerator<{ field: number; value: Uint8Array }> {
  if (maxArtifact !== Infinity && (!Number.isSafeInteger(maxArtifact) || maxArtifact < 1))
    throw new RangeError("maxArtifactBytes must be a positive safe integer");
  if (maxFrame !== Infinity && (!Number.isSafeInteger(maxFrame) || maxFrame < 1))
    throw new RangeError("maxFrameBytes must be a positive safe integer");
  const iterator = chunks(source)[Symbol.asyncIterator]();
  let buffer = Buffer.alloc(0),
    total = 0;
  const ensure = async (size: number): Promise<boolean> => {
    while (buffer.length < size) {
      const next = await iterator.next();
      if (next.done) return false;
      total += next.value.byteLength;
      if (total > maxArtifact)
        throw new Error(`Protobuf artifact exceeds maxArtifactBytes (${maxArtifact}); increase the declared derived observation budget to retry`);
      digest.update(next.value);
      buffer = Buffer.concat([buffer, next.value]);
    }
    return true;
  };
  const take = async (size: number): Promise<Uint8Array> => {
    if (!(await ensure(size))) throw new Error("Truncated protobuf field");
    const bytes = buffer.subarray(0, size);
    buffer = buffer.subarray(size);
    return bytes;
  };
  const readVarint = async (): Promise<number> => {
    let value = 0,
      shift = 0;
    while (shift <= 49) {
      const byte = (await take(1))[0]!;
      value += (byte & 127) * 2 ** shift;
      if ((byte & 128) === 0 && Number.isSafeInteger(value)) return value;
      shift += 7;
    }
    throw new Error("Invalid protobuf varint");
  };
  while (await ensure(1)) {
    const tag = await readVarint(),
      field = Math.floor(tag / 8),
      wire = tag % 8;
    if (field < 1) throw new Error("Invalid protobuf field number");
    if (wire === 2) {
      const size = await readVarint();
      if (size > maxFrame)
        throw new Error(`Protobuf frame exceeds maxFrameBytes (${maxFrame}); increase the declared frame budget to retry`);
      yield { field, value: await take(size) };
    } else if (wire === 0) await readVarint();
    else if (wire === 1 || wire === 5) await take(wire === 1 ? 8 : 4);
    else throw new Error(`Unsupported protobuf wire type ${wire}`);
  }
}
