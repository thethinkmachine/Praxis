import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import AlgorithmPage from '@/components/module/AlgorithmPage';
import ProblemConfigurator, { ConfigSection } from '@/components/module/ProblemConfigurator';
import PresetPickerDialog from '@/components/shared/PresetPickerDialog';
import Select from '@/components/shared/Select';
import { GraphColoringBoardTab, GraphColoringNeighborhoodTab } from '@/components/visualization/local-search/GraphColoringLab';
import { LandscapeBoardTab, LandscapeNeighborhoodTab } from '@/components/visualization/local-search/LandscapeLab';
import { NPuzzleBoardTab, NPuzzleNeighborhoodTab } from '@/components/visualization/local-search/NPuzzleLab';
import { NQueensBoardTab, NQueensNeighborhoodTab } from '@/components/visualization/local-search/NQueensLab';
import { ObjectiveTab, TrajectoryTab, ViewOverlay } from '@/components/visualization/local-search/LocalSearchShared';
import { TspBoardTab, TspNeighborhoodTab } from '@/components/visualization/local-search/TspLab';
import { Dice5 } from '@/components/shared/Icons';
import { TitleBarActionButton, TitleBarActionGroup } from '@/components/shared/TitleBarAction';
import type { LocalSearchStep } from '@/algorithms/local-search/types';
import { useExecutionStore } from '@/store/execution.store';
import { Graph, type GraphColoringProblem, type LandscapePreset, type LocalSearchProblem, type NPuzzleProblem, type NQueensProblem, type TspProblem } from '@/types/problem';
import {
  LOCAL_SEARCH_LABS,
  createDefaultGraphColoringProblem,
  createDefaultLandscapeProblem,
  createDefaultLocalSearchProblem,
  createDefaultNPuzzleProblem,
  createDefaultNQueensProblem,
  createDefaultTspProblem,
} from '@/problems/local-search/presets';
import { createSeededRandom, createRandomState } from '@/problems/local-search/n-queens';

function normalizeImportedProblem(problem: unknown): LocalSearchProblem {
  const incoming = problem as LocalSearchProblem;
  if (incoming.kind === 'graph-coloring') {
    return {
      ...createDefaultGraphColoringProblem(),
      ...incoming,
      graph: incoming.graph instanceof Graph ? incoming.graph : new Graph(incoming.graph),
      kind: 'graph-coloring',
    };
  }
  if (incoming.kind === 'n-queens') return { ...createDefaultNQueensProblem((incoming as NQueensProblem).size ?? 8), ...incoming, kind: 'n-queens' };
  if (incoming.kind === 'tsp') return { ...createDefaultTspProblem((incoming as TspProblem).cities?.length ?? 9), ...incoming, kind: 'tsp' };
  if (incoming.kind === 'landscape') return { ...createDefaultLandscapeProblem((incoming as { preset?: LandscapePreset }).preset ?? 'twin-peaks'), ...incoming, kind: 'landscape' };
  if (incoming.kind === 'n-puzzle') return { ...createDefaultNPuzzleProblem((incoming as NPuzzleProblem).size ?? 3), ...incoming, kind: 'n-puzzle' };
  return createDefaultLocalSearchProblem('n-queens');
}

function movePuzzleTile(problem: NPuzzleProblem, tileIndex: number): NPuzzleProblem {
  const blankIndex = problem.tiles.indexOf(0);
  const blankRow = Math.floor(blankIndex / problem.size);
  const blankCol = blankIndex % problem.size;
  const tileRow = Math.floor(tileIndex / problem.size);
  const tileCol = tileIndex % problem.size;
  const isNeighbor = Math.abs(blankRow - tileRow) + Math.abs(blankCol - tileCol) === 1;
  if (!isNeighbor) return problem;
  const next = [...problem.tiles];
  [next[blankIndex], next[tileIndex]] = [next[tileIndex], next[blankIndex]];
  return { ...problem, tiles: next };
}

interface NumberFieldConfig {
  key: keyof LocalSearchProblem;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  fallback: number;
}

const METAHEURISTIC_FIELDS: Partial<Record<string, NumberFieldConfig[]>> = {
  'hill-climbing-random-restart': [{ key: 'restartLimit', label: 'Restarts', min: 0, fallback: 8 }],
  'hill-climbing-sideways': [{ key: 'sidewaysMoveLimit', label: 'Sideways Limit', min: 0, fallback: 12 }],
  'local-beam-search': [{ key: 'beamWidth', label: 'Beam Width', min: 2, fallback: 4 }],
  'stochastic-beam-search': [{ key: 'beamWidth', label: 'Beam Width', min: 2, fallback: 4 }],
  'tabu-search': [{ key: 'tabuTenure', label: 'Tabu Tenure', min: 1, fallback: 7 }],
  'simulated-annealing': [
    { key: 'initialTemperature', label: 'Initial Temperature', min: 0.1, step: 0.1, fallback: 10 },
    { key: 'coolingRate', label: 'Cooling Rate', min: 0.5, max: 0.999, step: 0.005, fallback: 0.94 },
  ],
  'genetic-algorithm': [
    { key: 'populationSize', label: 'Population Size', min: 4, fallback: 16 },
    { key: 'mutationRate', label: 'Mutation Rate', min: 0, max: 1, step: 0.01, fallback: 0.18 },
    { key: 'crossoverRate', label: 'Crossover Rate', min: 0, max: 1, step: 0.01, fallback: 0.85 },
  ],
};

export default function LocalSearchPage() {
  const { algo = 'hill-climbing-steepest' } = useParams<{ algo: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const labParam = (searchParams.get('lab') as LocalSearchProblem['kind'] | null) ?? 'n-queens';
  const [problem, setProblem] = useState<LocalSearchProblem>(() => createDefaultLocalSearchProblem(labParam));
  const step = useExecutionStore(state => state.currentStep as LocalSearchStep | null);
  const currentIndex = useExecutionStore(state => state.currentIndex);
  const resetExecution = useExecutionStore(state => state.reset);

  const handleResetForSetup = () => {
    resetExecution();
    setProblem(prev => ({ ...prev }));
  };

  useEffect(() => {
    if (problem.kind !== labParam) {
      setProblem(createDefaultLocalSearchProblem(labParam));
    }
  }, [labParam, problem.kind]);

  const setLab = (kind: LocalSearchProblem['kind']) => {
    setProblem(createDefaultLocalSearchProblem(kind));
    setSearchParams({ lab: kind });
  };

  const updateProblem = (patch: Record<string, unknown>) => {
    if (currentIndex > 0) return; // Prevent edits during active traces
    setProblem(prev => ({ ...prev, ...patch } as LocalSearchProblem));
  };

  const randomizeCurrent = () => {
    setProblem(prev => {
      const nextSeed = (prev.randomSeed ?? 1337) + 17;
      
      const retainSettings = <T extends LocalSearchProblem>(base: T): T => {
        const result: any = { ...base };
        const keys = [
          'maxSteps', 'candidateSampleSize', 'restartLimit', 'sidewaysMoveLimit',
          'beamWidth', 'tabuTenure', 'initialTemperature', 'coolingRate',
          'populationSize', 'mutationRate', 'crossoverRate'
        ] as const;
        for (const key of keys) {
          if ((prev as any)[key] !== undefined) {
            result[key] = (prev as any)[key];
          }
        }
        result.randomSeed = nextSeed;
        return result as T;
      };

      switch (prev.kind) {
        case 'n-queens': {
          const random = createSeededRandom(nextSeed);
          return retainSettings({ ...prev, initialState: createRandomState(prev.size, random) });
        }
        case 'tsp':
          return retainSettings({ ...createDefaultTspProblem(prev.cities.length), neighborhoodMode: prev.neighborhoodMode });
        case 'graph-coloring':
          return retainSettings({ ...createDefaultGraphColoringProblem(prev.graph.nodes.length), colorCount: prev.colorCount });
        case 'landscape':
          return retainSettings({ ...createDefaultLandscapeProblem(prev.preset), stepSize: prev.stepSize });
        case 'n-puzzle':
          return retainSettings({ ...createDefaultNPuzzleProblem(prev.size), heuristic: prev.heuristic });
      }
    });
  };

  const configPanel = useMemo(() => (
    <ProblemConfigurator title="Local Search Config">
      <ConfigSection title="Lab Selection">
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Active Lab</p>
        <Select
          value={problem.kind}
          onValueChange={(val) => setLab(val as LocalSearchProblem['kind'])}
          options={LOCAL_SEARCH_LABS.map(lab => ({ value: lab.id, label: lab.name }))}
        />
        <p className="text-[9px] text-[var(--text-3)] mt-1">
          {LOCAL_SEARCH_LABS.find(lab => lab.id === problem.kind)?.description}
        </p>
      </ConfigSection>

      <ConfigSection title="Common Controls">
        {[
          { key: 'randomSeed', label: 'Random Seed', fallback: 1337 },
          { key: 'maxSteps', label: 'Max Steps / Generations', min: 1, fallback: 120 },
          { key: 'candidateSampleSize', label: 'Candidate Sample Size', min: 1, fallback: 8 },
        ].map((field) => (
          <div key={field.key}>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">{field.label}</p>
            <input
              type="number"
              min={field.min}
              value={Number(problem[field.key as keyof LocalSearchProblem] ?? field.fallback)}
              onChange={(e) => updateProblem({ [field.key]: field.min ? Math.max(field.min, Number(e.target.value) || field.fallback) : Number(e.target.value) })}
              className="ui-input w-full px-2 py-1.5 font-mono"
            />
          </div>
        ))}
      </ConfigSection>

      <ConfigSection title="Metaheuristic Tuning" defaultOpen={false}>
        <div className="space-y-4">
          {(METAHEURISTIC_FIELDS[algo] ?? []).map((field) => (
            <div key={String(field.key)}>
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">{field.label}</p>
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={Number(problem[field.key] ?? field.fallback)}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  const bounded = Math.max(field.min ?? raw, field.max === undefined ? raw : Math.min(field.max, raw || field.fallback));
                  updateProblem({ [field.key]: bounded });
                }}
                className="ui-input w-full px-2 py-1.5 font-mono"
              />
            </div>
          ))}
          {!(METAHEURISTIC_FIELDS[algo]?.length) && (
            <p className="text-[10px] text-center text-[var(--text-3)] py-2 italic">
              No specific tuning parameters for this algorithm.
            </p>
          )}
        </div>
      </ConfigSection>

      {problem.kind === 'n-queens' && (
        <ConfigSection title="N-Queens Setup">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Board Size</p>
          <Select
            value={String(problem.size)}
            onValueChange={(val) => setProblem(createDefaultNQueensProblem(Number(val)))}
            options={[4, 6, 8, 10, 12, 16].map(size => ({ value: String(size), label: `${size}-Queens` }))}
          />
        </ConfigSection>
      )}

      {problem.kind === 'tsp' && (
        <ConfigSection title="Route Setup">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">City Count</p>
            <Select
              value={String(problem.cities.length)}
              onValueChange={(val) => setProblem(createDefaultTspProblem(Number(val)))}
              options={[6, 8, 10, 12, 14].map(c => ({ value: String(c), label: `${c} Cities` }))}
            />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Neighborhood</p>
            <Select
              value={problem.neighborhoodMode ?? 'two-opt'}
              onValueChange={(val) => updateProblem({ neighborhoodMode: val as TspProblem['neighborhoodMode'] })}
              options={[
                { value: 'swap', label: 'Swap' },
                { value: 'two-opt', label: '2-opt' },
                { value: 'insert', label: 'Insert' },
              ]}
            />
            </div>
          </div>
        </ConfigSection>
      )}

      {problem.kind === 'graph-coloring' && (
        <ConfigSection title="Graph Setup">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Node Count</p>
            <Select
              value={String(problem.graph.nodes.length)}
              onValueChange={(val) => setProblem(createDefaultGraphColoringProblem(Number(val)))}
              options={[6, 8, 10, 12].map(c => ({ value: String(c), label: `${c} Nodes` }))}
            />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Color Count</p>
            <Select
              value={String(problem.colorCount)}
              onValueChange={(val) => updateProblem({ colorCount: Number(val) })}
              options={[2, 3, 4, 5].map(c => ({ value: String(c), label: `${c} Colors` }))}
            />
            </div>
          </div>
        </ConfigSection>
      )}

      {problem.kind === 'landscape' && (
        <ConfigSection title="Landscape Setup">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Preset</p>
            <Select
              value={problem.preset}
              onValueChange={(val) => setProblem(createDefaultLandscapeProblem(val as LandscapePreset))}
              options={(['twin-peaks', 'ridge', 'crater', 'rugged'] as const).map(p => ({ value: p, label: p }))}
            />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Step Size</p>
              <input type="number" min={0.1} step={0.05} value={problem.stepSize ?? 0.45} onChange={(e) => updateProblem({ stepSize: Math.max(0.1, Number(e.target.value) || 0.1) })} className="ui-input w-full px-2 py-1.5 font-mono" />
            </div>
          </div>
        </ConfigSection>
      )}

      {problem.kind === 'n-puzzle' && (
        <ConfigSection title="Puzzle Setup">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Board Size</p>
            <Select
              value={String(problem.size)}
              onValueChange={(val) => setProblem(createDefaultNPuzzleProblem(Number(val) as 3 | 4))}
              options={[
                { value: '3', label: '3 x 3' },
                { value: '4', label: '4 x 4' },
              ]}
            />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Heuristic</p>
            <Select
              value={problem.heuristic ?? 'combined'}
              onValueChange={(val) => updateProblem({ heuristic: val as NPuzzleProblem['heuristic'] })}
              options={[
                { value: 'combined', label: 'Combined' },
                { value: 'manhattan', label: 'Manhattan' },
                { value: 'misplaced', label: 'Misplaced Tiles' },
              ]}
            />
            </div>
          </div>
        </ConfigSection>
      )}
    </ProblemConfigurator>
  ), [problem, algo]);

  const boardTab = (() => {
    switch (problem.kind) {
      case 'n-queens':
        return (
          <div className="relative group h-full">
            <NQueensBoardTab problem={problem} step={step as LocalSearchStep | null} onSetQueen={(column, row) => {
              if (currentIndex > 0) return;
              setProblem(prev => {
                if (prev.kind !== 'n-queens') return prev;
                const next = [...(prev.initialState ?? createRandomState(prev.size, createSeededRandom(prev.randomSeed ?? 1337)))];
                next[column] = row;
                return { ...prev, initialState: next };
              });
            }} />
            <ViewOverlay active={currentIndex > 0} onReset={handleResetForSetup} />
          </div>
        );
      case 'tsp':
        return (
          <div className="relative group">
            <TspBoardTab 
              problem={problem} 
              step={step as LocalSearchStep | null} 
              onRegenerate={() => setProblem(createDefaultTspProblem(problem.cities.length))} 
              onUpdateCities={(cities) => updateProblem({ cities })}
            />
            <ViewOverlay active={currentIndex > 0} onReset={handleResetForSetup} />
          </div>
        );
      case 'graph-coloring':
        return (
          <div className="relative group h-full">
            <GraphColoringBoardTab 
              problem={problem} 
              step={step as LocalSearchStep | null} 
              onCycleNode={(index) => {
                if (currentIndex > 0) return;
                setProblem(prev => {
                  if (prev.kind !== 'graph-coloring') return prev;
                  const next = [...(prev.initialColors ?? Array.from({ length: prev.graph.nodes.length }, (_, idx) => idx % prev.colorCount))];
                  next[index] = (next[index] + 1) % prev.colorCount;
                  return { ...prev, initialColors: next };
                });
              }} 
              onUpdateGraph={(graph) => updateProblem({ graph })}
            />
            <ViewOverlay active={currentIndex > 0} onReset={handleResetForSetup} />
          </div>
        );
      case 'landscape':
        return (
          <div className="relative group">
            <LandscapeBoardTab
              problem={problem}
              step={step as LocalSearchStep | null}
              onSetInitialState={(initialState) => updateProblem({ initialState })}
            />
            <ViewOverlay active={currentIndex > 0} onReset={handleResetForSetup} />
          </div>
        );
      case 'n-puzzle':
        return (
          <div className="relative group h-full">
            <NPuzzleBoardTab
              problem={problem}
              step={step as LocalSearchStep | null}
              onMoveTile={(tileIndex) => {
                if (currentIndex > 0) return;
                setProblem(prev => prev.kind === 'n-puzzle' ? movePuzzleTile(prev, tileIndex) : prev);
              }}
            />
            <ViewOverlay active={currentIndex > 0} onReset={handleResetForSetup} />
          </div>
        );
    }
  })();

  const neighborhoodTab = (() => {
    switch (problem.kind) {
      case 'n-queens':
        return (
          <div className="relative group">
            <NQueensNeighborhoodTab problem={problem} step={step as LocalSearchStep | null} onSetQueen={(column, row) => {
              if (currentIndex > 0) return;
              setProblem(prev => {
                if (prev.kind !== 'n-queens') return prev;
                const next = [...(prev.initialState ?? createRandomState(prev.size, createSeededRandom(prev.randomSeed ?? 1337)))];
                next[column] = row;
                return { ...prev, initialState: next };
              });
            }} />
            <ViewOverlay active={currentIndex > 0} onReset={handleResetForSetup} />
          </div>
        );
      case 'tsp':
        return (
          <div className="relative group">
            <TspNeighborhoodTab 
              problem={problem} 
              step={step as LocalSearchStep | null} 
              onRegenerate={() => setProblem(createDefaultTspProblem(problem.cities.length))} 
              onUpdateCities={(cities) => updateProblem({ cities })}
            />
            <ViewOverlay active={currentIndex > 0} onReset={handleResetForSetup} />
          </div>
        );
      case 'graph-coloring':
        return (
          <div className="relative group">
            <GraphColoringNeighborhoodTab 
              problem={problem} 
              step={step as LocalSearchStep | null} 
              onCycleNode={(index) => {
                if (currentIndex > 0) return;
                setProblem(prev => {
                  if (prev.kind !== 'graph-coloring') return prev;
                  const next = [...(prev.initialColors ?? Array.from({ length: prev.graph.nodes.length }, (_, idx) => idx % prev.colorCount))];
                  next[index] = (next[index] + 1) % prev.colorCount;
                  return { ...prev, initialColors: next };
                });
              }} 
              onUpdateGraph={(graph) => updateProblem({ graph })}
            />
            <ViewOverlay active={currentIndex > 0} onReset={handleResetForSetup} />
          </div>
        );
      case 'landscape':
        return (
          <div className="relative group">
            <LandscapeNeighborhoodTab 
              problem={problem} 
              step={step as LocalSearchStep | null} 
              onSetInitialState={(initialState) => updateProblem({ initialState })}
            />
            <ViewOverlay active={currentIndex > 0} onReset={handleResetForSetup} />
          </div>
        );
      case 'n-puzzle':
        return (
          <div className="relative group">
            <NPuzzleNeighborhoodTab 
              problem={problem} 
              step={step as LocalSearchStep | null} 
              onMoveTile={(tileIndex) => {
                if (currentIndex > 0) return;
                setProblem(prev => prev.kind === 'n-puzzle' ? movePuzzleTile(prev, tileIndex) : prev);
              }}
            />
            <ViewOverlay active={currentIndex > 0} onReset={handleResetForSetup} />
          </div>
        );
    }
  })();

  return (
    <>
      <AlgorithmPage
        algorithmId={algo}
        problem={problem}
        problemForActions={problem}
        category="local-search"
        problemCategory="local-search"
        onProblemImport={(nextProblem) => setProblem(normalizeImportedProblem(nextProblem))}
        tabs={[
          { id: 'board', label: 'Problem View', content: boardTab },
          { id: 'neighborhood', label: 'Neighborhood', content: neighborhoodTab },
          { id: 'objective', label: 'Objective', content: <ObjectiveTab /> },
          { id: 'trajectory', label: 'Trajectory', content: <TrajectoryTab step={step as LocalSearchStep | null} /> },
        ]}
        titleActions={
          <TitleBarActionGroup>
            <TitleBarActionButton onClick={randomizeCurrent} icon={<Dice5 size={12} />} label="Randomize" title="Randomize current problem" />
          </TitleBarActionGroup>
        }
        configPanel={configPanel}
        defaultConfigOpen
        onDemoRequest={() => setDemoDialogOpen(true)}
      />
      <PresetPickerDialog
        open={demoDialogOpen}
        onOpenChange={setDemoDialogOpen}
        title="Choose a Local Search Demo"
        subtitle="Load the default setup for one of the local search labs"
        items={LOCAL_SEARCH_LABS.map((lab) => ({
          id: lab.id,
          name: lab.name,
          description: lab.description,
          tags: ['local-search', 'default setup'],
        }))}
        onSelect={(labId) => setLab(labId as LocalSearchProblem['kind'])}
      />
    </>
  );
}
