import type { GameProblem } from '@/types/problem';
import type { GameDomain } from './domain';
import { gameTreeDomain } from './game-tree.domain';

export function resolveGameDomain(_problem: GameProblem): GameDomain<GameProblem, unknown> {
  return gameTreeDomain as unknown as GameDomain<GameProblem, unknown>;
}
