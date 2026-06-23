import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import AlgorithmPage from '@/components/module/AlgorithmPage';
import PresetPickerDialog from '@/components/shared/PresetPickerDialog';
import { registry } from '@/algorithms/core/registry';
import { useMazeStore } from '@/store/maze.store';
import { useCurrentStep } from '@/store/execution.store';
import { mazeToGraphProblem } from '@/visualizations/adapters/maze.adapter';
import { deserializeMazeReplay, serializeMazeReplay } from '@/problems/maze/maze';
import { MAZE_DEMOS, buildMazeDemo } from '@/problems/maze/demos';
import { MAZE_LAB_MODULE, type MazeLabContext } from '@/problems/maze/lab-modules';
import { toAbsoluteAppUrl } from '@/lib/app-paths';
import { createExecutionProblemKey } from '@/lib/execution-problem-key';

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
  const runner = useMemo(() => registry.get(algo)?.runner ?? null, [algo]);
  const category = runner?.meta.category ?? 'uninformed-search';

  // Hydrate a shared maze from a ?m= replay token.
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

  // Debounce edits so dragging the brush doesn't reload the engine every frame.
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

  const step = useCurrentStep(algo);

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

  const markProblemChanged = useCallback((reason: string) => {
    setProblemKey(createMazeProblemKey(`maze:${reason}`));
  }, []);

  const handleImport = useCallback((imported: unknown) => {
    const normalized = MAZE_LAB_MODULE.normalizeImportedProblem(imported);
    if (normalized) {
      setMazeProblem(normalized);
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

  const mazeContext: MazeLabContext = {
    algorithmId: algo,
    problem: mazeProblem,
    graphProblem,
    step,
    setProblem: setMazeProblem,
    setSeed,
    generateMaze,
    strategy,
    setStrategy,
    setDimensions,
    depthLimit,
    setDepthLimit,
    weightedAStarWeight,
    setWeightedAStarWeight,
    markProblemChanged,
    copyReplayLink,
    copyStatus,
  };

  return (
    <>
      <AlgorithmPage
        algorithmId={algo}
        problem={graphProblem}
        problemForActions={mazeProblem}
        category={category}
        problemCategory="maze"
        onProblemImport={handleImport}
        tabs={MAZE_LAB_MODULE.renderTabs(mazeContext)}
        titleActions={MAZE_LAB_MODULE.renderTitleActions(mazeContext)}
        configPanel={MAZE_LAB_MODULE.renderConfigPanel(mazeContext)}
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
