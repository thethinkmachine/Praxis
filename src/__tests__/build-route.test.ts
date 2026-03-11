import { describe, expect, it } from 'vitest';
import { buildRoute } from '@/lib/buildRoute';

describe('buildRoute', () => {
  it('uses the default game module for game-playing algorithms', () => {
    expect(buildRoute({ id: 'minimax', category: 'game-playing' }, 'game')).toBe('/play/tic-tac-toe/minimax');
  });

  it('supports an explicit game module override', () => {
    expect(buildRoute({ id: 'alpha-beta', category: 'game-playing' }, 'game', { gameLabId: 'tic-tac-toe' })).toBe('/play/tic-tac-toe/alpha-beta');
  });

  it('preserves existing local-search routing', () => {
    expect(buildRoute({ id: 'tabu-search', category: 'local-search' }, 'local-search')).toBe('/local/tabu-search');
  });
});