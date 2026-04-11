import { beforeAll, describe, expect, it } from 'vitest';
import { registerAllAlgorithms } from '@/algorithms/register';
import { getNavigationCategoryGroups, getNavigationSegmentLabel } from '@/lib/navigation';

beforeAll(() => {
  registerAllAlgorithms();
});

describe('navigation metadata', () => {
  it('builds category groups from the algorithm registry, including planning and CSP entries', () => {
    const groups = getNavigationCategoryGroups();
    const gamePlayingGroup = groups.find((group) => group.category === 'game-playing');
    const planningGroup = groups.find((group) => group.category === 'planning');
    const cspGroup = groups.find((group) => group.category === 'constraint-satisfaction');

    expect(gamePlayingGroup).toBeTruthy();
    expect(gamePlayingGroup?.algorithms.some((algorithm) => algorithm.id === 'minimax')).toBe(true);
    expect(gamePlayingGroup?.algorithms.some((algorithm) => algorithm.path === '/play/tic-tac-toe/minimax')).toBe(true);

    expect(planningGroup).toBeTruthy();
    expect(planningGroup?.algorithms.some((algorithm) => algorithm.id === 'fssp')).toBe(true);
    expect(planningGroup?.algorithms.some((algorithm) => algorithm.path === '/planning/fssp?lab=state-space')).toBe(true);

    expect(cspGroup).toBeTruthy();
    expect(cspGroup?.algorithms.some((algorithm) => algorithm.id === 'ac-3')).toBe(true);
    expect(cspGroup?.algorithms.some((algorithm) => algorithm.path === '/csp/ac-3?lab=arc-consistency')).toBe(true);
  });

  it('resolves breadcrumb labels from shared metadata', () => {
    expect(getNavigationSegmentLabel('weighted-astar')).toBe('wA*');
    expect(getNavigationSegmentLabel('tic-tac-toe')).toBe('Tic-Tac-Toe Lab');
    expect(getNavigationSegmentLabel('n-queens')).toBe('N-Queens');
    expect(getNavigationSegmentLabel('planning-graph')).toBe('Planning Graph Lab');
    expect(getNavigationSegmentLabel('arc-consistency')).toBe('Arc Consistency Lab');
  });
});
