import type { GraphData, GraphEdge, GraphNode, GraphProblem, HeuristicConfig, HeuristicId, MazeProblem } from '@/types/problem';
import { MAZE_STRATEGIES } from './strategies';
import type { MazeGenerationStrategyId } from './strategies';

export const DEFAULT_MAZE_ROWS = 14;
export const DEFAULT_MAZE_COLS = 20;
const ALLOWED_HEURISTICS = new Set<HeuristicId>([
  'manual-node',
  'zero',
  'manhattan-distance',
  'euclidean-distance',
  'chebyshev-distance',
]);

export function mazeCellId(row: number, col: number): string {
  return `r${row}c${col}`;
}

export function parseMazeCellId(id: string): [number, number] {
  const m = /^r(\d+)c(\d+)$/.exec(id);
  if (!m) return [0, 0];
  return [Number(m[1]), Number(m[2])];
}

export function createDefaultMazeProblem(
  rows = DEFAULT_MAZE_ROWS,
  cols = DEFAULT_MAZE_COLS,
  seed = Date.now(),
): MazeProblem {
  return {
    kind: 'maze',
    rows,
    cols,
    seed,
    walls: [],
    startNode: mazeCellId(0, 0),
    goalNode: mazeCellId(rows - 1, cols - 1),
    terrain: {},
    strategy: 'recursive-backtracker',
    heuristic: { id: 'manhattan-distance' },
    manualHeuristicValues: {},
  };
}

function normalizeHeuristicConfig(config: HeuristicConfig | undefined): HeuristicConfig {
  if (config && ALLOWED_HEURISTICS.has(config.id)) {
    const scaleRaw = Number(config.params?.scale);
    if (Number.isFinite(scaleRaw) && scaleRaw > 0) {
      return {
        id: config.id,
        params: { ...config.params, scale: scaleRaw },
      };
    }
    return { id: config.id, params: config.params };
  }
  return { id: 'manhattan-distance' };
}

export function normalizeMazeProblem(problem: MazeProblem): MazeProblem {
  const rows = Math.max(2, Math.floor(problem.rows));
  const cols = Math.max(2, Math.floor(problem.cols));

  const [sr, sc] = parseMazeCellId(problem.startNode);
  const [gr, gc] = parseMazeCellId(problem.goalNode);

  const clampedStart = mazeCellId(Math.min(Math.max(sr, 0), rows - 1), Math.min(Math.max(sc, 0), cols - 1));
  const clampedGoal = mazeCellId(Math.min(Math.max(gr, 0), rows - 1), Math.min(Math.max(gc, 0), cols - 1));

  const wallSet = new Set(problem.walls.filter((id) => {
    const [r, c] = parseMazeCellId(id);
    return r >= 0 && r < rows && c >= 0 && c < cols;
  }));
  wallSet.delete(clampedStart);
  wallSet.delete(clampedGoal);

  const terrain: Record<string, number> = {};
  for (const [id, value] of Object.entries(problem.terrain ?? {})) {
    const [r, c] = parseMazeCellId(id);
    if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 1) continue;
    terrain[id] = Math.min(20, Math.max(2, Math.round(n)));
  }

  const manualHeuristicValues: Record<string, number> = {};
  for (const [id, value] of Object.entries(problem.manualHeuristicValues ?? {})) {
    const [r, c] = parseMazeCellId(id);
    if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    manualHeuristicValues[id] = n;
  }

  return {
    ...problem,
    rows,
    cols,
    walls: Array.from(wallSet),
    startNode: clampedStart,
    goalNode: clampedGoal,
    terrain,
    heuristic: normalizeHeuristicConfig(problem.heuristic),
    manualHeuristicValues,
  };
}

export function applyMazeStrategy(
  problem: MazeProblem,
  strategyId: MazeGenerationStrategyId,
  seed = problem.seed,
): MazeProblem {
  const strategy = MAZE_STRATEGIES[strategyId];
  const normalized = normalizeMazeProblem({ ...problem, seed });
  const generated = strategy({
    rows: normalized.rows,
    cols: normalized.cols,
    seed,
    startNode: normalized.startNode,
    goalNode: normalized.goalNode,
  });

  return normalizeMazeProblem({
    ...normalized,
    seed,
    strategy: strategyId,
    walls: generated.walls,
    terrain: generated.terrain,
  });
}

export function mazeProblemToGraphData(problem: MazeProblem): GraphData {
  const normalized = normalizeMazeProblem(problem);
  const walls = new Set(normalized.walls);

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeSet = new Set<string>();

  for (let r = 0; r < normalized.rows; r++) {
    for (let c = 0; c < normalized.cols; c++) {
      const id = mazeCellId(r, c);
      if (walls.has(id)) continue;
      nodeSet.add(id);
      nodes.push({
        id,
        label: `${r},${c}`,
        x: c * 68,
        y: r * 68,
        heuristic: normalized.manualHeuristicValues?.[id],
      });
    }
  }

  for (let r = 0; r < normalized.rows; r++) {
    for (let c = 0; c < normalized.cols; c++) {
      const id = mazeCellId(r, c);
      if (!nodeSet.has(id)) continue;

      const neighbors: Array<[number, number]> = [
        [r + 1, c],
        [r, c + 1],
      ];

      for (const [nr, nc] of neighbors) {
        if (nr < 0 || nr >= normalized.rows || nc < 0 || nc >= normalized.cols) continue;
        const nid = mazeCellId(nr, nc);
        if (!nodeSet.has(nid)) continue;

        const fromCost = normalized.terrain[id] ?? 1;
        const toCost = normalized.terrain[nid] ?? 1;
        const weight = Math.max(1, Math.round((fromCost + toCost) / 2));
        edges.push({
          id: `e-${id}-${nid}`,
          source: id,
          target: nid,
          weight,
        });
      }
    }
  }

  return {
    directed: false,
    nodes,
    edges,
  };
}

export function mazeProblemToGraphProblem(problem: MazeProblem): GraphProblem {
  const normalized = normalizeMazeProblem(problem);
  return {
    graph: mazeProblemToGraphData(normalized),
    startNode: normalized.startNode,
    goalNode: normalized.goalNode,
    useHeuristic: true,
    heuristic: normalized.heuristic,
  };
}

function encodeBase64(text: string): string {
  if (typeof btoa !== 'undefined') {
    return btoa(unescape(encodeURIComponent(text)));
  }
  return Buffer.from(text, 'utf8').toString('base64');
}

function decodeBase64(text: string): string {
  if (typeof atob !== 'undefined') {
    return decodeURIComponent(escape(atob(text)));
  }
  return Buffer.from(text, 'base64').toString('utf8');
}

export function serializeMazeReplay(problem: MazeProblem): string {
  const normalized = normalizeMazeProblem(problem);
  return encodeBase64(JSON.stringify(normalized));
}

export function deserializeMazeReplay(token: string): MazeProblem | null {
  try {
    const decoded = decodeBase64(token);
    const parsed = JSON.parse(decoded) as MazeProblem;
    if (!parsed || parsed.kind !== 'maze') return null;
    return normalizeMazeProblem(parsed);
  } catch {
    return null;
  }
}
