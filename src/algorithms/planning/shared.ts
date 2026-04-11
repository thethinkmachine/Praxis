import type { MetricTile, PanelSection } from '@/types';
import type { PlanningProblem } from '@/types/problem';
import { createLog, statePanels } from '@/algorithms/core/utils';
import type {
  PlanningGraphLayerView,
  PlanningPartialPlanView,
  PlanningResult,
  PlanningTraceHighlight,
  PlanningTraceState,
} from './types';

function chipItems(items: string[], variant: 'current' | 'explored' | 'frontier' | 'path' = 'explored') {
  return items.map((item) => ({ id: item, label: item, variant }));
}

function graphLayerNodes(layers: PlanningGraphLayerView[]) {
  return layers.map((layer) => ({
    id: String(layer.level),
    label: `Level ${layer.level}`,
    detail: `${layer.propositions.length} props, ${layer.actions.length} actions, ${layer.propositionMutex.length} prop mutex`,
  }));
}

function partialPlanNodes(plan: PlanningPartialPlanView | null) {
  return (plan?.actions ?? []).map((action) => ({
    id: action.id,
    label: action.label,
    detail: `ordered edges: ${plan?.orderings.filter(([from]) => from === action.id).length ?? 0}`,
  }));
}

export function createPlanningState(
  problem: PlanningProblem,
  patch: Partial<PlanningTraceState>,
): PlanningTraceState {
  return {
    mode: problem.lab === 'strips'
      ? 'strips'
      : problem.lab === 'goal-stack'
        ? 'goal-stack'
        : problem.lab === 'planning-graph'
          ? 'planning-graph'
          : problem.lab === 'partial-order'
            ? 'partial-order'
            : 'state-space',
    domainName: problem.domainName,
    presetId: problem.presetId,
    currentStateLiterals: [],
    currentGoals: [],
    satisfiedGoals: [],
    unsatisfiedGoals: [],
    frontier: [],
    exploredKeys: [],
    applicableActions: [],
    selectedActionId: null,
    selectedActionLabel: null,
    planSoFar: [],
    groundedActionLabels: problem.groundedActions.map((action) => action.label),
    goalStack: [],
    graphLayers: [],
    extractedPlan: [],
    cnfSummary: [],
    partialPlan: null,
    notes: [],
    ...patch,
  };
}

export function createPlanningHighlight(
  state: PlanningTraceState,
  patch: Partial<PlanningTraceHighlight> = {},
): PlanningTraceHighlight {
  return {
    currentLiterals: state.currentStateLiterals,
    currentGoals: state.currentGoals,
    selectedActionId: state.selectedActionId,
    frontierIds: state.frontier.map((entry) => entry.id),
    focusLayer: state.graphLayers.at(-1)?.level ?? null,
    focusFlawId: state.partialPlan?.openFlaws[0]?.id ?? null,
    ...patch,
  };
}

export function buildPlanningStatePanels(state: PlanningTraceState): PanelSection[] {
  const panels: PanelSection[] = [
    statePanels.keyValue('Problem', [
      { key: 'Domain', value: state.domainName },
      { key: 'Preset', value: state.presetId },
      { key: 'Mode', value: state.mode },
    ]),
  ];

  if (state.currentStateLiterals.length > 0) {
    panels.push(statePanels.chips('Current State', chipItems(state.currentStateLiterals, 'current')));
  }

  if (state.currentGoals.length > 0) {
    panels.push(statePanels.chips('Current Goals', chipItems(state.currentGoals, 'path')));
  }

  if (state.planSoFar.length > 0) {
    panels.push(statePanels.chips('Plan So Far', chipItems(state.planSoFar, 'path')));
  }

  if (state.frontier.length > 0) {
    panels.push(statePanels.nodes('Frontier', state.frontier.map((entry) => ({
      id: entry.id,
      label: entry.label,
      detail: `d=${entry.depth}, h=${entry.heuristic}, plan=${entry.planLength}`,
    }))));
  }

  if (state.applicableActions.length > 0) {
    panels.push(statePanels.nodes('Applicable Actions', state.applicableActions.map((action) => ({
      id: action.id,
      label: action.label,
      detail: action.detail,
    }))));
  }

  if (state.goalStack.length > 0) {
    panels.push(statePanels.nodes('Goal Stack', state.goalStack.map((entry, index) => ({
      id: `${index}:${entry}`,
      label: entry,
      detail: `slot ${index + 1}`,
    }))));
  }

  if (state.graphLayers.length > 0) {
    panels.push(statePanels.nodes('Graph Layers', graphLayerNodes(state.graphLayers)));
  }

  if (state.extractedPlan.length > 0) {
    panels.push(statePanels.nodes('Extracted Plan', state.extractedPlan.map((actions, index) => ({
      id: `step-${index}`,
      label: `t=${index}`,
      detail: actions.join(' | ') || 'NoOp',
    }))));
  }

  if (state.partialPlan) {
    panels.push(statePanels.nodes('Partial Plan', partialPlanNodes(state.partialPlan)));
    panels.push(statePanels.nodes('Open Flaws', state.partialPlan.openFlaws.map((flaw) => ({
      id: flaw.id,
      label: flaw.label,
      detail: flaw.detail,
    }))));
  }

  if (state.notes.length > 0) {
    panels.push(statePanels.nodes('Notes', state.notes.map((note, index) => ({
      id: `note-${index}`,
      label: note,
    }))));
  }

  return panels;
}

export function planningMetrics(items: Array<[string, number | string]>): MetricTile[] {
  return items.map(([label, value]) => ({
    label,
    value,
    color: label.includes('Solved') ? 'text-[#3FB950]' : 'text-[var(--text)]',
  }));
}

export function buildPlanningResult(
  solved: boolean,
  state: PlanningTraceState,
  visited: number,
  finalState: string[],
  notes: string[] = [],
  horizon?: number,
): PlanningResult {
  return {
    solved,
    plan: state.planSoFar,
    parallelPlan: state.extractedPlan.length > 0 ? state.extractedPlan : undefined,
    visited,
    finalState,
    horizon,
    notes,
  };
}

export function planningLog(message: string, level: 'info' | 'warn' | 'success' | 'error' = 'info') {
  return createLog(message, level);
}
