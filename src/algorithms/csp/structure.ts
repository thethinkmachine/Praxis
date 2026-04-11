import { assignVariable, cloneDomains, constraintsForVariable, domainsFromProblem, domainsToObject, hasSupportForValue, isAssignmentConsistent, isTreeStructured, primalGraph, treeOrder } from '@/problems/csp/core';
import { buildCspPanels, buildCspResult, createCspHighlight, createCspState, cspLog, cspMetrics, displayValue } from './shared';
import type { CspRunner, CspStep } from './types';

function validateCspProblem(problem: Parameters<CspRunner['validate']>[0]) {
  const errors: string[] = [];
  if (!problem || problem.kind !== 'constraint-satisfaction') errors.push('Expected a CSP problem.');
  if (!problem.variables?.length) errors.push('CSP problems need at least one variable.');
  return { valid: errors.length === 0, errors, warnings: [] as string[] };
}

function connectedComponents(graph: Map<string, Set<string>>) {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const node of graph.keys()) {
    if (visited.has(node)) continue;
    const stack = [node];
    const component: string[] = [];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      component.push(current);
      for (const neighbor of graph.get(current) ?? []) {
        if (!visited.has(neighbor)) stack.push(neighbor);
      }
    }

    components.push(component);
  }

  return components;
}

function isForestStructured(problem: Parameters<CspRunner['validate']>[0], omitted: Set<string>) {
  const graph = primalGraph(problem, omitted);
  const nodes = [...graph.keys()];
  if (nodes.length === 0) return true;

  let edgeCount = 0;
  for (const neighbors of graph.values()) edgeCount += neighbors.size;
  edgeCount /= 2;

  const components = connectedComponents(graph);
  return edgeCount === nodes.length - components.length;
}

function solveTreeInstance(
  problem: Parameters<CspRunner['validate']>[0],
  domains: ReturnType<typeof domainsFromProblem>,
  rootId: string,
  omitted: Set<string>,
  steps: CspStep[],
  stepNumberRef: { current: number },
  notes: string[],
) {
  const orderInfo = treeOrder(problem, rootId, omitted);
  const assignment: Record<string, string | number> = {};

  for (const variable of [...orderInfo.order].reverse()) {
    const parent = orderInfo.parent.get(variable);
    if (!parent) continue;
    const constraints = problem.constraints.filter((constraint) => constraint.variables.includes(variable) && constraint.variables.includes(parent));
    const parentDomain = [...(domains.get(parent) ?? [])];
    const removed = parentDomain.filter((value) => constraints.some((constraint) => !hasSupportForValue(constraint, parent, value, domains, assignment)));
    if (removed.length > 0) {
      domains.set(parent, parentDomain.filter((value) => !removed.includes(value)));
      steps.push({
        stepNumber: stepNumberRef.current++,
        phase: 'propagating',
        description: `Tree pass revised ${parent} using child ${variable}.`,
        pseudocodeLine: 1,
        state: createCspState(problem, {
          title: problem.title,
          assignment,
          domains: domainsToObject(domains),
          currentVariable: parent,
          prunedValues: removed.map((value) => ({
            variable: parent,
            value,
            reason: `No tree support in ${variable}`,
          })),
          recursionStack: [...orderInfo.order],
          notes,
        }),
        highlight: createCspHighlight(createCspState(problem, {
          title: problem.title,
          assignment,
          domains: domainsToObject(domains),
          currentVariable: parent,
        })),
        metrics: cspMetrics([
          ['Assigned', Object.keys(assignment).length],
          ['Singletons', Object.values(domainsToObject(domains)).filter((values) => values.length === 1).length],
          ['Prunes', removed.length],
        ]),
        statePanels: buildCspPanels(createCspState(problem, {
          title: problem.title,
          assignment,
          domains: domainsToObject(domains),
          currentVariable: parent,
          prunedValues: removed.map((value) => ({
            variable: parent,
            value,
            reason: `No tree support in ${variable}`,
          })),
          recursionStack: [...orderInfo.order],
          notes,
        })),
        logs: [cspLog(`Tree revise on ${parent} using ${variable}.`, removed.length > 0 ? 'info' : 'warn')],
      });
      if ((domains.get(parent) ?? []).length === 0) {
        return null;
      }
    }
  }

  for (const variable of orderInfo.order) {
    const parent = orderInfo.parent.get(variable);
    const candidates = [...(domains.get(variable) ?? [])];
    const chosen = candidates.find((value) => {
      const nextAssignment = { ...assignment, [variable]: value };
      return isAssignmentConsistent(problem, domains, nextAssignment);
    });
    if (chosen === undefined) {
      return null;
    }
    assignment[variable] = chosen;
    steps.push({
      stepNumber: stepNumberRef.current++,
      phase: 'visiting',
      description: parent
        ? `Assigned ${variable} = ${displayValue(chosen)} consistently with parent ${parent}.`
        : `Assigned root ${variable} = ${displayValue(chosen)}.`,
      pseudocodeLine: 2,
      state: createCspState(problem, {
        title: problem.title,
        assignment,
        domains: domainsToObject(domains),
        currentVariable: variable,
        currentValue: chosen,
        recursionStack: [...orderInfo.order],
        notes,
      }),
      highlight: createCspHighlight(createCspState(problem, {
        title: problem.title,
        assignment,
        domains: domainsToObject(domains),
        currentVariable: variable,
        currentValue: chosen,
      })),
      metrics: cspMetrics([
        ['Assigned', Object.keys(assignment).length],
        ['Unassigned', orderInfo.order.length - Object.keys(assignment).length],
        ['Prunes', 0],
      ]),
      statePanels: buildCspPanels(createCspState(problem, {
        title: problem.title,
        assignment,
        domains: domainsToObject(domains),
        currentVariable: variable,
        currentValue: chosen,
        recursionStack: [...orderInfo.order],
        notes,
      })),
      logs: [cspLog(parent ? `Assigned ${variable} with parent ${parent}.` : `Assigned root ${variable}.`, 'success')],
    });
  }

  return assignment;
}

export const treeCspRunner: CspRunner = {
  meta: {
    id: 'tree-csp',
    name: 'Tree-Structured CSP',
    shortName: 'Tree CSP',
    category: 'constraint-satisfaction',
    description: 'Solves a tree-structured CSP by enforcing parent-child consistency from the leaves upward, then assigning values in a single forward pass.',
    timeComplexity: 'O(n * d^2)',
    spaceComplexity: 'O(n)',
    complete: true,
    optimal: false,
    tags: ['csp', 'tree', 'structure'],
    bookChapter: 'AIMA 4th Ed. § 6.4',
    relatedAlgorithms: ['cutset-conditioning', 'backtracking-search'],
  },
  pseudocode: [
    'function TREE-CSP-SOLVE(csp):',
    '  make every parent-child arc consistent from leaves to root',
    '  assign root, then assign children top-down',
    '  return assignment',
  ],
  validate(problem) {
    const base = validateCspProblem(problem);
    if (!base.valid) return base;
    if (!isTreeStructured(problem)) {
      return {
        valid: false,
        errors: ['Tree-structured solving requires the primal graph to be a tree.'],
      };
    }
    return base;
  },
  getInitialState(problem) {
    return createCspState(problem, {
      title: problem.title,
      domains: domainsToObject(domainsFromProblem(problem)),
    });
  },
  *run(problem) {
    const steps: CspStep[] = [];
    const stepNumberRef = { current: 0 };
    const domains = domainsFromProblem(problem);
    const rootId = problem.rootVariable ?? problem.variables[0]?.id ?? '';
    const assignment = solveTreeInstance(problem, domains, rootId, new Set(), steps, stepNumberRef, [
      'Tree solving exploits the acyclic primal graph directly.',
    ]);

    const finalState = createCspState(problem, {
      title: problem.title,
      assignment: assignment ?? {},
      domains: domainsToObject(domains),
      notes: assignment
        ? ['The tree solver assigned the CSP in one backward-forward sweep.']
        : ['A tree-consistency pass emptied a domain or left no legal value for some node.'],
    });

    steps.push({
      stepNumber: stepNumberRef.current++,
      phase: assignment ? 'found' : 'failed',
      description: assignment
        ? 'Tree-structured solving completed successfully.'
        : 'Tree-structured solving failed to assign every variable.',
      pseudocodeLine: 2,
      state: finalState,
      highlight: createCspHighlight(finalState),
      metrics: cspMetrics([
        ['Assigned', Object.keys(finalState.assignment).length],
        ['Unassigned', problem.variables.length - Object.keys(finalState.assignment).length],
        ['Solved', assignment ? 'Yes' : 'No'],
      ]),
      statePanels: buildCspPanels(finalState),
      logs: [cspLog(
        assignment ? 'Tree-structured solving completed successfully.' : 'Tree-structured solving failed.',
        assignment ? 'success' : 'error',
      )],
    });

    for (const step of steps) {
      yield step;
    }

    return buildCspResult(Boolean(assignment), finalState, steps.length, assignment
      ? ['Tree-structured solving succeeded.']
      : ['Tree-structured solving failed.']);
  },
};

export const cutsetConditioningRunner: CspRunner = {
  meta: {
    id: 'cutset-conditioning',
    name: 'Cutset Conditioning',
    shortName: 'Cutset',
    category: 'constraint-satisfaction',
    description: 'Enumerates assignments to a small cutset until the remaining CSP becomes tree-structured, then solves the residual tree directly.',
    timeComplexity: 'O(d^c * (n-c) * d^2)',
    spaceComplexity: 'O(n)',
    complete: true,
    optimal: false,
    tags: ['csp', 'structure', 'cutset'],
    bookChapter: 'AIMA 4th Ed. § 6.4',
    relatedAlgorithms: ['tree-csp', 'backtracking-search', 'mac'],
  },
  pseudocode: [
    'function CUTSET-CONDITIONING(csp, cutset):',
    '  for each consistent assignment to cutset:',
    '    remove cutset variables and solve the remaining tree',
    '  return first complete assignment',
  ],
  validate(problem) {
    const base = validateCspProblem(problem);
    if (!base.valid) return base;
    const cutset = new Set(problem.cutset ?? []);
    if (cutset.size === 0) {
      return {
        valid: false,
        errors: ['Cutset conditioning needs at least one selected cutset variable.'],
      };
    }
    if (!isForestStructured(problem, cutset)) {
      return {
        valid: false,
        errors: ['The remaining primal graph must be acyclic after removing the chosen cutset.'],
      };
    }
    return base;
  },
  getInitialState(problem) {
    return createCspState(problem, {
      title: problem.title,
      domains: domainsToObject(domainsFromProblem(problem)),
    });
  },
  *run(problem) {
    const steps: CspStep[] = [];
    const stepNumberRef = { current: 0 };
    const domains = domainsFromProblem(problem);
    const cutset = problem.cutset ?? [];
    let visited = 0;

    const condition = (
      index: number,
      currentAssignment: Record<string, string | number>,
    ): Record<string, string | number> | null => {
      if (index >= cutset.length) {
        const conditionedDomains = cloneDomains(domains);
        for (const [variable, value] of Object.entries(currentAssignment)) {
          assignVariable(conditionedDomains, variable, value);
        }
        if (!isAssignmentConsistent(problem, conditionedDomains, currentAssignment)) {
          return null;
        }

        steps.push({
          stepNumber: stepNumberRef.current++,
          phase: 'visiting',
          description: `Conditioned on cutset assignment ${Object.entries(currentAssignment).map(([key, value]) => `${key}=${displayValue(value)}`).join(', ')}.`,
          pseudocodeLine: 1,
          state: createCspState(problem, {
            title: problem.title,
            assignment: currentAssignment,
            domains: domainsToObject(conditionedDomains),
            recursionStack: cutset.map((variable) => `${variable}=${displayValue(currentAssignment[variable])}`),
            notes: ['The remaining network is now tree-structured.'],
          }),
          highlight: createCspHighlight(createCspState(problem, {
            title: problem.title,
            assignment: currentAssignment,
            domains: domainsToObject(conditionedDomains),
          })),
          metrics: cspMetrics([
            ['Assigned', Object.keys(currentAssignment).length],
            ['Cutset Size', cutset.length],
            ['Visited', visited],
          ]),
          statePanels: buildCspPanels(createCspState(problem, {
            title: problem.title,
            assignment: currentAssignment,
            domains: domainsToObject(conditionedDomains),
            recursionStack: cutset.map((variable) => `${variable}=${displayValue(currentAssignment[variable])}`),
            notes: ['The remaining network is now tree-structured.'],
          })),
          logs: [cspLog('Conditioned the CSP on the current cutset assignment.', 'info')],
        });

        const omitted = new Set(cutset);
        const residualGraph = primalGraph(problem, omitted);
        const components = connectedComponents(residualGraph);
        const solvedAssignment = { ...currentAssignment };

        for (const component of components) {
          const componentRoot = component[0];
          const componentOmitted = new Set<string>([
            ...cutset,
            ...[...residualGraph.keys()].filter((node) => !component.includes(node)),
          ]);
          const treeAssignment = solveTreeInstance(problem, conditionedDomains, componentRoot, componentOmitted, steps, stepNumberRef, [
            'Tree solving is applied only after the cutset variables are fixed.',
          ]);
          if (!treeAssignment) return null;
          Object.assign(solvedAssignment, treeAssignment);
        }

        return solvedAssignment;
      }

      const variable = cutset[index];
      for (const value of domains.get(variable) ?? []) {
        visited += 1;
        const nextAssignment = { ...currentAssignment, [variable]: value };
        const localDomains = cloneDomains(domains);
        assignVariable(localDomains, variable, value);
        if (!isAssignmentConsistent(problem, localDomains, nextAssignment)) {
          steps.push({
            stepNumber: stepNumberRef.current++,
            phase: 'pruning',
            description: `Rejected cutset value ${variable} = ${displayValue(value)}.`,
            pseudocodeLine: 0,
            state: createCspState(problem, {
              title: problem.title,
              assignment: nextAssignment,
              domains: domainsToObject(localDomains),
              currentVariable: variable,
              currentValue: value,
              recursionStack: cutset.slice(0, index + 1).map((entry) => `${entry}=${displayValue(nextAssignment[entry])}`),
              notes: ['The partial cutset assignment already violates a constraint.'],
            }),
            highlight: createCspHighlight(createCspState(problem, {
              title: problem.title,
              assignment: nextAssignment,
              domains: domainsToObject(localDomains),
              currentVariable: variable,
              currentValue: value,
            })),
            metrics: cspMetrics([
              ['Assigned', Object.keys(nextAssignment).length],
              ['Cutset Size', cutset.length],
              ['Visited', visited],
            ]),
            statePanels: buildCspPanels(createCspState(problem, {
              title: problem.title,
              assignment: nextAssignment,
              domains: domainsToObject(localDomains),
              currentVariable: variable,
              currentValue: value,
              recursionStack: cutset.slice(0, index + 1).map((entry) => `${entry}=${displayValue(nextAssignment[entry])}`),
              notes: ['The partial cutset assignment already violates a constraint.'],
            })),
            logs: [cspLog('Rejected cutset value.', 'warn')],
          });
          continue;
        }

        const solved = condition(index + 1, nextAssignment);
        if (solved) return solved;
      }

      return null;
    };

    const assignment = condition(0, {});
    const finalState = createCspState(problem, {
      title: problem.title,
      assignment: assignment ?? {},
      domains: domainsToObject(domains),
      notes: assignment
        ? ['Cutset conditioning found a consistent cutset assignment and solved the remaining tree.']
        : ['No cutset assignment led to a solvable residual tree.'],
    });

    steps.push({
      stepNumber: stepNumberRef.current++,
      phase: assignment ? 'found' : 'failed',
      description: assignment
        ? 'Cutset conditioning solved the CSP.'
        : 'Cutset conditioning exhausted the selected cutset assignments.',
      pseudocodeLine: 2,
      state: finalState,
      highlight: createCspHighlight(finalState),
      metrics: cspMetrics([
        ['Assigned', Object.keys(finalState.assignment).length],
        ['Visited', visited],
        ['Solved', assignment ? 'Yes' : 'No'],
      ]),
      statePanels: buildCspPanels(finalState),
      logs: [cspLog(
        assignment ? 'Cutset conditioning solved the CSP.' : 'Cutset conditioning failed.',
        assignment ? 'success' : 'error',
      )],
    });

    for (const step of steps) {
      yield step;
    }

    return buildCspResult(Boolean(assignment), finalState, visited, assignment
      ? ['Cutset conditioning solved the CSP.']
      : ['Cutset conditioning failed to find a solvable cutset assignment.']);
  },
};
