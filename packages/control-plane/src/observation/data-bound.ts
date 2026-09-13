import { ObservationError } from "@projector/core";

/** Counts plain-data transfer size without first allocating a serialized copy. */
export function assertBoundedObservationData(value: unknown, maximumBytes: number, deadline: number): number {
  let bytes = 0;
  let visited = 0;
  const ancestors = new Set<object>();
  const add = (amount: number): void => {
    bytes += amount;
    if (bytes > maximumBytes) throw new ObservationError("observation-limit-exceeded", "derived-data", ".", `Observation derived-data limit exceeded (${bytes} > ${maximumBytes} bytes)`, "maxDerivedBytes", bytes);
    if (++visited % 1024 === 0 && Date.now() >= deadline) throw new ObservationError("observation-limit-exceeded", "data-accounting", ".", "Observation deadline exceeded during data accounting", "timeoutMs");
  };
  const visit = (item: unknown, depth: number): void => {
    if (depth > 256) throw new Error("Observation data nesting limit exceeded (256)");
    if (item === undefined || item === null) { add(4); return; }
    if (typeof item === "string") {
      add(2);
      for (let i = 0; i < item.length; i += 1) {
        const code = item.charCodeAt(i);
        if (code === 34 || code === 92 || [8, 9, 10, 12, 13].includes(code)) add(2);
        else if (code < 32) add(6);
        else if (code < 128) add(1);
        else if (code < 2048) add(2);
        else if (code >= 0xd800 && code <= 0xdbff && item.charCodeAt(i + 1) >= 0xdc00 && item.charCodeAt(i + 1) <= 0xdfff) { add(4); i += 1; }
        else if (code >= 0xd800 && code <= 0xdfff) add(6);
        else add(3);
      }
      return;
    }
    if (typeof item === "number") { add(Number.isFinite(item) ? String(item).length : 4); return; }
    if (typeof item === "boolean") { add(item ? 4 : 5); return; }
    if (typeof item !== "object") throw new Error("Observation worker tasks accept plain data only");
    if (ancestors.has(item)) throw new Error("Observation worker tasks cannot contain cyclic data");
    ancestors.add(item);
    add(2);
    if (Array.isArray(item)) {
      let first = true;
      for (const entry of item) { if (!first) add(1); first = false; visit(entry, depth + 1); }
    } else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) throw new Error("Observation worker tasks accept plain objects only");
      let first = true;
      for (const key in item) {
        if (!Object.hasOwn(item, key)) continue;
        const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
        if (!("value" in descriptor)) throw new Error("Observation worker tasks cannot contain accessors");
        if (descriptor.value === undefined) continue;
        if (!first) add(1);
        first = false;
        add(1);
        visit(key, depth + 1);
        visit(descriptor.value, depth + 1);
      }
    }
    ancestors.delete(item);
  };
  if (Date.now() >= deadline) throw new ObservationError("observation-limit-exceeded", "data-accounting", ".", "Observation deadline exceeded before data accounting", "timeoutMs");
  visit(value, 0);
  return bytes;
}
