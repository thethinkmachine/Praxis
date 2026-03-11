import type { ReactNode } from 'react';
import ProblemConfigurator, { ConfigSection } from '@/components/module/ProblemConfigurator';
import Select from '@/components/shared/Select';
import { GraphColoringBoardTab, GraphColoringNeighborhoodTab } from '@/components/visualization/local-search/GraphColoringLab';
import { ObjectiveTab, TrajectoryTab, ViewOverlay } from '@/components/visualization/local-search/LocalSearchShared';
import { LandscapeBoardTab, LandscapeNeighborhoodTab } from '@/components/visualization/local-search/LandscapeLab';
import { NPuzzleBoardTab, NPuzzleNeighborhoodTab } from '@/components/visualization/local-search/NPuzzleLab';
import { NQueensBoardTab, NQueensNeighborhoodTab } from '@/components/visualization/local-search/NQueensLab';
import { TspBoardTab, TspNeighborhoodTab } from '@/components/visualization/local-search/TspLab';
import type { LocalSearchStep } from '@/algorithms/local-search/types';
import { Graph, type GraphColoringProblem, type LandscapePreset, type LandscapeProblem, type LocalSearchProblem, type NPuzzleProblem, type NQueensProblem, type TspProblem } from '@/types/problem';
import {
  createDefaultGraphColoringProblem,
  createDefaultLandscapeProblem,
  createDefaultNPuzzleProblem,
  createDefaultNQueensProblem,
  createDefaultTspProblem,
} from './presets';
import type { LocalSearchLabContext, LocalSearchLabModule } from './labs';
import { createRandomState, createSeededRandom } from './n-queens';

function withOverlay(content: ReactNode, context: LocalSearchLabContext) {
  return (
    <div className="relative group h-full">
      {content}
      <ViewOverlay active={context.currentIndex > 0} onReset={context.resetForSetup} />
    </div>
  );
}

function retainLocalSearchSettings<T extends LocalSearchProblem>(previous: T, base: T, nextSeed: number): T {
  const result: Record<string, unknown> = { ...base };
  const keys = [
    'maxSteps', 'candidateSampleSize', 'restartLimit', 'sidewaysMoveLimit',
    'beamWidth', 'tabuTenure', 'initialTemperature', 'coolingRate',
    'populationSize', 'mutationRate', 'crossoverRate',
  ] as const;

  for (const key of keys) {
    const value = previous[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }

  result.randomSeed = nextSeed;
  return result as T;
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

function renderNQueensSetup(context: LocalSearchLabContext) {
  const problem = context.problem as NQueensProblem;
  return (
    <ConfigSection title="N-Queens Setup">
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Board Size</p>
      <Select
        value={String(problem.size)}
        onValueChange={(value) => context.setProblem(createDefaultNQueensProblem(Number(value)))}
        options={[4, 6, 8, 10, 12, 16].map(size => ({ value: String(size), label: `${size}-Queens` }))}
      />
    </ConfigSection>
  );
}

function renderTspSetup(context: LocalSearchLabContext) {
  const problem = context.problem as TspProblem;
  return (
    <ConfigSection title="Route Setup">
      <div className="space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">City Count</p>
          <Select
            value={String(problem.cities.length)}
            onValueChange={(value) => context.setProblem(createDefaultTspProblem(Number(value)))}
            options={[6, 8, 10, 12, 14].map(count => ({ value: String(count), label: `${count} Cities` }))}
          />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Neighborhood</p>
          <Select
            value={problem.neighborhoodMode ?? 'two-opt'}
            onValueChange={(value) => context.updateProblem({ neighborhoodMode: value as TspProblem['neighborhoodMode'] })}
            options={[
              { value: 'swap', label: 'Swap' },
              { value: 'two-opt', label: '2-opt' },
              { value: 'insert', label: 'Insert' },
            ]}
          />
        </div>
      </div>
    </ConfigSection>
  );
}

function renderGraphColoringSetup(context: LocalSearchLabContext) {
  const problem = context.problem as GraphColoringProblem;
  return (
    <ConfigSection title="Graph Setup">
      <div className="space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Node Count</p>
          <Select
            value={String(problem.graph.nodes.length)}
            onValueChange={(value) => context.setProblem(createDefaultGraphColoringProblem(Number(value)))}
            options={[6, 8, 10, 12].map(count => ({ value: String(count), label: `${count} Nodes` }))}
          />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Color Count</p>
          <Select
            value={String(problem.colorCount)}
            onValueChange={(value) => context.updateProblem({ colorCount: Number(value) })}
            options={[2, 3, 4, 5].map(count => ({ value: String(count), label: `${count} Colors` }))}
          />
        </div>
      </div>
    </ConfigSection>
  );
}

function renderLandscapeSetup(context: LocalSearchLabContext) {
  const problem = context.problem as LandscapeProblem;
  return (
    <ConfigSection title="Landscape Setup">
      <div className="space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Preset</p>
          <Select
            value={problem.preset}
            onValueChange={(value) => context.setProblem(createDefaultLandscapeProblem(value as LandscapePreset))}
            options={(['twin-peaks', 'ridge', 'crater', 'rugged'] as const).map((preset) => ({ value: preset, label: preset }))}
          />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Step Size</p>
          <input
            type="number"
            min={0.1}
            step={0.05}
            value={problem.stepSize ?? 0.45}
            onChange={(event) => context.updateProblem({ stepSize: Math.max(0.1, Number(event.target.value) || 0.1) })}
            className="ui-input w-full px-2 py-1.5 font-mono"
          />
        </div>
      </div>
    </ConfigSection>
  );
}

function renderNPuzzleSetup(context: LocalSearchLabContext) {
  const problem = context.problem as NPuzzleProblem;
  return (
    <ConfigSection title="Puzzle Setup">
      <div className="space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Board Size</p>
          <Select
            value={String(problem.size)}
            onValueChange={(value) => context.setProblem(createDefaultNPuzzleProblem(Number(value) as 3 | 4))}
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
            onValueChange={(value) => context.updateProblem({ heuristic: value as NPuzzleProblem['heuristic'] })}
            options={[
              { value: 'combined', label: 'Combined' },
              { value: 'manhattan', label: 'Manhattan' },
              { value: 'misplaced', label: 'Misplaced Tiles' },
            ]}
          />
        </div>
      </div>
    </ConfigSection>
  );
}

export const LOCAL_SEARCH_LAB_MODULES: LocalSearchLabModule[] = [
  {
    id: 'n-queens',
    name: 'N-Queens',
    description: 'Conflict-driven discrete local search with clear local maxima, plateaus, and repair behavior.',
    defaultAlgorithmId: 'hill-climbing-steepest',
    path: '/local/hill-climbing-steepest?lab=n-queens',
    createDefaultProblem: () => createDefaultNQueensProblem(),
    normalizeImportedProblem(problem: unknown) {
      const incoming = problem as NQueensProblem;
      return { ...createDefaultNQueensProblem(incoming.size ?? 8), ...incoming, kind: 'n-queens' };
    },
    randomizeProblem(problem: LocalSearchProblem) {
      const previous = problem as NQueensProblem;
      const nextSeed = (previous.randomSeed ?? 1337) + 17;
      const random = createSeededRandom(nextSeed);
      return retainLocalSearchSettings(previous, { ...previous, initialState: createRandomState(previous.size, random) }, nextSeed);
    },
    renderSetupSection: renderNQueensSetup,
    renderBoardTab(context) {
      const problem = context.problem as NQueensProblem;
      const step = context.step as LocalSearchStep | null;
      return withOverlay(
        <NQueensBoardTab
          problem={problem}
          step={step}
          onSetQueen={(column, row) => {
            if (context.currentIndex > 0) return;
            context.setProblem((previous) => {
              const current = previous as NQueensProblem;
              const next = [...(current.initialState ?? createRandomState(current.size, createSeededRandom(current.randomSeed ?? 1337)))];
              next[column] = row;
              return { ...current, initialState: next };
            });
          }}
        />,
        context,
      );
    },
    renderNeighborhoodTab(context) {
      const problem = context.problem as NQueensProblem;
      const step = context.step as LocalSearchStep | null;
      return withOverlay(
        <NQueensNeighborhoodTab
          problem={problem}
          step={step}
          onSetQueen={(column, row) => {
            if (context.currentIndex > 0) return;
            context.setProblem((previous) => {
              const current = previous as NQueensProblem;
              const next = [...(current.initialState ?? createRandomState(current.size, createSeededRandom(current.randomSeed ?? 1337)))];
              next[column] = row;
              return { ...current, initialState: next };
            });
          }}
        />,
        context,
      );
    },
  },
  {
    id: 'tsp',
    name: 'TSP / Route',
    description: 'Tour optimization over Euclidean city layouts using swap, 2-opt, or insertion neighborhoods.',
    defaultAlgorithmId: 'simulated-annealing',
    path: '/local/simulated-annealing?lab=tsp',
    createDefaultProblem: () => createDefaultTspProblem(),
    normalizeImportedProblem(problem: unknown) {
      const incoming = problem as TspProblem;
      return { ...createDefaultTspProblem(incoming.cities?.length ?? 9), ...incoming, kind: 'tsp' };
    },
    randomizeProblem(problem: LocalSearchProblem) {
      const previous = problem as TspProblem;
      const nextSeed = (previous.randomSeed ?? 1337) + 17;
      return retainLocalSearchSettings(previous, { ...createDefaultTspProblem(previous.cities.length), neighborhoodMode: previous.neighborhoodMode }, nextSeed);
    },
    renderSetupSection: renderTspSetup,
    renderBoardTab(context) {
      const problem = context.problem as TspProblem;
      const step = context.step as LocalSearchStep | null;
      return withOverlay(
        <TspBoardTab
          problem={problem}
          step={step}
          onRegenerate={() => context.setProblem(createDefaultTspProblem(problem.cities.length))}
          onUpdateCities={(cities) => context.updateProblem({ cities })}
        />,
        context,
      );
    },
    renderNeighborhoodTab(context) {
      const problem = context.problem as TspProblem;
      const step = context.step as LocalSearchStep | null;
      return withOverlay(
        <TspNeighborhoodTab
          problem={problem}
          step={step}
          onRegenerate={() => context.setProblem(createDefaultTspProblem(problem.cities.length))}
          onUpdateCities={(cities) => context.updateProblem({ cities })}
        />,
        context,
      );
    },
  },
  {
    id: 'graph-coloring',
    name: 'Graph Coloring',
    description: 'Constraint satisfaction over sparse graphs, useful for tabu search and min-conflicts.',
    defaultAlgorithmId: 'min-conflicts',
    path: '/local/min-conflicts?lab=graph-coloring',
    createDefaultProblem: () => createDefaultGraphColoringProblem(),
    normalizeImportedProblem(problem: unknown) {
      const incoming = problem as GraphColoringProblem;
      return {
        ...createDefaultGraphColoringProblem(),
        ...incoming,
        graph: incoming.graph instanceof Graph ? incoming.graph : new Graph(incoming.graph),
        kind: 'graph-coloring',
      };
    },
    randomizeProblem(problem: LocalSearchProblem) {
      const previous = problem as GraphColoringProblem;
      const nextSeed = (previous.randomSeed ?? 1337) + 17;
      return retainLocalSearchSettings(previous, { ...createDefaultGraphColoringProblem(previous.graph.nodes.length), colorCount: previous.colorCount }, nextSeed);
    },
    renderSetupSection: renderGraphColoringSetup,
    renderBoardTab(context) {
      const problem = context.problem as GraphColoringProblem;
      const step = context.step as LocalSearchStep | null;
      return withOverlay(
        <GraphColoringBoardTab
          problem={problem}
          step={step}
          onCycleNode={(index) => {
            if (context.currentIndex > 0) return;
            context.setProblem((previous) => {
              const current = previous as GraphColoringProblem;
              const next = [...(current.initialColors ?? Array.from({ length: current.graph.nodes.length }, (_, itemIndex) => itemIndex % current.colorCount))];
              next[index] = (next[index] + 1) % current.colorCount;
              return { ...current, initialColors: next };
            });
          }}
          onUpdateGraph={(graph) => context.updateProblem({ graph })}
        />,
        context,
      );
    },
    renderNeighborhoodTab(context) {
      const problem = context.problem as GraphColoringProblem;
      const step = context.step as LocalSearchStep | null;
      return withOverlay(
        <GraphColoringNeighborhoodTab
          problem={problem}
          step={step}
          onCycleNode={(index) => {
            if (context.currentIndex > 0) return;
            context.setProblem((previous) => {
              const current = previous as GraphColoringProblem;
              const next = [...(current.initialColors ?? Array.from({ length: current.graph.nodes.length }, (_, itemIndex) => itemIndex % current.colorCount))];
              next[index] = (next[index] + 1) % current.colorCount;
              return { ...current, initialColors: next };
            });
          }}
          onUpdateGraph={(graph) => context.updateProblem({ graph })}
        />,
        context,
      );
    },
  },
  {
    id: 'landscape',
    name: 'Landscape',
    description: 'A continuous objective surface for making ridges, plateaus, and annealing behavior visible.',
    defaultAlgorithmId: 'simulated-annealing',
    path: '/local/simulated-annealing?lab=landscape',
    createDefaultProblem: () => createDefaultLandscapeProblem(),
    normalizeImportedProblem(problem: unknown) {
      const incoming = problem as LandscapeProblem & { preset?: LandscapePreset };
      return { ...createDefaultLandscapeProblem(incoming.preset ?? 'twin-peaks'), ...incoming, kind: 'landscape' };
    },
    randomizeProblem(problem: LocalSearchProblem) {
      const previous = problem as LandscapeProblem;
      const nextSeed = (previous.randomSeed ?? 1337) + 17;
      return retainLocalSearchSettings(previous, { ...createDefaultLandscapeProblem(previous.preset), stepSize: previous.stepSize }, nextSeed);
    },
    renderSetupSection: renderLandscapeSetup,
    renderBoardTab(context) {
      return withOverlay(
        <LandscapeBoardTab
          problem={context.problem as LandscapeProblem}
          step={context.step as LocalSearchStep | null}
          onSetInitialState={(initialState) => context.updateProblem({ initialState })}
        />,
        context,
      );
    },
    renderNeighborhoodTab(context) {
      return withOverlay(
        <LandscapeNeighborhoodTab
          problem={context.problem as LandscapeProblem}
          step={context.step as LocalSearchStep | null}
          onSetInitialState={(initialState) => context.updateProblem({ initialState })}
        />,
        context,
      );
    },
  },
  {
    id: 'n-puzzle',
    name: 'N-Puzzle',
    description: 'A crossover lab that contrasts heuristic local search behavior with a classic state-space problem.',
    defaultAlgorithmId: 'tabu-search',
    path: '/local/tabu-search?lab=n-puzzle',
    createDefaultProblem: () => createDefaultNPuzzleProblem(),
    normalizeImportedProblem(problem: unknown) {
      const incoming = problem as NPuzzleProblem;
      return { ...createDefaultNPuzzleProblem(incoming.size ?? 3), ...incoming, kind: 'n-puzzle' };
    },
    randomizeProblem(problem: LocalSearchProblem) {
      const previous = problem as NPuzzleProblem;
      const nextSeed = (previous.randomSeed ?? 1337) + 17;
      return retainLocalSearchSettings(previous, { ...createDefaultNPuzzleProblem(previous.size), heuristic: previous.heuristic }, nextSeed);
    },
    renderSetupSection: renderNPuzzleSetup,
    renderBoardTab(context) {
      return withOverlay(
        <NPuzzleBoardTab
          problem={context.problem as NPuzzleProblem}
          step={context.step as LocalSearchStep | null}
          onMoveTile={(tileIndex) => {
            if (context.currentIndex > 0) return;
            context.setProblem((previous) => movePuzzleTile(previous as NPuzzleProblem, tileIndex));
          }}
        />,
        context,
      );
    },
    renderNeighborhoodTab(context) {
      return withOverlay(
        <NPuzzleNeighborhoodTab
          problem={context.problem as NPuzzleProblem}
          step={context.step as LocalSearchStep | null}
          onMoveTile={(tileIndex) => {
            if (context.currentIndex > 0) return;
            context.setProblem((previous) => movePuzzleTile(previous as NPuzzleProblem, tileIndex));
          }}
        />,
        context,
      );
    },
  },
];

export function renderLocalSearchObjectiveTab() {
  return <ObjectiveTab />;
}

export function renderLocalSearchTrajectoryTab(step: LocalSearchStep | null) {
  return <TrajectoryTab step={step} />;
}