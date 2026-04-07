import type { ElementDefinition } from 'cytoscape';
import { Graph } from '@/types/problem';

// ---------------------------------------------------------------------------
// Search Tree Adapter
//
// Builds a Cytoscape tree from the `pathMap` parent-pointer map that every
// graph-search algorithm maintains.  The result is rendered with a dagre
// top-to-bottom layout to show the exploration structure.
// ---------------------------------------------------------------------------

interface SearchTreeOptions {
  startNode: string;
  goalNode: string;
  /** id → user-visible label */
  labelMap: Map<string, string>;
  /** Cost maps (optional — only present for informed / optimal search) */
  gCosts?: Map<string, number>;
  hCosts?: Map<string, number>;
  fCosts?: Map<string, number>;
  /** The problem graph (to look up edge labels/actions) */
  graph?: Graph;
}

interface SearchHighlight {
  frontierNodes?: Set<string>;
  exploredNodes?: Set<string>;
  currentNode?: string | null;
  pathEdges?: string[] | null;
}

interface TreeCoord {
  x: number;
  y: number;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function computeTreeCoordinates(rootId: string, childrenMap: Map<string, string[]>): Map<string, TreeCoord> {
  const subtreeWidth = new Map<string, number>();
  const widthVisiting = new Set<string>();
  const assignVisiting = new Set<string>();

  const computeWidth = (nodeId: string): number => {
    if (widthVisiting.has(nodeId)) {
      return 1;
    }

    const children = childrenMap.get(nodeId) ?? [];
    if (children.length === 0) {
      subtreeWidth.set(nodeId, 1);
      return 1;
    }

    widthVisiting.add(nodeId);
    let total = 0;
    for (const child of children) total += computeWidth(child);
    widthVisiting.delete(nodeId);
    // Add lane gaps between sibling subtrees for readability.
    total += (children.length - 1) * 0.45;
    subtreeWidth.set(nodeId, total);
    return total;
  };

  const rootWidth = computeWidth(rootId);
  const coords = new Map<string, TreeCoord>();

  const assign = (nodeId: string, leftBoundary: number, depth: number) => {
    if (assignVisiting.has(nodeId)) {
      return;
    }
    assignVisiting.add(nodeId);

    const width = subtreeWidth.get(nodeId) ?? 1;
    const center = leftBoundary + width / 2;
    coords.set(nodeId, { x: center, y: depth });

    const children = childrenMap.get(nodeId) ?? [];
    let cursor = leftBoundary;
    for (const child of children) {
      const childWidth = subtreeWidth.get(child) ?? 1;
      assign(child, cursor, depth + 1);
      cursor += childWidth + 0.45;
    }

    assignVisiting.delete(nodeId);
  };

  assign(rootId, 0, 0);

  // Normalize x around zero and scale into screen-friendly spacing.
  const xSpacing = 130;
  const ySpacing = 110;
  for (const [id, pos] of coords) {
    coords.set(id, {
      x: (pos.x - rootWidth / 2) * xSpacing,
      y: pos.y * ySpacing,
    });
  }

  return coords;
}

/**
 * Build Cytoscape `ElementDefinition[]` representing the search tree derived
 * from the current step's `pathMap`.
 *
 * @param pathMap   Map<child, parent | null> — parent pointers from the algorithm
 * @param highlight Current step highlight (frontier, explored, current, path)
 * @param foundPath Solution path (if any)
 * @param options   Labels, start/goal, cost maps
 */
export function buildSearchTreeElements(
  pathMap: Map<string, string | null>,
  highlight: SearchHighlight,
  foundPath: string[] | null,
  options: SearchTreeOptions,
): ElementDefinition[] {
  if (pathMap.size === 0) return [];

  const { startNode, goalNode, labelMap, gCosts, hCosts, fCosts, graph } = options;
  const adj = graph?.toAdjList();

  // -- Invert pathMap to children-map ----------------------------------------
  const childrenMap = new Map<string, string[]>();
  let rootId: string | null = null;
  const parentMap = new Map<string, string | null>();

  const wouldCreateCycle = (child: string, parent: string): boolean => {
    let cursor: string | null | undefined = parent;
    const seen = new Set<string>();
    while (cursor != null && !seen.has(cursor)) {
      if (cursor === child) return true;
      seen.add(cursor);
      cursor = parentMap.get(cursor);
    }
    return false;
  };

  for (const [child, parent] of pathMap) {
    if (parent === null) {
      rootId = child;
      parentMap.set(child, null);
      continue;
    }
    if (wouldCreateCycle(child, parent)) {
      continue;
    }
    parentMap.set(child, parent);
    const siblings = childrenMap.get(parent);
    if (siblings) {
      if (!siblings.includes(child)) siblings.push(child);
    } else {
      childrenMap.set(parent, [child]);
    }
  }

  if (rootId === null) return [];

  const coords = computeTreeCoordinates(rootId, childrenMap);

  // -- Solution path set (for coloring) --------------------------------------
  const pathSet = new Set(foundPath ?? []);

  // -- BFS through the tree to build elements --------------------------------
  // Nodes and edges are collected separately so that all node elements appear
  // before any edge elements in the final array.  Cytoscape requires that both
  // endpoints of an edge already exist when the edge is added.
  const nodeElements: ElementDefinition[] = [];
  const edgeElements: ElementDefinition[] = [];
  const visited = new Set<string>();
  const queue: string[] = [rootId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    // --- CSS classes ---------------------------------------------------------
    const classes: string[] = [];

    if (nodeId === highlight.currentNode) {
      classes.push('current');
    } else if (pathSet.has(nodeId)) {
      classes.push('path');
    } else if (highlight.frontierNodes?.has(nodeId)) {
      classes.push('frontier');
    } else if (highlight.exploredNodes?.has(nodeId)) {
      classes.push('explored');
    } else {
      classes.push('normal');
    }

    if (nodeId === startNode) classes.push('start');
    if (nodeId === goalNode) classes.push('goal');

    // --- Label ---------------------------------------------------------------
    let label = labelMap.get(nodeId) ?? nodeId;

    const g = gCosts?.get(nodeId);
    const h = hCosts?.get(nodeId);
    const f = fCosts?.get(nodeId);
    if (f !== undefined) {
      label += `\nf=${fmt(f)}`;
      if (g !== undefined && h !== undefined) {
        label += ` (g=${fmt(g)} h=${fmt(h)})`;
      }
    } else if (g !== undefined) {
      label += `\ng=${fmt(g)}`;
    }

    nodeElements.push({
      data: { id: `t-${nodeId}`, label },
      classes: classes.join(' '),
      position: coords.get(nodeId),
    });

    // --- Enqueue children & record edges -------------------------------------
    const children = childrenMap.get(nodeId);
    if (children) {
      for (const childId of children) {
        queue.push(childId);

        const inPath = pathSet.has(nodeId) && pathSet.has(childId);
        const edgeClasses = inPath ? 'directed path-edge' : 'directed';

        // Try to find the action/label for this edge
        let edgeLabel: string | undefined;
        if (adj) {
          const edge = adj.get(nodeId)?.find((e: { neighbor: string; edgeId: string }) => e.neighbor === childId);
          if (edge && edge.edgeId && !edge.edgeId.startsWith('e-')) {
            // If edgeId is not generic (like e-0, e-1), use it as a label/action
            edgeLabel = edge.edgeId;
          }
        }

        edgeElements.push({
          data: {
            id: `t-e-${nodeId}-${childId}`,
            source: `t-${nodeId}`,
            target: `t-${childId}`,
            label: edgeLabel,
          },
          classes: edgeClasses,
        });
      }
    }
  }

  // All nodes must come before edges so Cytoscape can resolve endpoints
  return [...nodeElements, ...edgeElements];
}
