import { GameTree } from '@/types/problem';
import type { GameTreeData, GameTreeEdgeData, GameTreeNodeData, GameTreeNodeKind, GameTreeProblem } from '@/types/problem';

export interface GameTreeSpec {
  kind: GameTreeNodeKind;
  value?: number;
  children?: Array<{ spec: GameTreeSpec; moveLabel?: string; probability?: number }>;
}

export function leaf(value: number): GameTreeSpec {
  return { kind: 'terminal', value };
}

export function node(
  kind: GameTreeNodeKind,
  children: Array<{ spec: GameTreeSpec; moveLabel?: string; probability?: number }>,
): GameTreeSpec {
  return { kind, children };
}

export function edge(spec: GameTreeSpec, moveLabel?: string, probability?: number) {
  return { spec, moveLabel, probability };
}

/** Flattens a compact nested-literal spec into a GameTree with auto-generated ids. */
export function buildGameTree(spec: GameTreeSpec, prefix = 'g'): GameTree {
  const nodes: GameTreeNodeData[] = [];
  const edges: GameTreeEdgeData[] = [];
  let counter = 0;

  function visit(current: GameTreeSpec, parentId: string | null, meta?: { moveLabel?: string; probability?: number }): string {
    const id = `${prefix}${counter++}`;
    nodes.push({ id, kind: current.kind, value: current.value });
    if (parentId) {
      edges.push({
        id: `${prefix}e${edges.length}`,
        source: parentId,
        target: id,
        moveLabel: meta?.moveLabel,
        probability: meta?.probability,
      });
    }
    for (const c of current.children ?? []) {
      visit(c.spec, id, { moveLabel: c.moveLabel, probability: c.probability });
    }
    return id;
  }

  const rootId = visit(spec, null);
  return new GameTree({ nodes, edges, rootId } as GameTreeData);
}

export function buildGameTreeProblem(spec: GameTreeSpec, prefix = 'g'): GameTreeProblem {
  return { kind: 'game-tree', tree: buildGameTree(spec, prefix) };
}
