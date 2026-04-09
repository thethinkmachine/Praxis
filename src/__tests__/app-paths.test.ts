import { describe, expect, it } from 'vitest';
import { joinBasePath, normalizeBasePath } from '@/lib/app-paths';

describe('app paths', () => {
  it('normalizes root and nested base paths', () => {
    expect(normalizeBasePath('/')).toBe('/');
    expect(normalizeBasePath('/Praxis/')).toBe('/Praxis');
    expect(normalizeBasePath('/nested/app///')).toBe('/nested/app');
  });

  it('joins application paths without duplicating slashes', () => {
    expect(joinBasePath('/', 'maze/bfs')).toBe('/maze/bfs');
    expect(joinBasePath('/Praxis', 'maze/bfs')).toBe('/Praxis/maze/bfs');
    expect(joinBasePath('/Praxis', '/problems/graphs/romania-map.json')).toBe('/Praxis/problems/graphs/romania-map.json');
    expect(joinBasePath('/Praxis', '')).toBe('/Praxis');
  });
});
