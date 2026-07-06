import { Graph, type GraphProblem } from '@/types/problem';
import { encodeBase64, decodeBase64 } from '@/lib/serialization';

const DEMO_FILENAME_PATTERN = /^[a-z0-9_-]+\.json$/i;

/** Restricts fetched demo filenames to a safe, known-shape set — guards against path traversal via a `?demo=` link. */
export function isValidDemoFilename(filename: string): boolean {
  return DEMO_FILENAME_PATTERN.test(filename);
}

export function serializeGraphReplay(problem: GraphProblem): string {
  const payload = {
    graph: { nodes: problem.graph.nodes, edges: problem.graph.edges, directed: problem.graph.directed },
    startNode: problem.startNode,
    goalNode: problem.goalNode,
    useHeuristic: problem.useHeuristic,
    heuristic: problem.heuristic,
  };
  return encodeBase64(JSON.stringify(payload));
}

export function deserializeGraphReplay(token: string): GraphProblem | null {
  try {
    const decoded = decodeBase64(token);
    const parsed = JSON.parse(decoded) as GraphProblem;
    if (!parsed?.graph?.nodes || !parsed?.graph?.edges) return null;
    return {
      ...parsed,
      graph: new Graph(parsed.graph),
    };
  } catch {
    return null;
  }
}
