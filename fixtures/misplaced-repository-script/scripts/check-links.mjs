export function findBrokenLinks(links) {
  return links.filter((link) => link.startsWith("missing:"));
}
