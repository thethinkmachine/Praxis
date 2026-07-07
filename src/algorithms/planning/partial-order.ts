import { createGroundedProblem } from '@/problems/planning/core';
import { buildPlanningResult, buildPlanningStatePanels, createPlanningHighlight, createPlanningState, planningLog, planningMetrics } from './shared';
import type { PlanningPartialPlanView, PlanningRunner, PlanningStep } from './types';

interface PopAction {
  id: string;
  label: string;
  preconditions: string[];
  addEffects: string[];
  deleteEffects: string[];
  persistent?: boolean;
}

interface CausalLink {
  id: string;
  from: string;
  to: string;
  literal: string;
}

interface OpenConditionFlaw {
  id: string;
  type: 'open-precondition';
  actionId: string;
  literal: string;
}

interface ThreatFlaw {
  id: string;
  type: 'threat';
  actionId: string;
  linkId: string;
  literal: string;
  from: string;
  to: string;
}

type PopFlaw = OpenConditionFlaw | ThreatFlaw;

interface PopPlan {
  actions: PopAction[];
  orderings: Array<[string, string]>;
  causalLinks: CausalLink[];
  openConditions: OpenConditionFlaw[];
}

function validatePlanningProblem(problem: Parameters<PlanningRunner['validate']>[0]) {
  const errors: string[] = [];
  if (!problem || problem.kind !== 'planning') errors.push('Expected a planning problem.');
  if (!problem.initialLiterals?.length) errors.push('Planning problems need an initial literal set.');
  if (!problem.goalLiterals?.length) errors.push('Planning problems need at least one goal literal.');
  return { valid: errors.length === 0, errors, warnings: [] as string[] };
}

function clonePlan(plan: PopPlan): PopPlan {
  return {
    actions: plan.actions.map((action) => ({ ...action, preconditions: [...action.preconditions], addEffects: [...action.addEffects], deleteEffects: [...action.deleteEffects] })),
    orderings: plan.orderings.map(([left, right]) => [left, right]),
    causalLinks: plan.causalLinks.map((link) => ({ ...link })),
    openConditions: plan.openConditions.map((flaw) => ({ ...flaw })),
  };
}

function getAction(plan: PopPlan, actionId: string) {
  return plan.actions.find((action) => action.id === actionId) ?? null;
}

function buildOrderingGraph(plan: PopPlan) {
  const graph = new Map<string, string[]>();
  for (const action of plan.actions) {
    graph.set(action.id, []);
  }
  for (const [before, after] of plan.orderings) {
    graph.get(before)?.push(after);
  }
  return graph;
}

function hasOrdering(plan: PopPlan, before: string, after: string): boolean {
  if (before === after) return true;
  const graph = buildOrderingGraph(plan);
  const stack = [before];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === after) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of graph.get(current) ?? []) {
      stack.push(next);
    }
  }
  return false;
}

function addOrdering(plan: PopPlan, before: string, after: string): boolean {
  if (before === after) return false;
  if (hasOrdering(plan, before, after)) return true;
  if (hasOrdering(plan, after, before)) return false;
  plan.orderings.push([before, after]);
  return true;
}

function computeThreats(plan: PopPlan): ThreatFlaw[] {
  const threats: ThreatFlaw[] = [];
  for (const link of plan.causalLinks) {
    for (const action of plan.actions) {
      if (action.id === link.from || action.id === link.to) continue;
      if (!action.deleteEffects.includes(link.literal)) continue;
      const orderedBeforeSupporter = hasOrdering(plan, action.id, link.from);
      const orderedAfterConsumer = hasOrdering(plan, link.to, action.id);
      if (!orderedBeforeSupporter && !orderedAfterConsumer) {
        threats.push({
          id: `threat:${action.id}:${link.id}`,
          type: 'threat',
          actionId: action.id,
          linkId: link.id,
          literal: link.literal,
          from: link.from,
          to: link.to,
        });
      }
    }
  }
  return threats;
}

function linearizePlan(plan: PopPlan): string[] {
  const inDegree = new Map<string, number>(plan.actions.map((action) => [action.id, 0]));
  const outgoing = new Map<string, string[]>(plan.actions.map((action) => [action.id, []]));
  for (const [before, after] of plan.orderings) {
    outgoing.get(before)?.push(after);
    inDegree.set(after, (inDegree.get(after) ?? 0) + 1);
  }

  const queue = [...plan.actions.map((action) => action.id)].filter((id) => (inDegree.get(id) ?? 0) === 0).sort();
  const ordered: string[] = [];
  while (queue.length > 0) {
    queue.sort();
    const current = queue.shift()!;
    ordered.push(current);
    for (const next of outgoing.get(current) ?? []) {
      inDegree.set(next, (inDegree.get(next) ?? 0) - 1);
      if ((inDegree.get(next) ?? 0) === 0) {
        queue.push(next);
      }
    }
  }

  return ordered
    .map((id) => getAction(plan, id))
    .filter((action): action is PopAction => !!action && action.id !== 'start' && action.id !== 'finish')
    .map((action) => action.label);
}

function serializePartialPlan(plan: PopPlan): PlanningPartialPlanView {
  const threats = computeThreats(plan);
  return {
    actions: plan.actions.map((action) => ({ id: action.id, label: action.label })),
    orderings: plan.orderings.map(([left, right]) => [left, right]),
    causalLinks: plan.causalLinks.map((link) => ({ id: link.id, from: link.from, to: link.to, literal: link.literal })),
    openFlaws: [
      ...plan.openConditions.map((flaw) => ({
        id: flaw.id,
        type: flaw.type,
        label: `${flaw.literal} @ ${flaw.actionId}`,
        detail: 'Open precondition',
      })),
      ...threats.map((threat) => ({
        id: threat.id,
        type: threat.type,
        label: `${threat.literal} threatened by ${threat.actionId}`,
        detail: `${threat.from} -> ${threat.to}`,
      })),
    ],
  };
}

function countAchievers(plan: PopPlan, literal: string, groundedActions: ReturnType<typeof createGroundedProblem>['groundedActions']) {
  const existing = plan.actions.filter((action) => action.addEffects.includes(literal)).length;
  const potential = groundedActions.filter((action) => action.addEffects.includes(literal)).length;
  return existing + potential;
}

function selectFlaw(
  plan: PopPlan,
  groundedActions: ReturnType<typeof createGroundedProblem>['groundedActions'],
  policy: Parameters<typeof createGroundedProblem>[0]['flawSelection'],
): PopFlaw | null {
  const flaws: PopFlaw[] = [...plan.openConditions, ...computeThreats(plan)];
  if (flaws.length === 0) return null;
  if (policy === 'recent') return flaws.at(-1) ?? null;
  if (policy === 'most-constrained') {
    return [...flaws].sort((left, right) => {
      if (left.type === 'open-precondition' && right.type === 'open-precondition') {
        return countAchievers(plan, left.literal, groundedActions) - countAchievers(plan, right.literal, groundedActions);
      }
      if (left.type === 'threat' && right.type !== 'threat') return -1;
      if (left.type !== 'threat' && right.type === 'threat') return 1;
      return left.id.localeCompare(right.id);
    })[0];
  }
  return flaws[0];
}

function removeOpenCondition(plan: PopPlan, flawId: string) {
  plan.openConditions = plan.openConditions.filter((flaw) => flaw.id !== flawId);
}

export const popRunner: PlanningRunner = {
  meta: {
    id: 'pop',
    name: 'Partial-Order Planning',
    shortName: 'POP',
    category: 'planning',
    description: 'Searches in plan space by resolving open preconditions and threats while keeping only the order constraints that are strictly necessary.',
    timeComplexity: 'Problem-dependent',
    spaceComplexity: 'Problem-dependent',
    complete: 'Complete within the search-depth bound',
    optimal: false,
    tags: ['planning', 'partial-order', 'least-commitment'],
    bookChapter: 'AIMA 4th Ed. § 11.5',
    relatedAlgorithms: ['gsp', 'graphplan', 'bssp'],
  },
  pseudocode: [
    'function POP(problem):',
    '  plan <- {Start, Finish, goals on Finish}',
    '  while plan has flaws:',
    '    flaw <- SELECT-FLAW(plan)',
    '    if flaw is open precondition: support it with an action and causal link',
    '    else if flaw is a threat: promote, demote, or separate',
    '  return plan',
  ],
  validate: validatePlanningProblem,
  getInitialState(problem) {
    const prepared = createGroundedProblem(problem);
    return createPlanningState(prepared, {
      mode: 'partial-order',
      currentStateLiterals: prepared.initialLiterals,
      currentGoals: prepared.goalLiterals,
      satisfiedGoals: prepared.goalLiterals.filter((goal) => prepared.initialLiterals.includes(goal)),
      unsatisfiedGoals: prepared.goalLiterals.filter((goal) => !prepared.initialLiterals.includes(goal)),
      partialPlan: {
        actions: [
          { id: 'start', label: 'Start' },
          { id: 'finish', label: 'Finish' },
        ],
        orderings: [['start', 'finish']],
        causalLinks: [],
        openFlaws: prepared.goalLiterals.map((goal) => ({
          id: `open:finish:${goal}`,
          type: 'open-precondition',
          label: `${goal} @ finish`,
          detail: 'Open precondition',
        })),
      },
    });
  },
  *run(problem) {
    const prepared = createGroundedProblem(problem);
    const steps: PlanningStep[] = [];
    let stepNumber = 0;
    let actionSerial = 0;
    const maxDepth = Math.max(6, prepared.expansionDepthCap ?? 8);

    const record = (
      phase: PlanningStep['phase'],
      description: string,
      pseudocodeLine: number,
      plan: PopPlan,
      notes: string[],
      selectedActionId: string | null = null,
      selectedActionLabel: string | null = null,
      level: 'info' | 'warn' | 'success' | 'error' = 'info',
    ) => {
      const partialPlan = serializePartialPlan(plan);
      const trace = createPlanningState(prepared, {
        mode: 'partial-order',
        currentStateLiterals: prepared.initialLiterals,
        currentGoals: prepared.goalLiterals,
        satisfiedGoals: prepared.goalLiterals.filter((goal) => prepared.initialLiterals.includes(goal)),
        unsatisfiedGoals: prepared.goalLiterals.filter((goal) => !prepared.initialLiterals.includes(goal)),
        selectedActionId,
        selectedActionLabel,
        planSoFar: linearizePlan(plan),
        partialPlan,
        notes,
      });

      steps.push({
        stepNumber: stepNumber++,
        phase,
        description,
        pseudocodeLine,
        state: trace,
        highlight: createPlanningHighlight(trace, { focusFlawId: partialPlan.openFlaws[0]?.id ?? null }),
        metrics: planningMetrics([
          ['Actions', partialPlan.actions.length - 2],
          ['Orderings', partialPlan.orderings.length],
          ['Flaws', partialPlan.openFlaws.length],
        ]),
        statePanels: buildPlanningStatePanels(trace),
        logs: [planningLog(description, level)],
      });
    };

    const basePlan: PopPlan = {
      actions: [
        {
          id: 'start',
          label: 'Start',
          preconditions: [],
          addEffects: [...prepared.initialLiterals],
          deleteEffects: [],
        },
        {
          id: 'finish',
          label: 'Finish',
          preconditions: [...prepared.goalLiterals],
          addEffects: [],
          deleteEffects: [],
        },
      ],
      orderings: [['start', 'finish']],
      causalLinks: [],
      openConditions: prepared.goalLiterals.map((literal) => ({
        id: `open:finish:${literal}`,
        type: 'open-precondition',
        actionId: 'finish',
        literal,
      })),
    };

    record('initializing', `Initialized partial-order planning on ${prepared.domainName}.`, 0, basePlan, [
      'POP starts with Start and Finish and resolves flaws in between.',
    ]);

    const search = (plan: PopPlan, depth: number): PopPlan | null => {
      const flaw = selectFlaw(plan, prepared.groundedActions, prepared.flawSelection);
      if (!flaw) return plan;
      if (depth > maxDepth) return null;

      if (flaw.type === 'open-precondition') {
        record('expanding', `Selected open precondition ${flaw.literal} for ${flaw.actionId}.`, 2, plan, [
          'Resolving an open precondition by reusing an action or adding a new one.',
        ]);

        const consumer = getAction(plan, flaw.actionId);
        if (!consumer) return null;

        const supportingActions = plan.actions.filter((action) => action.addEffects.includes(flaw.literal) && action.id !== consumer.id);
        const newTemplates = prepared.groundedActions.filter((action) => action.addEffects.includes(flaw.literal));

        const candidates: PopAction[] = [
          ...supportingActions,
          ...newTemplates.map((action) => ({
            id: `a${actionSerial++}`,
            label: action.label,
            preconditions: [...action.preconditions],
            addEffects: [...action.addEffects],
            deleteEffects: [...action.deleteEffects],
          })),
        ];

        for (const candidate of candidates) {
          const nextPlan = clonePlan(plan);
          const existing = getAction(nextPlan, candidate.id);
          const supporter = existing ?? candidate;
          if (!existing) {
            nextPlan.actions.push(supporter);
            nextPlan.openConditions.push(...supporter.preconditions.map((literal) => ({
              id: `open:${supporter.id}:${literal}`,
              type: 'open-precondition' as const,
              actionId: supporter.id,
              literal,
            })));
            addOrdering(nextPlan, 'start', supporter.id);
            addOrdering(nextPlan, supporter.id, 'finish');
          }

          if (!addOrdering(nextPlan, supporter.id, consumer.id)) {
            continue;
          }

          removeOpenCondition(nextPlan, flaw.id);
          nextPlan.causalLinks.push({
            id: `link:${supporter.id}:${consumer.id}:${flaw.literal}`,
            from: supporter.id,
            to: consumer.id,
            literal: flaw.literal,
          });

          record('visiting', `Linked ${supporter.label} to ${consumer.label} for ${flaw.literal}.`, 3, nextPlan, [
            'Causal links protect why each action appears in the partial plan.',
          ], supporter.id, supporter.label);

          const solved = search(nextPlan, depth + 1);
          if (solved) return solved;
        }

        return null;
      }

      const threatPlan = clonePlan(plan);
      const threateningAction = getAction(threatPlan, flaw.actionId);
      if (!threateningAction) return null;

      record('pruning', `Selected threat flaw on ${flaw.literal} caused by ${threateningAction.label}.`, 4, threatPlan, [
        'Resolving a threat by adding an ordering constraint.',
      ], threateningAction.id, threateningAction.label);

      const resolutions: Array<[string, string, string]> = prepared.threatResolution === 'demotion'
        ? [[flaw.actionId, flaw.from, 'Demoted threat before supporter'], [flaw.to, flaw.actionId, 'Promoted threat after consumer']]
        : prepared.threatResolution === 'separation'
          ? [[flaw.actionId, flaw.from, 'Separated by ordering threat before supporter'], [flaw.to, flaw.actionId, 'Separated by ordering threat after consumer']]
          : [[flaw.to, flaw.actionId, 'Promoted threat after consumer'], [flaw.actionId, flaw.from, 'Demoted threat before supporter']];

      for (const [before, after, note] of resolutions) {
        const nextPlan = clonePlan(plan);
        if (!addOrdering(nextPlan, before, after)) continue;
        record('backtracking', `${note}.`, 5, nextPlan, [note], threateningAction.id, threateningAction.label);
        const solved = search(nextPlan, depth + 1);
        if (solved) return solved;
      }

      return null;
    };

    const solvedPlan = search(basePlan, 0);

    if (solvedPlan) {
      record('found', `Resolved every flaw and produced a partial-order plan with ${linearizePlan(solvedPlan).length} action(s).`, 6, solvedPlan, [
        'All open preconditions and threats have been discharged.',
      ], null, null, 'success');

      for (const step of steps) {
        yield step;
      }

      const finalTrace = steps.at(-1)?.state ?? createPlanningState(prepared, {
        mode: 'partial-order',
        currentStateLiterals: prepared.initialLiterals,
        currentGoals: prepared.goalLiterals,
      });
      return buildPlanningResult(true, finalTrace, steps.length, prepared.initialLiterals, ['POP resolved every flaw in the partial plan.']);
    }

    record('failed', 'Partial-order planning exhausted the search without resolving every flaw.', 6, basePlan, [
      'No threat resolution / open-precondition support sequence succeeded within the depth cap.',
    ], null, null, 'error');

    for (const step of steps) {
      yield step;
    }

    const finalTrace = steps.at(-1)?.state ?? createPlanningState(prepared, {
      mode: 'partial-order',
      currentStateLiterals: prepared.initialLiterals,
      currentGoals: prepared.goalLiterals,
    });
    return buildPlanningResult(false, finalTrace, steps.length, prepared.initialLiterals, ['POP did not resolve every flaw within the depth cap.']);
  },
};
