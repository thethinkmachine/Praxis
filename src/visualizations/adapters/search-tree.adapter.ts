import type { ElementDefinition } from 'cytoscape';

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
}

interface SearchHighlight {
  frontierNodes?: Set<string>;
  exploredNodes?: Set<string>;
  currentNode?: string | null;
  pathEdges?: string[] | null;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

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

  const { startNode, goalNode, labelMap, gCosts, hCosts, fCosts } = options;

  // -- Invert pathMap to children-map ----------------------------------------
  const childrenMap = new Map<string, string[]>();
  let rootId: string | null = null;

  for (const [child, parent] of pathMap) {
    if (parent === null) {
      rootId = child;
      continue;
    }
    const siblings = childrenMap.get(parent);
    if (siblings) siblings.push(child);
    else childrenMap.set(parent, [child]);
  }

  if (rootId === null) return [];

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
    });

    // --- Enqueue children & record edges -------------------------------------
    const children = childrenMap.get(nodeId);
    if (children) {
      for (const childId of children) {
        queue.push(childId);

        const inPath = pathSet.has(nodeId) && pathSet.has(childId);
        edgeElements.push({
          data: {
            id: `t-e-${nodeId}-${childId}`,
            source: `t-${nodeId}`,
            target: `t-${childId}`,
          },
          classes: inPath ? 'path-edge' : '',
        });
      }
    }
  }

  // All nodes must come before edges so Cytoscape can resolve endpoints
  return [...nodeElements, ...edgeElements];
}
