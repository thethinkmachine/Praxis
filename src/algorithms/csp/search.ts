import { assignVariable, cloneDomains, constraintCanBeSatisfied, constraintsForVariable, domainsFromProblem, domainsToObject, gac, isAssignmentConsistent, orderValues, selectUnassignedVariable, unassignedCount, hasSupportForValue } from '@/problems/csp/core';
import { buildCspPanels, buildCspResult, createCspHighlight, createCspState, cspLog, cspMetrics, displayValue } from './shared';
import type { CspRunner, CspStep } from './types';

function validateCspProblem(problem: Parameters<CspRunner['validate']>[0]) {
  const errors: string[] = [];
  if (!problem || problem.kind !== 'constraint-satisfaction') errors.push('Expected a CSP problem.');
  if (!problem.variables?.length) errors.push('CSP problems need at least one variable.');
  if (!problem.constraints?.length) errors.push('CSP problems need at least one constraint.');
  return { valid: errors.length === 0, errors, warnings: [] as string[] };
}

function violatedConstraintIds(problem: Parameters<CspRunner['validate']>[0], domains: ReturnType<typeof domainsFromProblem>, assignment: Record<string, string | number>) {
  return problem.constraints
    .filter((constraint) => !constraintCanBeSatisfied(constraint, domains, assignment))
    .map((constraint) => constraint.id);
}

function forwardCheck(
  problem: Parameters<CspRunner['validate']>[0],
  domains: ReturnType<typeof domainsFromProblem>,
  assignment: Record<string, string | number>,
  variableId: string,
) {
  const pruned: Array<{ variable: string; value: string | number; reason: string }> = [];
  const queueTrace: string[] = [];

  for (const constraint of constraintsForVariable(problem, variableId)) {
    for (const neighbor of constraint.variables) {
      if (neighbor === variableId || assignment[neighbor] !== undefined) continue;
      queueTrace.push(`${constraint.id}:${neighbor}`);
      const domain = [...(domains.get(neighbor) ?? [])];
      const removed = domain.filter((candidate) => !hasSupportForValue(constraint, neighbor, candidate, domains, assignment));
      if (removed.length > 0) {
        pruned.push(...removed.map((candidate) => ({
          variable: neighbor,
          value: candidate,
          reason: `Forward checking removed unsupported value for ${constraint.id}`,
        })));
        domains.set(neighbor, domain.filter((candidate) => !removed.includes(candidate)));
      }
      if ((domains.get(neighbor) ?? []).length === 0) {
        return { consistent: false, pruned, queueTrace };
      }
    }
  }

  return { consistent: true, pruned, queueTrace };
}

function createSearchRunner(
  algorithmId: 'backtracking-search' | 'forward-checking' | 'mac',
  config: {
    name: string;
    shortName?: string;
    description: string;
    tags: string[];
    bookChapter: string;
    pseudocode: string[];
    inference: 'none' | 'forward-checking' | 'mac';
  },
): CspRunner {
  return {
    meta: {
      id: algorithmId,
      name: config.name,
      shortName: config.shortName ?? config.name,
      category: 'constraint-satisfaction',
      description: config.description,
      timeComplexity: 'Exponential in worst case',
      spaceComplexity: 'O(n + d)',
      complete: true,
      optimal: false,
      tags: config.tags,
      bookChapter: config.bookChapter,
      relatedAlgorithms: config.inference === 'none'
        ? ['forward-checking', 'mac']
        : config.inference === 'forward-checking'
          ? ['backtracking-search', 'mac']
          : ['backtracking-search', 'ac-3', 'gac', 'min-conflicts'],
    },
    pseudocode: config.pseudocode,
    validate: validateCspProblem,
    getInitialState(problem) {
      return createCspState(problem, {
        title: problem.title,
        domains: domainsToObject(domainsFromProblem(problem)),
      });
    },
    *run(problem) {
      const steps: CspStep[] = [];
      let stepNumber = 0;
      let visited = 0;
      let backtracks = 0;

      const record = (
        phase: CspStep['phase'],
        description: string,
        pseudocodeLine: number,
        statePatch: Partial<ReturnType<typeof createCspState>>,
        level: 'info' | 'warn' | 'success' | 'error' = 'info',
      ) => {
        const state = createCspState(problem, statePatch);
        steps.push({
          stepNumber: stepNumber++,
          phase,
          description,
          pseudocodeLine,
          state,
          highlight: createCspHighlight(state),
          metrics: cspMetrics([
            ['Assigned', Object.keys(state.assignment).length],
            ['Unassigned', unassignedCount(problem, state.assignment)],
            ['Backtracks', backtracks],
            ['Prunes', state.prunedValues.length],
          ]),
          statePanels: buildCspPanels(state),
          logs: [cspLog(description, level)],
        });
      };

      const search = (
        domains: ReturnType<typeof domainsFromProblem>,
        assignment: Record<string, string | number>,
        stack: string[],
      ): Record<string, string | number> | null => {
        if (Object.keys(assignment).length === problem.variables.length) {
          return assignment;
        }

        const variableId = selectUnassignedVariable(problem, domains, assignment, problem.variableOrdering);
        if (!variableId) return assignment;
        const values = orderValues(problem, variableId, domains, assignment, problem.valueOrdering);
        visited += 1;

        record('expanding', `Selected variable ${variableId}.`, 1, {
          title: problem.title,
          assignment,
          domains: domainsToObject(domains),
          currentVariable: variableId,
          orderedValues: values.map((value) => ({ value })),
          violatedConstraints: violatedConstraintIds(problem, domains, assignment),
          recursionStack: stack,
          notes: [`Using ${problem.variableOrdering ?? 'input'} ordering and ${problem.valueOrdering ?? 'input'} value ordering.`],
        });

        for (const value of values) {
          const nextDomains = cloneDomains(domains);
          const nextAssignment = { ...assignment, [variableId]: value };
          assignVariable(nextDomains, variableId, value);

          if (!isAssignmentConsistent(problem, nextDomains, nextAssignment)) {
            backtracks += 1;
            record('pruning', `Rejected ${variableId} = ${displayValue(value)} immediately.`, 2, {
              title: problem.title,
              assignment: nextAssignment,
              domains: domainsToObject(nextDomains),
              currentVariable: variableId,
              currentValue: value,
              violatedConstraints: violatedConstraintIds(problem, nextDomains, nextAssignment),
              recursionStack: [...stack, `${variableId}=${displayValue(value)}`],
              notes: ['The partial assignment already violates a constraint.'],
            }, 'warn');
            continue;
          }

          let inferenceResult = { consistent: true, pruned: [] as Array<{ variable: string; value: string | number; reason: string }>, queueTrace: [] as string[] };
          if (config.inference === 'forward-checking') {
            inferenceResult = forwardCheck(problem, nextDomains, nextAssignment, variableId);
          } else if (config.inference === 'mac') {
            inferenceResult = gac(problem, nextDomains, nextAssignment, problem.queueDiscipline);
          }

          record('visiting', `Assigned ${variableId} = ${displayValue(value)}.`, 3, {
            title: problem.title,
            assignment: nextAssignment,
            domains: domainsToObject(nextDomains),
            currentVariable: variableId,
            currentValue: value,
            orderedValues: values.map((entry) => ({ value: entry })),
            arcQueue: inferenceResult.queueTrace,
            prunedValues: inferenceResult.pruned,
            violatedConstraints: violatedConstraintIds(problem, nextDomains, nextAssignment),
            recursionStack: [...stack, `${variableId}=${displayValue(value)}`],
            notes: [
              config.inference === 'none'
                ? 'Pure backtracking: no look-ahead pruning beyond consistency checks.'
                : config.inference === 'forward-checking'
                  ? 'Forward checking pruned the neighbors touched by the new assignment.'
                  : 'MAC maintained arc consistency after the new assignment.',
            ],
          }, inferenceResult.consistent ? 'info' : 'warn');

          if (!inferenceResult.consistent) {
            backtracks += 1;
            continue;
          }

          const result = search(nextDomains, nextAssignment, [...stack, `${variableId}=${displayValue(value)}`]);
          if (result) return result;

          backtracks += 1;
          record('backtracking', `Backtracked from ${variableId} = ${displayValue(value)}.`, 4, {
            title: problem.title,
            assignment,
            domains: domainsToObject(domains),
            currentVariable: variableId,
            currentValue: value,
            violatedConstraints: [],
            recursionStack: stack,
            notes: ['Search returned from a dead end.'],
          }, 'warn');
        }

        return null;
      };

      const initialDomains = domainsFromProblem(problem);
      const initialAssignment: Record<string, string | number> = {};
      record('initializing', `Initialized ${config.name}.`, 0, {
        title: problem.title,
        assignment: initialAssignment,
        domains: domainsToObject(initialDomains),
        notes: ['CSP search begins from the unassigned network.'],
      });

      const result = search(initialDomains, initialAssignment, []);
      if (result) {
        const solvedState = createCspState(problem, {
          title: problem.title,
          assignment: result,
          domains: Object.fromEntries(Object.entries(result).map(([key, value]) => [key, [value]])),
          notes: ['Every variable is assigned without violating any constraint.'],
        });
        steps.push({
          stepNumber: stepNumber++,
          phase: 'found',
          description: `${config.name} found a complete assignment.`,
          pseudocodeLine: 5,
          state: solvedState,
          highlight: createCspHighlight(solvedState),
          metrics: cspMetrics([
            ['Assigned', Object.keys(result).length],
            ['Unassigned', 0],
            ['Backtracks', backtracks],
            ['Solved', 'Yes'],
          ]),
          statePanels: buildCspPanels(solvedState),
          logs: [cspLog(`${config.name} found a complete assignment.`, 'success')],
        });
      } else {
        const failedState = createCspState(problem, {
          title: problem.title,
          assignment: {},
          domains: domainsToObject(initialDomains),
          notes: ['The search explored every branch without finding a complete assignment.'],
        });
        steps.push({
          stepNumber: stepNumber++,
          phase: 'failed',
          description: `${config.name} exhausted the search without solving the CSP.`,
          pseudocodeLine: 6,
          state: failedState,
          highlight: createCspHighlight(failedState),
          metrics: cspMetrics([
            ['Assigned', 0],
            ['Unassigned', problem.variables.length],
            ['Backtracks', backtracks],
            ['Solved', 'No'],
          ]),
          statePanels: buildCspPanels(failedState),
          logs: [cspLog(`${config.name} exhausted the search without solving the CSP.`, 'error')],
        });
      }

      for (const step of steps) {
        yield step;
      }

      const finalState = steps.at(-1)?.state ?? createCspState(problem, { title: problem.title });
      return buildCspResult(Boolean(result), finalState, visited, result
        ? [`${config.name} solved the CSP.`]
        : [`${config.name} did not find a complete assignment.`]);
    },
  };
}

export const backtrackingSearchRunner = createSearchRunner('backtracking-search', {
  name: 'Backtracking Search',
  description: 'Assigns variables recursively and backtracks whenever the partial assignment can no longer satisfy the remaining constraints.',
  tags: ['csp', 'search', 'backtracking'],
  bookChapter: 'AIMA 4th Ed. § 6.3',
  pseudocode: [
    'function BACKTRACKING-SEARCH(csp):',
    '  var <- SELECT-UNASSIGNED-VARIABLE(csp)',
    '  for each value in ORDER-DOMAIN-VALUES(var):',
    '    if value is consistent: assign and recurse',
    '  return failure',
  ],
  inference: 'none',
});

export const forwardCheckingRunner = createSearchRunner('forward-checking', {
  name: 'Forward Checking',
  description: 'Runs backtracking search while pruning neighbor domains immediately after each assignment.',
  tags: ['csp', 'search', 'forward-checking'],
  bookChapter: 'AIMA 4th Ed. § 6.3',
  pseudocode: [
    'function FORWARD-CHECKING(csp):',
    '  var <- SELECT-UNASSIGNED-VARIABLE(csp)',
    '  for each value in ORDER-DOMAIN-VALUES(var):',
    '    assign value and prune neighbors',
    '    if no domain is empty: recurse',
    '  return failure',
  ],
  inference: 'forward-checking',
});

export const macRunner = createSearchRunner('mac', {
  name: 'Maintaining Arc Consistency',
  shortName: 'MAC',
  description: 'Runs backtracking search while re-establishing generalized arc consistency after every assignment.',
  tags: ['csp', 'search', 'mac', 'propagation'],
  bookChapter: 'AIMA 4th Ed. § 6.3',
  pseudocode: [
    'function MAC(csp):',
    '  var <- SELECT-UNASSIGNED-VARIABLE(csp)',
    '  for each value in ORDER-DOMAIN-VALUES(var):',
    '    assign value and enforce arc consistency',
    '    if all domains remain non-empty: recurse',
    '  return failure',
  ],
  inference: 'mac',
});
