import { buildPlanningGraph, createGroundedProblem } from './src/problems/planning/core';
import { PLANNING_PRESETS, createPlanningProblemFromPreset } from './src/problems/planning/presets';

const problem = createPlanningProblemFromPreset('blocks-world', 'planning-graph', 3);
const grounded = createGroundedProblem(problem);

const graph = buildPlanningGraph(grounded.initialLiterals, grounded.groundedActions, 5);
graph.layers.forEach((layer, i) => {
  console.log(`--- LAYER ${i} ---`);
  if (i > 0) {
    console.log(`Actions (count: ${layer.actions.length}):`, layer.actions.filter(a => !a.persistent).map(a => a.label).join(', '));
    console.log(`Action Mutexes:`, layer.actionMutex.length);
  }
  console.log(`Propositions (count: ${layer.propositions.length}):`, layer.propositions.join(', '));
  console.log(`Proposition Mutexes:`, layer.propositionMutex.length);
  const holdingA = layer.propositions.includes('Holding(A)');
  const holdingB = layer.propositions.includes('Holding(B)');
  if (holdingA && holdingB) {
      const isMutex = layer.propositionMutex.some(m => (m[0] === 'Holding(A)' && m[1] === 'Holding(B)') || (m[1] === 'Holding(A)' && m[0] === 'Holding(B)'));
      console.log(`Holding(A) and Holding(B) mutex? ${isMutex}`);
  }
});
