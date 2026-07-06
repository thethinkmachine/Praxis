/**
 * Compares two labels for tie-breaking, treating embedded digit runs as
 * numbers so "2" sorts before "10" instead of lexicographically after it.
 * Falls back to plain locale comparison for non-numeric labels.
 */
export function compareLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}
