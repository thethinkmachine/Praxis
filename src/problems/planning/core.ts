import type {
  PlanningActionSchema,
  PlanningGroundedAction,
  PlanningHeuristicId,
  PlanningProblem,
  PlanningSchemaParameter,
} from '@/types/problem';

export interface PlanningGraphActionLayerEntry {
  id: string;
  label: string;
  preconditions: string[];
  addEffects: string[];
  deleteEffects: string[];
  persistent: boolean;
}

export interface PlanningGraphLayer {
  level: number;
  propositions: string[];
  propositionMutex: Array<[string, string]>;
  actions: PlanningGraphActionLayerEntry[];
  actionMutex: Array<[string, string]>;
}

export interface PlanningGraphBuildResult {
  layers: PlanningGraphLayer[];
  leveledOff: boolean;
}

export function normalizeLiterals(literals: string[]): string[] {
  return [...new Set(literals)].sort((left, right) => left.localeCompare(right));
}

export function stateKey(literals: string[]): string {
  return normalizeLiterals(literals).join(' | ');
}

export function setDifference(items: string[], removed: Iterable<string>): string[] {
  const removedSet = new Set(removed);
  return items.filter((item) => !removedSet.has(item));
}

export function isGoalSatisfied(state: string[], goals: string[]): boolean {
  const stateSet = new Set(state);
  return goals.every((goal) => stateSet.has(goal));
}

export function countUnsatisfiedGoals(state: string[], goals: string[]): number {
  const stateSet = new Set(state);
  return goals.filter((goal) => !stateSet.has(goal)).length;
}

function substituteTemplate(template: string, parameters: Record<string, string>): string {
  return template.replace(/\{([^}]+)\}/g, (_match, key: string) => parameters[key] ?? `{${key}}`);
}

function cartesianProduct<T>(groups: T[][]): T[][] {
  if (groups.length === 0) return [[]];
  const [head, ...rest] = groups;
  const tail = cartesianProduct(rest);
  const result: T[][] = [];
  for (const item of head) {
    for (const suffix of tail) {
      result.push([item, ...suffix]);
    }
  }
  return result;
}

function createActionLabel(name: string, parameters: PlanningSchemaParameter[], values: string[]): string {
  if (parameters.length === 0) return name;
  return `${name}(${values.join(', ')})`;
}

export function groundActionSchemas(problem: Pick<PlanningProblem, 'objectSets' | 'schemas'>): PlanningGroundedAction[] {
  const grounded: PlanningGroundedAction[] = [];

  for (const schema of problem.schemas) {
    if (schema.enabled === false) continue;
    const domains = schema.parameters.map((parameter) => problem.objectSets[parameter.objectSet] ?? []);
    const assignments = cartesianProduct(domains);

    for (const values of assignments) {
      if (new Set(values).size !== values.length && values.length > 1) {
        continue;
      }

      const parameters = Object.fromEntries(
        schema.parameters.map((parameter, index) => [parameter.key, values[index]]),
      );
      grounded.push({
        id: `${schema.id}:${values.join(':') || 'unit'}`,
        schemaId: schema.id,
        name: schema.name,
        label: createActionLabel(schema.name, schema.parameters, values),
        parameters,
        preconditions: normalizeLiterals(schema.preconditions.map((literal) => substituteTemplate(literal, parameters))),
        addEffects: normalizeLiterals(schema.addEffects.map((literal) => substituteTemplate(literal, parameters))),
        deleteEffects: normalizeLiterals(schema.deleteEffects.map((literal) => substituteTemplate(literal, parameters))),
        enabled: true,
      });
    }
  }

  return grounded.sort((left, right) => left.label.localeCompare(right.label));
}

export function applyAction(state: string[], action: PlanningGroundedAction): string[] {
  return normalizeLiterals([
    ...setDifference(state, action.deleteEffects),
    ...action.addEffects,
  ]);
}

export function isActionApplicable(state: string[], action: PlanningGroundedAction): boolean {
  const stateSet = new Set(state);
  return action.preconditions.every((literal) => stateSet.has(literal));
}

export function getApplicableActions(state: string[], actions: PlanningGroundedAction[]): PlanningGroundedAction[] {
  return actions.filter((action) => action.enabled !== false && isActionApplicable(state, action));
}

export function regressGoals(goals: string[], action: PlanningGroundedAction): string[] | null {
  const goalSet = new Set(goals);
  const relevant = action.addEffects.some((literal) => goalSet.has(literal));
  if (!relevant) return null;

  for (const deleted of action.deleteEffects) {
    if (goalSet.has(deleted) && !action.addEffects.includes(deleted)) {
      return null;
    }
  }

  return normalizeLiterals([
    ...setDifference(goals, action.addEffects),
    ...action.preconditions,
  ]);
}

export function orderGoals(goals: string[], ordering: PlanningProblem['goalOrdering'] = 'input'): string[] {
  const ordered = [...goals];
  if (ordering === 'shortest-first') {
    return ordered.sort((left, right) => left.length - right.length || left.localeCompare(right));
  }
  if (ordering === 'hardest-first') {
    return ordered.sort((left, right) => right.length - left.length || left.localeCompare(right));
  }
  return ordered;
}

export function orderActions(
  actions: PlanningGroundedAction[],
  goals: string[],
  ordering: PlanningProblem['branchOrder'] = 'schema',
): PlanningGroundedAction[] {
  const goalSet = new Set(goals);
  const sorted = [...actions].sort((left, right) => left.label.localeCompare(right.label));

  if (ordering === 'goal-first') {
    return sorted.sort((left, right) => {
      const leftHits = left.addEffects.filter((literal) => goalSet.has(literal)).length;
      const rightHits = right.addEffects.filter((literal) => goalSet.has(literal)).length;
      return rightHits - leftHits || left.label.localeCompare(right.label);
    });
  }

  if (ordering === 'reverse') {
    return sorted.reverse();
  }

  return sorted;
}

export function estimateRelaxedPlanningLevel(
  state: string[],
  goals: string[],
  actions: PlanningGroundedAction[],
  depthCap: number = 8,
): number {
  if (isGoalSatisfied(state, goals)) return 0;

  let reachable = normalizeLiterals(state);
  for (let level = 1; level <= depthCap; level++) {
    const reachSet = new Set(reachable);
    const additions = actions.flatMap((action) => (
      action.preconditions.every((literal) => reachSet.has(literal)) ? action.addEffects : []
    ));
    const next = normalizeLiterals([...reachable, ...additions]);
    if (isGoalSatisfied(next, goals)) return level;
    if (stateKey(next) === stateKey(reachable)) break;
    reachable = next;
  }

  return depthCap + countUnsatisfiedGoals(reachable, goals);
}

function pairKey(left: string, right: string): string {
  return left < right ? `${left} || ${right}` : `${right} || ${left}`;
}

function isPairwiseMutex(
  one: string[],
  two: string[],
  mutex: Set<string>,
): boolean {
  return one.some((left) => two.some((right) => mutex.has(pairKey(left, right))));
}

function createPersistenceActions(literals: string[]): PlanningGraphActionLayerEntry[] {
  return literals.map((literal) => ({
    id: `noop:${literal}`,
    label: `NoOp(${literal})`,
    preconditions: [literal],
    addEffects: [literal],
    deleteEffects: [],
    persistent: true,
  }));
}

export function buildPlanningGraph(
  state: string[],
  actions: PlanningGroundedAction[],
  depthCap: number = 8,
): PlanningGraphBuildResult {
  const layers: PlanningGraphLayer[] = [{
    level: 0,
    propositions: normalizeLiterals(state),
    propositionMutex: [],
    actions: [],
    actionMutex: [],
  }];

  let leveledOff = false;

  for (let level = 0; level < depthCap; level++) {
    const previous = layers[level];
    const propositionSet = new Set(previous.propositions);
    const persistence = createPersistenceActions(previous.propositions);
    const applicable = actions
      .filter((action) => action.enabled !== false && action.preconditions.every((literal) => propositionSet.has(literal)))
      .map((action) => ({
        id: action.id,
        label: action.label,
        preconditions: action.preconditions,
        addEffects: action.addEffects,
        deleteEffects: action.deleteEffects,
        persistent: false,
      }));
    const actionLayer = [...persistence, ...applicable];
    const propositionMutexSet = new Set(previous.propositionMutex.map(([left, right]) => pairKey(left, right)));
    const actionMutexSet = new Set<string>();

    for (let index = 0; index < actionLayer.length; index++) {
      for (let cursor = index + 1; cursor < actionLayer.length; cursor++) {
        const left = actionLayer[index];
        const right = actionLayer[cursor];
        const inconsistentEffects = left.addEffects.some((literal) => right.deleteEffects.includes(literal))
          || right.addEffects.some((literal) => left.deleteEffects.includes(literal));
        const interference = left.deleteEffects.some((literal) => right.preconditions.includes(literal) || right.addEffects.includes(literal))
          || right.deleteEffects.some((literal) => left.preconditions.includes(literal) || left.addEffects.includes(literal));
        const competingNeeds = isPairwiseMutex(left.preconditions, right.preconditions, propositionMutexSet);
        if (inconsistentEffects || interference || competingNeeds) {
          actionMutexSet.add(pairKey(left.id, right.id));
        }
      }
    }

    const nextProps = normalizeLiterals(actionLayer.flatMap((action) => action.addEffects));
    const producers = new Map<string, string[]>();
    for (const literal of nextProps) {
      producers.set(literal, actionLayer.filter((action) => action.addEffects.includes(literal)).map((action) => action.id));
    }

    const nextPropMutex: Array<[string, string]> = [];
    for (let index = 0; index < nextProps.length; index++) {
      for (let cursor = index + 1; cursor < nextProps.length; cursor++) {
        const left = nextProps[index];
        const right = nextProps[cursor];
        const leftProducers = producers.get(left) ?? [];
        const rightProducers = producers.get(right) ?? [];
        const allMutex = leftProducers.every((leftProducer) => (
          rightProducers.every((rightProducer) => actionMutexSet.has(pairKey(leftProducer, rightProducer)))
        ));
        if (allMutex) {
          nextPropMutex.push([left, right]);
        }
      }
    }

    layers.push({
      level: level + 1,
      propositions: nextProps,
      propositionMutex: nextPropMutex,
      actions: actionLayer,
      actionMutex: [...actionMutexSet].map((entry) => entry.split(' || ') as [string, string]),
    });

    if (stateKey(previous.propositions) === stateKey(nextProps) && previous.propositionMutex.length === nextPropMutex.length) {
      leveledOff = true;
      break;
    }
  }

  return { layers, leveledOff };
}

export function goalsNonMutex(goals: string[], layer: PlanningGraphLayer): boolean {
  const mutexSet = new Set(layer.propositionMutex.map(([left, right]) => pairKey(left, right)));
  for (let index = 0; index < goals.length; index++) {
    for (let cursor = index + 1; cursor < goals.length; cursor++) {
      if (mutexSet.has(pairKey(goals[index], goals[cursor]))) {
        return false;
      }
    }
  }
  return true;
}

export function extractGraphPlan(
  graph: PlanningGraphBuildResult,
  goals: string[],
  level: number,
): { plan: string[][] | null; noGoods: string[] } {
  const noGoods = new Set<string>();

  const recurse = (currentLevel: number, pendingGoals: string[]): string[][] | null => {
    const normalizedGoals = normalizeLiterals(pendingGoals);
    if (currentLevel === 0) {
      return isGoalSatisfied(graph.layers[0].propositions, normalizedGoals) ? [] : null;
    }

    const key = `${currentLevel}:${normalizedGoals.join('|')}`;
    if (noGoods.has(key)) return null;

    const layer = graph.layers[currentLevel];
    const actionLayer = graph.layers[currentLevel].actions;
    const actionMutex = new Set(layer.actionMutex.map(([left, right]) => pairKey(left, right)));
    const achieversByGoal = new Map<string, PlanningGraphActionLayerEntry[]>();
    for (const goal of normalizedGoals) {
      achieversByGoal.set(
        goal,
        actionLayer.filter((action) => action.addEffects.includes(goal)),
      );
    }

    const orderedGoals = [...normalizedGoals].sort((left, right) => {
      const leftCount = achieversByGoal.get(left)?.length ?? 0;
      const rightCount = achieversByGoal.get(right)?.length ?? 0;
      return leftCount - rightCount || left.localeCompare(right);
    });

    const chooseActions = (
      goalIndex: number,
      selected: PlanningGraphActionLayerEntry[],
      coveredGoals: Set<string>,
    ): string[][] | null => {
      if (goalIndex >= orderedGoals.length) {
        const previousGoals = normalizeLiterals(selected.flatMap((action) => action.preconditions));
        const prefix = recurse(currentLevel - 1, previousGoals);
        if (!prefix) return null;
        const step = selected.filter((action) => !action.persistent).map((action) => action.label);
        return [...prefix, step];
      }

      const goal = orderedGoals[goalIndex];
      if (coveredGoals.has(goal)) {
        return chooseActions(goalIndex + 1, selected, coveredGoals);
      }

      for (const action of achieversByGoal.get(goal) ?? []) {
        if (selected.some((picked) => actionMutex.has(pairKey(picked.id, action.id)))) {
          continue;
        }
        const nextSelected = selected.some((picked) => picked.id === action.id)
          ? selected
          : [...selected, action];
        const nextCovered = new Set(coveredGoals);
        for (const achieved of action.addEffects) {
          nextCovered.add(achieved);
        }
        const result = chooseActions(goalIndex + 1, nextSelected, nextCovered);
        if (result) return result;
      }

      return null;
    };

    const result = chooseActions(0, [], new Set());
    if (!result) {
      noGoods.add(key);
    }
    return result;
  };

  return { plan: recurse(level, goals), noGoods: [...noGoods] };
}

export function estimatePlanningGraphLevel(
  state: string[],
  goals: string[],
  actions: PlanningGroundedAction[],
  depthCap: number = 8,
): number {
  const graph = buildPlanningGraph(state, actions, depthCap);
  for (const layer of graph.layers) {
    if (isGoalSatisfied(layer.propositions, goals) && goalsNonMutex(goals, layer)) {
      return layer.level;
    }
  }
  return depthCap + countUnsatisfiedGoals(graph.layers.at(-1)?.propositions ?? state, goals);
}

export function estimateHeuristic(
  state: string[],
  goals: string[],
  actions: PlanningGroundedAction[],
  heuristic: PlanningHeuristicId = 'goal-count',
): number {
  if (heuristic === 'ignore-delete') {
    return estimateRelaxedPlanningLevel(state, goals, actions);
  }
  if (heuristic === 'planning-graph-level') {
    return estimatePlanningGraphLevel(state, goals, actions);
  }
  return countUnsatisfiedGoals(state, goals);
}

export function createGroundedProblem(problem: PlanningProblem): PlanningProblem {
  return {
    ...problem,
    groundedActions: problem.groundedActions.length > 0
      ? problem.groundedActions
      : groundActionSchemas(problem),
    initialLiterals: normalizeLiterals(problem.initialLiterals),
    goalLiterals: normalizeLiterals(problem.goalLiterals),
  };
}

export function summarizeAction(action: PlanningGroundedAction): string {
  return `pre: ${action.preconditions.join(', ') || 'none'} | add: ${action.addEffects.join(', ') || 'none'} | del: ${action.deleteEffects.join(', ') || 'none'}`;
}
