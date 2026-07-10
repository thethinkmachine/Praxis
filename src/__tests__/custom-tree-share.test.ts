import { describe, it, expect } from 'vitest';
import { serializeGameTree, deserializeGameTree } from '@/problems/game-playing/custom-tree-share';
import { getCustomTreeScenario } from '@/problems/game-playing/custom-tree-lab';

describe('custom-tree share round-trip', () => {
  it('preserves node positions through serialize -> deserialize', () => {
    const problem = getCustomTreeScenario('classic-minimax');
    // Give nodes explicit positions like the editor store would.
    problem.tree.nodes.forEach((n, i) => { n.x = i * 100; n.y = i * 50; });

    const token = serializeGameTree(problem.tree);
    const back = deserializeGameTree(token);

    expect(back).not.toBeNull();
    expect(back!.tree.nodes.length).toBe(problem.tree.nodes.length);
    expect(back!.tree.rootId).toBe(problem.tree.rootId);
    // positions survive
    const first = back!.tree.nodes[0];
    expect(first.x).toBe(0);
    expect(first.y).toBe(0);
    const some = back!.tree.nodes[2];
    expect(some.x).toBe(200);
    expect(some.y).toBe(100);
  });

  it('survives a URL query round-trip (encodeURIComponent + URLSearchParams)', () => {
    const problem = getCustomTreeScenario('classic-minimax');
    const token = serializeGameTree(problem.tree);

    // Exactly how the app builds and later reads the link.
    const query = `?t=${encodeURIComponent(token)}`;
    const readBack = new URLSearchParams(query).get('t');

    expect(readBack).toBe(token);
    const back = deserializeGameTree(readBack!);
    expect(back).not.toBeNull();
    expect(back!.tree.nodes.length).toBe(problem.tree.nodes.length);
  });

  it('returns null (not a throw) for a corrupt token', () => {
    expect(deserializeGameTree('not-valid-base64-$$$')).toBeNull();
  });
});
