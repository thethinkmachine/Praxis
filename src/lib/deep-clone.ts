/**
 * Deep-clone helper.
 * Uses structuredClone when available, falls back to JSON round-trip.
 * Maps and Sets are handled explicitly.
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;

  if (obj instanceof Map) {
    const clone = new Map();
    for (const [k, v] of obj) {
      clone.set(deepClone(k), deepClone(v));
    }
    return clone as unknown as T;
  }

  if (obj instanceof Set) {
    const clone = new Set();
    for (const v of obj) {
      clone.add(deepClone(v));
    }
    return clone as unknown as T;
  }

  if (Array.isArray(obj)) {
    return (obj as unknown[]).map(deepClone) as unknown as T;
  }

  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    clone[key] = deepClone((obj as Record<string, unknown>)[key]);
  }
  return clone as T;
}
