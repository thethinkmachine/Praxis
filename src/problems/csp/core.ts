import type {
  CspConstraint,
  CspProblem,
  CspQueueDiscipline,
  CspValue,
  CspVariable,
  CspVariableOrdering,
  CspValueOrdering,
} from '@/types/problem';

export type DomainMap = Map<string, CspValue[]>;
export type Assignment = Record<string, CspValue>;

export interface PruneRecord {
  variable: string;
  value: CspValue;
  reason: string;
}

function cloneValue(value: CspValue): CspValue {
  return typeof value === 'number' ? Number(value) : String(value);
}

export function cloneDomains(domains: DomainMap): DomainMap {
  return new Map(
    [...domains.entries()].map(([key, values]) => [key, values.map(cloneValue)]),
  );
}

export function domainsFromProblem(problem: CspProblem): DomainMap {
  return new Map(problem.variables.map((variable) => [variable.id, [...variable.domain]]));
}

export function domainsToObject(domains: DomainMap): Record<string, CspValue[]> {
  return Object.fromEntries(
    [...domains.entries()].map(([key, values]) => [key, [...values]]),
  );
}

export function variableById(problem: CspProblem, variableId: string): CspVariable {
  const variable = problem.variables.find((entry) => entry.id === variableId);
  if (!variable) {
    throw new Error(`Unknown CSP variable "${variableId}"`);
  }
  return variable;
}

export function constraintsForVariable(problem: CspProblem, variableId: string): CspConstraint[] {
  return problem.constraints.filter((constraint) => constraint.variables.includes(variableId));
}

export function normalizeTokenParts(value: CspValue): string[] {
  return String(value).split('|');
}

function tupleMatches(tuple: CspValue[], variables: string[], assignment: Assignment): boolean {
  return variables.every((variable, index) => assignment[variable] === undefined || assignment[variable] === tuple[index]);
}

export function isConstraintSatisfied(constraint: CspConstraint, assignment: Assignment): boolean {
  if (constraint.type === 'not-equal') {
    const [left, right] = constraint.variables;
    return assignment[left] !== assignment[right];
  }

  if (constraint.type === 'all-different') {
    const values = constraint.variables.map((variable) => assignment[variable]);
    return new Set(values).size === values.length;
  }

  if (constraint.type === 'table') {
    const tuple = constraint.variables.map((variable) => assignment[variable]);
    if (constraint.allowedTuples) {
      return constraint.allowedTuples.some((allowed) => allowed.every((value, index) => value === tuple[index]));
    }
    if (constraint.disallowedTuples) {
      return !constraint.disallowedTuples.some((blocked) => blocked.every((value, index) => value === tuple[index]));
    }
    return true;
  }

  if (constraint.type === 'linear-eq') {
    const total = constraint.variables.reduce((sum, variable, index) => (
      sum + Number(assignment[variable]) * constraint.coefficients[index]
    ), 0);
    return total === constraint.constant;
  }

  if (constraint.type === 'token-conflict') {
    const [leftVar, rightVar] = constraint.variables;
    const leftParts = normalizeTokenParts(assignment[leftVar]);
    const rightParts = normalizeTokenParts(assignment[rightVar]);
    return !constraint.partIndexes.every((partIndex) => leftParts[partIndex] === rightParts[partIndex]);
  }

  if (constraint.type === 'token-order') {
    const [beforeVar, afterVar] = constraint.variables;
    const beforeValue = Number(normalizeTokenParts(assignment[beforeVar])[constraint.partIndex] ?? 0);
    const afterValue = Number(normalizeTokenParts(assignment[afterVar])[constraint.partIndex] ?? 0);
    if (constraint.relation === '<') return beforeValue < afterValue;
    if (constraint.relation === '<=') return beforeValue <= afterValue;
    if (constraint.relation === '>') return beforeValue > afterValue;
    return beforeValue >= afterValue;
  }

  const [variable] = constraint.variables;
  return Number(assignment[variable]) !== 0;
}

function remainingVariables(constraint: CspConstraint, assignment: Assignment): string[] {
  return constraint.variables.filter((variable) => assignment[variable] === undefined);
}

function valueRange(values: CspValue[], coefficient: number) {
  const numbers = values.map((value) => Number(value));
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  return coefficient >= 0
    ? { min: coefficient * min, max: coefficient * max }
    : { min: coefficient * max, max: coefficient * min };
}

export function constraintCanBeSatisfied(
  constraint: CspConstraint,
  domains: DomainMap,
  assignment: Assignment,
): boolean {
  if (constraint.type === 'not-equal') {
    const [left, right] = constraint.variables;
    const leftValue = assignment[left];
    const rightValue = assignment[right];
    if (leftValue !== undefined && rightValue !== undefined) {
      return leftValue !== rightValue;
    }
    if (leftValue !== undefined) {
      return (domains.get(right) ?? []).some((value) => value !== leftValue);
    }
    if (rightValue !== undefined) {
      return (domains.get(left) ?? []).some((value) => value !== rightValue);
    }
    const leftDomain = domains.get(left) ?? [];
    const rightDomain = domains.get(right) ?? [];
    return leftDomain.some((leftCandidate) => rightDomain.some((rightCandidate) => leftCandidate !== rightCandidate));
  }

  if (constraint.type === 'all-different') {
    const assignedValues = constraint.variables
      .map((variable) => assignment[variable])
      .filter((value): value is CspValue => value !== undefined);
    if (new Set(assignedValues).size !== assignedValues.length) {
      return false;
    }

    const remaining = constraint.variables.filter((variable) => assignment[variable] === undefined);
    const pool = new Set<CspValue>(assignedValues);
    for (const variable of remaining) {
      for (const value of domains.get(variable) ?? []) {
        pool.add(value);
      }
    }
    return pool.size >= constraint.variables.length;
  }

  if (constraint.type === 'table') {
    if (constraint.allowedTuples) {
      return constraint.allowedTuples.some((tuple) => tupleMatches(tuple, constraint.variables, assignment));
    }
    if (constraint.disallowedTuples) {
      if (remainingVariables(constraint, assignment).length > 0) return true;
      return isConstraintSatisfied(constraint, assignment);
    }
    return true;
  }

  if (constraint.type === 'linear-eq') {
    let assignedTotal = 0;
    let minRemaining = 0;
    let maxRemaining = 0;

    for (const [index, variable] of constraint.variables.entries()) {
      const value = assignment[variable];
      const coefficient = constraint.coefficients[index];
      if (value !== undefined) {
        assignedTotal += coefficient * Number(value);
      } else {
        const domain = domains.get(variable) ?? [];
        if (domain.length === 0) return false;
        const range = valueRange(domain, coefficient);
        minRemaining += range.min;
        maxRemaining += range.max;
      }
    }

    if (remainingVariables(constraint, assignment).length === 0) {
      return assignedTotal === constraint.constant;
    }

    const target = constraint.constant - assignedTotal;
    return target >= minRemaining && target <= maxRemaining;
  }

  if (constraint.type === 'token-conflict') {
    const [left, right] = constraint.variables;
    const leftValue = assignment[left];
    const rightValue = assignment[right];
    if (leftValue !== undefined && rightValue !== undefined) {
      return isConstraintSatisfied(constraint, assignment);
    }

    const leftDomain = leftValue !== undefined ? [leftValue] : (domains.get(left) ?? []);
    const rightDomain = rightValue !== undefined ? [rightValue] : (domains.get(right) ?? []);
    return leftDomain.some((leftCandidate) => rightDomain.some((rightCandidate) => {
      const leftParts = normalizeTokenParts(leftCandidate);
      const rightParts = normalizeTokenParts(rightCandidate);
      return !constraint.partIndexes.every((partIndex) => leftParts[partIndex] === rightParts[partIndex]);
    }));
  }

  if (constraint.type === 'token-order') {
    const [before, after] = constraint.variables;
    const leftDomain = assignment[before] !== undefined ? [assignment[before]] : (domains.get(before) ?? []);
    const rightDomain = assignment[after] !== undefined ? [assignment[after]] : (domains.get(after) ?? []);
    return leftDomain.some((leftCandidate) => rightDomain.some((rightCandidate) => {
      const localAssignment = {
        ...assignment,
        [before]: leftCandidate,
        [after]: rightCandidate,
      };
      return isConstraintSatisfied(constraint, localAssignment);
    }));
  }

  const [variable] = constraint.variables;
  const value = assignment[variable];
  if (value !== undefined) {
    return Number(value) !== 0;
  }
  return (domains.get(variable) ?? []).some((candidate) => Number(candidate) !== 0);
}

export function hasSupportForValue(
  constraint: CspConstraint,
  variableId: string,
  value: CspValue,
  domains: DomainMap,
  assignment: Assignment,
): boolean {
  const localAssignment: Assignment = { ...assignment, [variableId]: value };
  const pending = constraint.variables.filter((variable) => localAssignment[variable] === undefined);

  const search = (index: number): boolean => {
    if (!constraintCanBeSatisfied(constraint, domains, localAssignment)) {
      return false;
    }
    if (index >= pending.length) {
      return isConstraintSatisfied(constraint, localAssignment);
    }

    const variable = pending[index];
    const domain = domains.get(variable) ?? [];
    for (const candidate of domain) {
      localAssignment[variable] = candidate;
      if (search(index + 1)) {
        delete localAssignment[variable];
        return true;
      }
      delete localAssignment[variable];
    }

    return false;
  };

  return search(0);
}

export function isAssignmentConsistent(problem: CspProblem, domains: DomainMap, assignment: Assignment): boolean {
  return problem.constraints.every((constraint) => constraintCanBeSatisfied(constraint, domains, assignment));
}

export function selectUnassignedVariable(
  problem: CspProblem,
  domains: DomainMap,
  assignment: Assignment,
  ordering: CspVariableOrdering = 'input',
): string | null {
  const unassigned = problem.variables.filter((variable) => assignment[variable.id] === undefined);
  if (unassigned.length === 0) return null;

  if (ordering === 'input') {
    return unassigned[0].id;
  }

  const neighbors = buildNeighborMap(problem);

  const ranked = [...unassigned].sort((left, right) => {
    const leftDomain = domains.get(left.id)?.length ?? 0;
    const rightDomain = domains.get(right.id)?.length ?? 0;
    if (ordering === 'mrv' && leftDomain !== rightDomain) {
      return leftDomain - rightDomain;
    }
    const leftDegree = neighbors.get(left.id)?.size ?? 0;
    const rightDegree = neighbors.get(right.id)?.size ?? 0;
    if (leftDegree !== rightDegree) {
      return rightDegree - leftDegree;
    }
    return left.id.localeCompare(right.id);
  });

  return ranked[0]?.id ?? null;
}

export function orderValues(
  problem: CspProblem,
  variableId: string,
  domains: DomainMap,
  assignment: Assignment,
  ordering: CspValueOrdering = 'input',
): CspValue[] {
  const values = [...(domains.get(variableId) ?? [])];
  if (ordering === 'input') return values;

  const neighbors = buildNeighborMap(problem).get(variableId) ?? new Set<string>();
  return values.sort((left, right) => {
    const leftImpact = [...neighbors].reduce((total, neighbor) => {
      return total + ((domains.get(neighbor) ?? []).filter((candidate) => {
        const nextAssignment = { ...assignment, [variableId]: left };
        return isAssignmentConsistent(problem, domains, { ...nextAssignment, [neighbor]: candidate });
      }).length);
    }, 0);
    const rightImpact = [...neighbors].reduce((total, neighbor) => {
      return total + ((domains.get(neighbor) ?? []).filter((candidate) => {
        const nextAssignment = { ...assignment, [variableId]: right };
        return isAssignmentConsistent(problem, domains, { ...nextAssignment, [neighbor]: candidate });
      }).length);
    }, 0);
    return rightImpact - leftImpact;
  });
}

export function buildNeighborMap(problem: CspProblem): Map<string, Set<string>> {
  const neighbors = new Map(problem.variables.map((variable) => [variable.id, new Set<string>()]));
  for (const constraint of problem.constraints) {
    for (const variable of constraint.variables) {
      const set = neighbors.get(variable);
      if (!set) continue;
      for (const other of constraint.variables) {
        if (other !== variable) set.add(other);
      }
    }
  }
  return neighbors;
}

export function reviseBinaryConstraint(
  constraint: CspConstraint,
  source: string,
  target: string,
  domains: DomainMap,
  assignment: Assignment,
): PruneRecord[] {
  const sourceDomain = [...(domains.get(source) ?? [])];
  const pruned: PruneRecord[] = [];

  for (const value of sourceDomain) {
    const supported = hasSupportForValue(constraint, source, value, domains, assignment);
    if (!supported) {
      pruned.push({
        variable: source,
        value,
        reason: `No support in ${target} for constraint ${constraint.id}`,
      });
    }
  }

  if (pruned.length > 0) {
    domains.set(
      source,
      sourceDomain.filter((value) => !pruned.some((entry) => entry.value === value)),
    );
  }

  return pruned;
}

export function binaryConstraints(problem: CspProblem): CspConstraint[] {
  return problem.constraints.flatMap((constraint) => {
    if (constraint.type === 'all-different') {
      const pairs: CspConstraint[] = [];
      for (let index = 0; index < constraint.variables.length; index++) {
        for (let cursor = index + 1; cursor < constraint.variables.length; cursor++) {
          pairs.push({
            id: `${constraint.id}:${constraint.variables[index]}:${constraint.variables[cursor]}`,
            type: 'not-equal',
            variables: [constraint.variables[index], constraint.variables[cursor]],
            description: constraint.description,
          });
        }
      }
      return pairs;
    }

    return constraint.variables.length === 2 ? [constraint] : [];
  });
}

export function ac3(
  problem: CspProblem,
  domains: DomainMap,
  assignment: Assignment,
  queueDiscipline: CspQueueDiscipline = 'fifo',
): { consistent: boolean; pruned: PruneRecord[]; queueTrace: string[] } {
  const queue: Array<{ source: string; target: string; constraint: CspConstraint }> = [];
  const pruned: PruneRecord[] = [];
  const queueTrace: string[] = [];
  const binary = binaryConstraints(problem);
  const neighbors = buildNeighborMap(problem);

  for (const constraint of binary) {
    const [left, right] = constraint.variables;
    queue.push({ source: left, target: right, constraint });
    queue.push({ source: right, target: left, constraint });
  }

  while (queue.length > 0) {
    const entry = queueDiscipline === 'lifo' ? queue.pop()! : queue.shift()!;
    queueTrace.push(`${entry.source} -> ${entry.target} (${entry.constraint.id})`);
    const removed = reviseBinaryConstraint(entry.constraint, entry.source, entry.target, domains, assignment);
    if (removed.length > 0) {
      pruned.push(...removed);
      if ((domains.get(entry.source) ?? []).length === 0) {
        return { consistent: false, pruned, queueTrace };
      }
      for (const neighbor of neighbors.get(entry.source) ?? []) {
        if (neighbor === entry.target) continue;
        for (const constraint of binary.filter((candidate) => candidate.variables.includes(entry.source) && candidate.variables.includes(neighbor))) {
          queue.push({ source: neighbor, target: entry.source, constraint });
        }
      }
    }
  }

  return { consistent: true, pruned, queueTrace };
}

export function gac(
  problem: CspProblem,
  domains: DomainMap,
  assignment: Assignment,
  queueDiscipline: CspQueueDiscipline = 'fifo',
): { consistent: boolean; pruned: PruneRecord[]; queueTrace: string[] } {
  const queue: Array<{ constraint: CspConstraint; variable: string }> = [];
  const pruned: PruneRecord[] = [];
  const queueTrace: string[] = [];

  for (const constraint of problem.constraints) {
    for (const variable of constraint.variables) {
      queue.push({ constraint, variable });
    }
  }

  while (queue.length > 0) {
    const entry = queueDiscipline === 'lifo' ? queue.pop()! : queue.shift()!;
    queueTrace.push(`${entry.constraint.id}:${entry.variable}`);
    const domain = [...(domains.get(entry.variable) ?? [])];
    const removed: PruneRecord[] = [];
    for (const value of domain) {
      if (!hasSupportForValue(entry.constraint, entry.variable, value, domains, assignment)) {
        removed.push({
          variable: entry.variable,
          value,
          reason: `No support in ${entry.constraint.id}`,
        });
      }
    }
    if (removed.length > 0) {
      pruned.push(...removed);
      domains.set(entry.variable, domain.filter((value) => !removed.some((record) => record.value === value)));
      if ((domains.get(entry.variable) ?? []).length === 0) {
        return { consistent: false, pruned, queueTrace };
      }
      for (const constraint of problem.constraints.filter((constraint) => constraint.variables.includes(entry.variable))) {
        for (const variable of constraint.variables) {
          if (variable !== entry.variable) {
            queue.push({ constraint, variable });
          }
        }
      }
    }
  }

  return { consistent: true, pruned, queueTrace };
}

export function assignVariable(domains: DomainMap, variableId: string, value: CspValue) {
  domains.set(variableId, [value]);
}

export function unassignedCount(problem: CspProblem, assignment: Assignment) {
  return problem.variables.filter((variable) => assignment[variable.id] === undefined).length;
}

export function primalGraph(problem: CspProblem, omitted: Set<string> = new Set()): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const variable of problem.variables) {
    if (!omitted.has(variable.id)) {
      graph.set(variable.id, new Set());
    }
  }
  for (const constraint of binaryConstraints(problem)) {
    const [left, right] = constraint.variables;
    if (omitted.has(left) || omitted.has(right)) continue;
    graph.get(left)?.add(right);
    graph.get(right)?.add(left);
  }
  return graph;
}

export function isTreeStructured(problem: CspProblem, omitted: Set<string> = new Set()) {
  const graph = primalGraph(problem, omitted);
  const nodes = [...graph.keys()];
  if (nodes.length === 0) return true;

  let edgeCount = 0;
  for (const neighbors of graph.values()) edgeCount += neighbors.size;
  edgeCount /= 2;
  if (edgeCount !== nodes.length - 1) return false;

  const visited = new Set<string>();
  const stack = [nodes[0]];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const neighbor of graph.get(current) ?? []) {
      stack.push(neighbor);
    }
  }

  return visited.size === nodes.length;
}

export function treeOrder(problem: CspProblem, rootId: string, omitted: Set<string> = new Set()) {
  const graph = primalGraph(problem, omitted);
  const parent = new Map<string, string | null>([[rootId, null]]);
  const order: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const neighbor of graph.get(current) ?? []) {
      if (parent.has(neighbor)) continue;
      parent.set(neighbor, current);
      queue.push(neighbor);
    }
  }
  return { order, parent, graph };
}
