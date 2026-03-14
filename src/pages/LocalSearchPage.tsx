import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import AlgorithmPage from '@/components/module/AlgorithmPage';
import ProblemConfigurator, { ConfigSection } from '@/components/module/ProblemConfigurator';
import PresetPickerDialog from '@/components/shared/PresetPickerDialog';
import Select from '@/components/shared/Select';
import { renderLocalSearchObjectiveTab, renderLocalSearchTrajectoryTab } from '@/problems/local-search/lab-modules';
import { Dice5 } from '@/components/shared/Icons';
import { TitleBarActionButton, TitleBarActionGroup } from '@/components/shared/TitleBarAction';
import type { LocalSearchStep } from '@/algorithms/local-search/types';
import { useExecutionStore } from '@/store/execution.store';
import {
  LOCAL_SEARCH_LAB_DEFINITIONS,
  createDefaultLocalSearchProblem,
  getLocalSearchLabModule,
  isLocalSearchLabKind,
  normalizeLocalSearchProblem,
  randomizeLocalSearchProblem,
  type LocalSearchLabContext,
} from '@/problems/local-search/labs';
import type { LocalSearchProblem } from '@/types/problem';

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
  const rawLabParam = searchParams.get('lab');
  const labParam = isLocalSearchLabKind(rawLabParam) ? rawLabParam : 'n-queens';
  const [problem, setProblem] = useState<LocalSearchProblem>(() => createDefaultLocalSearchProblem(labParam));
  const step = useExecutionStore(state => state.currentStep as LocalSearchStep | null);
  const currentIndex = useExecutionStore(state => state.currentIndex);
  const resetExecution = useExecutionStore(state => state.reset);
  const activeLab = getLocalSearchLabModule(problem.kind);

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
    setProblem(prev => randomizeLocalSearchProblem(prev));
  };

  const labContext: LocalSearchLabContext = {
    problem,
    step,
    currentIndex,
    setProblem,
    updateProblem,
    resetForSetup: handleResetForSetup,
  };

  const configPanel = (
    <ProblemConfigurator title="Local Search Config">
      <ConfigSection title="Lab Selection">
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1.5">Active Lab</p>
        <Select
          value={problem.kind}
          onValueChange={(val) => setLab(val as LocalSearchProblem['kind'])}
          options={LOCAL_SEARCH_LAB_DEFINITIONS.map(lab => ({ value: lab.id, label: lab.name }))}
        />
        <p className="text-[9px] text-[var(--text-3)] mt-1">
          {LOCAL_SEARCH_LAB_DEFINITIONS.find(lab => lab.id === problem.kind)?.description}
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
      {activeLab.renderSetupSection(labContext)}
    </ProblemConfigurator>
  );

  return (
    <>
      <AlgorithmPage
        algorithmId={algo}
        problem={problem}
        problemForActions={problem}
        category="local-search"
        problemCategory="local-search"
        onProblemImport={(nextProblem) => setProblem(normalizeLocalSearchProblem(nextProblem))}
        tabs={[
          { id: 'board', label: 'Problem View', content: activeLab.renderBoardTab(labContext) },
          { id: 'neighborhood', label: 'Neighborhood', content: activeLab.renderNeighborhoodTab(labContext) },
          { id: 'objective', label: 'Objective', content: renderLocalSearchObjectiveTab() },
          { id: 'trajectory', label: 'Trajectory', content: renderLocalSearchTrajectoryTab(problem, step) },
        ]}
        buildAlgorithmRoute={(algorithmId) => `/local/${algorithmId}?lab=${problem.kind}`}
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
        items={LOCAL_SEARCH_LAB_DEFINITIONS.map((lab) => ({
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
