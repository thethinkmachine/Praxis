import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import AlgorithmPage from '@/components/module/AlgorithmPage';
import ProblemConfigurator, { ConfigSection } from '@/components/module/ProblemConfigurator';
import PresetPickerDialog from '@/components/shared/PresetPickerDialog';
import Select from '@/components/shared/Select';
import { useExecutionStore } from '@/store/execution.store';
import type { PlanningProblem } from '@/types/problem';
import type { PlanningStep } from '@/algorithms/planning/types';
import { applyAction, createGroundedProblem, isActionApplicable } from '@/problems/planning/core';
import { PLANNING_PRESETS } from '@/problems/planning/presets';
import { createExecutionProblemKey } from '@/lib/execution-problem-key';
import {
  buildPlanningRoute,
  createDefaultPlanningProblem,
  getDefaultPlanningLabForAlgorithm,
  PLANNING_LAB_DEFINITIONS,
  getPlanningLabModule,
  isPlanningLabId,
  normalizePlanningProblem,
  supportsPlanningAlgorithm,
  type PlanningLabContext,
} from '@/problems/planning/labs';

function createPlanningProblemKey(prefix: string): string {
  return `${prefix}:${Date.now()}`;
}

export default function PlanningPage() {
  const { algo = 'fssp' } = useParams<{ algo: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const rawLabParam = searchParams.get('lab');
  const fallbackLab = getDefaultPlanningLabForAlgorithm(algo);
  const labParam = isPlanningLabId(rawLabParam) ? rawLabParam : fallbackLab;
  const resolvedLab = supportsPlanningAlgorithm(labParam, algo) ? labParam : fallbackLab;
  const [problem, setProblem] = useState<PlanningProblem>(() => createDefaultPlanningProblem(resolvedLab));
  const [problemKey, setProblemKey] = useState(`planning:${resolvedLab}:default`);
  const step = useExecutionStore((state) => state.currentStep as PlanningStep | null);
  const currentIndex = useExecutionStore((state) => state.currentIndex);
  const resetExecution = useExecutionStore((state) => state.reset);
  const activeLab = getPlanningLabModule(problem.lab);

  useEffect(() => {
    if (resolvedLab !== labParam) {
      setSearchParams({ lab: resolvedLab }, { replace: true });
    }
  }, [labParam, resolvedLab, setSearchParams]);

  useEffect(() => {
    if (problem.lab !== resolvedLab) {
      setProblem(createDefaultPlanningProblem(resolvedLab));
      setProblemKey(`planning:${resolvedLab}:default`);
    }
  }, [problem.lab, resolvedLab]);

  const handleResetForSetup = () => {
    resetExecution();
    setProblem((previous) => ({ ...previous }));
  };

  const updateProblem = (patch: Partial<PlanningProblem>) => {
    if (currentIndex > 0) return;
    setProblem((previous) => createGroundedProblem({
      ...previous,
      ...patch,
      schemas: patch.schemas ?? previous.schemas,
      groundedActions: [],
    }));
    setProblemKey(createPlanningProblemKey(`planning:${problem.lab}:edit`));
  };

  const setLab = (labId: PlanningProblem['lab']) => {
    const nextProblem = createDefaultPlanningProblem(labId);
    setProblem(nextProblem);
    setSearchParams({ lab: labId });
    setProblemKey(createPlanningProblemKey(`planning:${labId}:lab`));
  };

  const applyActionToProblem = (actionId: string) => {
    if (currentIndex > 0) return;
    setProblem((previous) => {
      const prepared = createGroundedProblem(previous);
      const action = prepared.groundedActions.find((entry) => entry.id === actionId);
      if (!action || !isActionApplicable(prepared.initialLiterals, action)) {
        return prepared;
      }
      return {
        ...prepared,
        initialLiterals: applyAction(prepared.initialLiterals, action),
        manualActionHistory: [...(prepared.manualActionHistory ?? []), action.label],
      };
    });
    setProblemKey(createPlanningProblemKey(`planning:${problem.lab}:apply`));
  };

  const planningContext: PlanningLabContext = {
    problem,
    step,
    currentIndex,
    setProblem: (value) => {
      if (currentIndex > 0) return;
      setProblem((previous) => {
        const next = typeof value === 'function' ? value(previous) : value;
        return createGroundedProblem({ ...next, groundedActions: [] });
      });
      setProblemKey(createPlanningProblemKey(`planning:${problem.lab}:set`));
    },
    updateProblem,
    resetForSetup: handleResetForSetup,
    applyAction: applyActionToProblem,
  };

  const executionProblemKey = useMemo(
    () => `${problemKey}:${createExecutionProblemKey(problem)}`,
    [problemKey, problem],
  );
  const executionContext = useMemo(() => ({
    pageKey: 'planning',
    labKey: problem.lab,
    problemKey: executionProblemKey,
    preservePosition: true,
  }), [problem.lab, executionProblemKey]);

  const configPanel = (
    <ProblemConfigurator title="Planning Config">
      <ConfigSection title="Lab Selection">
        <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Active Lab</p>
        <Select
          value={problem.lab}
          onValueChange={(value) => setLab(value as PlanningProblem['lab'])}
          options={PLANNING_LAB_DEFINITIONS
            .filter((lab) => lab.id === 'strips' || lab.supportsAlgorithm(algo))
            .map((lab) => ({ value: lab.id, label: lab.name }))}
        />
      </ConfigSection>
      {activeLab.renderSetupSection(planningContext)}
    </ProblemConfigurator>
  );

  return (
    <>
      <AlgorithmPage
        algorithmId={algo}
        problem={problem}
        problemForActions={problem}
        category="planning"
        problemCategory="planning"
        onProblemImport={(nextProblem) => {
          const normalized = normalizePlanningProblem(nextProblem, resolvedLab);
          setProblem(normalized);
          setProblemKey(createPlanningProblemKey(`planning:${normalized.lab}:import`));
        }}
        tabs={activeLab.renderTabs(planningContext)}
        buildAlgorithmRoute={(algorithmId) => buildPlanningRoute(algorithmId, supportsPlanningAlgorithm(problem.lab, algorithmId) ? problem.lab : getDefaultPlanningLabForAlgorithm(algorithmId))}
        configPanel={configPanel}
        defaultConfigOpen
        executionContext={executionContext}
        onDemoRequest={() => setDemoDialogOpen(true)}
      />

      <PresetPickerDialog
        open={demoDialogOpen}
        onOpenChange={setDemoDialogOpen}
        title="Choose a Planning Preset"
        subtitle="Swap in a classical STRIPS-style planning benchmark"
        items={PLANNING_PRESETS.map((preset) => ({
          id: preset.id,
          name: preset.name,
          description: preset.description,
          tags: ['planning', preset.supportsObjectCount ? 'scalable' : 'fixed'],
        }))}
        onSelect={(presetId) => {
          const next = activeLab.normalizeImportedProblem({
            ...problem,
            presetId,
          });
          setProblem(next);
          setProblemKey(createPlanningProblemKey(`planning:${next.lab}:preset:${presetId}`));
        }}
      />
    </>
  );
}
