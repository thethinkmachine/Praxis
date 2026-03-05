import type { AlgorithmStep } from '@/types/step';
import type { GraphProblem, MazeProblem } from '@/types/problem';
import { mazeProblemToGraphProblem } from '@/problems/maze/maze';

export interface MazeOverlay {
  frontier: Set<string>;
  explored: Set<string>;
  currentNode: string | null;
  pathNodes: Set<string>;
}

export function mazeToGraphProblem(problem: MazeProblem): GraphProblem {
  return mazeProblemToGraphProblem(problem);
}

export function algorithmStepToMazeOverlay(step: AlgorithmStep | null): MazeOverlay | null {
  if (!step) return null;

  const st = step.state as Record<string, unknown>;
  const h = step.highlight as Record<string, unknown>;

  const frontier = new Set<string>(Array.isArray(st.frontier) ? st.frontier as string[] : []);
  const explored = st.explored instanceof Set ? st.explored as Set<string> : new Set<string>();
  const currentNode = typeof h.currentNode === 'string' ? h.currentNode : null;

  const foundPath = Array.isArray(st.foundPath)
    ? st.foundPath as string[]
    : Array.isArray(h.pathEdges)
      ? h.pathEdges as string[]
      : [];

  return {
    frontier,
    explored,
    currentNode,
    pathNodes: new Set(foundPath),
  };
}
