import type { ElementDefinition } from 'cytoscape';
import type { GameTreeNode } from '@/algorithms/game-playing/types';

interface TreeCoord {
  x: number;
  y: number;
}

function computeTreeCoordinates(rootId: string, childrenMap: Map<string, string[]>): Map<string, TreeCoord> {
  const subtreeWidth = new Map<string, number>();

  const computeWidth = (nodeId: string): number => {
    const children = childrenMap.get(nodeId) ?? [];
    if (children.length === 0) {
      subtreeWidth.set(nodeId, 1);
      return 1;
    }

    let total = 0;
    for (const child of children) total += computeWidth(child);
    total += (children.length - 1) * 0.5;
    subtreeWidth.set(nodeId, total);
    return total;
  };

  const rootWidth = computeWidth(rootId);
  const coords = new Map<string, TreeCoord>();

  const assign = (nodeId: string, leftBoundary: number, depth: number) => {
    const width = subtreeWidth.get(nodeId) ?? 1;
    const center = leftBoundary + width / 2;
    coords.set(nodeId, { x: center, y: depth });

    const children = childrenMap.get(nodeId) ?? [];
    let cursor = leftBoundary;
    for (const child of children) {
      const childWidth = subtreeWidth.get(child) ?? 1;
      assign(child, cursor, depth + 1);
      cursor += childWidth + 0.5;
    }
  };

  assign(rootId, 0, 0);

  const xSpacing = 160;
  const ySpacing = 180;
  for (const [id, pos] of coords) {
    coords.set(id, {
      x: (pos.x - rootWidth / 2) * xSpacing,
      y: pos.y * ySpacing,
    });
  }

  return coords;
}

function defaultDescribeNode(node: GameTreeNode): string {
  return node.stateLabel;
}

function defaultDescribeEdge(node: GameTreeNode): string {
  return node.moveLabel ?? '';
}

export type GameTreeNodeShape = 'circle' | 'square' | 'diamond' | 'card';

/**
 * Builds Cytoscape elements for a Game Search Tree (Minimax/Alpha-Beta/SSS*)
 * Implements "focal-rendering" to prevent DOM explosion by only showing
 * relevant parts of the tree near the current search node.
 */
export function buildGameTreeElements(
  tree: Map<string, GameTreeNode> | undefined,
  currentNodeId: string | null = null,
  principalVariation: string[] | null = null,
  currentStepNumber: number = Infinity,
  describeNode: (node: GameTreeNode) => string = defaultDescribeNode,
  describeEdge: (node: GameTreeNode) => string = defaultDescribeEdge,
  nodeShape: (node: GameTreeNode) => GameTreeNodeShape = () => 'card',
  bestStrategyNodeIds: string[] | null = null,
): ElementDefinition[] {
  if (!tree || tree.size === 0) return [];

  // Prefer the (possibly branching) best-strategy set when available; fall back to the single
  // principal-variation line. Node ids are matched against `extra.nodeId`, the domain's own id
  // for the underlying tree node — not the search-tree trace id, which is a per-run compound key.
  const strategyIds = new Set<string>(
    bestStrategyNodeIds && bestStrategyNodeIds.length > 0 ? bestStrategyNodeIds : (principalVariation ?? []),
  );

  const MAX_VISUAL_NODES = 150;
  let rootId: string | null = null;
  for (const node of tree.values()) {
    if (node.parentId === null) {
      rootId = node.id;
      break;
    }
  }
  if (!rootId) return [];

  // Filter tree to only include nodes discovered up to currentStepNumber
  const filteredTree = new Map<string, GameTreeNode>();
  for (const [id, node] of tree.entries()) {
    if (node.discoveryStep <= currentStepNumber) {
      filteredTree.set(id, node);
    }
  }

  // Use the filtered tree for the rest of the logic
  const activePath = new Set<string>();
  let curr = currentNodeId;
  while (curr) {
    activePath.add(curr);
    curr = filteredTree.get(curr)?.parentId || null;
  }
  if (rootId) activePath.add(rootId);

  const visibleNodes = new Set<string>(activePath);

  for (const nodeId of activePath) {
    for (const node of filteredTree.values()) {
      if (node.parentId === nodeId) {
        visibleNodes.add(node.id);
        if (visibleNodes.size >= MAX_VISUAL_NODES) break;
      }
    }
    if (visibleNodes.size >= MAX_VISUAL_NODES) break;
  }

  if (visibleNodes.size < MAX_VISUAL_NODES) {
    const sortedNodes = Array.from(filteredTree.values()).sort((a, b) => b.depth - a.depth);
    for (const node of sortedNodes) {
      if (!visibleNodes.has(node.id) && (activePath.has(node.parentId || ''))) {
          visibleNodes.add(node.id);
      }
      if (visibleNodes.size >= MAX_VISUAL_NODES) break;
    }
  }

  const childrenMap = new Map<string, string[]>();
  for (const nodeId of visibleNodes) {
    const node = filteredTree.get(nodeId);
    if (node && node.parentId && visibleNodes.has(node.parentId)) {
      const siblings = childrenMap.get(node.parentId) ?? [];
      siblings.push(node.id);
      childrenMap.set(node.parentId, siblings);
    }
  }

  const coords = computeTreeCoordinates(rootId, childrenMap);
  const nodeElements: ElementDefinition[] = [];
  const edgeElements: ElementDefinition[] = [];

  for (const nodeId of visibleNodes) {
    const node = filteredTree.get(nodeId);
    if (!node) continue;
    const coord = coords.get(node.id);
    if (!coord) continue;

    const classes: string[] = [];
    if (node.parentId === null) classes.push('start');
    if (node.id === currentNodeId) classes.push('current');
    if (node.isPruned) classes.push('pruned');
    if (node.isTerminal) classes.push('goal');
    if (node.id !== currentNodeId) {
      if (node.searchState === 'L') classes.push('frontier');
      if (node.searchState === 'S') classes.push('explored');
    }
    if (activePath.has(node.id)) classes.push('active-path');
    const editorNodeId = (node.extra?.nodeId as string | undefined) ?? node.id;
    if (strategyIds.has(editorNodeId)) classes.push('path');

    nodeElements.push({
      data: {
        id: node.id,
        label: describeNode(node),
        shape: nodeShape(node),
        nodeKind: node.nodeKind,
        score: node.score,
        alpha: node.alpha,
        beta: node.beta,
        depth: node.depth,
      },
      position: coord,
      classes: classes.join(' '),
    });

    if (node.parentId) {
      const edgeClasses: string[] = ['directed'];
      if (node.isPruned) edgeClasses.push('pruned-edge');

      edgeElements.push({
        data: {
          id: `e-${node.parentId}-${node.id}`,
          source: node.parentId,
          target: node.id,
          label: describeEdge(node),
        },
        classes: edgeClasses.join(' '),
      });
    }
  }

  return [...nodeElements, ...edgeElements];
}
