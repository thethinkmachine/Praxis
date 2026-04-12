import type { ElementDefinition } from 'cytoscape';
import type { GameTreeNode } from '@/algorithms/game-playing/types';
import { formatMove } from '@/lib/tic-tac-toe';

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

/**
 * Builds Cytoscape elements for a Game Search Tree (Minimax/Alpha-Beta/SSS*)
 * Implements "focal-rendering" to prevent DOM explosion by only showing 
 * relevant parts of the tree near the current search node.
 */
export function buildGameTreeElements(
  tree: Map<string, GameTreeNode> | undefined,
  currentNodeId: string | null = null,
  principalVariation: number[] | null = null,
  currentStepNumber: number = Infinity,
): ElementDefinition[] {
  if (!tree || tree.size === 0) return [];

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

    // Board representation for SVGAutoCanvas to detect
    // Format: "X . O | . X . | O . ."
    const boardStr = node.board
      .map((cell, i) => {
        const char = cell === null ? '.' : cell;
        return (i + 1) % 3 === 0 && i < 8 ? `${char} | ` : `${char} `;
      })
      .join('')
      .trim();

    nodeElements.push({
      data: {
        id: node.id,
        label: boardStr,
        score: node.score,
        alpha: node.alpha,
        beta: node.beta,
        depth: node.depth,
      },
      position: coord,
      classes: classes.join(' '),
    });

    if (node.parentId) {
      const parent = filteredTree.get(node.parentId);
      const edgeClasses: string[] = ['directed'];
      if (node.isPruned) edgeClasses.push('pruned-edge');
      
      const moveLabel = node.move !== null ? formatMove(node.move) : '';

      edgeElements.push({
        data: {
          id: `e-${node.parentId}-${node.id}`,
          source: node.parentId,
          target: node.id,
          label: moveLabel,
        },
        classes: edgeClasses.join(' '),
      });
    }
  }

  return [...nodeElements, ...edgeElements];
}
