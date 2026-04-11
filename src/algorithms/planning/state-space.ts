import { createPlanningHighlight, createPlanningState, planningLog, planningMetrics, buildPlanningResult, buildPlanningStatePanels } from './shared';
import type { PlanningRunner } from './types';
import { applyAction, createGroundedProblem, estimateHeuristic, getApplicableActions, isGoalSatisfied, orderActions, orderGoals, regressGoals, stateKey, summarizeAction } from '@/problems/planning/core';

interface ForwardNode {
  id: string;
  state: string[];
  plan: string[];
  depth: number;
  heuristic: number;
  order: number;
}

interface BackwardNode {
  id: string;
  goals: string[];
  plan: string[];
  depth: number;
  heuristic: number;
  order: number;
}

function validatePlanningProblem(problem: Parameters<PlanningRunner['validate']>[0]) {
  const errors: string[] = [];
  if (!problem || problem.kind !== 'planning') {
    errors.push('Expected a planning problem.');
  }
  if (!problem.initialLiterals?.length) {
    errors.push('Planning problems need an initial literal set.');
  }
  if (!problem.goalLiterals?.length) {
    errors.push('Planning problems need at least one goal literal.');
  }
  return { valid: errors.length === 0, errors, warnings: [] as string[] };
}

function compareNodes<T extends { heuristic: number; depth: number; order: number; id: string }>(
  left: T,
  right: T,
  tieBreaker: 'fifo' | 'lifo' | 'lexicographic' = 'fifo',
): number {
  const score = (left.depth + left.heuristic) - (right.depth + right.heuristic);
  if (score !== 0) return score;
  if (tieBreaker === 'lexicographic') return left.id.localeCompare(right.id);
  return tieBreaker === 'lifo' ? right.order - left.order : left.order - right.order;
}

function frontierPreview(frontier: Array<ForwardNode | BackwardNode>) {
  return frontier.map((node) => ({
    id: node.id,
    label: node.id,
    depth: node.depth,
    heuristic: node.heuristic,
    planLength: node.plan.length,
  }));
}

export const fsspRunner: PlanningRunner = {
  meta: {
    id: 'fssp',
    name: 'Forward State-Space Planning',
    shortName: 'FSSP',
    category: 'planning',
    description: 'Searches forward from the initial state by applying grounded STRIPS actions until the goal literals are satisfied.',
    timeComplexity: 'O(b^d)',
    spaceComplexity: 'O(b^d)',
    complete: true,
    optimal: 'Only with uniform step costs and breadth-first expansion',
    tags: ['planning', 'state-space', 'progression'],
    bookChapter: 'AIMA 4th Ed. § 11.2',
    relatedAlgorithms: ['bssp', 'gsp', 'graphplan'],
  },
  pseudocode: [
    'function FSSP(problem):',
    '  frontier <- {initial state}',
    '  explored <- {}',
    '  while frontier not empty:',
    '    node <- best(frontier)',
    '    if node satisfies goals: return plan(node)',
    '    for each applicable action:',
    '      child <- APPLY(action, node.state)',
    '      add child to frontier if new',
    '  return failure',
  ],
  validate: validatePlanningProblem,
  getInitialState(problem) {
    const prepared = createGroundedProblem(problem);
    return createPlanningState(prepared, {
      mode: 'state-space',
      currentStateLiterals: prepared.initialLiterals,
      currentGoals: prepared.goalLiterals,
      satisfiedGoals: prepared.goalLiterals.filter((goal) => prepared.initialLiterals.includes(goal)),
      unsatisfiedGoals: prepared.goalLiterals.filter((goal) => !prepared.initialLiterals.includes(goal)),
    });
  },
  *run(problem) {
    const prepared = createGroundedProblem(problem);
    const initialState = prepared.initialLiterals;
    const initialGoals = orderGoals(prepared.goalLiterals, prepared.goalOrdering);
    let nextOrder = 0;
    const frontier: ForwardNode[] = [{
      id: stateKey(initialState),
      state: initialState,
      plan: [],
      depth: 0,
      heuristic: estimateHeuristic(initialState, initialGoals, prepared.groundedActions, prepared.heuristic),
      order: nextOrder++,
    }];
    const seen = new Set<string>(prepared.duplicateDetection ? [frontier[0].id] : []);
    const explored = new Set<string>();
    let visited = 0;
    let stepNumber = 0;

    const initialTrace = createPlanningState(prepared, {
      mode: 'state-space',
      currentStateLiterals: initialState,
      currentGoals: initialGoals,
      satisfiedGoals: initialGoals.filter((goal) => initialState.includes(goal)),
      unsatisfiedGoals: initialGoals.filter((goal) => !initialState.includes(goal)),
      frontier: frontierPreview(frontier),
      exploredKeys: [],
      applicableActions: getApplicableActions(initialState, prepared.groundedActions).map((action) => ({
        id: action.id,
        label: action.label,
        detail: summarizeAction(action),
      })),
      notes: ['Progression planning expands explicit world states.'],
    });

    yield {
      stepNumber: stepNumber++,
      phase: 'initializing',
      description: `Initialized forward state-space planning on ${prepared.domainName}.`,
      pseudocodeLine: 1,
      state: initialTrace,
      highlight: createPlanningHighlight(initialTrace),
      metrics: planningMetrics([
        ['Expanded', 0],
        ['Frontier', frontier.length],
        ['Plan Length', 0],
        ['Unsatisfied', initialTrace.unsatisfiedGoals.length],
      ]),
      statePanels: buildPlanningStatePanels(initialTrace),
      logs: [planningLog(`Loaded ${prepared.groundedActions.length} grounded operators.`, 'info')],
    };

    while (frontier.length > 0) {
      frontier.sort((left, right) => compareNodes(left, right, prepared.tieBreaker));
      const current = frontier.shift()!;
      visited += 1;
      explored.add(current.id);

      const applicable = orderActions(
        getApplicableActions(current.state, prepared.groundedActions),
        initialGoals.filter((goal) => !current.state.includes(goal)),
        prepared.branchOrder,
      );
      const trace = createPlanningState(prepared, {
        mode: 'state-space',
        currentStateLiterals: current.state,
        currentGoals: initialGoals,
        satisfiedGoals: initialGoals.filter((goal) => current.state.includes(goal)),
        unsatisfiedGoals: initialGoals.filter((goal) => !current.state.includes(goal)),
        frontier: frontierPreview(frontier),
        exploredKeys: [...explored],
        applicableActions: applicable.map((action) => ({
          id: action.id,
          label: action.label,
          detail: summarizeAction(action),
        })),
        planSoFar: current.plan,
        notes: [`f = g + h = ${current.depth} + ${current.heuristic}`],
      });

      yield {
        stepNumber: stepNumber++,
        phase: 'expanding',
        description: `Expanding a forward search state with ${trace.unsatisfiedGoals.length} unsatisfied goal literal(s).`,
        pseudocodeLine: 4,
        state: trace,
        highlight: createPlanningHighlight(trace),
        metrics: planningMetrics([
          ['Expanded', visited],
          ['Frontier', frontier.length],
          ['Plan Length', current.plan.length],
          ['Unsatisfied', trace.unsatisfiedGoals.length],
        ]),
        statePanels: buildPlanningStatePanels(trace),
        logs: [planningLog(`Selected state ${current.id}.`, 'info')],
      };

      if (isGoalSatisfied(current.state, initialGoals)) {
        const finalTrace = createPlanningState(prepared, {
          ...trace,
          notes: ['All goal literals are satisfied in the current state.'],
        });

        yield {
          stepNumber: stepNumber++,
          phase: 'found',
          description: `Found a valid forward plan with ${current.plan.length} action(s).`,
          pseudocodeLine: 5,
          state: finalTrace,
          highlight: createPlanningHighlight(finalTrace),
          metrics: planningMetrics([
            ['Expanded', visited],
            ['Frontier', frontier.length],
            ['Plan Length', current.plan.length],
            ['Solved', 'Yes'],
          ]),
          statePanels: buildPlanningStatePanels(finalTrace),
          logs: [planningLog('Forward state-space planning reached the goal.', 'success')],
        };
        return buildPlanningResult(true, finalTrace, visited, current.state, ['FSSP found a satisfying action sequence.']);
      }

      for (const action of applicable) {
        const childState = applyAction(current.state, action);
        const childId = stateKey(childState);
        if (prepared.duplicateDetection && (seen.has(childId) || explored.has(childId))) {
          continue;
        }
        if (prepared.duplicateDetection) {
          seen.add(childId);
        }

        const child: ForwardNode = {
          id: childId,
          state: childState,
          plan: [...current.plan, action.label],
          depth: current.depth + 1,
          heuristic: estimateHeuristic(childState, initialGoals, prepared.groundedActions, prepared.heuristic),
          order: nextOrder++,
        };
        frontier.push(child);

        const childTrace = createPlanningState(prepared, {
          mode: 'state-space',
          currentStateLiterals: childState,
          currentGoals: initialGoals,
          satisfiedGoals: initialGoals.filter((goal) => childState.includes(goal)),
          unsatisfiedGoals: initialGoals.filter((goal) => !childState.includes(goal)),
          frontier: frontierPreview(frontier),
          exploredKeys: [...explored],
          applicableActions: [],
          selectedActionId: action.id,
          selectedActionLabel: action.label,
          planSoFar: child.plan,
          notes: [`Applied ${action.label}.`],
        });

        yield {
          stepNumber: stepNumber++,
          phase: 'visiting',
          description: `Applied ${action.label} and generated a successor state.`,
          pseudocodeLine: 7,
          state: childTrace,
          highlight: createPlanningHighlight(childTrace),
          metrics: planningMetrics([
            ['Expanded', visited],
            ['Frontier', frontier.length],
            ['Plan Length', child.plan.length],
            ['Unsatisfied', childTrace.unsatisfiedGoals.length],
          ]),
          statePanels: buildPlanningStatePanels(childTrace),
          logs: [planningLog(`Generated successor via ${action.label}.`, 'info')],
        };
      }
    }

    const failedTrace = createPlanningState(prepared, {
      mode: 'state-space',
      currentStateLiterals: initialState,
      currentGoals: initialGoals,
      satisfiedGoals: [],
      unsatisfiedGoals: initialGoals,
      frontier: [],
      exploredKeys: [...explored],
      notes: ['The frontier emptied before reaching a goal state.'],
    });

    yield {
      stepNumber: stepNumber++,
      phase: 'failed',
      description: 'Forward state-space planning exhausted the frontier without finding a plan.',
      pseudocodeLine: 8,
      state: failedTrace,
      highlight: createPlanningHighlight(failedTrace),
      metrics: planningMetrics([
        ['Expanded', visited],
        ['Frontier', 0],
        ['Plan Length', 0],
        ['Solved', 'No'],
      ]),
      statePanels: buildPlanningStatePanels(failedTrace),
      logs: [planningLog('FSSP failed to find a satisfying state.', 'error')],
    };
    return buildPlanningResult(false, failedTrace, visited, initialState, ['No forward plan was found.']);
  },
};

export const bsspRunner: PlanningRunner = {
  meta: {
    id: 'bssp',
    name: 'Backward State-Space Planning',
    shortName: 'BSSP',
    category: 'planning',
    description: 'Searches backward by regressing the goal set through relevant actions until every remaining subgoal is already true in the initial state.',
    timeComplexity: 'O(b^d)',
    spaceComplexity: 'O(b^d)',
    complete: true,
    optimal: 'Only with uniform step costs and breadth-first expansion',
    tags: ['planning', 'state-space', 'regression'],
    bookChapter: 'AIMA 4th Ed. § 11.2',
    relatedAlgorithms: ['fssp', 'gsp', 'pop'],
  },
  pseudocode: [
    'function BSSP(problem):',
    '  frontier <- {goal set}',
    '  while frontier not empty:',
    '    node <- best(frontier)',
    '    if node.goals subset initial state: return reverse(plan(node))',
    '    for each relevant action:',
    '      child.goals <- REGRESS(node.goals, action)',
    '      add child to frontier if new',
    '  return failure',
  ],
  validate: validatePlanningProblem,
  getInitialState(problem) {
    const prepared = createGroundedProblem(problem);
    return createPlanningState(prepared, {
      mode: 'state-space',
      currentStateLiterals: prepared.initialLiterals,
      currentGoals: prepared.goalLiterals,
      satisfiedGoals: [],
      unsatisfiedGoals: prepared.goalLiterals,
      notes: ['Regression search nodes are goal sets rather than explicit world states.'],
    });
  },
  *run(problem) {
    const prepared = createGroundedProblem(problem);
    const initialState = prepared.initialLiterals;
    const orderedGoals = orderGoals(prepared.goalLiterals, prepared.goalOrdering);
    let nextOrder = 0;
    const frontier: BackwardNode[] = [{
      id: stateKey(orderedGoals),
      goals: orderedGoals,
      plan: [],
      depth: 0,
      heuristic: estimateHeuristic(initialState, orderedGoals, prepared.groundedActions, prepared.heuristic),
      order: nextOrder++,
    }];
    const seen = new Set<string>(prepared.duplicateDetection ? [frontier[0].id] : []);
    const explored = new Set<string>();
    let visited = 0;
    let stepNumber = 0;

    const initialTrace = createPlanningState(prepared, {
      mode: 'state-space',
      currentStateLiterals: initialState,
      currentGoals: orderedGoals,
      satisfiedGoals: orderedGoals.filter((goal) => initialState.includes(goal)),
      unsatisfiedGoals: orderedGoals.filter((goal) => !initialState.includes(goal)),
      frontier: frontierPreview(frontier),
      exploredKeys: [],
      applicableActions: [],
      notes: ['Regression planning starts from the goal set and rewrites it backwards.'],
    });

    yield {
      stepNumber: stepNumber++,
      phase: 'initializing',
      description: `Initialized backward state-space planning on ${prepared.domainName}.`,
      pseudocodeLine: 1,
      state: initialTrace,
      highlight: createPlanningHighlight(initialTrace),
      metrics: planningMetrics([
        ['Expanded', 0],
        ['Frontier', frontier.length],
        ['Plan Length', 0],
        ['Open Goals', orderedGoals.length],
      ]),
      statePanels: buildPlanningStatePanels(initialTrace),
      logs: [planningLog('Regression frontier seeded with the goal set.', 'info')],
    };

    while (frontier.length > 0) {
      frontier.sort((left, right) => compareNodes(left, right, prepared.tieBreaker));
      const current = frontier.shift()!;
      visited += 1;
      explored.add(current.id);

      const relevantActions = orderActions(
        prepared.groundedActions.filter((action) => regressGoals(current.goals, action) !== null),
        current.goals,
        prepared.branchOrder,
      );
      const trace = createPlanningState(prepared, {
        mode: 'state-space',
        currentStateLiterals: initialState,
        currentGoals: current.goals,
        satisfiedGoals: current.goals.filter((goal) => initialState.includes(goal)),
        unsatisfiedGoals: current.goals.filter((goal) => !initialState.includes(goal)),
        frontier: frontierPreview(frontier),
        exploredKeys: [...explored],
        applicableActions: relevantActions.map((action) => ({
          id: action.id,
          label: action.label,
          detail: summarizeAction(action),
        })),
        planSoFar: current.plan,
        notes: ['Current node is a regressed goal set.'],
      });

      yield {
        stepNumber: stepNumber++,
        phase: 'expanding',
        description: `Regressing a goal set with ${trace.currentGoals.length} literal(s).`,
        pseudocodeLine: 3,
        state: trace,
        highlight: createPlanningHighlight(trace),
        metrics: planningMetrics([
          ['Expanded', visited],
          ['Frontier', frontier.length],
          ['Plan Length', current.plan.length],
          ['Open Goals', trace.unsatisfiedGoals.length],
        ]),
        statePanels: buildPlanningStatePanels(trace),
        logs: [planningLog(`Selected regressed goal set ${current.id}.`, 'info')],
      };

      if (trace.unsatisfiedGoals.length === 0) {
        const finalPlan = current.plan;
        const finalTrace = createPlanningState(prepared, {
          ...trace,
          planSoFar: finalPlan,
          notes: ['Every remaining subgoal already holds in the initial state.'],
        });

        yield {
          stepNumber: stepNumber++,
          phase: 'found',
          description: `Backward state-space planning produced a ${finalPlan.length}-step plan.`,
          pseudocodeLine: 4,
          state: finalTrace,
          highlight: createPlanningHighlight(finalTrace),
          metrics: planningMetrics([
            ['Expanded', visited],
            ['Frontier', frontier.length],
            ['Plan Length', finalPlan.length],
            ['Solved', 'Yes'],
          ]),
          statePanels: buildPlanningStatePanels(finalTrace),
          logs: [planningLog('Regression search matched the initial state.', 'success')],
        };
        return buildPlanningResult(true, finalTrace, visited, initialState, ['BSSP regressed the goals back to the initial state.']);
      }

      for (const action of relevantActions) {
        const regressedGoals = regressGoals(current.goals, action);
        if (!regressedGoals) continue;
        const childId = stateKey(regressedGoals);
        if (prepared.duplicateDetection && (seen.has(childId) || explored.has(childId))) {
          continue;
        }
        if (prepared.duplicateDetection) {
          seen.add(childId);
        }

        const child: BackwardNode = {
          id: childId,
          goals: regressedGoals,
          plan: [action.label, ...current.plan],
          depth: current.depth + 1,
          heuristic: estimateHeuristic(initialState, regressedGoals, prepared.groundedActions, prepared.heuristic),
          order: nextOrder++,
        };
        frontier.push(child);

        const childTrace = createPlanningState(prepared, {
          mode: 'state-space',
          currentStateLiterals: initialState,
          currentGoals: regressedGoals,
          satisfiedGoals: regressedGoals.filter((goal) => initialState.includes(goal)),
          unsatisfiedGoals: regressedGoals.filter((goal) => !initialState.includes(goal)),
          frontier: frontierPreview(frontier),
          exploredKeys: [...explored],
          applicableActions: [],
          selectedActionId: action.id,
          selectedActionLabel: action.label,
          planSoFar: child.plan,
          notes: [`Regressed through ${action.label}.`],
        });

        yield {
          stepNumber: stepNumber++,
          phase: 'backtracking',
          description: `Regressed goals through ${action.label}.`,
          pseudocodeLine: 5,
          state: childTrace,
          highlight: createPlanningHighlight(childTrace),
          metrics: planningMetrics([
            ['Expanded', visited],
            ['Frontier', frontier.length],
            ['Plan Length', child.plan.length],
            ['Open Goals', childTrace.unsatisfiedGoals.length],
          ]),
          statePanels: buildPlanningStatePanels(childTrace),
          logs: [planningLog(`Added regressed goal set via ${action.label}.`, 'info')],
        };
      }
    }

    const failedTrace = createPlanningState(prepared, {
      mode: 'state-space',
      currentStateLiterals: initialState,
      currentGoals: orderedGoals,
      satisfiedGoals: [],
      unsatisfiedGoals: orderedGoals,
      frontier: [],
      exploredKeys: [...explored],
      notes: ['The regression frontier emptied without grounding the goals in the initial state.'],
    });

    yield {
      stepNumber: stepNumber++,
      phase: 'failed',
      description: 'Backward state-space planning exhausted the regression frontier without finding a plan.',
      pseudocodeLine: 7,
      state: failedTrace,
      highlight: createPlanningHighlight(failedTrace),
      metrics: planningMetrics([
        ['Expanded', visited],
        ['Frontier', 0],
        ['Plan Length', 0],
        ['Solved', 'No'],
      ]),
      statePanels: buildPlanningStatePanels(failedTrace),
      logs: [planningLog('BSSP failed to regress the goals to the initial state.', 'error')],
    };
    return buildPlanningResult(false, failedTrace, visited, initialState, ['No backward plan was found.']);
  },
};
