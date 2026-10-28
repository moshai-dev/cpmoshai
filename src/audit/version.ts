export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference) return difference < 0 ? -1 : 1;
  }
  return 0;
}

export const branchOf = (version: string, segments = 2): string =>
  version.split(".").slice(0, segments).join(".");
