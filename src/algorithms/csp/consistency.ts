import { ac3, binaryConstraints, constraintCanBeSatisfied, domainsFromProblem, domainsToObject, gac, hasSupportForValue } from '@/problems/csp/core';
import { buildCspPanels, buildCspResult, createCspHighlight, createCspState, cspLog, cspMetrics } from './shared';
import type { CspRunner, CspStep } from './types';

function validateCspProblem(problem: Parameters<CspRunner['validate']>[0]) {
  const errors: string[] = [];
  if (!problem || problem.kind !== 'constraint-satisfaction') errors.push('Expected a CSP problem.');
  if (!problem.variables?.length) errors.push('CSP problems need at least one variable.');
  if (!problem.constraints?.length) errors.push('CSP problems need at least one constraint.');
  return { valid: errors.length === 0, errors, warnings: [] as string[] };
}

function singletonAssignment(domains: ReturnType<typeof domainsFromProblem>) {
  const entries = [...domains.entries()];
  if (entries.some(([, values]) => values.length !== 1)) return null;
  return Object.fromEntries(entries.map(([key, values]) => [key, values[0]]));
}

function createConsistencyRunner(
  algorithmId: 'ac-3' | 'gac',
  config: {
    name: string;
    description: string;
    bookChapter: string;
    tags: string[];
    pseudocode: string[];
    inference: 'ac-3' | 'gac';
  },
): CspRunner {
  return {
    meta: {
      id: algorithmId,
      name: config.name,
      shortName: config.name,
      category: 'constraint-satisfaction',
      description: config.description,
      timeComplexity: config.inference === 'ac-3' ? 'O(e * d^3)' : 'Problem-dependent',
      spaceComplexity: 'O(e)',
      complete: false,
      optimal: false,
      tags: config.tags,
      bookChapter: config.bookChapter,
      relatedAlgorithms: config.inference === 'ac-3' ? ['gac', 'mac'] : ['ac-3', 'mac'],
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
      const domains = domainsFromProblem(problem);
      const assignment = {};

      const record = (
        phase: 'initializing' | 'expanding' | 'visiting' | 'found' | 'failed',
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
            ['Singletons', Object.values(state.domains).filter((values) => values.length === 1).length],
            ['Queue Size', state.arcQueue.length],
            ['Prunes', state.prunedValues.length],
          ]),
          statePanels: buildCspPanels(state),
          logs: [cspLog(description, level)],
        });
      };

      record('initializing', `Initialized ${config.name}.`, 0, {
        title: problem.title,
        domains: domainsToObject(domains),
        notes: ['Propagation begins from the current domain store.'],
      });

      const result = config.inference === 'ac-3'
        ? ac3(problem, domains, assignment, problem.queueDiscipline)
        : gac(problem, domains, assignment, problem.queueDiscipline);

      for (const queueEntry of result.queueTrace) {
        record('expanding', `Revised ${queueEntry}.`, 1, {
          title: problem.title,
          domains: domainsToObject(domains),
          arcQueue: [queueEntry],
          prunedValues: result.pruned.filter((entry) => entry.reason.includes(queueEntry.split(':')[0]) || entry.reason.includes(queueEntry.split(' ')[0])),
          notes: ['Inspect the queue and the matching value removals.'],
        });
      }

      const assignmentFromDomains = singletonAssignment(domains);
      const finalState = createCspState(problem, {
        title: problem.title,
        assignment: assignmentFromDomains ?? {},
        domains: domainsToObject(domains),
        arcQueue: [],
        prunedValues: result.pruned,
        notes: result.consistent
          ? ['Propagation reached a fixed point without emptying a domain.']
          : ['A domain became empty during propagation.'],
      });

      steps.push({
        stepNumber: stepNumber++,
        phase: result.consistent ? (assignmentFromDomains ? 'found' : 'visiting') : 'failed',
        description: result.consistent
          ? assignmentFromDomains
            ? `${config.name} reduced every domain to a singleton assignment.`
            : `${config.name} reached arc consistency but did not fully solve the CSP.`
          : `${config.name} detected inconsistency: some domain is empty.`,
        pseudocodeLine: 2,
        state: finalState,
        highlight: createCspHighlight(finalState),
        metrics: cspMetrics([
          ['Assigned', Object.keys(finalState.assignment).length],
          ['Singletons', Object.values(finalState.domains).filter((values) => values.length === 1).length],
          ['Prunes', result.pruned.length],
          ['Solved', assignmentFromDomains ? 'Yes' : result.consistent ? 'Partial' : 'No'],
        ]),
        statePanels: buildCspPanels(finalState),
        logs: [cspLog(
          result.consistent
            ? assignmentFromDomains
              ? `${config.name} solved the CSP by propagation alone.`
              : `${config.name} stopped after reaching consistency.`
            : `${config.name} proved the current domains inconsistent.`,
          result.consistent ? (assignmentFromDomains ? 'success' : 'info') : 'error',
        )],
      });

      for (const step of steps) {
        yield step;
      }

      return buildCspResult(Boolean(result.consistent && assignmentFromDomains), finalState, steps.length, result.consistent
        ? assignmentFromDomains
          ? [`${config.name} solved the CSP by propagation.`]
          : [`${config.name} reached a consistent but partial domain store.`]
        : [`${config.name} found an inconsistency.`]);
    },
  };
}

export const ac3Runner = createConsistencyRunner('ac-3', {
  name: 'AC-3',
  description: 'Processes binary arcs until every remaining value has binary support in its neighboring domains.',
  bookChapter: 'AIMA 4th Ed. § 6.2',
  tags: ['csp', 'propagation', 'binary'],
  pseudocode: [
    'function AC-3(csp):',
    '  queue <- all arcs',
    '  while queue not empty:',
    '    revise an arc and enqueue neighbors when a domain shrinks',
    '  return domains',
  ],
  inference: 'ac-3',
});

export const gacRunner = createConsistencyRunner('gac', {
  name: 'Generalized Arc Consistency',
  description: 'Extends arc consistency to n-ary constraints by removing values that lack support anywhere in the related constraint scope.',
  bookChapter: 'AIMA 4th Ed. § 6.2',
  tags: ['csp', 'propagation', 'n-ary'],
  pseudocode: [
    'function GAC(csp):',
    '  queue <- all (constraint, variable) pairs',
    '  while queue not empty:',
    '    delete unsupported values and re-enqueue affected pairs',
    '  return domains',
  ],
  inference: 'gac',
});
