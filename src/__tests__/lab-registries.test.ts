import { describe, expect, it } from 'vitest';
import { DISCOVERY_ITEMS_BY_CATEGORY } from '@/lib/discovery-items';
import { GAME_PLAYING_LAB_DEFINITIONS } from '@/problems/game-playing/labs';
import { LOCAL_SEARCH_LAB_DEFINITIONS } from '@/problems/local-search/labs';
import { MAZE_LAB_DEFINITIONS } from '@/problems/maze/labs';
import { SEARCH_LAB_DEFINITIONS } from '@/problems/search/labs';

describe('Lab Registries', () => {
  it('derives uninformed-search home labs from maze and search registries', () => {
    const expectedIds = [
      ...MAZE_LAB_DEFINITIONS.filter((lab) => lab.category === 'uninformed-search').map((lab) => lab.id),
      ...SEARCH_LAB_DEFINITIONS.filter((lab) => lab.category === 'uninformed-search').map((lab) => lab.id),
    ];

    expect(DISCOVERY_ITEMS_BY_CATEGORY['uninformed-search']?.map((item) => item.id)).toEqual(expectedIds);
  });

  it('derives informed-search home labs from maze and search registries', () => {
    const expectedIds = [
      ...MAZE_LAB_DEFINITIONS.filter((lab) => lab.category === 'informed-search').map((lab) => lab.id),
      ...SEARCH_LAB_DEFINITIONS.filter((lab) => lab.category === 'informed-search').map((lab) => lab.id),
    ];

    expect(DISCOVERY_ITEMS_BY_CATEGORY['informed-search']?.map((item) => item.id)).toEqual(expectedIds);
  });

  it('derives game-playing and local-search home labs from their registries', () => {
    expect(DISCOVERY_ITEMS_BY_CATEGORY['game-playing']?.map((item) => item.id)).toEqual(
      GAME_PLAYING_LAB_DEFINITIONS.map((lab) => `${lab.id}-lab`),
    );

    expect(DISCOVERY_ITEMS_BY_CATEGORY['local-search']?.map((item) => item.id)).toEqual(
      LOCAL_SEARCH_LAB_DEFINITIONS.map((lab) => `${lab.id}-lab`),
    );
  });
});