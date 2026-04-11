import { ConfigSection } from '@/components/module/ProblemConfigurator';
import Select from '@/components/shared/Select';
import { CspDomainsTab, CspNetworkTab, CspSearchTab } from '@/components/visualization/csp/CspLab';
import type { CspLabId, CspPresetId, CspProblem } from '@/types/problem';
import { createCspProblemFromPreset, CSP_PRESETS } from './presets';
import type { CspLabContext, CspLabModule } from './labs';

function presetOptions(ids: CspPresetId[]) {
  return CSP_PRESETS
    .filter((preset) => ids.includes(preset.id))
    .map((preset) => ({ value: preset.id, label: preset.name }));
}

function updatePreset(context: CspLabContext, presetId: CspPresetId) {
  context.setProblem(createCspProblemFromPreset(presetId, context.problem.lab));
}

function renderCommonSearchControls(context: CspLabContext) {
  return (
    <ConfigSection title="Search Controls">
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Variable Ordering</p>
          <Select
            value={context.problem.variableOrdering ?? 'mrv'}
            onValueChange={(value) => context.updateProblem({ variableOrdering: value as CspProblem['variableOrdering'] })}
            options={[
              { value: 'mrv', label: 'MRV' },
              { value: 'degree', label: 'Degree' },
              { value: 'input', label: 'Input Order' },
            ]}
          />
        </div>

        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Value Ordering</p>
          <Select
            value={context.problem.valueOrdering ?? 'lcv'}
            onValueChange={(value) => context.updateProblem({ valueOrdering: value as CspProblem['valueOrdering'] })}
            options={[
              { value: 'lcv', label: 'LCV' },
              { value: 'input', label: 'Input Order' },
            ]}
          />
        </div>

        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Queue Discipline</p>
          <Select
            value={context.problem.queueDiscipline ?? 'fifo'}
            onValueChange={(value) => context.updateProblem({ queueDiscipline: value as CspProblem['queueDiscipline'] })}
            options={[
              { value: 'fifo', label: 'FIFO' },
              { value: 'lifo', label: 'LIFO' },
            ]}
          />
        </div>
      </div>
    </ConfigSection>
  );
}

function renderConstraintNetworkSetup(context: CspLabContext) {
  return (
    <>
      <ConfigSection title="Preset">
        <Select
          value={context.problem.presetId}
          onValueChange={(value) => updatePreset(context, value as CspPresetId)}
          options={presetOptions(['australia-map', 'n-queens-csp', 'graph-coloring', 'custom-network'])}
        />
      </ConfigSection>
      {renderCommonSearchControls(context)}
    </>
  );
}

function renderArcConsistencySetup(context: CspLabContext) {
  return (
    <>
      <ConfigSection title="Preset">
        <Select
          value={context.problem.presetId}
          onValueChange={(value) => updatePreset(context, value as CspPresetId)}
          options={presetOptions(['australia-map', 'graph-coloring', 'sudoku-4x4-easy'])}
        />
      </ConfigSection>
      {renderCommonSearchControls(context)}
      <ConfigSection title="Propagation Options">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs text-[var(--text-2)]">
            <input
              type="checkbox"
              checked={context.problem.binaryOnlyView ?? false}
              onChange={(event) => context.updateProblem({ binaryOnlyView: event.target.checked })}
            />
            Binary-only visualization
          </label>
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">All-Different Encoding</p>
            <Select
              value={context.problem.allDifferentEncoding ?? 'global'}
              onValueChange={(value) => context.updateProblem({ allDifferentEncoding: value as CspProblem['allDifferentEncoding'] })}
              options={[
                { value: 'global', label: 'Global' },
                { value: 'binary-decomposition', label: 'Binary Decomposition' },
              ]}
            />
          </div>
        </div>
      </ConfigSection>
    </>
  );
}

function renderSudokuSetup(context: CspLabContext) {
  return (
    <>
      <ConfigSection title="Sudoku Preset">
        <Select
          value={context.problem.presetId}
          onValueChange={(value) => updatePreset(context, value as CspPresetId)}
          options={presetOptions(['sudoku-4x4-easy', 'sudoku-4x4-medium'])}
        />
      </ConfigSection>
      {renderCommonSearchControls(context)}
      <ConfigSection title="Sudoku Options">
        <label className="flex items-center gap-2 text-xs text-[var(--text-2)]">
          <input
            type="checkbox"
            checked={context.problem.propagationFirst !== false}
            onChange={(event) => context.updateProblem({ propagationFirst: event.target.checked })}
          />
          Propagation-first mode
        </label>
      </ConfigSection>
    </>
  );
}

function renderCryptarithmSetup(context: CspLabContext) {
  return (
    <>
      <ConfigSection title="Cryptarithm">
        <Select
          value={context.problem.presetId}
          onValueChange={(value) => updatePreset(context, value as CspPresetId)}
          options={presetOptions(['send-more-money'])}
        />
      </ConfigSection>
      {renderCommonSearchControls(context)}
      <ConfigSection title="Encoding">
        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">All-Different</p>
          <Select
            value={context.problem.allDifferentEncoding ?? 'global'}
            onValueChange={(value) => context.updateProblem({ allDifferentEncoding: value as CspProblem['allDifferentEncoding'] })}
            options={[
              { value: 'global', label: 'Global' },
              { value: 'binary-decomposition', label: 'Binary Decomposition' },
            ]}
          />
        </div>
      </ConfigSection>
    </>
  );
}

function renderSchedulingSetup(context: CspLabContext) {
  return (
    <>
      <ConfigSection title="Scheduling Preset">
        <Select
          value={context.problem.presetId}
          onValueChange={(value) => updatePreset(context, value as CspPresetId)}
          options={presetOptions(['small-timetable'])}
        />
      </ConfigSection>
      {renderCommonSearchControls(context)}
      <ConfigSection title="Structure Controls">
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Cutset</p>
            <input
              type="text"
              value={(context.problem.cutset ?? []).join(',')}
              onChange={(event) => context.updateProblem({
                cutset: event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean),
              })}
              className="ui-input w-full px-2 py-1.5 font-mono text-[11px]"
            />
          </div>
        </div>
      </ConfigSection>
    </>
  );
}

function renderStructureSetup(context: CspLabContext) {
  return (
    <>
      <ConfigSection title="Structure Preset">
        <Select
          value={context.problem.presetId}
          onValueChange={(value) => updatePreset(context, value as CspPresetId)}
          options={presetOptions(['tree-map'])}
        />
      </ConfigSection>
      {renderCommonSearchControls(context)}
      <ConfigSection title="Tree Controls">
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Root Variable</p>
            <Select
              value={context.problem.rootVariable ?? context.problem.variables[0]?.id ?? ''}
              onValueChange={(value) => context.updateProblem({ rootVariable: value })}
              options={context.problem.variables.map((variable) => ({ value: variable.id, label: variable.label ?? variable.id }))}
            />
          </div>
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Cutset</p>
            <input
              type="text"
              value={(context.problem.cutset ?? []).join(',')}
              onChange={(event) => context.updateProblem({
                cutset: event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean),
              })}
              className="ui-input w-full px-2 py-1.5 font-mono text-[11px]"
            />
          </div>
        </div>
      </ConfigSection>
    </>
  );
}

function renderTabs(context: CspLabContext) {
  return [
    {
      id: 'network',
      label: 'Network',
      content: <CspNetworkTab problem={context.problem} step={context.step} />,
    },
    {
      id: 'domains',
      label: 'Domains',
      content: <CspDomainsTab problem={context.problem} step={context.step} />,
    },
    {
      id: 'search',
      label: 'Search',
      content: <CspSearchTab problem={context.problem} step={context.step} />,
    },
  ];
}

function normalizeImported(problem: unknown, lab: CspLabId, fallbackPreset: CspPresetId): CspProblem {
  const incoming = problem as Partial<CspProblem> | null;
  const base = createCspProblemFromPreset(incoming?.presetId ?? fallbackPreset, lab);
  return {
    ...base,
    ...incoming,
    kind: 'constraint-satisfaction',
    lab,
  };
}

export const CSP_LAB_MODULES: CspLabModule[] = [
  {
    id: 'constraint-network',
    name: 'Constraint Network Sandbox',
    description: 'Explore variable ordering, value ordering, backtracking, forward checking, and MAC on small finite-domain networks.',
    defaultAlgorithmId: 'backtracking-search',
    path: '/csp/backtracking-search?lab=constraint-network',
    supportsAlgorithm: (algorithmId) => ['backtracking-search', 'forward-checking', 'mac'].includes(algorithmId),
    createDefaultProblem: () => createCspProblemFromPreset('australia-map', 'constraint-network'),
    normalizeImportedProblem: (problem) => normalizeImported(problem, 'constraint-network', 'australia-map'),
    renderSetupSection: renderConstraintNetworkSetup,
    renderTabs,
    presetIds: ['australia-map', 'n-queens-csp', 'graph-coloring', 'custom-network'],
  },
  {
    id: 'arc-consistency',
    name: 'Arc Consistency Lab',
    description: 'Focus on the propagation queue, revised arcs, and value deletions from binary and n-ary consistency algorithms.',
    defaultAlgorithmId: 'ac-3',
    path: '/csp/ac-3?lab=arc-consistency',
    supportsAlgorithm: (algorithmId) => ['ac-3', 'gac'].includes(algorithmId),
    createDefaultProblem: () => createCspProblemFromPreset('australia-map', 'arc-consistency'),
    normalizeImportedProblem: (problem) => normalizeImported(problem, 'arc-consistency', 'australia-map'),
    renderSetupSection: renderArcConsistencySetup,
    renderTabs,
    presetIds: ['australia-map', 'graph-coloring', 'sudoku-4x4-easy'],
  },
  {
    id: 'sudoku',
    name: 'Sudoku Lab',
    description: 'Show Sudoku propagation, candidate deletion, and search on a compact 4x4 board.',
    defaultAlgorithmId: 'mac',
    path: '/csp/mac?lab=sudoku',
    supportsAlgorithm: (algorithmId) => ['ac-3', 'gac', 'backtracking-search', 'forward-checking', 'mac'].includes(algorithmId),
    createDefaultProblem: () => createCspProblemFromPreset('sudoku-4x4-easy', 'sudoku'),
    normalizeImportedProblem: (problem) => normalizeImported(problem, 'sudoku', 'sudoku-4x4-easy'),
    renderSetupSection: renderSudokuSetup,
    renderTabs,
    presetIds: ['sudoku-4x4-easy', 'sudoku-4x4-medium'],
  },
  {
    id: 'cryptarithm',
    name: 'Cryptarithm Lab',
    description: 'Trace all-different reasoning, carry propagation, and arithmetic consistency in SEND + MORE = MONEY.',
    defaultAlgorithmId: 'gac',
    path: '/csp/gac?lab=cryptarithm',
    supportsAlgorithm: (algorithmId) => ['backtracking-search', 'forward-checking', 'gac', 'mac'].includes(algorithmId),
    createDefaultProblem: () => createCspProblemFromPreset('send-more-money', 'cryptarithm'),
    normalizeImportedProblem: (problem) => normalizeImported(problem, 'cryptarithm', 'send-more-money'),
    renderSetupSection: renderCryptarithmSetup,
    renderTabs,
    presetIds: ['send-more-money'],
  },
  {
    id: 'scheduling',
    name: 'Scheduling Lab',
    description: 'Inspect room-slot assignments, hard conflicts, and structural reasoning on a small timetable.',
    defaultAlgorithmId: 'mac',
    path: '/csp/mac?lab=scheduling',
    supportsAlgorithm: (algorithmId) => ['backtracking-search', 'forward-checking', 'mac', 'cutset-conditioning'].includes(algorithmId),
    createDefaultProblem: () => createCspProblemFromPreset('small-timetable', 'scheduling'),
    normalizeImportedProblem: (problem) => normalizeImported(problem, 'scheduling', 'small-timetable'),
    renderSetupSection: renderSchedulingSetup,
    renderTabs,
    presetIds: ['small-timetable'],
  },
  {
    id: 'structure',
    name: 'Structure Exploitation Lab',
    description: 'Compare direct tree solving with cutset conditioning on a tree-structured primal graph.',
    defaultAlgorithmId: 'tree-csp',
    path: '/csp/tree-csp?lab=structure',
    supportsAlgorithm: (algorithmId) => ['tree-csp', 'cutset-conditioning'].includes(algorithmId),
    createDefaultProblem: () => createCspProblemFromPreset('tree-map', 'structure'),
    normalizeImportedProblem: (problem) => normalizeImported(problem, 'structure', 'tree-map'),
    renderSetupSection: renderStructureSetup,
    renderTabs,
    presetIds: ['tree-map'],
  },
];
