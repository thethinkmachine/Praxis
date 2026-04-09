type NormalizedValue =
  | null
  | boolean
  | number
  | string
  | NormalizedValue[]
  | { [key: string]: NormalizedValue };

interface GraphLike {
  nodes: unknown[];
  edges: unknown[];
  directed?: boolean;
}

function compareNormalized(a: NormalizedValue, b: NormalizedValue): number {
  return JSON.stringify(a).localeCompare(JSON.stringify(b));
}

function sortNormalized(values: NormalizedValue[]): NormalizedValue[] {
  return [...values].sort(compareNormalized);
}

function isGraphLike(value: unknown): value is GraphLike {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as GraphLike;
  return Array.isArray(candidate.nodes) && Array.isArray(candidate.edges);
}

function normalizeGraph(graph: GraphLike): NormalizedValue {
  return {
    __type: 'Graph',
    directed: graph.directed ?? false,
    nodes: sortNormalized(graph.nodes.map((node) => normalizeValue(node))),
    edges: sortNormalized(graph.edges.map((edge) => normalizeValue(edge))),
  };
}

function normalizeObject(value: Record<string, unknown>): NormalizedValue {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalizeValue(entry)]),
  );
}

function normalizeValue(value: unknown): NormalizedValue {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (isGraphLike(value)) {
    return normalizeGraph(value);
  }

  if (value instanceof Set) {
    return {
      __type: 'Set',
      values: sortNormalized(Array.from(value, (entry) => normalizeValue(entry))),
    };
  }

  if (value instanceof Map) {
    return {
      __type: 'Map',
      entries: Array.from(value.entries(), ([key, entry]) => [
        normalizeValue(key),
        normalizeValue(entry),
      ] satisfies NormalizedValue[]).sort((left, right) => compareNormalized(left, right)),
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }

  if (typeof value === 'object') {
    return normalizeObject(value as Record<string, unknown>);
  }

  return String(value);
}

function hashString(value: string): string {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

export function serializeExecutionProblem(value: unknown): string {
  return JSON.stringify(normalizeValue(value));
}

export function createExecutionProblemKey(value: unknown): string {
  return `problem:${hashString(serializeExecutionProblem(value))}`;
}
