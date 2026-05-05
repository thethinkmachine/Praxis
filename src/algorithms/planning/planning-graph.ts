import { applyAction, buildPlanningGraph, createGroundedProblem, extractGraphPlan, goalsNonMutex, isGoalSatisfied, orderActions, stateKey, summarizeAction } from '@/problems/planning/core';
import { buildPlanningResult, buildPlanningStatePanels, createPlanningHighlight, createPlanningState, planningLog, planningMetrics } from './shared';
import type { PlanningGraphLayerView, PlanningRunner } from './types';

function validatePlanningProblem(problem: Parameters<PlanningRunner['validate']>[0]) {
  const errors: string[] = [];
  if (!problem || problem.kind !== 'planning') errors.push('Expected a planning problem.');
  if (!problem.initialLiterals?.length) errors.push('Planning problems need an initial literal set.');
  if (!problem.goalLiterals?.length) errors.push('Planning problems need at least one goal literal.');
  return { valid: errors.length === 0, errors, warnings: [] as string[] };
}

function serializeLayers(result: ReturnType<typeof buildPlanningGraph>): PlanningGraphLayerView[] {
  return result.layers.map((layer) => {
    const idToLabel = new Map(layer.actions.map((a) => [a.id, a.label]));
    return {
      level: layer.level,
      propositions: layer.propositions,
      actions: layer.actions.map((action) => action.label),
      propositionMutex: layer.propositionMutex.map(([left, right]) => `${left} <> ${right}`),
      actionMutex: layer.actionMutex.map(([left, right]) => `${idToLabel.get(left)} <> ${idToLabel.get(right)}`),
    };
  });
}

function approximateClauseCount(horizon: number, groundedActions: number, propositions: number, goals: number) {
  const preconditionClauses = horizon * groundedActions * 3;
  const exclusivityClauses = Math.max(0, horizon * Math.max(groundedActions - 1, 0));
  return propositions + goals + preconditionClauses + exclusivityClauses;
}

function boundedForwardPlan(
  state: string[],
  goals: string[],
  actions: ReturnType<typeof createGroundedProblem>['groundedActions'],
  horizon: number,
): string[] | null {
  const memo = new Set<string>();

  const search = (currentState: string[], depth: number): string[] | null => {
    if (isGoalSatisfied(currentState, goals)) return [];
    if (depth >= horizon) return null;

    const key = `${depth}:${stateKey(currentState)}`;
    if (memo.has(key)) return null;
    memo.add(key);

    const applicable = orderActions(
      actions.filter((action) => action.preconditions.every((literal) => currentState.includes(literal))),
      goals.filter((goal) => !currentState.includes(goal)),
      'goal-first',
    );

    for (const action of applicable) {
      const nextState = applyAction(currentState, action);
      const suffix = search(nextState, depth + 1);
      if (suffix) return [action.label, ...suffix];
    }

    return null;
  };

  return search(state, 0);
}

export const graphplanRunner: PlanningRunner = {
  meta: {
    id: 'graphplan',
    name: 'GraphPlan',
    shortName: 'GraphPlan',
    category: 'planning',
    description: 'Expands alternating proposition and action layers, tracks mutexes, and extracts a parallel plan once the goals become reachable without mutual exclusion.',
    timeComplexity: 'Problem-dependent',
    spaceComplexity: 'Problem-dependent',
    complete: true,
    optimal: 'Optimal in number of planning-graph levels for extracted plans',
    tags: ['planning', 'planning-graph', 'mutex'],
    bookChapter: 'AIMA 4th Ed. § 11.3',
    relatedAlgorithms: ['satplan', 'fssp', 'pop'],
  },
  pseudocode: [
    'function GRAPHPLAN(problem):',
    '  graph <- planning graph rooted at initial state',
    '  repeat:',
    '    expand graph by one action layer and one proposition layer',
    '    if goals appear without mutex: try to extract a plan',
    '    if extraction succeeds: return plan',
    '  until graph levels off',
    '  return failure',
  ],
  validate: validatePlanningProblem,
  getInitialState(problem) {
    const prepared = createGroundedProblem(problem);
    return createPlanningState(prepared, {
      mode: 'planning-graph',
      currentStateLiterals: prepared.initialLiterals,
      currentGoals: prepared.goalLiterals,
      satisfiedGoals: prepared.goalLiterals.filter((goal) => prepared.initialLiterals.includes(goal)),
      unsatisfiedGoals: prepared.goalLiterals.filter((goal) => !prepared.initialLiterals.includes(goal)),
      graphLayers: [],
    });
  },
  *run(problem) {
    const prepared = createGroundedProblem(problem);
    const graph = buildPlanningGraph(prepared.initialLiterals, prepared.groundedActions, prepared.expansionDepthCap ?? 8);
    const layers = serializeLayers(graph);
    let stepNumber = 0;

    yield {
      stepNumber: stepNumber++,
      phase: 'initializing',
      description: `Initialized a planning graph for ${prepared.domainName}.`,
      pseudocodeLine: 1,
      state: createPlanningState(prepared, {
        mode: 'planning-graph',
        currentStateLiterals: prepared.initialLiterals,
        currentGoals: prepared.goalLiterals,
        satisfiedGoals: prepared.goalLiterals.filter((goal) => prepared.initialLiterals.includes(goal)),
        unsatisfiedGoals: prepared.goalLiterals.filter((goal) => !prepared.initialLiterals.includes(goal)),
        graphLayers: [],
        notes: ['Planning graphs alternate proposition and action levels. A graph levels off when both propositions and mutexes stabilize.'],
      }),
      highlight: createPlanningHighlight(createPlanningState(prepared, {
        mode: 'planning-graph',
        currentStateLiterals: prepared.initialLiterals,
        currentGoals: prepared.goalLiterals,
      }), { focusLayer: 0 }),
      metrics: planningMetrics([
        ['Level', 0],
        ['Goal Count', prepared.goalLiterals.length],
        ['Solved', 'No'],
      ]),
      statePanels: buildPlanningStatePanels(createPlanningState(prepared, {
        mode: 'planning-graph',
        currentStateLiterals: prepared.initialLiterals,
        currentGoals: prepared.goalLiterals,
        graphLayers: [],
      })),
      logs: [planningLog('Planning graph seeded with proposition level P0.', 'info')],
    };

    for (let index = 1; index < graph.layers.length; index++) {
      const currentLayers = layers.slice(0, index + 1);
      const currentLayer = graph.layers[index];
      const trace = createPlanningState(prepared, {
        mode: 'planning-graph',
        currentStateLiterals: prepared.initialLiterals,
        currentGoals: prepared.goalLiterals,
        satisfiedGoals: prepared.goalLiterals.filter((goal) => currentLayer.propositions.includes(goal)),
        unsatisfiedGoals: prepared.goalLiterals.filter((goal) => !currentLayer.propositions.includes(goal)),
        graphLayers: currentLayers,
        applicableActions: currentLayer.actions.slice(0, 8).map((action) => ({
          id: action.id,
          label: action.label,
          detail: `pre ${action.preconditions.length} / add ${action.addEffects.length}`,
        })),
        notes: [`Level ${index} contains ${currentLayer.propositions.length} proposition(s).`],
      });

      yield {
        stepNumber: stepNumber++,
        phase: 'expanding',
        description: `Expanded planning graph to level ${index}.`,
        pseudocodeLine: 3,
        state: trace,
        highlight: createPlanningHighlight(trace, { focusLayer: index }),
        metrics: planningMetrics([
          ['Level', index],
          ['Actions', currentLayer.actions.length],
          ['Prop Mutex', currentLayer.propositionMutex.length],
          ['Act Mutex', currentLayer.actionMutex.length],
        ]),
        statePanels: buildPlanningStatePanels(trace),
        logs: [planningLog(`Expanded planning graph to level ${index}.`, 'info')],
      };

      if (isGoalSatisfied(currentLayer.propositions, prepared.goalLiterals) && goalsNonMutex(prepared.goalLiterals, currentLayer)) {
        const extraction = extractGraphPlan(graph, prepared.goalLiterals, index);
        const found = extraction.plan;
        const finalTrace = createPlanningState(prepared, {
          ...trace,
          extractedPlan: found ?? [],
          notes: found
            ? ['Extracted a non-mutex parallel plan from the graph.']
            : ['Goals appeared, but backward extraction failed at this level.'],
        });

        yield {
          stepNumber: stepNumber++,
          phase: found ? 'found' : 'backtracking',
          description: found
            ? `Extracted a ${found.length}-level parallel plan.`
            : 'Goals are present without mutex, but extraction still needs more support.',
          pseudocodeLine: 4,
          state: finalTrace,
          highlight: createPlanningHighlight(finalTrace, { focusLayer: index }),
          metrics: planningMetrics([
            ['Level', index],
            ['Parallel Steps', found?.length ?? 0],
            ['No-Goods', extraction.noGoods.length],
            ['Solved', found ? 'Yes' : 'No'],
          ]),
          statePanels: buildPlanningStatePanels(finalTrace),
          logs: [planningLog(found ? 'GraphPlan extracted a valid parallel plan.' : 'Extraction produced a no-good at this level.', found ? 'success' : 'warn')],
        };

        if (found) {
          return buildPlanningResult(true, finalTrace, graph.layers.length, prepared.initialLiterals, ['GraphPlan extracted a valid parallel plan.'], index);
        }
      }
    }

    const failedTrace = createPlanningState(prepared, {
      mode: 'planning-graph',
      currentStateLiterals: prepared.initialLiterals,
      currentGoals: prepared.goalLiterals,
      satisfiedGoals: [],
      unsatisfiedGoals: prepared.goalLiterals,
      graphLayers: layers,
      notes: [graph.leveledOff ? 'The planning graph leveled off before extraction succeeded.' : 'Expansion depth cap was reached before extraction succeeded.'],
    });

    yield {
      stepNumber: stepNumber++,
      phase: 'failed',
      description: 'GraphPlan did not extract a plan within the configured graph horizon.',
      pseudocodeLine: 6,
      state: failedTrace,
      highlight: createPlanningHighlight(failedTrace, { focusLayer: failedTrace.graphLayers.at(-1)?.level ?? null }),
      metrics: planningMetrics([
        ['Level', failedTrace.graphLayers.at(-1)?.level ?? 0],
        ['Graph Layers', failedTrace.graphLayers.length],
        ['Solved', 'No'],
      ]),
      statePanels: buildPlanningStatePanels(failedTrace),
      logs: [planningLog('GraphPlan failed to extract a plan.', 'error')],
    };
    return buildPlanningResult(false, failedTrace, graph.layers.length, prepared.initialLiterals, ['GraphPlan failed to extract a plan.']);
  },
};

export const satplanRunner: PlanningRunner = {
  meta: {
    id: 'satplan',
    name: 'SATPlan',
    shortName: 'SATPlan',
    category: 'planning',
    description: 'Raises a bounded horizon, summarizes the resulting SAT encoding, and checks whether a plan exists at that horizon.',
    timeComplexity: 'NP-complete per horizon',
    spaceComplexity: 'Problem-dependent',
    complete: true,
    optimal: 'Optimal in horizon when searched incrementally',
    tags: ['planning', 'sat', 'bounded-horizon'],
    bookChapter: 'AIMA 4th Ed. § 11.4',
    relatedAlgorithms: ['graphplan', 'fssp'],
  },
  pseudocode: [
    'function SATPLAN(problem):',
    '  for horizon in 0..H:',
    '    encode the planning problem at horizon',
    '    if SAT(encoding): return decoded plan',
    '  return failure',
  ],
  validate: validatePlanningProblem,
  getInitialState(problem) {
    const prepared = createGroundedProblem(problem);
    return createPlanningState(prepared, {
      mode: 'planning-graph',
      currentStateLiterals: prepared.initialLiterals,
      currentGoals: prepared.goalLiterals,
      satisfiedGoals: prepared.goalLiterals.filter((goal) => prepared.initialLiterals.includes(goal)),
      unsatisfiedGoals: prepared.goalLiterals.filter((goal) => !prepared.initialLiterals.includes(goal)),
      cnfSummary: [],
    });
  },
  *run(problem) {
    const prepared = createGroundedProblem(problem);
    const horizonCap = prepared.satHorizonCap ?? prepared.expansionDepthCap ?? 8;
    let stepNumber = 0;
    const summaries: ReturnType<typeof createPlanningState>['cnfSummary'] = [];

    yield {
      stepNumber: stepNumber++,
      phase: 'initializing',
      description: `Initialized SATPlan horizon search for ${prepared.domainName}.`,
      pseudocodeLine: 0,
      state: createPlanningState(prepared, {
        mode: 'planning-graph',
        currentStateLiterals: prepared.initialLiterals,
        currentGoals: prepared.goalLiterals,
        satisfiedGoals: prepared.goalLiterals.filter((goal) => prepared.initialLiterals.includes(goal)),
        unsatisfiedGoals: prepared.goalLiterals.filter((goal) => !prepared.initialLiterals.includes(goal)),
        cnfSummary: [],
        notes: ['SATPlan increases the horizon until the bounded encoding becomes satisfiable.'],
      }),
      highlight: createPlanningHighlight(createPlanningState(prepared, {
        mode: 'planning-graph',
        currentStateLiterals: prepared.initialLiterals,
        currentGoals: prepared.goalLiterals,
      })),
      metrics: planningMetrics([
        ['Horizon', 0],
        ['Encodings', 0],
        ['Solved', 'No'],
      ]),
      statePanels: buildPlanningStatePanels(createPlanningState(prepared, {
        mode: 'planning-graph',
        currentStateLiterals: prepared.initialLiterals,
        currentGoals: prepared.goalLiterals,
      })),
      logs: [planningLog('Starting bounded-horizon planning search.', 'info')],
    };

    for (let horizon = 0; horizon <= horizonCap; horizon++) {
      const graph = buildPlanningGraph(prepared.initialLiterals, prepared.groundedActions, horizon);
      const propositions = new Set(graph.layers.flatMap((layer) => layer.propositions)).size;
      const satisfiablePlan = boundedForwardPlan(prepared.initialLiterals, prepared.goalLiterals, prepared.groundedActions, horizon);
      summaries.push({
        horizon,
        propositionVariables: propositions * Math.max(1, horizon + 1),
        actionVariables: prepared.groundedActions.length * Math.max(0, horizon),
        clauseCount: approximateClauseCount(horizon, prepared.groundedActions.length, propositions, prepared.goalLiterals.length),
        satisfiable: satisfiablePlan !== null,
      });

      const trace = createPlanningState(prepared, {
        mode: 'planning-graph',
        currentStateLiterals: prepared.initialLiterals,
        currentGoals: prepared.goalLiterals,
        satisfiedGoals: [],
        unsatisfiedGoals: prepared.goalLiterals,
        graphLayers: serializeLayers(graph),
        cnfSummary: [...summaries],
        planSoFar: satisfiablePlan ?? [],
        extractedPlan: satisfiablePlan ? satisfiablePlan.map((action) => [action]) : [],
        notes: [satisfiablePlan ? `Horizon ${horizon} is satisfiable.` : `Horizon ${horizon} is unsatisfiable.`],
      });

      yield {
        stepNumber: stepNumber++,
        phase: satisfiablePlan ? 'found' : 'expanding',
        description: satisfiablePlan
          ? `Found a bounded plan at horizon ${horizon}.`
          : `Encoded and checked horizon ${horizon}.`,
        pseudocodeLine: 1,
        state: trace,
        highlight: createPlanningHighlight(trace, { focusLayer: trace.graphLayers.at(-1)?.level ?? null }),
        metrics: planningMetrics([
          ['Horizon', horizon],
          ['Clauses', summaries.at(-1)?.clauseCount ?? 0],
          ['Plan Length', satisfiablePlan?.length ?? 0],
          ['Solved', satisfiablePlan ? 'Yes' : 'No'],
        ]),
        statePanels: buildPlanningStatePanels(trace),
        logs: [planningLog(
          satisfiablePlan
            ? `SATPlan found a satisfying bounded plan at horizon ${horizon}.`
            : `Horizon ${horizon} was unsatisfiable.`,
          satisfiablePlan ? 'success' : 'info',
        )],
      };

      if (satisfiablePlan) {
        return buildPlanningResult(true, trace, horizon + 1, prepared.initialLiterals, ['SATPlan found a bounded plan.'], horizon);
      }
    }

    const failedTrace = createPlanningState(prepared, {
      mode: 'planning-graph',
      currentStateLiterals: prepared.initialLiterals,
      currentGoals: prepared.goalLiterals,
      satisfiedGoals: [],
      unsatisfiedGoals: prepared.goalLiterals,
      cnfSummary: summaries,
      notes: ['No satisfiable horizon was found within the configured cap.'],
    });

    yield {
      stepNumber: stepNumber++,
      phase: 'failed',
      description: 'SATPlan did not find a satisfiable bounded encoding within the configured horizon cap.',
      pseudocodeLine: 3,
      state: failedTrace,
      highlight: createPlanningHighlight(failedTrace),
      metrics: planningMetrics([
        ['Horizon', horizonCap],
        ['Encodings', summaries.length],
        ['Solved', 'No'],
      ]),
      statePanels: buildPlanningStatePanels(failedTrace),
      logs: [planningLog('SATPlan exhausted the configured horizon cap.', 'error')],
    };
    return buildPlanningResult(false, failedTrace, summaries.length, prepared.initialLiterals, ['SATPlan did not find a satisfiable horizon.']);
  },
};
