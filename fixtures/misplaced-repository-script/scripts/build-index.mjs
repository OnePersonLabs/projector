export function buildIndex(entries) {
  return [...entries].sort().join("\n");
}
