import {
  ObservationError
} from "./shared-AJ5KBTH5.js";

// node_modules/@projector/control-plane/dist/observation/data-bound.js
function assertBoundedObservationData(value, maximumBytes, deadline) {
  let bytes = 0;
  let visited = 0;
  const ancestors = /* @__PURE__ */ new Set();
  const add = (amount) => {
    bytes += amount;
    if (bytes > maximumBytes)
      throw new ObservationError("observation-limit-exceeded", "derived-data", ".", `Observation derived-data limit exceeded (${bytes} > ${maximumBytes} bytes)`, "maxDerivedBytes", bytes);
    if (++visited % 1024 === 0 && Date.now() >= deadline)
      throw new ObservationError("observation-limit-exceeded", "data-accounting", ".", "Observation deadline exceeded during data accounting", "timeoutMs");
  };
  const frames = [{ kind: "value", item: value }];
  if (Date.now() >= deadline)
    throw new ObservationError("observation-limit-exceeded", "data-accounting", ".", "Observation deadline exceeded before data accounting", "timeoutMs");
  while (frames.length > 0) {
    const frame = frames.pop();
    if (frame.kind === "array") {
      if (frame.index === frame.item.length) {
        ancestors.delete(frame.item);
        continue;
      }
      if (frame.index > 0)
        add(1);
      frames.push({ ...frame, index: frame.index + 1 });
      frames.push({ kind: "value", item: frame.item[frame.index] });
      continue;
    }
    if (frame.kind === "object") {
      if (frame.index === frame.keys.length) {
        ancestors.delete(frame.item);
        continue;
      }
      const key = frame.keys[frame.index];
      const descriptor = Object.getOwnPropertyDescriptor(frame.item, key);
      if (!("value" in descriptor))
        throw new Error("Observation worker tasks cannot contain accessors");
      if (descriptor.value === void 0) {
        frames.push({ ...frame, index: frame.index + 1 });
        continue;
      }
      if (frame.emitted)
        add(1);
      add(1);
      frames.push({ ...frame, index: frame.index + 1, emitted: true });
      frames.push({ kind: "value", item: descriptor.value });
      frames.push({ kind: "value", item: key });
      continue;
    }
    const item = frame.item;
    if (item === void 0 || item === null) {
      add(4);
      continue;
    }
    if (typeof item === "string") {
      add(2);
      for (let i = 0; i < item.length; i += 1) {
        const code = item.charCodeAt(i);
        if (code === 34 || code === 92 || [8, 9, 10, 12, 13].includes(code))
          add(2);
        else if (code < 32)
          add(6);
        else if (code < 128)
          add(1);
        else if (code < 2048)
          add(2);
        else if (code >= 55296 && code <= 56319 && item.charCodeAt(i + 1) >= 56320 && item.charCodeAt(i + 1) <= 57343) {
          add(4);
          i += 1;
        } else if (code >= 55296 && code <= 57343)
          add(6);
        else
          add(3);
      }
      continue;
    }
    if (typeof item === "number") {
      add(Number.isFinite(item) ? String(item).length : 4);
      continue;
    }
    if (typeof item === "boolean") {
      add(item ? 4 : 5);
      continue;
    }
    if (typeof item !== "object")
      throw new Error("Observation worker tasks accept plain data only");
    if (ancestors.has(item))
      throw new Error("Observation worker tasks cannot contain cyclic data");
    ancestors.add(item);
    add(2);
    if (Array.isArray(item)) {
      frames.push({ kind: "array", item, index: 0 });
    } else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null)
        throw new Error("Observation worker tasks accept plain objects only");
      frames.push({ kind: "object", item, keys: Object.keys(item), index: 0, emitted: false });
    }
  }
  return bytes;
}

export {
  assertBoundedObservationData
};
