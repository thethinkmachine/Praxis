import { GameTree } from '@/types/problem';
import type { GameTreeData, GameTreeEdgeData, GameTreeNodeData, GameTreeNodeKind, GameTreeProblem } from '@/types/problem';
import { layoutGameTree } from './tree-layout';

export type CustomTreeScenarioId = 'classic-minimax' | 'alpha-beta-demo' | 'expectimax-dice';

export interface CustomTreeScenarioDefinition {
  id: CustomTreeScenarioId;
  name: string;
  description: string;
  tags: string[];
  problem: GameTreeProblem;
}

interface TreeSpec {
  kind: GameTreeNodeKind;
  value?: number;
  children?: Array<{ spec: TreeSpec; moveLabel?: string; probability?: number }>;
}

function child(spec: TreeSpec, moveLabel?: string, probability?: number) {
  return { spec, moveLabel, probability };
}

function leaf(value: number): TreeSpec {
  return { kind: 'terminal', value };
}

/** Compact nested-literal tree builder used for the bundled presets and the default starter tree. */
function buildTree(spec: TreeSpec, prefix: string): GameTree {
  const nodes: GameTreeNodeData[] = [];
  const edges: GameTreeEdgeData[] = [];
  let counter = 0;

  function visit(node: TreeSpec, parentId: string | null, edgeMeta?: { moveLabel?: string; probability?: number }): string {
    const id = `${prefix}${counter++}`;
    nodes.push({ id, kind: node.kind, value: node.value });
    if (parentId) {
      edges.push({
        id: `${prefix}e${edges.length}`,
        source: parentId,
        target: id,
        moveLabel: edgeMeta?.moveLabel,
        probability: edgeMeta?.probability,
      });
    }
    for (const c of node.children ?? []) {
      visit(c.spec, id, { moveLabel: c.moveLabel, probability: c.probability });
    }
    return id;
  }

  const rootId = visit(spec, null);
  const positions = layoutGameTree(nodes, edges, rootId, { xGap: 140, yGap: 140 });
  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (pos) { node.x = pos.x; node.y = pos.y; }
  }
  return new GameTree({ nodes, edges, rootId } as GameTreeData);
}

export function createDefaultGameTreeProblem(): GameTreeProblem {
  return {
    kind: 'game-tree',
    tree: buildTree(
      { kind: 'max', children: [child(leaf(3), 'A'), child(leaf(5), 'B')] },
      'n',
    ),
  };
}

export function normalizeGameTreeProblem(problem: unknown): GameTreeProblem {
  const incoming = problem as Partial<GameTreeProblem> | undefined;
  const treeData = incoming?.tree as GameTreeData | undefined;
  return {
    kind: 'game-tree',
    tree: treeData ? new GameTree(treeData) : createDefaultGameTreeProblem().tree,
  };
}

export const CUSTOM_TREE_SCENARIOS: CustomTreeScenarioDefinition[] = [
  {
    id: 'classic-minimax',
    name: 'Classic Minimax',
    description: 'A small textbook MAX/MIN tree with a hand-checkable best move and score.',
    tags: ['minimax', 'textbook'],
    problem: {
      kind: 'game-tree',
      tree: buildTree(
        {
          kind: 'max',
          children: [
            child({ kind: 'min', children: [child(leaf(3), 'a1'), child(leaf(5), 'a2')] }, 'A'),
            child({ kind: 'min', children: [child(leaf(6), 'b1'), child(leaf(2), 'b2')] }, 'B'),
          ],
        },
        'cm',
      ),
    },
  },
  {
    id: 'alpha-beta-demo',
    name: 'Alpha-Beta Pruning Demo',
    description: 'Shaped so Alpha-Beta provably visits fewer nodes than plain Minimax on the identical tree.',
    tags: ['alpha-beta', 'pruning'],
    problem: {
      kind: 'game-tree',
      tree: buildTree(
        {
          kind: 'max',
          children: [
            child({ kind: 'min', children: [child(leaf(3), 'a1'), child(leaf(12), 'a2'), child(leaf(8), 'a3')] }, 'A'),
            child({ kind: 'min', children: [child(leaf(2), 'b1'), child(leaf(4), 'b2'), child(leaf(6), 'b3')] }, 'B'),
            child({ kind: 'min', children: [child(leaf(14), 'c1'), child(leaf(5), 'c2'), child(leaf(2), 'c3')] }, 'C'),
          ],
        },
        'ab',
      ),
    },
  },
  {
    id: 'expectimax-dice',
    name: 'Expectimax Dice Roll',
    description: 'A chance node with non-uniform probabilities — compare how Expectimax and Minimax disagree.',
    tags: ['expectimax', 'chance nodes'],
    problem: {
      kind: 'game-tree',
      tree: buildTree(
        {
          kind: 'max',
          children: [
            child(
              {
                kind: 'chance',
                children: [child(leaf(10), 'heads', 0.5), child(leaf(0), 'tails', 0.5)],
              },
              'Gamble',
            ),
            child(
              {
                kind: 'chance',
                children: [child(leaf(4), 'miss', 0.2), child(leaf(6), 'hit', 0.8)],
              },
              'Safe bet',
            ),
          ],
        },
        'ed',
      ),
    },
  },
];

const CUSTOM_TREE_SCENARIO_MAP = new Map(CUSTOM_TREE_SCENARIOS.map((scenario) => [scenario.id, scenario]));

export function getCustomTreeScenario(id: CustomTreeScenarioId): GameTreeProblem {
  const scenario = CUSTOM_TREE_SCENARIO_MAP.get(id);
  if (!scenario) {
    throw new Error(`Unknown custom-tree scenario: ${id}`);
  }
  return normalizeGameTreeProblem(scenario.problem);
}
