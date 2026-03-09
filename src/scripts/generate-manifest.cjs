const fs = require('fs');
const path = require('path');

const graphsDir = path.join(__dirname, '../../public/problems/graphs');
const files = fs.readdirSync(graphsDir).filter(f => f.endsWith('.json') && f !== '_manifest.json');

const uninformed = [];
const informed = [];

for (const file of files) {
  const content = JSON.parse(fs.readFileSync(path.join(graphsDir, file), 'utf8'));
  
  // Create a base metadata object from the JSON
  const meta = {
    id: file,
    name: content.name || file.replace('.json', ''),
    description: content.description || 'A Custom Graph Problem',
    difficulty: content.difficulty || 'medium',
    estimatedSteps: content.estimatedSteps || Math.round(content.problem.graph.nodes.length * 2.5),
    hint: content.hint || 'Custom loaded problem',
    tags: content.tags || ['custom', 'graph']
  };

  // Decide which lists to put it in based on heuristic usages
  if (!content.problem.useHeuristic) {
    uninformed.push(meta);
  } else {
    // If it has a heuristic, it can be tested in both
    uninformed.push({ ...meta, tags: [...meta.tags, 'uninformed'] });
    informed.push({ ...meta, tags: [...meta.tags, 'heuristic'] });
  }
}

// Generate the manifest
const manifest = {
  version: 1,
  'uninformed-search': uninformed,
  'informed-search': informed,
  'game-playing': []
};

fs.writeFileSync(path.join(graphsDir, '_manifest.json'), JSON.stringify(manifest, null, 2));
console.log("Manifest built successfully");
