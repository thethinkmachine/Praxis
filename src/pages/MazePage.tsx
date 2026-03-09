import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import AlgorithmPage from '@/components/module/AlgorithmPage';
import ProblemConfigurator from '@/components/module/ProblemConfigurator';
import type { TabDefinition } from '@/components/module/AlgorithmPage';
import SVGAutoCanvas from '@/components/visualization/SVGAutoCanvas';
import MazeEditor from '@/components/visualization/MazeEditor';
import { registry } from '@/algorithms/core/registry';
import { INFORMED_HEURISTICS, getHeuristicDefinition } from '@/algorithms/search/informed/types';
import { useMazeStore } from '@/store/maze.store';
import { useExecutionStore } from '@/store/execution.store';
import type { HeuristicId, MazeProblem } from '@/types/problem';
import { algorithmStepToMazeOverlay, mazeToGraphProblem } from '@/visualizations/adapters/maze.adapter';
import { buildSearchTreeElements } from '@/visualizations/adapters/search-tree.adapter';
import { deserializeMazeReplay, serializeMazeReplay } from '@/problems/maze/maze';
import { MAZE_STRATEGY_LABELS } from '@/problems/maze/strategies';
import { MAZE_DEMOS, buildMazeDemo } from '@/problems/maze/demos';

const MAZE_ALGORITHMS = [
  'bfs',
  'dfs',
  'dls',
  'iddfs',
  'ucs',
  'bidirectional-bfs',
  'bidirectional-ucs',
  'greedy-bfs',
  'astar',
  'rbfs',
  'sma-star',
  'bidirectional-astar',
  'weighted-astar',
  'ida-star',
] as const;
const MAZE_UNINFORMED_ALGOS = new Set(['bfs', 'dfs', 'dls', 'iddfs', 'ucs', 'bidirectional-bfs', 'bidirectional-ucs']);

function evaluationFormula(algo: string): string {
  if (algo === 'greedy-bfs') return 'f(n) = h(n)';
  if (algo === 'weighted-astar') return 'f(n) = g(n) + w * h(n)';
  if (algo === 'bidirectional-astar') return 'f_f(n) = g_f(n) + h_f(n),   f_b(n) = g_b(n) + h_b(n)';
  if (algo === 'rbfs' || algo === 'sma-star') return 'f(n) = g(n) + h(n) with memory-bounded best-first control';
  if (algo === 'astar' || algo === 'ida-star') return 'f(n) = g(n) + h(n)';
  return 'Heuristic scoring is not used by this algorithm.';
}

function isMazeProblem(value: unknown): value is MazeProblem {
  if (!value || typeof value !== 'object') return false;
  return (value as MazeProblem).kind === 'maze';
}

export default function MazePage() {
  const { algo = 'bfs' } = useParams<{ algo?: string }>();
  const [searchParams] = useSearchParams();

  const mazeProblem = useMazeStore(s => s.problem);
  const setMazeProblem = useMazeStore(s => s.setProblem);
  const setSeed = useMazeStore(s => s.setSeed);
  const generateMaze = useMazeStore(s => s.generateMaze);
  const strategy = useMazeStore(s => s.strategy);
  const setStrategy = useMazeStore(s => s.setStrategy);
  const setDimensions = useMazeStore(s => s.setDimensions);

  const [depthLimit, setDepthLimit] = useState(12);
  const [weightedAStarWeight, setWeightedAStarWeight] = useState(1.5);
  const [copied, setCopied] = useState(false);
  const importedReplayRef = useRef<string | null>(null);
  const heuristicId = (mazeProblem.heuristic?.id ?? 'manhattan-distance') as HeuristicId;
  const heuristicScale = Number(mazeProblem.heuristic?.params?.scale ?? 1);
  const heuristicDefinition = useMemo(() => getHeuristicDefinition(heuristicId), [heuristicId]);
  const isInformedAlgorithm = !MAZE_UNINFORMED_ALGOS.has(algo);

  useEffect(() => {
    const replay = searchParams.get('m');
    if (!replay) return;
    if (importedReplayRef.current === replay) return;
    importedReplayRef.current = replay;
    const decoded = deserializeMazeReplay(replay);
    if (decoded) {
      setMazeProblem(decoded);
    }
  }, [searchParams, setMazeProblem]);

  const [debouncedProblem, setDebouncedProblem] = useState(mazeProblem);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedProblem(mazeProblem), 220);
    return () => clearTimeout(timer);
  }, [mazeProblem]);

  const graphProblem = useMemo(() => {
    const base = mazeToGraphProblem(debouncedProblem);
    if (algo === 'dls') {
      return { ...base, depthLimit };
    }
    if (algo === 'weighted-astar') {
      return { ...base, weight: weightedAStarWeight };
    }
    return base;
  }, [debouncedProblem, algo, depthLimit, weightedAStarWeight]);

  const runner = useMemo(() => registry.get(algo)?.runner ?? null, [algo]);
  const step = useExecutionStore(s => s.currentStep);

  const treeElements = useMemo(() => {
    if (!step) return [];

    const st = step.state as Record<string, unknown>;
    const pathMap = st.pathMap instanceof Map
      ? st.pathMap as Map<string, string | null>
      : new Map<string, string | null>();

    const foundPath = Array.isArray(st.foundPath) ? st.foundPath as string[] : null;
    const gCosts = (st.gCosts instanceof Map ? st.gCosts : st.costs instanceof Map ? st.costs : undefined) as Map<string, number> | undefined;
    const hCosts = (st.hCosts instanceof Map ? st.hCosts : undefined) as Map<string, number> | undefined;
    const fCosts = (st.fCosts instanceof Map ? st.fCosts : undefined) as Map<string, number> | undefined;

    const highlight = step.highlight as {
      frontierNodes?: Set<string>;
      exploredNodes?: Set<string>;
      currentNode?: string | null;
      pathEdges?: string[] | null;
    };

    const labelMap = new Map(
      graphProblem.graph.nodes.map(n => [n.id, n.label ?? n.id]),
    );

    return buildSearchTreeElements(pathMap, highlight, foundPath, {
      startNode: graphProblem.startNode,
      goalNode: graphProblem.goalNode,
      labelMap,
      gCosts,
      hCosts,
      fCosts,
    });
  }, [graphProblem, step]);

  const overlay = useMemo(() => algorithmStepToMazeOverlay(step), [step]);

  const tabs: TabDefinition[] = useMemo(() => [
    {
      id: 'maze-board',
      label: 'Maze Board',
      content: <MazeEditor overlay={overlay} className="h-full" />,
    },
    {
      id: 'tree',
      label: 'Search Tree',
      content: treeElements.length > 0
        ? <div className="h-full overflow-hidden"><SVGAutoCanvas elements={treeElements} /></div>
        : (
          <div className="h-full flex items-center justify-center bg-[var(--bg)]">
            <div className="text-center space-y-1.5">
              <p className="text-sm text-[var(--text-3)]">No search tree yet</p>
              <p className="text-xs text-[var(--text-3)]">Edit the maze and step through to build the tree</p>
            </div>
          </div>
        ),
    },
  ], [overlay, treeElements]);

  const copyReplayLink = useCallback(async () => {
    const token = serializeMazeReplay(mazeProblem);
    const url = `${window.location.origin}/maze/${algo}?m=${encodeURIComponent(token)}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [algo, mazeProblem]);

  const titleActions = useMemo(() => (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          setSeed(Date.now());
          generateMaze();
        }}
        className="text-xs px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--accent)]/60"
      >
        New Seed
      </button>
      <button
        onClick={copyReplayLink}
        className="text-xs px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--accent)]/60"
      >
        {copied ? 'Copied' : 'Copy Replay Link'}
      </button>
    </div>
  ), [copied, copyReplayLink, generateMaze, setSeed]);

  const configPanel = useMemo(() => (
    <ProblemConfigurator title="Maze Config">
      <div className="space-y-3 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">Algorithm</p>
          <div className="grid grid-cols-2 gap-1.5">
            {MAZE_ALGORITHMS.map((id) => (
              <Link
                key={id}
                to={`/maze/${id}`}
                className={`px-2 py-1 rounded border font-mono text-[11px] ${id === algo
                  ? 'border-[var(--accent)]/60 text-[var(--accent)] bg-[var(--accent-soft)]'
                  : 'border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)]'}`}
              >
                {id}
              </Link>
            ))}
          </div>
        </div>

        {algo === 'dls' && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">Depth Limit</p>
            <input
              type="number"
              min={1}
              max={200}
              value={depthLimit}
              onChange={(e) => setDepthLimit(Math.max(1, Number(e.target.value) || 1))}
              className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono"
            />
          </div>
        )}

        {algo === 'weighted-astar' && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">Inflation Weight (w)</p>
            <input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={weightedAStarWeight}
              onChange={(e) => setWeightedAStarWeight(Math.max(1, Number(e.target.value) || 1))}
              className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono"
            />
            <p className="text-[9px] text-[var(--text-3)] mt-1">w=1 → optimal (A*). Higher = faster but suboptimal.</p>
          </div>
        )}

        {isInformedAlgorithm && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">Heuristic Function</p>
            <select
              value={heuristicId}
              onChange={(e) => {
                const nextId = e.target.value as HeuristicId;
                const params = (nextId !== 'manual-node' && nextId !== 'zero' && heuristicScale !== 1)
                  ? { scale: heuristicScale }
                  : undefined;
                setMazeProblem({
                  ...mazeProblem,
                  heuristic: { id: nextId, params },
                });
              }}
              className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono"
            >
              {INFORMED_HEURISTICS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <p className="text-[9px] text-[var(--text-3)] mt-1">{heuristicDefinition.description}</p>
          </div>
        )}

        {isInformedAlgorithm && (
          <div className="rounded border border-[var(--border)] p-2 bg-[var(--surface-2)]/30 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)]">How The Costs Work</p>
            <p className="text-[11px] text-[var(--text-2)]"><span className="font-mono text-[var(--text)]">g(n)</span>: true cost from start to <span className="font-mono">n</span> across maze terrain.</p>
            <p className="text-[11px] text-[var(--text-2)]"><span className="font-mono text-[var(--text)]">h(n)</span>: estimated remaining cost from <span className="font-mono">n</span> to goal.</p>
            <p className="text-[11px] text-[var(--text-2)]"><span className="font-mono text-[var(--text)]">f(n)</span>: priority score that picks the next node to expand.</p>
            <p className="text-[11px] text-[var(--text)] font-mono border-t border-[var(--border)] pt-1">{evaluationFormula(algo)}</p>
          </div>
        )}

        {isInformedAlgorithm && heuristicId !== 'manual-node' && heuristicId !== 'zero' && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">Heuristic Scale</p>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={heuristicScale}
              onChange={(e) => {
                const nextScale = Math.max(0.1, Number(e.target.value) || 0.1);
                setMazeProblem({
                  ...mazeProblem,
                  heuristic: {
                    id: heuristicId,
                    params: nextScale === 1 ? undefined : { scale: nextScale },
                  },
                });
              }}
              className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono"
            />
          </div>
        )}

        {isInformedAlgorithm && heuristicId === 'manual-node' && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">Per-Cell h(n) Table</p>
            <div className="rounded border border-[var(--border)] overflow-hidden">
              <div className="grid grid-cols-[1fr_100px] text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)] bg-[var(--surface-2)] px-2 py-1">
                <span>Cell</span>
                <span className="text-right">h(n)</span>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-[var(--border)] bg-[var(--surface)]">
                {[...graphProblem.graph.nodes]
                  .sort((a, b) => (a.label ?? a.id).localeCompare(b.label ?? b.id))
                  .map((node) => (
                    <div key={node.id} className="grid grid-cols-[1fr_100px] items-center px-2 py-1 gap-2">
                      <span className="truncate text-[11px] text-[var(--text-2)] font-mono" title={node.id}>
                        {node.label ?? node.id}
                      </span>
                      <input
                        type="number"
                        step={0.1}
                        value={mazeProblem.manualHeuristicValues?.[node.id] ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const nextManual = { ...(mazeProblem.manualHeuristicValues ?? {}) };
                          if (raw.trim() === '') {
                            delete nextManual[node.id];
                          } else {
                            const parsed = Number(raw);
                            if (!Number.isFinite(parsed)) return;
                            nextManual[node.id] = parsed;
                          }
                          setMazeProblem({
                            ...mazeProblem,
                            manualHeuristicValues: nextManual,
                          });
                        }}
                        className="w-full px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-right font-mono"
                      />
                    </div>
                  ))}
              </div>
            </div>
            <p className="text-[10px] text-[var(--text-3)] mt-1">Leave a value blank to use h(n)=0 for that cell in manual mode.</p>
          </div>
        )}

        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">Dimensions</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-1">
              <span className="text-[var(--text-2)]">Rows</span>
              <input
                type="number"
                min={4}
                max={80}
                value={mazeProblem.rows}
                onChange={(e) => setDimensions(Number(e.target.value) || mazeProblem.rows, mazeProblem.cols)}
                className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono"
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-[var(--text-2)]">Cols</span>
              <input
                type="number"
                min={4}
                max={80}
                value={mazeProblem.cols}
                onChange={(e) => setDimensions(mazeProblem.rows, Number(e.target.value) || mazeProblem.cols)}
                className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono"
              />
            </label>
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">Demos</p>
          <div className="space-y-1.5">
            {MAZE_DEMOS.map((demo) => (
              <button
                key={demo.id}
                onClick={() => {
                  setStrategy(demo.strategy);
                  setMazeProblem(buildMazeDemo(demo));
                }}
                className="w-full text-left px-2 py-1.5 rounded border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] text-[11px] font-mono"
              >
                {demo.name}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded border border-[var(--border)] p-2 bg-[var(--surface-2)]/30">
          <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider mb-1">Generation Strategy</p>
          <p className="text-[12px] text-[var(--text-2)]">{MAZE_STRATEGY_LABELS[strategy]}</p>
        </div>
      </div>
    </ProblemConfigurator>
  ), [algo, depthLimit, weightedAStarWeight, isInformedAlgorithm, heuristicId, heuristicScale, heuristicDefinition.description, mazeProblem, setDimensions, setMazeProblem, setStrategy, strategy]);

  const handleImport = useCallback((imported: unknown) => {
    if (isMazeProblem(imported)) {
      setMazeProblem(imported);
    }
  }, [setMazeProblem]);

  return (
    <AlgorithmPage
      algorithmId={algo}
      problem={graphProblem}
      problemForActions={mazeProblem}
      category={runner?.meta.category ?? 'uninformed-search'}
      problemCategory="maze"
      onProblemImport={handleImport}
      tabs={tabs}
      titleActions={titleActions}
      configPanel={configPanel}
    />
  );
}
