import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import AlgorithmPage from '@/components/module/AlgorithmPage';
import ProblemConfigurator, { ConfigSection } from '@/components/module/ProblemConfigurator';
import PresetPickerDialog from '@/components/shared/PresetPickerDialog';
import Select from '@/components/shared/Select';
import { useExecutionStore } from '@/store/execution.store';
import type { CspProblem } from '@/types/problem';
import type { CspStep } from '@/algorithms/csp/types';
import { createExecutionProblemKey } from '@/lib/execution-problem-key';
import {
  buildCspRoute,
  createDefaultCspProblem,
  CSP_LAB_DEFINITIONS,
  getCspLabModule,
  getDefaultCspLabForAlgorithm,
  isCspLabId,
  normalizeCspProblem,
  supportsCspAlgorithm,
  type CspLabContext,
} from '@/problems/csp/labs';
import { CSP_PRESETS } from '@/problems/csp/presets';

function createCspProblemKey(prefix: string): string {
  return `${prefix}:${Date.now()}`;
}

export default function CspPage() {
  const { algo = 'backtracking-search' } = useParams<{ algo: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const rawLabParam = searchParams.get('lab');
  const fallbackLab = getDefaultCspLabForAlgorithm(algo);
  const labParam = isCspLabId(rawLabParam) ? rawLabParam : fallbackLab;
  const resolvedLab = supportsCspAlgorithm(labParam, algo) ? labParam : fallbackLab;
  const [problem, setProblem] = useState<CspProblem>(() => createDefaultCspProblem(resolvedLab));
  const [problemKey, setProblemKey] = useState(`csp:${resolvedLab}:default`);
  const step = useExecutionStore((state) => state.currentStep as CspStep | null);
  const currentIndex = useExecutionStore((state) => state.currentIndex);
  const resetExecution = useExecutionStore((state) => state.reset);
  const activeLab = getCspLabModule(problem.lab);

  useEffect(() => {
    if (resolvedLab !== labParam) {
      setSearchParams({ lab: resolvedLab }, { replace: true });
    }
  }, [labParam, resolvedLab, setSearchParams]);

  useEffect(() => {
    if (problem.lab !== resolvedLab) {
      setProblem(createDefaultCspProblem(resolvedLab));
      setProblemKey(`csp:${resolvedLab}:default`);
    }
  }, [problem.lab, resolvedLab]);

  const updateProblem = (patch: Partial<CspProblem>) => {
    if (currentIndex > 0) return;
    setProblem((previous) => ({ ...previous, ...patch }));
    setProblemKey(createCspProblemKey(`csp:${problem.lab}:edit`));
  };

  const setLab = (labId: CspProblem['lab']) => {
    setProblem(createDefaultCspProblem(labId));
    setSearchParams({ lab: labId });
    setProblemKey(createCspProblemKey(`csp:${labId}:lab`));
  };

  const cspContext: CspLabContext = {
    problem,
    step,
    currentIndex,
    setProblem: (value) => {
      if (currentIndex > 0) return;
      setProblem((previous) => (typeof value === 'function' ? value(previous) : value));
      setProblemKey(createCspProblemKey(`csp:${problem.lab}:set`));
    },
    updateProblem,
    resetForSetup: () => {
      resetExecution();
      setProblem((previous) => ({ ...previous }));
    },
  };

  const executionProblemKey = useMemo(
    () => `${problemKey}:${createExecutionProblemKey(problem)}`,
    [problemKey, problem],
  );
  const executionContext = useMemo(() => ({
    pageKey: 'constraint-satisfaction',
    labKey: problem.lab,
    problemKey: executionProblemKey,
    preservePosition: true,
  }), [problem.lab, executionProblemKey]);

  const configPanel = (
    <ProblemConfigurator title="CSP Config">
      <ConfigSection title="Lab Selection">
        <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Active Lab</p>
        <Select
          value={problem.lab}
          onValueChange={(value) => setLab(value as CspProblem['lab'])}
          options={CSP_LAB_DEFINITIONS
            .filter((lab) => lab.supportsAlgorithm(algo))
            .map((lab) => ({ value: lab.id, label: lab.name }))}
        />
      </ConfigSection>
      {activeLab.renderSetupSection(cspContext)}
    </ProblemConfigurator>
  );

  return (
    <>
      <AlgorithmPage
        algorithmId={algo}
        problem={problem}
        problemForActions={problem}
        category="constraint-satisfaction"
        problemCategory="constraint-satisfaction"
        onProblemImport={(nextProblem) => {
          const normalized = normalizeCspProblem(nextProblem, resolvedLab);
          setProblem(normalized);
          setProblemKey(createCspProblemKey(`csp:${normalized.lab}:import`));
        }}
        tabs={activeLab.renderTabs(cspContext)}
        buildAlgorithmRoute={(algorithmId) => buildCspRoute(algorithmId, supportsCspAlgorithm(problem.lab, algorithmId) ? problem.lab : getDefaultCspLabForAlgorithm(algorithmId))}
        configPanel={configPanel}
        executionContext={executionContext}
        onDemoRequest={() => setDemoDialogOpen(true)}
      />

      <PresetPickerDialog
        open={demoDialogOpen}
        onOpenChange={setDemoDialogOpen}
        title="Choose a CSP Preset"
        subtitle="Load a finite-domain CSP benchmark into the active lab"
        items={CSP_PRESETS
          .filter((preset) => activeLab.presetIds.includes(preset.id))
          .map((preset) => ({
            id: preset.id,
            name: preset.name,
            description: preset.description,
            tags: ['csp', problem.lab],
          }))}
        onSelect={(presetId) => {
          const next = activeLab.normalizeImportedProblem({
            ...problem,
            presetId,
          });
          setProblem(next);
          setProblemKey(createCspProblemKey(`csp:${next.lab}:preset:${presetId}`));
        }}
      />
    </>
  );
}
