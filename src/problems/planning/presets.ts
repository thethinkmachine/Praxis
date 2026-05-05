import type {
  PlanningActionSchema,
  PlanningLabId,
  PlanningPresetId,
  PlanningProblem,
} from '@/types/problem';
import { createGroundedProblem } from './core';

export interface PlanningPresetDefinition {
  id: PlanningPresetId;
  name: string;
  description: string;
  supportsObjectCount: boolean;
}

export const PLANNING_PRESETS: PlanningPresetDefinition[] = [
  {
    id: 'blocks-world',
    name: 'Blocks World',
    description: 'Stack and unstack blocks to reach a symbolic goal arrangement. (Note: The table is assumed infinitely large, so Clear(Table) is not tracked)',
    supportsObjectCount: true,
  },
  {
    id: 'air-cargo',
    name: 'Air Cargo',
    description: 'Load cargos into aircraft, fly them, and unload them at destination airports.',
    supportsObjectCount: true,
  },
  {
    id: 'spare-tire',
    name: 'Spare Tire',
    description: 'A small classical planning domain with a tight causal dependency chain.',
    supportsObjectCount: false,
  },
  {
    id: 'cake',
    name: 'Have Cake and Eat It',
    description: 'The textbook example that highlights delete effects and plan interaction.',
    supportsObjectCount: false,
  },
];

function schema(
  id: string,
  name: string,
  parameters: PlanningActionSchema['parameters'],
  preconditions: string[],
  addEffects: string[],
  deleteEffects: string[],
): PlanningActionSchema {
  return {
    id,
    name,
    parameters,
    preconditions,
    addEffects,
    deleteEffects,
    enabled: true,
  };
}

function buildBlocksWorld(lab: PlanningLabId, objectCount: number): PlanningProblem {
  const blocks = ['A', 'B', 'C', 'D'].slice(0, Math.max(3, Math.min(4, objectCount)));

  return createGroundedProblem({
    kind: 'planning',
    lab,
    presetId: 'blocks-world',
    domainName: 'Blocks World',
    objectCount: blocks.length,
    objectSets: {
      block: blocks,
    },
    schemas: [
      schema(
        'pickup',
        'Pickup',
        [{ key: 'x', objectSet: 'block' }],
        ['OnTable({x})', 'Clear({x})', 'ArmEmpty'],
        ['Holding({x})'],
        ['OnTable({x})', 'Clear({x})', 'ArmEmpty'],
      ),
      schema(
        'putdown',
        'Putdown',
        [{ key: 'x', objectSet: 'block' }],
        ['Holding({x})'],
        ['OnTable({x})', 'Clear({x})', 'ArmEmpty'],
        ['Holding({x})'],
      ),
      schema(
        'stack',
        'Stack',
        [
          { key: 'x', objectSet: 'block' },
          { key: 'y', objectSet: 'block' },
        ],
        ['Holding({x})', 'Clear({y})'],
        ['On({x},{y})', 'Clear({x})', 'ArmEmpty'],
        ['Holding({x})', 'Clear({y})'],
      ),
      schema(
        'unstack',
        'Unstack',
        [
          { key: 'x', objectSet: 'block' },
          { key: 'y', objectSet: 'block' },
        ],
        ['On({x},{y})', 'Clear({x})', 'ArmEmpty'],
        ['Holding({x})', 'Clear({y})'],
        ['On({x},{y})', 'Clear({x})', 'ArmEmpty'],
      ),
    ],
    groundedActions: [],
    initialLiterals: [
      ...blocks.map((block) => `OnTable(${block})`),
      ...blocks.map((block) => `Clear(${block})`),
      'ArmEmpty',
    ],
    goalLiterals: blocks.length > 3
      ? ['On(A,B)', 'On(B,C)', 'On(C,D)']
      : ['On(A,B)', 'On(B,C)'],
    heuristic: 'goal-count',
    duplicateDetection: true,
    branchOrder: 'goal-first',
    tieBreaker: 'fifo',
    goalOrdering: 'input',
    repeatedGoalProtection: true,
    operatorChoice: 'fewest-preconditions',
    expansionDepthCap: 8,
    showDeleteEffects: true,
    extractionStrategy: 'parallel-first',
    satHorizonCap: 8,
    flawSelection: 'most-constrained',
    threatResolution: 'promotion',
    leastCommitment: true,
    manualActionHistory: [],
  });
}

function buildAirCargo(lab: PlanningLabId, objectCount: number): PlanningProblem {
  const cargoCount = Math.max(2, Math.min(3, objectCount));
  const cargos = ['C1', 'C2', 'C3'].slice(0, cargoCount);
  const planes = ['P1'];
  const airports = ['SFO', 'JFK', 'ORD'];

  return createGroundedProblem({
    kind: 'planning',
    lab,
    presetId: 'air-cargo',
    domainName: 'Air Cargo',
    objectCount: cargos.length,
    objectSets: {
      cargo: cargos,
      plane: planes,
      airport: airports.slice(0, cargos.length === 3 ? 3 : 2),
    },
    schemas: [
      schema(
        'load',
        'Load',
        [
          { key: 'c', objectSet: 'cargo' },
          { key: 'p', objectSet: 'plane' },
          { key: 'a', objectSet: 'airport' },
        ],
        ['At({c},{a})', 'At({p},{a})'],
        ['In({c},{p})'],
        ['At({c},{a})'],
      ),
      schema(
        'unload',
        'Unload',
        [
          { key: 'c', objectSet: 'cargo' },
          { key: 'p', objectSet: 'plane' },
          { key: 'a', objectSet: 'airport' },
        ],
        ['In({c},{p})', 'At({p},{a})'],
        ['At({c},{a})'],
        ['In({c},{p})'],
      ),
      schema(
        'fly',
        'Fly',
        [
          { key: 'p', objectSet: 'plane' },
          { key: 'from', objectSet: 'airport' },
          { key: 'to', objectSet: 'airport' },
        ],
        ['At({p},{from})'],
        ['At({p},{to})'],
        ['At({p},{from})'],
      ),
    ],
    groundedActions: [],
    initialLiterals: [
      `At(${cargos[0]},SFO)`,
      `At(${cargos[1]},JFK)`,
      ...(cargos[2] ? [`At(${cargos[2]},ORD)`] : []),
      'At(P1,SFO)',
    ],
    goalLiterals: [
      `At(${cargos[0]},JFK)`,
      `At(${cargos[1]},SFO)`,
      ...(cargos[2] ? [`At(${cargos[2]},JFK)`] : []),
    ],
    heuristic: 'planning-graph-level',
    duplicateDetection: true,
    branchOrder: 'goal-first',
    tieBreaker: 'fifo',
    goalOrdering: 'shortest-first',
    repeatedGoalProtection: true,
    operatorChoice: 'fewest-preconditions',
    expansionDepthCap: 7,
    showDeleteEffects: true,
    extractionStrategy: 'parallel-first',
    satHorizonCap: 7,
    flawSelection: 'most-constrained',
    threatResolution: 'promotion',
    leastCommitment: true,
    manualActionHistory: [],
  });
}

function buildSpareTire(lab: PlanningLabId): PlanningProblem {
  return createGroundedProblem({
    kind: 'planning',
    lab,
    presetId: 'spare-tire',
    domainName: 'Spare Tire',
    objectSets: {},
    schemas: [
      schema(
        'remove-flat',
        'RemoveFlat',
        [],
        ['At(Flat,Axle)'],
        ['At(Flat,Ground)', 'Clear(Axle)'],
        ['At(Flat,Axle)'],
      ),
      schema(
        'remove-spare',
        'RemoveSpare',
        [],
        ['At(Spare,Trunk)'],
        ['At(Spare,Ground)'],
        ['At(Spare,Trunk)'],
      ),
      schema(
        'put-on-spare',
        'PutOnSpare',
        [],
        ['At(Spare,Ground)', 'Clear(Axle)'],
        ['At(Spare,Axle)'],
        ['At(Spare,Ground)', 'Clear(Axle)'],
      ),
    ],
    groundedActions: [],
    initialLiterals: ['At(Flat,Axle)', 'At(Spare,Trunk)'],
    goalLiterals: ['At(Spare,Axle)'],
    heuristic: 'goal-count',
    duplicateDetection: true,
    branchOrder: 'schema',
    tieBreaker: 'fifo',
    goalOrdering: 'input',
    repeatedGoalProtection: true,
    operatorChoice: 'first-achiever',
    expansionDepthCap: 5,
    showDeleteEffects: true,
    extractionStrategy: 'serial-first',
    satHorizonCap: 5,
    flawSelection: 'fifo',
    threatResolution: 'promotion',
    leastCommitment: true,
    manualActionHistory: [],
  });
}

function buildCake(lab: PlanningLabId): PlanningProblem {
  return createGroundedProblem({
    kind: 'planning',
    lab,
    presetId: 'cake',
    domainName: 'Have Cake and Eat It',
    objectSets: {},
    schemas: [
      schema(
        'eat-cake',
        'EatCake',
        [],
        ['Have(Cake)'],
        ['Eaten(Cake)', 'NoCake'],
        ['Have(Cake)'],
      ),
      schema(
        'bake-cake',
        'BakeCake',
        [],
        ['NoCake'],
        ['Have(Cake)'],
        ['NoCake'],
      ),
    ],
    groundedActions: [],
    initialLiterals: ['Have(Cake)'],
    goalLiterals: ['Have(Cake)', 'Eaten(Cake)'],
    heuristic: 'ignore-delete',
    duplicateDetection: true,
    branchOrder: 'goal-first',
    tieBreaker: 'fifo',
    goalOrdering: 'hardest-first',
    repeatedGoalProtection: true,
    operatorChoice: 'fewest-preconditions',
    expansionDepthCap: 5,
    showDeleteEffects: true,
    extractionStrategy: 'serial-first',
    satHorizonCap: 5,
    flawSelection: 'most-constrained',
    threatResolution: 'demotion',
    leastCommitment: true,
    manualActionHistory: [],
  });
}

export function createPlanningProblemFromPreset(
  presetId: PlanningPresetId,
  lab: PlanningLabId,
  objectCount?: number,
): PlanningProblem {
  if (presetId === 'blocks-world') {
    return buildBlocksWorld(lab, objectCount ?? 3);
  }
  if (presetId === 'air-cargo') {
    return buildAirCargo(lab, objectCount ?? 2);
  }
  if (presetId === 'spare-tire') {
    return buildSpareTire(lab);
  }
  return buildCake(lab);
}
