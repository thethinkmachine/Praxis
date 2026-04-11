import { applyAction, createGroundedProblem, isActionApplicable, orderGoals, summarizeAction } from '@/problems/planning/core';
import { buildPlanningResult, buildPlanningStatePanels, createPlanningHighlight, createPlanningState, planningLog, planningMetrics } from './shared';
import type { PlanningRunner } from './types';

function validatePlanningProblem(problem: Parameters<PlanningRunner['validate']>[0]) {
  const errors: string[] = [];
  if (!problem || problem.kind !== 'planning') errors.push('Expected a planning problem.');
  if (!problem.initialLiterals?.length) errors.push('Planning problems need an initial literal set.');
  if (!problem.goalLiterals?.length) errors.push('Planning problems need at least one goal literal.');
  return { valid: errors.length === 0, errors, warnings: [] as string[] };
}

function chooseAchiever(
  goal: string,
  actions: ReturnType<typeof createGroundedProblem>['groundedActions'],
  operatorChoice: Parameters<typeof createGroundedProblem>[0]['operatorChoice'],
) {
  const achievers = actions
    .filter((action) => action.addEffects.includes(goal))
    .sort((left, right) => {
      if (operatorChoice === 'fewest-preconditions') {
        return left.preconditions.length - right.preconditions.length || left.label.localeCompare(right.label);
      }
      return left.label.localeCompare(right.label);
    });

  return achievers[0] ?? null;
}

export const gspRunner: PlanningRunner = {
  meta: {
    id: 'gsp',
    name: 'Goal Stack Planning',
    shortName: 'GSP',
    category: 'planning',
    description: 'Uses a working-memory stack of goals and operators, pushing preconditions until a chosen action becomes executable.',
    timeComplexity: 'Problem-dependent',
    spaceComplexity: 'O(d)',
    complete: false,
    optimal: false,
    tags: ['planning', 'goal-stack', 'strips'],
    bookChapter: 'AIMA 4th Ed. § 11.2',
    relatedAlgorithms: ['fssp', 'bssp', 'pop'],
  },
  pseudocode: [
    'function GOAL-STACK-PLANNER(problem):',
    '  stack <- ordered goals',
    '  while stack not empty:',
    '    item <- top(stack)',
    '    if item is a satisfied goal: pop',
    '    else if item is an action and applicable: apply it',
    '    else choose an action that achieves the goal',
    '      push action then its preconditions',
    '  return accumulated plan',
  ],
  validate: validatePlanningProblem,
  getInitialState(problem) {
    const prepared = createGroundedProblem(problem);
    return createPlanningState(prepared, {
      mode: 'goal-stack',
      currentStateLiterals: prepared.initialLiterals,
      currentGoals: prepared.goalLiterals,
      satisfiedGoals: prepared.goalLiterals.filter((goal) => prepared.initialLiterals.includes(goal)),
      unsatisfiedGoals: prepared.goalLiterals.filter((goal) => !prepared.initialLiterals.includes(goal)),
      goalStack: orderGoals(prepared.goalLiterals, prepared.goalOrdering),
    });
  },
  *run(problem) {
    const prepared = createGroundedProblem(problem);
    const orderedGoals = orderGoals(prepared.goalLiterals, prepared.goalOrdering);
    const stack = [...orderedGoals].reverse();
    const actionByLabel = new Map(prepared.groundedActions.map((action) => [action.label, action]));
    let state = [...prepared.initialLiterals];
    const plan: string[] = [];
    let stepNumber = 0;
    let iterations = 0;
    const maxIterations = Math.max(16, (prepared.expansionDepthCap ?? 6) * Math.max(4, prepared.groundedActions.length));

    const initialTrace = createPlanningState(prepared, {
      mode: 'goal-stack',
      currentStateLiterals: state,
      currentGoals: orderedGoals,
      satisfiedGoals: orderedGoals.filter((goal) => state.includes(goal)),
      unsatisfiedGoals: orderedGoals.filter((goal) => !state.includes(goal)),
      goalStack: [...stack].reverse(),
      notes: ['Goal-stack planning keeps goals and actions in one LIFO structure.'],
    });

    yield {
      stepNumber: stepNumber++,
      phase: 'initializing',
      description: `Initialized goal-stack planning on ${prepared.domainName}.`,
      pseudocodeLine: 1,
      state: initialTrace,
      highlight: createPlanningHighlight(initialTrace),
      metrics: planningMetrics([
        ['Stack Size', stack.length],
        ['Plan Length', 0],
        ['Satisfied Goals', initialTrace.satisfiedGoals.length],
      ]),
      statePanels: buildPlanningStatePanels(initialTrace),
      logs: [planningLog('Seeded the goal stack with the requested goal literals.', 'info')],
    };

    while (stack.length > 0 && iterations < maxIterations) {
      iterations += 1;
      const top = stack[stack.length - 1];
      const isAction = top.startsWith('ACTION:');
      const currentGoal = isAction ? null : top;
      const selectedAction = isAction ? actionByLabel.get(top.replace('ACTION:', '')) ?? null : null;

      const trace = createPlanningState(prepared, {
        mode: 'goal-stack',
        currentStateLiterals: state,
        currentGoals: currentGoal ? [currentGoal] : orderedGoals.filter((goal) => !state.includes(goal)),
        satisfiedGoals: orderedGoals.filter((goal) => state.includes(goal)),
        unsatisfiedGoals: orderedGoals.filter((goal) => !state.includes(goal)),
        goalStack: [...stack].reverse(),
        planSoFar: [...plan],
        selectedActionId: selectedAction?.id ?? null,
        selectedActionLabel: selectedAction?.label ?? null,
        applicableActions: currentGoal
          ? prepared.groundedActions
              .filter((action) => action.addEffects.includes(currentGoal))
              .map((action) => ({
                id: action.id,
                label: action.label,
                detail: summarizeAction(action),
              }))
          : [],
        notes: [currentGoal ? `Focused goal: ${currentGoal}` : 'Top of stack is an action token.'],
      });

      yield {
        stepNumber: stepNumber++,
        phase: currentGoal ? 'expanding' : 'visiting',
        description: currentGoal
          ? `Examining goal ${currentGoal}.`
          : `Checking whether ${selectedAction?.label ?? 'an action'} is ready to execute.`,
        pseudocodeLine: currentGoal ? 3 : 4,
        state: trace,
        highlight: createPlanningHighlight(trace),
        metrics: planningMetrics([
          ['Stack Size', stack.length],
          ['Plan Length', plan.length],
          ['Satisfied Goals', trace.satisfiedGoals.length],
        ]),
        statePanels: buildPlanningStatePanels(trace),
        logs: [planningLog(currentGoal ? `Inspecting goal ${currentGoal}.` : `Inspecting action token ${selectedAction?.label}.`, 'info')],
      };

      if (currentGoal) {
        if (state.includes(currentGoal)) {
          stack.pop();
          continue;
        }

        const achiever = chooseAchiever(currentGoal, prepared.groundedActions, prepared.operatorChoice);
        if (!achiever) {
          const failedTrace = createPlanningState(prepared, {
            ...trace,
            notes: [`No action achieves ${currentGoal}.`],
          });
          yield {
            stepNumber: stepNumber++,
            phase: 'failed',
            description: `Goal-stack planning could not find an achiever for ${currentGoal}.`,
            pseudocodeLine: 5,
            state: failedTrace,
            highlight: createPlanningHighlight(failedTrace),
            metrics: planningMetrics([
              ['Stack Size', stack.length],
              ['Plan Length', plan.length],
              ['Satisfied Goals', failedTrace.satisfiedGoals.length],
            ]),
            statePanels: buildPlanningStatePanels(failedTrace),
            logs: [planningLog(`No operator achieves ${currentGoal}.`, 'error')],
          };
          return buildPlanningResult(false, failedTrace, iterations, state, ['Goal stack planner hit an unsupported goal literal.']);
        }

        stack.pop();
        stack.push(`ACTION:${achiever.label}`);
        const pendingPreconditions = [...achiever.preconditions].reverse();
        for (const precondition of pendingPreconditions) {
          if (prepared.repeatedGoalProtection && stack.includes(precondition)) {
            continue;
          }
          if (!state.includes(precondition)) {
            stack.push(precondition);
          }
        }
        continue;
      }

      if (!selectedAction) {
        stack.pop();
        continue;
      }

      if (!isActionApplicable(state, selectedAction)) {
        for (const precondition of [...selectedAction.preconditions].reverse()) {
          if (!state.includes(precondition)) {
            stack.push(precondition);
          }
        }
        continue;
      }

      stack.pop();
      state = applyAction(state, selectedAction);
      plan.push(selectedAction.label);

      const actionTrace = createPlanningState(prepared, {
        mode: 'goal-stack',
        currentStateLiterals: state,
        currentGoals: orderedGoals.filter((goal) => !state.includes(goal)),
        satisfiedGoals: orderedGoals.filter((goal) => state.includes(goal)),
        unsatisfiedGoals: orderedGoals.filter((goal) => !state.includes(goal)),
        goalStack: [...stack].reverse(),
        planSoFar: [...plan],
        selectedActionId: selectedAction.id,
        selectedActionLabel: selectedAction.label,
        notes: [`Executed ${selectedAction.label}.`],
      });

      yield {
        stepNumber: stepNumber++,
        phase: 'visiting',
        description: `Executed ${selectedAction.label}.`,
        pseudocodeLine: 4,
        state: actionTrace,
        highlight: createPlanningHighlight(actionTrace),
        metrics: planningMetrics([
          ['Stack Size', stack.length],
          ['Plan Length', plan.length],
          ['Satisfied Goals', actionTrace.satisfiedGoals.length],
        ]),
        statePanels: buildPlanningStatePanels(actionTrace),
        logs: [planningLog(`Applied ${selectedAction.label}.`, 'success')],
      };
    }

    const solved = orderedGoals.every((goal) => state.includes(goal));
    const finalTrace = createPlanningState(prepared, {
      mode: 'goal-stack',
      currentStateLiterals: state,
      currentGoals: orderedGoals,
      satisfiedGoals: orderedGoals.filter((goal) => state.includes(goal)),
      unsatisfiedGoals: orderedGoals.filter((goal) => !state.includes(goal)),
      goalStack: [...stack].reverse(),
      planSoFar: [...plan],
      notes: solved
        ? ['The stack emptied and the goal literals are true.']
        : ['The iteration cap was reached before the stack resolved cleanly.'],
    });

    yield {
      stepNumber: stepNumber++,
      phase: solved ? 'found' : 'failed',
      description: solved
        ? `Goal-stack planning produced a ${plan.length}-step plan.`
        : 'Goal-stack planning stopped before every goal was satisfied.',
      pseudocodeLine: 7,
      state: finalTrace,
      highlight: createPlanningHighlight(finalTrace),
      metrics: planningMetrics([
        ['Stack Size', stack.length],
        ['Plan Length', plan.length],
        ['Satisfied Goals', finalTrace.satisfiedGoals.length],
      ]),
      statePanels: buildPlanningStatePanels(finalTrace),
      logs: [planningLog(solved ? 'Goal stack planner succeeded.' : 'Goal stack planner did not finish cleanly.', solved ? 'success' : 'warn')],
    };

    return buildPlanningResult(solved, finalTrace, iterations, state, solved
      ? ['GSP resolved the goal stack into a plan.']
      : ['GSP stopped before every stacked goal was discharged.']);
  },
};
