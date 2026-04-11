import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import AlgorithmPage from '@/components/module/AlgorithmPage';
import ProblemConfigurator, { ConfigSection } from '@/components/module/ProblemConfigurator';
import PresetPickerDialog from '@/components/shared/PresetPickerDialog';
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
import { Copy, Dice5 } from '@/components/shared/Icons';
import { TitleBarActionButton, TitleBarActionGroup } from '@/components/shared/TitleBarAction';
import EmptyState from '@/components/shared/EmptyState';
import InfoCard from '@/components/shared/InfoCard';
import HeuristicConfigSection from '@/components/shared/HeuristicConfigSection';
import { evaluationFormula } from '@/lib/evaluationFormula';
import { toAbsoluteAppUrl } from '@/lib/app-paths';
import { createExecutionProblemKey } from '@/lib/execution-problem-key';

function isMazeProblem(value: unknown): value is MazeProblem {
  if (!value || typeof value !== 'object') return false;
  return (value as MazeProblem).kind === 'maze';
}

function createMazeProblemKey(prefix: string): string {
  return `${prefix}:${Date.now()}`;
}

export default function MazePage() {
  const { algo = 'bfs' } = useParams<{ algo?: string }>();
  const [searchParams] = useSearchParams();
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const [problemKey, setProblemKey] = useState('maze:default');

  const mazeProblem = useMazeStore(s => s.problem);
  const setMazeProblem = useMazeStore(s => s.setProblem);
  const setSeed = useMazeStore(s => s.setSeed);
  const generateMaze = useMazeStore(s => s.generateMaze);
  const strategy = useMazeStore(s => s.strategy);
  const setStrategy = useMazeStore(s => s.setStrategy);
  const setDimensions = useMazeStore(s => s.setDimensions);

  const [depthLimit, setDepthLimit] = useState(12);
  const [weightedAStarWeight, setWeightedAStarWeight] = useState(1.5);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const importedReplayRef = useRef<string | null>(null);
  const heuristicId = (mazeProblem.heuristic?.id ?? 'manhattan-distance') as HeuristicId;
  const heuristicScale = Number(mazeProblem.heuristic?.params?.scale ?? 1);
  const heuristicDefinition = useMemo(() => getHeuristicDefinition(heuristicId), [heuristicId]);
  const runner = useMemo(() => registry.get(algo)?.runner ?? null, [algo]);
  const runnerTags = useMemo(() => new Set(runner?.meta.tags ?? []), [runner]);
  const isInformedAlgorithm = runner?.meta.category === 'informed-search';
  const supportsInflationWeight = runnerTags.has('inflation-weight');

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
  ], [overlay, treeElements]);

  const copyReplayLink = useCallback(async () => {
    const token = serializeMazeReplay(mazeProblem);
    try {
      const url = toAbsoluteAppUrl(`maze/${algo}?m=${encodeURIComponent(token)}`);
      await navigator.clipboard.writeText(url);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
    window.setTimeout(() => setCopyStatus('idle'), 1200);
  }, [algo, mazeProblem]);

  const titleActions = useMemo(() => (
    <TitleBarActionGroup>
      <TitleBarActionButton
        onClick={() => {
          setSeed(Date.now());
          generateMaze();
          setProblemKey(createMazeProblemKey('maze:random'));
        }}
        icon={<Dice5 size={12} />}
        label="Randomize"
        title="Generate a new maze seed"
      />
      <TitleBarActionButton
        onClick={copyReplayLink}
        icon={<Copy size={12} />}
        label={copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Copy Failed' : 'Copy Replay'}
        title="Copy replay link"
      />
    </TitleBarActionGroup>
  ), [copyReplayLink, copyStatus, generateMaze, setSeed]);

  const configPanel = useMemo(() => (
    <ProblemConfigurator title="Maze Config">
      {isInformedAlgorithm && (
        <ConfigSection title="Heuristic Settings">
          <HeuristicConfigSection
            heuristicId={heuristicId}
            onHeuristicIdChange={(nextId) => {
              const params = (nextId !== 'manual-node' && nextId !== 'zero' && heuristicScale !== 1)
                ? { scale: heuristicScale }
                : undefined;
              setMazeProblem({
                ...mazeProblem,
                heuristic: { id: nextId as HeuristicId, params },
              });
            }}
            heuristicOptions={INFORMED_HEURISTICS.map(h => ({ value: h.id, label: h.label }))}
            description={heuristicDefinition.description}
            heuristicScale={heuristicScale}
            onHeuristicScaleChange={(nextScale) => {
              setMazeProblem({
                ...mazeProblem,
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
                  onChange={(e) => setWeightedAStarWeight(Math.max(1, Number(e.target.value) || 1))}
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
                  <p className="mt-2 rounded border border-[var(--border)]/50 bg-[var(--surface)]/40 py-1 text-center font-mono text-[var(--text)]">{evaluationFormula(algo)}</p>
                </div>
              </InfoCard>
            )}
          />
        </ConfigSection>
      )}

      {algo === 'dls' && (
        <ConfigSection title="Depth Settings">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Depth Limit</p>
          <input
            type="number"
            min={1}
            max={200}
            value={depthLimit}
            onChange={(e) => setDepthLimit(Math.max(1, Number(e.target.value) || 1))}
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
                  value={mazeProblem.rows}
                  onChange={(e) => {
                    setDimensions(Number(e.target.value) || mazeProblem.rows, mazeProblem.cols);
                    setProblemKey(createMazeProblemKey('maze:dimensions'));
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
                  value={mazeProblem.cols}
                  onChange={(e) => {
                    setDimensions(mazeProblem.rows, Number(e.target.value) || mazeProblem.cols);
                    setProblemKey(createMazeProblemKey('maze:dimensions'));
                  }}
                  className="ui-input w-full px-2 py-1 font-mono"
                />
              </label>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider mb-1.5">Generation Strategy</p>
            <p className="text-[12px] text-[var(--text-2)] p-2 rounded bg-[var(--surface-2)] border border-[var(--border)] font-medium">{MAZE_STRATEGY_LABELS[strategy]}</p>
          </div>
        </div>
      </ConfigSection>

      <ConfigSection title="Demos" defaultOpen={false}>
        <div className="space-y-1.5">
          {MAZE_DEMOS.map((demo) => (
            <button
              key={demo.id}
              onClick={() => {
                setStrategy(demo.strategy);
                setMazeProblem(buildMazeDemo(demo));
                setProblemKey(createMazeProblemKey(`maze:demo:${demo.id}`));
              }}
              className="ui-btn w-full justify-start rounded-md px-2 py-1.5 text-[11px] font-mono"
            >
              {demo.name}
            </button>
          ))}
        </div>
      </ConfigSection>
    </ProblemConfigurator>
  ), [algo, depthLimit, heuristicId, heuristicScale, heuristicDefinition.description, isInformedAlgorithm, mazeProblem, setDimensions, setMazeProblem, setStrategy, strategy, supportsInflationWeight, weightedAStarWeight, graphProblem.graph.nodes]);

  const handleImport = useCallback((imported: unknown) => {
    if (isMazeProblem(imported)) {
      setMazeProblem(imported);
      setProblemKey(createMazeProblemKey('maze:import'));
    }
  }, [setMazeProblem]);
  const executionProblemKey = useMemo(
    () => `${problemKey}:${createExecutionProblemKey(graphProblem)}`,
    [problemKey, graphProblem],
  );
  const executionContext = useMemo(() => ({
    pageKey: 'maze',
    labKey: 'maze',
    problemKey: searchParams.get('m')
      ? `${executionProblemKey}:replay:${searchParams.get('m')}`
      : executionProblemKey,
    preservePosition: true,
  }), [executionProblemKey, searchParams]);

  return (
    <>
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
        executionContext={executionContext}
        onDemoRequest={() => setDemoDialogOpen(true)}
      />
      <PresetPickerDialog
        open={demoDialogOpen}
        onOpenChange={setDemoDialogOpen}
        title="Choose a Maze Demo"
        subtitle="Load a ready-made maze layout into the workspace"
        items={MAZE_DEMOS.map((demo) => ({
          id: demo.id,
          name: demo.name,
          description: `${demo.rows} x ${demo.cols} maze using ${demo.strategy.replace(/-/g, ' ')} generation.`,
          tags: [demo.strategy, `seed ${demo.seed}`],
        }))}
        onSelect={(demoId) => {
          const demo = MAZE_DEMOS.find((entry) => entry.id === demoId);
          if (!demo) return;
          setStrategy(demo.strategy);
          setMazeProblem(buildMazeDemo(demo));
          setProblemKey(createMazeProblemKey(`maze:demo:${demo.id}`));
        }}
      />
    </>
  );
}
