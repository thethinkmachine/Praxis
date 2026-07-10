// Shared hierarchical (top-down) layout for game trees. Used by the preset
// builders, the test fixtures, and the editor's "auto-layout" button so the
// spacing stays identical everywhere.

export interface LayoutNodeRef {
  id: string;
}

export interface LayoutEdgeRef {
  source: string;
  target: string;
}

export interface LayoutOptions {
  xGap?: number;
  yGap?: number;
}

/** Subtree-width layout: leaves are unit-width, parents centered over children. */
export function layoutGameTree(
  nodes: LayoutNodeRef[],
  edges: LayoutEdgeRef[],
  rootId: string | null,
  options: LayoutOptions = {},
): Map<string, { x: number; y: number }> {
  const xGap = options.xGap ?? 150;
  const yGap = options.yGap ?? 140;
  const positions = new Map<string, { x: number; y: number }>();
  if (!rootId) return positions;

  const childrenMap = new Map<string, string[]>();
  for (const node of nodes) childrenMap.set(node.id, []);
  for (const edge of edges) childrenMap.get(edge.source)?.push(edge.target);

  const width = new Map<string, number>();
  const seen = new Set<string>();
  const computeWidth = (id: string): number => {
    if (seen.has(id)) return width.get(id) ?? 1; // guard against malformed cycles
    seen.add(id);
    const children = childrenMap.get(id) ?? [];
    if (children.length === 0) {
      width.set(id, 1);
      return 1;
    }
    const total = children.reduce((sum, child) => sum + computeWidth(child), 0) + (children.length - 1) * 0.5;
    width.set(id, total);
    return total;
  };

  const rootWidth = computeWidth(rootId);

  const placed = new Set<string>();
  const assign = (id: string, leftBoundary: number, depth: number) => {
    if (placed.has(id)) return;
    placed.add(id);
    const w = width.get(id) ?? 1;
    positions.set(id, {
      x: Math.round(((leftBoundary + w / 2) - rootWidth / 2) * xGap),
      y: depth * yGap,
    });
    let cursor = leftBoundary;
    for (const child of childrenMap.get(id) ?? []) {
      const childWidth = width.get(child) ?? 1;
      assign(child, cursor, depth + 1);
      cursor += childWidth + 0.5;
    }
  };

  assign(rootId, 0, 0);
  return positions;
}
