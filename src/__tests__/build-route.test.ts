import { describe, expect, it } from 'vitest';
import { buildRoute } from '@/lib/buildRoute';

describe('buildRoute', () => {
  it('uses the default game module for game-playing algorithms', () => {
    expect(buildRoute({ id: 'minimax', category: 'game-playing' }, 'game')).toBe('/play/tic-tac-toe/minimax');
    expect(buildRoute({ id: 'expectimax', category: 'game-playing' }, 'game')).toBe('/play/tic-tac-toe/expectimax');
  });

  it('supports an explicit game module override', () => {
    expect(buildRoute({ id: 'alpha-beta', category: 'game-playing' }, 'game', { gameLabId: 'tic-tac-toe' })).toBe('/play/tic-tac-toe/alpha-beta');
    expect(buildRoute({ id: 'mcts', category: 'game-playing' }, 'game', { gameLabId: 'tic-tac-toe' })).toBe('/play/tic-tac-toe/mcts');
  });

  it('preserves existing local-search routing', () => {
    expect(buildRoute({ id: 'tabu-search', category: 'local-search' }, 'local-search')).toBe('/local/tabu-search');
    expect(buildRoute({ id: 'ant-colony-optimization', category: 'local-search' }, 'local-search')).toBe('/local/ant-colony-optimization');
  });

  it('uses default planning labs for planning algorithms', () => {
    expect(buildRoute({ id: 'fssp', category: 'planning' }, 'planning')).toBe('/planning/fssp?lab=state-space');
    expect(buildRoute({ id: 'graphplan', category: 'planning' }, 'planning')).toBe('/planning/graphplan?lab=planning-graph');
    expect(buildRoute({ id: 'pop', category: 'planning' }, 'planning')).toBe('/planning/pop?lab=partial-order');
  });

  it('uses default CSP labs for CSP algorithms', () => {
    expect(buildRoute({ id: 'backtracking-search', category: 'constraint-satisfaction' }, 'constraint-satisfaction')).toBe('/csp/backtracking-search?lab=constraint-network');
    expect(buildRoute({ id: 'ac-3', category: 'constraint-satisfaction' }, 'constraint-satisfaction')).toBe('/csp/ac-3?lab=arc-consistency');
    expect(buildRoute({ id: 'tree-csp', category: 'constraint-satisfaction' }, 'constraint-satisfaction')).toBe('/csp/tree-csp?lab=structure');
  });
});
