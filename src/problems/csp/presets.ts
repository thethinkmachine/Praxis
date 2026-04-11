import type {
  CspConstraint,
  CspLabId,
  CspPresetId,
  CspProblem,
  CspValue,
  CspVariable,
} from '@/types/problem';

export interface CspPresetDefinition {
  id: CspPresetId;
  name: string;
  description: string;
}

export const CSP_PRESETS: CspPresetDefinition[] = [
  {
    id: 'australia-map',
    name: 'Australia Map Coloring',
    description: 'Classic binary CSP with a planar graph and three colors.',
  },
  {
    id: 'n-queens-csp',
    name: 'N-Queens as a CSP',
    description: 'One variable per column, one row value per variable, with row and diagonal constraints.',
  },
  {
    id: 'graph-coloring',
    name: 'Graph Coloring',
    description: 'A small graph-coloring network with explicit adjacency constraints.',
  },
  {
    id: 'custom-network',
    name: 'Custom Constraint Network',
    description: 'A compact mixed network useful for heuristic and propagation comparisons.',
  },
  {
    id: 'sudoku-4x4-easy',
    name: 'Sudoku 4x4 Easy',
    description: 'A small Sudoku instance with enough givens for propagation to be highly visible.',
  },
  {
    id: 'sudoku-4x4-medium',
    name: 'Sudoku 4x4 Medium',
    description: 'A slightly harder 4x4 Sudoku that benefits from search plus propagation.',
  },
  {
    id: 'send-more-money',
    name: 'SEND + MORE = MONEY',
    description: 'Cryptarithmetic with all-different letters and explicit carry constraints.',
  },
  {
    id: 'small-timetable',
    name: 'Small Timetable',
    description: 'Assign classes to room-slot tokens under hard scheduling constraints.',
  },
  {
    id: 'tree-map',
    name: 'Tree-Structured Map',
    description: 'A tree CSP designed for tree solving and cutset conditioning.',
  },
];

const COLORS = ['red', 'green', 'blue'];

function makeProblem(
  lab: CspLabId,
  presetId: CspPresetId,
  title: string,
  variables: CspVariable[],
  constraints: CspConstraint[],
  patch: Partial<CspProblem> = {},
): CspProblem {
  return {
    kind: 'constraint-satisfaction',
    lab,
    presetId,
    title,
    variables,
    constraints,
    variableOrdering: 'mrv',
    valueOrdering: 'lcv',
    queueDiscipline: 'fifo',
    explainPruning: true,
    binaryOnlyView: false,
    propagationFirst: true,
    allDifferentEncoding: 'global',
    ...patch,
  };
}

function mapVariable(id: string, x: number, y: number): CspVariable {
  return {
    id,
    label: id,
    domain: [...COLORS],
    x,
    y,
  };
}

function australiaMap(lab: CspLabId): CspProblem {
  const variables = [
    mapVariable('WA', 0, 60),
    mapVariable('NT', 70, 20),
    mapVariable('SA', 70, 100),
    mapVariable('Q', 140, 40),
    mapVariable('NSW', 150, 120),
    mapVariable('V', 110, 170),
    mapVariable('T', 140, 240),
  ];

  const edges: Array<[string, string]> = [
    ['WA', 'NT'],
    ['WA', 'SA'],
    ['NT', 'SA'],
    ['NT', 'Q'],
    ['SA', 'Q'],
    ['SA', 'NSW'],
    ['SA', 'V'],
    ['Q', 'NSW'],
    ['NSW', 'V'],
  ];

  return makeProblem(
    lab,
    'australia-map',
    'Australia Map Coloring',
    variables,
    edges.map(([left, right]) => ({
      id: `${left}-${right}`,
      type: 'not-equal',
      variables: [left, right],
      description: `${left} and ${right} cannot share a color.`,
    })),
  );
}

function nQueensCsp(lab: CspLabId, size: number = 4): CspProblem {
  const variables: CspVariable[] = Array.from({ length: size }, (_, index) => ({
    id: `Q${index + 1}`,
    label: `Q${index + 1}`,
    domain: Array.from({ length: size }, (_entry, row) => row + 1),
    x: index * 48,
    y: 0,
    meta: { column: index + 1, boardSize: size },
  }));

  const constraints: CspConstraint[] = [];
  for (let left = 0; left < size; left++) {
    for (let right = left + 1; right < size; right++) {
      const disallowed: CspValue[][] = [];
      for (let rowLeft = 1; rowLeft <= size; rowLeft++) {
        for (let rowRight = 1; rowRight <= size; rowRight++) {
          if (rowLeft === rowRight || Math.abs(rowLeft - rowRight) === Math.abs(left - right)) {
            disallowed.push([rowLeft, rowRight]);
          }
        }
      }
      constraints.push({
        id: `Q${left + 1}-Q${right + 1}`,
        type: 'table',
        variables: [`Q${left + 1}`, `Q${right + 1}`],
        disallowedTuples: disallowed,
        description: 'Queens may not share a row or diagonal.',
      });
    }
  }

  return makeProblem(lab, 'n-queens-csp', `${size}-Queens CSP`, variables, constraints, {
    allDifferentEncoding: 'binary-decomposition',
  });
}

function graphColoring(lab: CspLabId): CspProblem {
  const variables: CspVariable[] = [
    { id: 'A', label: 'A', domain: [...COLORS], x: 20, y: 30 },
    { id: 'B', label: 'B', domain: [...COLORS], x: 160, y: 30 },
    { id: 'C', label: 'C', domain: [...COLORS], x: 50, y: 140 },
    { id: 'D', label: 'D', domain: [...COLORS], x: 180, y: 150 },
  ];
  const edges: Array<[string, string]> = [
    ['A', 'B'],
    ['A', 'C'],
    ['B', 'C'],
    ['B', 'D'],
    ['C', 'D'],
  ];

  return makeProblem(
    lab,
    'graph-coloring',
    'Graph Coloring Network',
    variables,
    edges.map(([left, right]) => ({
      id: `${left}-${right}`,
      type: 'not-equal',
      variables: [left, right],
      description: `${left} and ${right} cannot share a color.`,
    })),
  );
}

function customNetwork(lab: CspLabId): CspProblem {
  const variables: CspVariable[] = [
    { id: 'X1', label: 'X1', domain: [1, 2, 3], x: 20, y: 30 },
    { id: 'X2', label: 'X2', domain: [1, 2, 3], x: 140, y: 30 },
    { id: 'X3', label: 'X3', domain: [1, 2, 3], x: 20, y: 140 },
    { id: 'X4', label: 'X4', domain: [1, 2, 3], x: 140, y: 140 },
  ];

  const constraints: CspConstraint[] = [
    { id: 'X1-X2', type: 'not-equal', variables: ['X1', 'X2'], description: 'Adjacent values must differ.' },
    { id: 'X2-X4', type: 'not-equal', variables: ['X2', 'X4'], description: 'Adjacent values must differ.' },
    { id: 'X1-X3', type: 'not-equal', variables: ['X1', 'X3'], description: 'Adjacent values must differ.' },
    { id: 'X3-X4', type: 'not-equal', variables: ['X3', 'X4'], description: 'Adjacent values must differ.' },
    { id: 'sum-corners', type: 'linear-eq', variables: ['X1', 'X2', 'X3'], coefficients: [1, 1, -1], constant: 1, description: 'X1 + X2 - X3 = 1' },
  ];

  return makeProblem(lab, 'custom-network', 'Custom Constraint Network', variables, constraints);
}

function sudoku(lab: CspLabId, presetId: 'sudoku-4x4-easy' | 'sudoku-4x4-medium'): CspProblem {
  const givens = presetId === 'sudoku-4x4-easy'
    ? [
        [1, 0, 0, 4],
        [0, 4, 1, 0],
        [2, 0, 4, 0],
        [0, 3, 0, 1],
      ]
    : [
        [0, 0, 2, 0],
        [0, 0, 0, 3],
        [0, 3, 0, 0],
        [0, 1, 0, 0],
      ];

  const variables: CspVariable[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const given = givens[row][col];
      variables.push({
        id: `R${row}C${col}`,
        label: `${row + 1},${col + 1}`,
        domain: given ? [given] : [1, 2, 3, 4],
        x: col * 48,
        y: row * 48,
        meta: { row, col, box: `${Math.floor(row / 2)}-${Math.floor(col / 2)}`, given },
      });
    }
  }

  const constraints: CspConstraint[] = [];
  for (let row = 0; row < 4; row++) {
    constraints.push({
      id: `row-${row}`,
      type: 'all-different',
      variables: Array.from({ length: 4 }, (_entry, col) => `R${row}C${col}`),
      description: `Row ${row + 1} values must all differ.`,
    });
  }
  for (let col = 0; col < 4; col++) {
    constraints.push({
      id: `col-${col}`,
      type: 'all-different',
      variables: Array.from({ length: 4 }, (_entry, row) => `R${row}C${col}`),
      description: `Column ${col + 1} values must all differ.`,
    });
  }
  for (let row = 0; row < 4; row += 2) {
    for (let col = 0; col < 4; col += 2) {
      constraints.push({
        id: `box-${row}-${col}`,
        type: 'all-different',
        variables: [
          `R${row}C${col}`,
          `R${row}C${col + 1}`,
          `R${row + 1}C${col}`,
          `R${row + 1}C${col + 1}`,
        ],
        description: 'Each 2x2 box must contain 1..4 exactly once.',
      });
    }
  }

  return makeProblem(lab, presetId, `Sudoku ${presetId.endsWith('easy') ? 'Easy' : 'Medium'}`, variables, constraints, {
    binaryOnlyView: false,
    allDifferentEncoding: 'global',
  });
}

function cryptarithm(lab: CspLabId): CspProblem {
  const letters = ['S', 'E', 'N', 'D', 'M', 'O', 'R', 'Y'];
  const carries = ['C1', 'C2', 'C3', 'C4'];
  const variables: CspVariable[] = [
    ...letters.map((letter, index) => ({
      id: letter,
      label: letter,
      domain: Array.from({ length: 10 }, (_entry, digit) => digit),
      x: index * 36,
      y: 0,
      meta: { kind: 'letter' },
    })),
    ...carries.map((carry, index) => ({
      id: carry,
      label: carry,
      domain: [0, 1],
      x: index * 48,
      y: 100,
      meta: { kind: 'carry' },
    })),
  ];

  const constraints: CspConstraint[] = [
    {
      id: 'letters-all-different',
      type: 'all-different',
      variables: letters,
      description: 'Each letter must map to a unique digit.',
    },
    { id: 'S-non-zero', type: 'non-zero', variables: ['S'], description: 'Leading digit S must be non-zero.' },
    { id: 'M-non-zero', type: 'non-zero', variables: ['M'], description: 'Leading digit M must be non-zero.' },
    { id: 'ones', type: 'linear-eq', variables: ['D', 'E', 'C1', 'Y'], coefficients: [1, 1, -10, -1], constant: 0, description: 'D + E = Y + 10*C1' },
    { id: 'tens', type: 'linear-eq', variables: ['N', 'R', 'C1', 'C2', 'E'], coefficients: [1, 1, 1, -10, -1], constant: 0, description: 'N + R + C1 = E + 10*C2' },
    { id: 'hundreds', type: 'linear-eq', variables: ['E', 'O', 'C2', 'C3', 'N'], coefficients: [1, 1, 1, -10, -1], constant: 0, description: 'E + O + C2 = N + 10*C3' },
    { id: 'thousands', type: 'linear-eq', variables: ['S', 'M', 'C3', 'C4', 'O'], coefficients: [1, 1, 1, -10, -1], constant: 0, description: 'S + M + C3 = O + 10*C4' },
    { id: 'carry-out', type: 'linear-eq', variables: ['C4', 'M'], coefficients: [1, -1], constant: 0, description: 'Final carry must equal M.' },
  ];

  return makeProblem(lab, 'send-more-money', 'SEND + MORE = MONEY', variables, constraints, {
    allDifferentEncoding: 'global',
  });
}

function smallTimetable(lab: CspLabId): CspProblem {
  const slots = [0, 1, 2];
  const rooms = ['R1', 'R2'];
  const tokens = slots.flatMap((slot) => rooms.map((room) => `${slot}|${room}`));
  const variables: CspVariable[] = [
    { id: 'AI101', label: 'AI101', domain: tokens, meta: { teacher: 'Turing' } },
    { id: 'DB101', label: 'DB101', domain: tokens.filter((token) => token !== '2|R1'), meta: { teacher: 'Codd' } },
    { id: 'ML201', label: 'ML201', domain: tokens.filter((token) => !token.startsWith('0|')), meta: { teacher: 'Turing' } },
    { id: 'SYS101', label: 'SYS101', domain: tokens.filter((token) => token !== '0|R2'), meta: { teacher: 'Liskov' } },
  ];

  const constraints: CspConstraint[] = [
    { id: 'AI-ML-teacher', type: 'token-conflict', variables: ['AI101', 'ML201'], partIndexes: [0], description: 'Courses taught by Turing cannot share a slot.' },
    { id: 'DB-SYS-room', type: 'token-conflict', variables: ['DB101', 'SYS101'], partIndexes: [0, 1], description: 'Two classes cannot occupy the same room-slot token.' },
    { id: 'AI-before-ML', type: 'token-order', variables: ['AI101', 'ML201'], partIndex: 0, relation: '<', description: 'AI101 must occur before ML201.' },
  ];

  return makeProblem(lab, 'small-timetable', 'Small Timetable', variables, constraints, {
    allDifferentEncoding: 'binary-decomposition',
    rootVariable: 'DB101',
    cutset: ['AI101'],
  });
}

function treeMap(lab: CspLabId): CspProblem {
  const variables: CspVariable[] = [
    mapVariable('A', 60, 20),
    mapVariable('B', 20, 90),
    mapVariable('C', 100, 90),
    mapVariable('D', 0, 170),
    mapVariable('E', 40, 170),
    mapVariable('F', 120, 170),
  ];

  const edges: Array<[string, string]> = [
    ['A', 'B'],
    ['A', 'C'],
    ['B', 'D'],
    ['B', 'E'],
    ['C', 'F'],
  ];

  return makeProblem(
    lab,
    'tree-map',
    'Tree-Structured Map',
    variables,
    edges.map(([left, right]) => ({
      id: `${left}-${right}`,
      type: 'not-equal',
      variables: [left, right],
      description: `${left} and ${right} cannot share a color.`,
    })),
    {
      rootVariable: 'A',
      cutset: ['A'],
    },
  );
}

export function createCspProblemFromPreset(presetId: CspPresetId, lab: CspLabId): CspProblem {
  if (presetId === 'australia-map') return australiaMap(lab);
  if (presetId === 'n-queens-csp') return nQueensCsp(lab);
  if (presetId === 'graph-coloring') return graphColoring(lab);
  if (presetId === 'custom-network') return customNetwork(lab);
  if (presetId === 'sudoku-4x4-easy' || presetId === 'sudoku-4x4-medium') return sudoku(lab, presetId);
  if (presetId === 'send-more-money') return cryptarithm(lab);
  if (presetId === 'small-timetable') return smallTimetable(lab);
  return treeMap(lab);
}
