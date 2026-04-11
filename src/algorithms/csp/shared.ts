import { createLog, statePanels } from '@/algorithms/core/utils';
import type { MetricTile, PanelSection } from '@/types';
import type { CspProblem, CspValue } from '@/types/problem';
import type { CspResult, CspTraceHighlight, CspTraceState } from './types';

export function createCspState(
  problem: CspProblem,
  patch: Partial<CspTraceState>,
): CspTraceState {
  return {
    title: problem.title,
    assignment: {},
    domains: Object.fromEntries(problem.variables.map((variable) => [variable.id, [...variable.domain]])),
    currentVariable: null,
    currentValue: null,
    orderedValues: [],
    arcQueue: [],
    selectedConstraintId: null,
    prunedValues: [],
    violatedConstraints: [],
    recursionStack: [],
    notes: [],
    ...patch,
  };
}

export function createCspHighlight(
  state: CspTraceState,
  patch: Partial<CspTraceHighlight> = {},
): CspTraceHighlight {
  return {
    currentVariable: state.currentVariable,
    focusVariables: state.currentVariable ? [state.currentVariable] : [],
    prunedKeys: state.prunedValues.map((entry) => `${entry.variable}:${entry.value}`),
    ...patch,
  };
}

export function buildCspPanels(state: CspTraceState): PanelSection[] {
  const panels: PanelSection[] = [
    statePanels.keyValue('Assignment', Object.entries(state.assignment).map(([key, value]) => ({
      key,
      value: String(value),
    }))),
    statePanels.keyValue('Domains', Object.entries(state.domains).map(([key, values]) => ({
      key,
      value: `[${values.join(', ')}]`,
    }))),
  ];

  if (state.orderedValues.length > 0) {
    panels.push(statePanels.chips('Ordered Values', state.orderedValues.map((entry) => ({
      id: String(entry.value),
      label: String(entry.value),
      detail: entry.score === undefined ? undefined : `score=${entry.score}`,
      variant: 'frontier',
    }))));
  }

  if (state.arcQueue.length > 0) {
    panels.push(statePanels.nodes('Arc Queue', state.arcQueue.map((entry, index) => ({
      id: `${index}:${entry}`,
      label: entry,
    }))));
  }

  if (state.prunedValues.length > 0) {
    panels.push(statePanels.nodes('Pruned Values', state.prunedValues.map((entry, index) => ({
      id: `${entry.variable}:${entry.value}:${index}`,
      label: `${entry.variable} != ${entry.value}`,
      detail: entry.reason,
    }))));
  }

  if (state.violatedConstraints.length > 0) {
    panels.push(statePanels.chips('Violated Constraints', state.violatedConstraints.map((constraint) => ({
      id: constraint,
      label: constraint,
      variant: 'path',
    }))));
  }

  if (state.recursionStack.length > 0) {
    panels.push(statePanels.nodes('Recursion Stack', state.recursionStack.map((entry, index) => ({
      id: `${index}:${entry}`,
      label: entry,
    }))));
  }

  if (state.notes.length > 0) {
    panels.push(statePanels.nodes('Notes', state.notes.map((entry, index) => ({
      id: `note-${index}`,
      label: entry,
    }))));
  }

  return panels;
}

export function cspMetrics(items: Array<[string, number | string]>): MetricTile[] {
  return items.map(([label, value]) => ({
    label,
    value,
    color: label.includes('Solved') ? 'text-[#3FB950]' : 'text-[var(--text)]',
  }));
}

export function cspLog(message: string, level: 'info' | 'warn' | 'success' | 'error' = 'info') {
  return createLog(message, level);
}

export function buildCspResult(
  solved: boolean,
  state: CspTraceState,
  visited: number,
  notes: string[],
): CspResult {
  return {
    solved,
    assignment: state.assignment,
    visited,
    notes,
  };
}

export function displayValue(value: CspValue) {
  return String(value);
}
