import type { ReactNode } from 'react';
import ProblemConfigurator, { ConfigSection } from '@/components/module/ProblemConfigurator';
import type { TabDefinition } from '@/components/module/AlgorithmPage';
import SVGAutoCanvas from '@/components/visualization/SVGAutoCanvas';
import MazeEditor from '@/components/visualization/MazeEditor';
import EmptyState from '@/components/shared/EmptyState';
import InfoCard from '@/components/shared/InfoCard';
import HeuristicConfigSection from '@/components/shared/HeuristicConfigSection';
import Select from '@/components/shared/Select';
import { TitleBarActionButton, TitleBarActionGroup } from '@/components/shared/TitleBarAction';
import { Copy, Dice5, Wand2, Eraser, Mountain } from '@/components/shared/Icons';
import { registry } from '@/algorithms/core/registry';
import { INFORMED_HEURISTICS, getHeuristicDefinition } from '@/algorithms/search/informed/types';
import { MAZE_STRATEGY_LABELS, type MazeGenerationStrategyId } from '@/problems/maze/strategies';
import { algorithmStepToMazeOverlay } from '@/visualizations/adapters/maze.adapter';
import { buildSearchTreeElements } from '@/visualizations/adapters/search-tree.adapter';
import { evaluationFormula } from '@/lib/evaluationFormula';
import type { AlgorithmStep } from '@/types/step';
import type { GraphProblem, HeuristicId, MazeProblem } from '@/types/problem';

/**
 * Context the Maze playground page threads into the module's render functions.
 * The page owns all stateful concerns (the maze store, local config state, and
 * effects); the module stays a set of pure render functions, exactly like the
 * game-playing / planning / csp / local-search families.
 */
export interface MazeLabContext {
  algorithmId: string;
  /** Live maze problem (from the maze store). */
  problem: MazeProblem;
  /** Debounced maze-as-graph problem used for the search tree + heuristic table. */
  graphProblem: GraphProblem;
  step: AlgorithmStep | null;
  setProblem: (problem: MazeProblem) => void;
  setSeed: (seed: number) => void;
  generateMaze: () => void;
  strategy: MazeGenerationStrategyId;
  setStrategy: (strategy: MazeGenerationStrategyId) => void;
  setDimensions: (rows: number, cols: number) => void;
  depthLimit: number;
  setDepthLimit: (value: number) => void;
  weightedAStarWeight: number;
  setWeightedAStarWeight: (value: number) => void;
  clearWalls: () => void;
  clearTerrain: () => void;
  /** Bump the execution problem key so the trace reloads. `reason` is a short tag. */
  markProblemChanged: (reason: string) => void;
  copyReplayLink: () => void;
  copyStatus: 'idle' | 'copied' | 'error';
}

export interface MazeLabModule {
  id: string;
  name: string;
  defaultAlgorithmId: string;
  normalizeImportedProblem: (problem: unknown) => MazeProblem | null;
  renderConfigPanel: (context: MazeLabContext) => ReactNode;
  renderTabs: (context: MazeLabContext) => TabDefinition[];
  renderTitleActions: (context: MazeLabContext) => ReactNode;
}

function isMazeProblem(value: unknown): value is MazeProblem {
  if (!value || typeof value !== 'object') return false;
  return (value as MazeProblem).kind === 'maze';
}

function buildMazeTreeElements(graphProblem: GraphProblem, step: AlgorithmStep | null) {
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
}

function renderMazeTabs(context: MazeLabContext): TabDefinition[] {
  const overlay = algorithmStepToMazeOverlay(context.step);
  const treeElements = buildMazeTreeElements(context.graphProblem, context.step);

  return [
    {
      id: 'maze-board',
      label: 'Problem View',
      content: <MazeEditor overlay={overlay} className="h-full" />,
    },
    {
      id: 'tree',
      label: 'Search Tree',
      content: treeElements.length > 0
        ? <div className="h-full overflow-hidden"><SVGAutoCanvas elements={treeElements} /></div>
        : (
          <EmptyState
            title="No search tree yet"
            description="Edit the maze and step through the run to build the tree."
            className="bg-[var(--bg)]"
          />
        ),
    },
  ];
}

function renderMazeTitleActions(context: MazeLabContext): ReactNode {
  return (
    <TitleBarActionGroup>
      <TitleBarActionButton
        onClick={() => {
          context.setSeed(Date.now());
          context.generateMaze();
          context.markProblemChanged('random');
        }}
        icon={<Dice5 size={12} />}
        label="Randomize"
        title="Generate a new maze seed"
      />
      <TitleBarActionButton
        onClick={context.copyReplayLink}
        icon={<Copy size={12} />}
        label={context.copyStatus === 'copied' ? 'Copied' : context.copyStatus === 'error' ? 'Copy Failed' : 'Copy Replay'}
        title="Copy replay link"
      />
    </TitleBarActionGroup>
  );
}

function renderMazeConfigPanel(context: MazeLabContext): ReactNode {
  const { algorithmId, problem, graphProblem, depthLimit, weightedAStarWeight } = context;

  const heuristicId = (problem.heuristic?.id ?? 'manhattan-distance') as HeuristicId;
  const heuristicScale = Number(problem.heuristic?.params?.scale ?? 1);
  const heuristicDefinition = getHeuristicDefinition(heuristicId);
  const runner = registry.get(algorithmId)?.runner ?? null;
  const runnerTags = new Set(runner?.meta.tags ?? []);
  const isInformedAlgorithm = runner?.meta.category === 'informed-search';
  const supportsInflationWeight = runnerTags.has('inflation-weight');

  return (
    <ProblemConfigurator title="Maze Config">
      {isInformedAlgorithm && (
        <ConfigSection title="Heuristic Settings">
          <HeuristicConfigSection
            heuristicId={heuristicId}
            onHeuristicIdChange={(nextId) => {
              const params = (nextId !== 'manual-node' && nextId !== 'zero' && heuristicScale !== 1)
                ? { scale: heuristicScale }
                : undefined;
              context.setProblem({
                ...problem,
                heuristic: { id: nextId as HeuristicId, params },
              });
            }}
            heuristicOptions={INFORMED_HEURISTICS.map(h => ({ value: h.id, label: h.label }))}
            description={heuristicDefinition.description}
            heuristicScale={heuristicScale}
            onHeuristicScaleChange={(nextScale) => {
              context.setProblem({
                ...problem,
                heuristic: {
                  id: heuristicId,
                  params: nextScale === 1 ? undefined : { scale: nextScale },
                },
              });
            }}
            beforeSelect={supportsInflationWeight ? (
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Inflation Weight (w)</p>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={0.5}
                  value={weightedAStarWeight}
                  onChange={(e) => context.setWeightedAStarWeight(Math.max(1, Number(e.target.value) || 1))}
                  className="ui-input w-full px-2 py-1.5 font-mono"
                />
                <p className="mt-1 text-[9px] text-[var(--text-3)]">w=1 -&gt; optimal (A*). Higher = faster but suboptimal.</p>
              </div>
            ) : null}
            afterSelect={heuristicId === 'manual-node' ? (
              <div className="space-y-2">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Per-Cell h(n) Table</p>
                <div className="overflow-hidden rounded border border-[var(--border)]">
                  <div className="grid grid-cols-[1fr_80px] bg-[var(--surface-2)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                    <span>Cell</span>
                    <span className="text-right">h(n)</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-[var(--border)] bg-[var(--surface)]">
                    {[...graphProblem.graph.nodes]
                      .sort((a, b) => (a.label ?? a.id).localeCompare(b.label ?? b.id))
                      .map((node) => (
                        <div key={node.id} className="grid grid-cols-[1fr_80px] items-center gap-2 px-2 py-1">
                          <span className="truncate font-mono text-[11px] text-[var(--text-2)]" title={node.id}>
                            {node.label ?? node.id}
                          </span>
                          <input
                            type="number"
                            step={0.1}
                            value={problem.manualHeuristicValues?.[node.id] ?? ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const nextManual = { ...(problem.manualHeuristicValues ?? {}) };
                              if (raw.trim() === '') {
                                delete nextManual[node.id];
                              } else {
                                const parsed = Number(raw);
                                if (!Number.isFinite(parsed)) return;
                                nextManual[node.id] = parsed;
                              }
                              context.setProblem({
                                ...problem,
                                manualHeuristicValues: nextManual,
                                heuristic: { id: 'manual-node' },
                              });
                            }}
                            className="ui-input w-full px-1.5 py-0.5 text-right font-mono"
                          />
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ) : null}
            footer={(
              <InfoCard title="Cost Model">
                <div className="space-y-1 text-[11px]">
                  <p className="leading-tight text-[var(--text-2)]"><span className="font-mono text-[var(--text)]">g(n)</span> Path cost from start</p>
                  <p className="leading-tight text-[var(--text-2)]"><span className="font-mono text-[var(--text)]">h(n)</span> Estimate to goal</p>
                  <p className="mt-2 rounded border border-[var(--border)]/50 bg-[var(--surface)]/40 py-1 text-center font-mono text-[var(--text)]">{evaluationFormula(algorithmId)}</p>
                </div>
              </InfoCard>
            )}
          />
        </ConfigSection>
      )}

      {algorithmId === 'dls' && (
        <ConfigSection title="Depth Settings">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Depth Limit</p>
          <input
            type="number"
            min={1}
            max={200}
            value={depthLimit}
            onChange={(e) => context.setDepthLimit(Math.max(1, Number(e.target.value) || 1))}
            className="ui-input w-full px-2 py-1.5 font-mono"
          />
        </ConfigSection>
      )}

      <ConfigSection title="Maze Settings">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Dimensions</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-1">
                <span className="text-[var(--text-2)]">R</span>
                <input
                  type="number"
                  min={4}
                  max={80}
                  value={problem.rows}
                  onChange={(e) => {
                    context.setDimensions(Number(e.target.value) || problem.rows, problem.cols);
                    context.markProblemChanged('dimensions');
                  }}
                  className="ui-input w-full px-2 py-1 font-mono"
                />
              </label>
              <label className="flex items-center gap-1">
                <span className="text-[var(--text-2)]">C</span>
                <input
                  type="number"
                  min={4}
                  max={80}
                  value={problem.cols}
                  onChange={(e) => {
                    context.setDimensions(problem.rows, Number(e.target.value) || problem.cols);
                    context.markProblemChanged('dimensions');
                  }}
                  className="ui-input w-full px-2 py-1 font-mono"
                />
              </label>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider mb-1.5">Generation Strategy</p>
            <Select
              value={context.strategy}
              onValueChange={(val) => context.setStrategy(val as MazeGenerationStrategyId)}
              options={Object.entries(MAZE_STRATEGY_LABELS).map(([id, label]) => ({ value: id, label }))}
              triggerClassName="w-full"
            />
            <button
              onClick={() => {
                context.setSeed(Date.now());
                context.generateMaze();
                context.markProblemChanged('generate');
              }}
              className="ui-btn ui-btn-active mt-2 w-full justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-mono"
            >
              <Wand2 size={12} />
              Generate Maze
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                context.clearWalls();
                context.markProblemChanged('clear-walls');
              }}
              className="ui-btn justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-mono"
            >
              <Eraser size={12} />
              Clear Walls
            </button>
            <button
              onClick={() => {
                context.clearTerrain();
                context.markProblemChanged('clear-terrain');
              }}
              className="ui-btn justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-mono"
            >
              <Mountain size={12} />
              Reset Terrain
            </button>
          </div>
        </div>
      </ConfigSection>
    </ProblemConfigurator>
  );
}

export const MAZE_LAB_MODULE: MazeLabModule = {
  id: 'maze',
  name: 'Maze',
  defaultAlgorithmId: 'bfs',
  normalizeImportedProblem: (problem) => (isMazeProblem(problem) ? problem : null),
  renderConfigPanel: renderMazeConfigPanel,
  renderTabs: renderMazeTabs,
  renderTitleActions: renderMazeTitleActions,
};
