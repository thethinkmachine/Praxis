/**
 * Shared Set/Map-aware JSON serialization helpers.
 * Used by both useProblemImportExport and savedProblems.store.
 */

export function setMapReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Set) return { __set: true, values: Array.from(value) };
  if (value instanceof Map) return { __map: true, entries: Array.from(value.entries()) };
  return value;
}

export function setMapReviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && (value as Record<string, unknown>).__set) {
    return new Set((value as { values: unknown[] }).values);
  }
  if (value && typeof value === 'object' && (value as Record<string, unknown>).__map) {
    return new Map((value as { entries: [unknown, unknown][] }).entries);
  }
  return value;
}

export function serializeWithSetMap(value: unknown): string {
  return JSON.stringify(value, setMapReplacer);
}

export function deserializeWithSetMap(text: string): unknown {
  return JSON.parse(text, setMapReviver);
}
