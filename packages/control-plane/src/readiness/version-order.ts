interface ParsedVersion {
  readonly core: readonly [string, string, string];
  readonly prerelease: readonly string[] | undefined;
}

const numericVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

export function comparePackageVersions(left: string, right: string): -1 | 0 | 1 {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  for (let index = 0; index < leftVersion.core.length; index += 1) {
    const order = compareDecimal(leftVersion.core[index]!, rightVersion.core[index]!);
    if (order !== 0) return order;
  }
  if (leftVersion.prerelease === undefined) return rightVersion.prerelease === undefined ? 0 : 1;
  if (rightVersion.prerelease === undefined) return -1;
  const length = Math.max(leftVersion.prerelease.length, rightVersion.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = leftVersion.prerelease[index];
    const rightIdentifier = rightVersion.prerelease[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    const leftNumeric = /^\d+$/u.test(leftIdentifier);
    const rightNumeric = /^\d+$/u.test(rightIdentifier);
    if (leftNumeric && rightNumeric) {
      const order = compareDecimal(leftIdentifier, rightIdentifier);
      if (order !== 0) return order;
    } else if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1;
    } else if (leftIdentifier !== rightIdentifier) {
      return leftIdentifier < rightIdentifier ? -1 : 1;
    }
  }
  return 0;
}

function parseVersion(value: string): ParsedVersion {
  const match = numericVersion.exec(value);
  if (match === null) throw new TypeError(`invalid numeric semantic version: ${value}`);
  return {
    core: [match[1]!, match[2]!, match[3]!],
    prerelease: match[4]?.split("."),
  };
}

function compareDecimal(left: string, right: string): -1 | 0 | 1 {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  return left === right ? 0 : left < right ? -1 : 1;
}
