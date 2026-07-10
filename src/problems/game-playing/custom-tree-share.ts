import { GameTree, type GameTreeProblem } from '@/types/problem';
import { encodeBase64, decodeBase64 } from '@/lib/serialization';

// Serializes a custom game tree (structure, kinds, values, probabilities, and
// layout positions) into a URL-safe token, mirroring the graph page's
// serializeGraphReplay so trees can be shared via a link.
export function serializeGameTree(problem: GameTreeProblem): string {
  const tree = problem.tree;
  return encodeBase64(JSON.stringify({ nodes: tree.nodes, edges: tree.edges, rootId: tree.rootId }));
}

export function deserializeGameTree(token: string): GameTreeProblem | null {
  try {
    const parsed = JSON.parse(decodeBase64(token)) as { nodes?: unknown; edges?: unknown; rootId?: unknown };
    if (!Array.isArray(parsed?.nodes) || !Array.isArray(parsed?.edges)) return null;
    return {
      kind: 'game-tree',
      tree: new GameTree({
        nodes: parsed.nodes as GameTree['nodes'],
        edges: parsed.edges as GameTree['edges'],
        rootId: typeof parsed.rootId === 'string' ? parsed.rootId : null,
      }),
    };
  } catch {
    return null;
  }
}
