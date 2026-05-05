import { ConfigSection } from '@/components/module/ProblemConfigurator';
import Select from '@/components/shared/Select';
import type { PlanningProblem, PlanningLabId, PlanningPresetId } from '@/types/problem';
import { PlanningOverviewTab, PlanningPlanTab, PlanningStructureTab } from '@/components/visualization/planning/PlanningLab';
import PlanningGraphVisualizer from '@/components/visualization/planning/PlanningGraphVisualizer';
import { createPlanningProblemFromPreset, PLANNING_PRESETS } from './presets';
import type { PlanningLabContext, PlanningLabModule } from './labs';

function presetOptions() {
  return PLANNING_PRESETS.map((preset) => ({
    value: preset.id,
    label: preset.name,
  }));
}

function updatePreset(context: PlanningLabContext, presetId: PlanningPresetId) {
  const next = createPlanningProblemFromPreset(presetId, context.problem.lab, context.problem.objectCount);
  context.setProblem({
    ...next,
    lab: context.problem.lab,
  });
}

function updateObjectCount(context: PlanningLabContext, objectCount: number) {
  const next = createPlanningProblemFromPreset(context.problem.presetId, context.problem.lab, objectCount);
  context.setProblem({
    ...next,
    lab: context.problem.lab,
  });
}

function renderSharedDomainSetup(context: PlanningLabContext) {
  const preset = PLANNING_PRESETS.find((entry) => entry.id === context.problem.presetId);
  return (
    <>
      <ConfigSection title="Domain Setup">
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Preset Domain</p>
            <Select
              value={context.problem.presetId}
              onValueChange={(value) => updatePreset(context, value as PlanningPresetId)}
              options={presetOptions()}
            />
            <p className="mt-1 text-[10px] text-[var(--text-3)]">{preset?.description}</p>
          </div>

          {preset?.supportsObjectCount && (
            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Object Count</p>
              <input
                type="number"
                min={2}
                max={4}
                value={context.problem.objectCount ?? 3}
                onChange={(event) => updateObjectCount(context, Math.max(2, Math.min(4, Number(event.target.value) || 3)))}
                className="ui-input w-full px-2 py-1.5 font-mono"
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-[var(--text-2)]">
            <input
              type="checkbox"
              checked={context.problem.showDeleteEffects !== false}
              onChange={(event) => context.updateProblem({ showDeleteEffects: event.target.checked })}
            />
            Show delete effects in the workbench
          </label>
        </div>
      </ConfigSection>

      <ConfigSection title="Literal Editors" defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Initial Literals</p>
            <textarea
              value={context.problem.initialLiterals.join('\n')}
              onChange={(event) => context.updateProblem({
                initialLiterals: event.target.value
                  .split('\n')
                  .map((literal) => literal.trim())
                  .filter(Boolean),
              })}
              className="ui-input min-h-[110px] w-full px-2 py-1.5 font-mono text-[11px]"
            />
          </div>
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Goal Literals</p>
            <textarea
              value={context.problem.goalLiterals.join('\n')}
              onChange={(event) => context.updateProblem({
                goalLiterals: event.target.value
                  .split('\n')
                  .map((literal) => literal.trim())
                  .filter(Boolean),
              })}
              className="ui-input min-h-[110px] w-full px-2 py-1.5 font-mono text-[11px]"
            />
          </div>
        </div>
      </ConfigSection>
    </>
  );
}

function renderStripsSetup(context: PlanningLabContext) {
  return (
    <>
      {renderSharedDomainSetup(context)}
      <ConfigSection title="Schema Toggles">
        <div className="space-y-2">
          {context.problem.schemas.map((schema) => (
            <label key={schema.id} className="flex items-center gap-2 text-xs text-[var(--text-2)]">
              <input
                type="checkbox"
                checked={schema.enabled !== false}
                onChange={(event) => context.setProblem({
                  ...context.problem,
                  schemas: context.problem.schemas.map((entry) => (
                    entry.id === schema.id ? { ...entry, enabled: event.target.checked } : entry
                  )),
                })}
              />
              {schema.name}
            </label>
          ))}
        </div>
      </ConfigSection>
    </>
  );
}

function renderStateSpaceSetup(context: PlanningLabContext) {
  return (
    <>
      {renderSharedDomainSetup(context)}
      <ConfigSection title="State-Space Controls">
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Heuristic</p>
            <Select
              value={context.problem.heuristic ?? 'goal-count'}
              onValueChange={(value) => context.updateProblem({ heuristic: value as PlanningProblem['heuristic'] })}
              options={[
                { value: 'goal-count', label: 'Goal Count' },
                { value: 'ignore-delete', label: 'Ignore Delete' },
                { value: 'planning-graph-level', label: 'Planning Graph Level' },
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Branch Order</p>
            <Select
              value={context.problem.branchOrder ?? 'schema'}
              onValueChange={(value) => context.updateProblem({ branchOrder: value as PlanningProblem['branchOrder'] })}
              options={[
                { value: 'schema', label: 'Schema Order' },
                { value: 'goal-first', label: 'Goal First' },
                { value: 'reverse', label: 'Reverse' },
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Tie Breaker</p>
            <Select
              value={context.problem.tieBreaker ?? 'fifo'}
              onValueChange={(value) => context.updateProblem({ tieBreaker: value as PlanningProblem['tieBreaker'] })}
              options={[
                { value: 'fifo', label: 'FIFO' },
                { value: 'lifo', label: 'LIFO' },
                { value: 'lexicographic', label: 'Lexicographic' },
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Goal Ordering</p>
            <Select
              value={context.problem.goalOrdering ?? 'input'}
              onValueChange={(value) => context.updateProblem({ goalOrdering: value as PlanningProblem['goalOrdering'] })}
              options={[
                { value: 'input', label: 'Input' },
                { value: 'shortest-first', label: 'Shortest First' },
                { value: 'hardest-first', label: 'Hardest First' },
              ]}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--text-2)]">
            <input
              type="checkbox"
              checked={context.problem.duplicateDetection !== false}
              onChange={(event) => context.updateProblem({ duplicateDetection: event.target.checked })}
            />
            Duplicate detection
          </label>
        </div>
      </ConfigSection>
    </>
  );
}

function renderGoalStackSetup(context: PlanningLabContext) {
  return (
    <>
      {renderSharedDomainSetup(context)}
      <ConfigSection title="Goal Stack Controls">
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Goal Ordering</p>
            <Select
              value={context.problem.goalOrdering ?? 'input'}
              onValueChange={(value) => context.updateProblem({ goalOrdering: value as PlanningProblem['goalOrdering'] })}
              options={[
                { value: 'input', label: 'Input' },
                { value: 'shortest-first', label: 'Shortest First' },
                { value: 'hardest-first', label: 'Hardest First' },
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Operator Choice</p>
            <Select
              value={context.problem.operatorChoice ?? 'fewest-preconditions'}
              onValueChange={(value) => context.updateProblem({ operatorChoice: value as PlanningProblem['operatorChoice'] })}
              options={[
                { value: 'fewest-preconditions', label: 'Fewest Preconditions' },
                { value: 'first-achiever', label: 'First Achiever' },
                { value: 'lexicographic', label: 'Lexicographic' },
              ]}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--text-2)]">
            <input
              type="checkbox"
              checked={context.problem.repeatedGoalProtection !== false}
              onChange={(event) => context.updateProblem({ repeatedGoalProtection: event.target.checked })}
            />
            Repeated-goal protection
          </label>
        </div>
      </ConfigSection>
    </>
  );
}

function renderPlanningGraphSetup(context: PlanningLabContext) {
  return (
    <>
      {renderSharedDomainSetup(context)}
      <ConfigSection title="Planning Graph Controls">
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Expansion Depth Cap</p>
            <input
              type="number"
              min={1}
              value={context.problem.expansionDepthCap ?? 6}
              onChange={(event) => context.updateProblem({ expansionDepthCap: Math.max(1, Number(event.target.value) || 6) })}
              className="ui-input w-full px-2 py-1.5 font-mono"
            />
          </div>
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Extraction Strategy</p>
            <Select
              value={context.problem.extractionStrategy ?? 'parallel-first'}
              onValueChange={(value) => context.updateProblem({ extractionStrategy: value as PlanningProblem['extractionStrategy'] })}
              options={[
                { value: 'parallel-first', label: 'Parallel First' },
                { value: 'serial-first', label: 'Serial First' },
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">SAT Horizon Cap</p>
            <input
              type="number"
              min={1}
              value={context.problem.satHorizonCap ?? 6}
              onChange={(event) => context.updateProblem({ satHorizonCap: Math.max(1, Number(event.target.value) || 6) })}
              className="ui-input w-full px-2 py-1.5 font-mono"
            />
          </div>
        </div>
      </ConfigSection>
    </>
  );
}

function renderPartialOrderSetup(context: PlanningLabContext) {
  return (
    <>
      {renderSharedDomainSetup(context)}
      <ConfigSection title="Plan-Space Controls">
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Flaw Selection</p>
            <Select
              value={context.problem.flawSelection ?? 'most-constrained'}
              onValueChange={(value) => context.updateProblem({ flawSelection: value as PlanningProblem['flawSelection'] })}
              options={[
                { value: 'most-constrained', label: 'Most Constrained' },
                { value: 'fifo', label: 'FIFO' },
                { value: 'recent', label: 'Most Recent' },
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Threat Resolution</p>
            <Select
              value={context.problem.threatResolution ?? 'promotion'}
              onValueChange={(value) => context.updateProblem({ threatResolution: value as PlanningProblem['threatResolution'] })}
              options={[
                { value: 'promotion', label: 'Promotion' },
                { value: 'demotion', label: 'Demotion' },
                { value: 'separation', label: 'Separation' },
              ]}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--text-2)]">
            <input
              type="checkbox"
              checked={context.problem.leastCommitment !== false}
              onChange={(event) => context.updateProblem({ leastCommitment: event.target.checked })}
            />
            Least-commitment ordering
          </label>
        </div>
      </ConfigSection>
    </>
  );
}

function renderPlanningGraphTabs(context: PlanningLabContext) {
  const graphLayers = context.step?.state.graphLayers ?? [];
  const extractedPlan = context.step?.state.extractedPlan ?? [];

  return [
    {
      id: 'graph',
      label: 'Graph',
      content: (
        <div className="h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgba(88,166,255,0.08),transparent_50%),var(--bg)]">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 pt-2 px-4 pb-4">
            <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-sm" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-[rgba(88,166,255,0.12)] blur-3xl" />
              <div className="relative p-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-[var(--text-3)]">Planning Graph</p>
                    <h2 className="mt-0.5 text-sm font-semibold text-[var(--text)]">
                      {graphLayers.length > 0
                        ? `${graphLayers.length} Level${graphLayers.length !== 1 ? 's' : ''} · ${extractedPlan.length > 0 ? 'Plan Extracted ✓' : 'Expanding…'}`
                        : 'Awaiting Execution'}
                    </h2>
                  </div>
                </div>
                <div className="mt-2.5">
                  <PlanningGraphVisualizer
                    layers={graphLayers}
                    extractedPlan={extractedPlan}
                    goalLiterals={context.problem.goalLiterals}
                    focusLevel={context.step?.highlight?.focusLayer}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'overview',
      label: 'Workbench',
      content: (
        <PlanningOverviewTab
          problem={context.problem}
          step={context.step}
          currentIndex={context.currentIndex}
          onApplyAction={context.applyAction}
        />
      ),
    },
    {
      id: 'structure',
      label: 'Structures',
      content: <PlanningStructureTab problem={context.problem} step={context.step} />,
    },
    {
      id: 'plan',
      label: 'Plan',
      content: <PlanningPlanTab problem={context.problem} step={context.step} />,
    },
  ];
}

function renderTabs(context: PlanningLabContext) {
  return [
    {
      id: 'overview',
      label: 'Workbench',
      content: (
        <PlanningOverviewTab
          problem={context.problem}
          step={context.step}
          currentIndex={context.currentIndex}
          onApplyAction={context.applyAction}
        />
      ),
    },
    {
      id: 'structure',
      label: 'Structures',
      content: <PlanningStructureTab problem={context.problem} step={context.step} />,
    },
    {
      id: 'plan',
      label: 'Plan',
      content: <PlanningPlanTab problem={context.problem} step={context.step} />,
    },
  ];
}

function normalizeImported(problem: unknown, lab: PlanningLabId, fallbackPreset: PlanningPresetId): PlanningProblem {
  const incoming = problem as Partial<PlanningProblem> | null;
  const base = createPlanningProblemFromPreset(incoming?.presetId ?? fallbackPreset, lab, incoming?.objectCount);
  return {
    ...base,
    ...incoming,
    kind: 'planning',
    lab,
  };
}

export const PLANNING_LAB_MODULES: PlanningLabModule[] = [
  {
    id: 'strips',
    name: 'STRIPS Workbench',
    description: 'Inspect domain schemas, grounded operators, state diffs, and manual operator application.',
    defaultAlgorithmId: 'fssp',
    path: '/planning/fssp?lab=strips',
    supportsAlgorithm: () => true,
    createDefaultProblem: () => createPlanningProblemFromPreset('blocks-world', 'strips'),
    normalizeImportedProblem: (problem) => normalizeImported(problem, 'strips', 'blocks-world'),
    renderSetupSection: renderStripsSetup,
    renderTabs,
  },
  {
    id: 'state-space',
    name: 'State-Space Planning Lab',
    description: 'Compare progression and regression planning on the same STRIPS domains.',
    defaultAlgorithmId: 'fssp',
    path: '/planning/fssp?lab=state-space',
    supportsAlgorithm: (algorithmId) => algorithmId === 'fssp' || algorithmId === 'bssp',
    createDefaultProblem: () => createPlanningProblemFromPreset('blocks-world', 'state-space'),
    normalizeImportedProblem: (problem) => normalizeImported(problem, 'state-space', 'blocks-world'),
    renderSetupSection: renderStateSpaceSetup,
    renderTabs,
  },
  {
    id: 'goal-stack',
    name: 'Goal Stack Lab',
    description: 'Trace how goal-stack planning pushes subgoals and operators onto a shared stack.',
    defaultAlgorithmId: 'gsp',
    path: '/planning/gsp?lab=goal-stack',
    supportsAlgorithm: (algorithmId) => algorithmId === 'gsp',
    createDefaultProblem: () => createPlanningProblemFromPreset('spare-tire', 'goal-stack'),
    normalizeImportedProblem: (problem) => normalizeImported(problem, 'goal-stack', 'spare-tire'),
    renderSetupSection: renderGoalStackSetup,
    renderTabs,
  },
  {
    id: 'planning-graph',
    name: 'Planning Graph Lab',
    description: 'Inspect planning-graph growth, mutex propagation, extraction, and bounded SAT horizons.',
    defaultAlgorithmId: 'graphplan',
    path: '/planning/graphplan?lab=planning-graph',
    supportsAlgorithm: (algorithmId) => algorithmId === 'graphplan' || algorithmId === 'satplan',
    createDefaultProblem: () => createPlanningProblemFromPreset('cake', 'planning-graph'),
    normalizeImportedProblem: (problem) => normalizeImported(problem, 'planning-graph', 'cake'),
    renderSetupSection: renderPlanningGraphSetup,
    renderTabs: renderPlanningGraphTabs,  },
  {
    id: 'partial-order',
    name: 'Partial-Order Planning Lab',
    description: 'Show causal links, ordering constraints, open flaws, and threat resolution for least-commitment planning.',
    defaultAlgorithmId: 'pop',
    path: '/planning/pop?lab=partial-order',
    supportsAlgorithm: (algorithmId) => algorithmId === 'pop',
    createDefaultProblem: () => createPlanningProblemFromPreset('cake', 'partial-order'),
    normalizeImportedProblem: (problem) => normalizeImported(problem, 'partial-order', 'cake'),
    renderSetupSection: renderPartialOrderSetup,
    renderTabs,
  },
];
