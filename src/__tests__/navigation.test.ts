import { beforeAll, describe, expect, it } from 'vitest';
import { registerAllAlgorithms } from '@/algorithms/register';
import { getNavigationCategoryGroups, getNavigationSegmentLabel } from '@/lib/navigation';

beforeAll(() => {
  registerAllAlgorithms();
});

describe('navigation metadata', () => {
  it('builds category groups from the algorithm registry, including game-playing entries', () => {
    const groups = getNavigationCategoryGroups();
    const gamePlayingGroup = groups.find((group) => group.category === 'game-playing');

    expect(gamePlayingGroup).toBeTruthy();
    expect(gamePlayingGroup?.algorithms.some((algorithm) => algorithm.id === 'minimax')).toBe(true);
    expect(gamePlayingGroup?.algorithms.some((algorithm) => algorithm.path === '/play/tic-tac-toe/minimax')).toBe(true);
  });

  it('resolves breadcrumb labels from shared metadata', () => {
    expect(getNavigationSegmentLabel('weighted-astar')).toBe('wA*');
    expect(getNavigationSegmentLabel('tic-tac-toe')).toBe('Tic-Tac-Toe Lab');
    expect(getNavigationSegmentLabel('n-queens')).toBe('N-Queens');
  });
});
