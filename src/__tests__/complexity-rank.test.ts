import { describe, expect, it } from 'vitest';
import { complexityRank } from '@/lib/complexity-rank';

// Every distinct timeComplexity/spaceComplexity string in use across the
// algorithm registry, as of the sort/filter feature landing — a regression
// guard so a future addition doesn't silently produce NaN/undefined ranks.
const KNOWN_COMPLEXITY_STRINGS = [
  'Exponential in worst case',
  'NP-complete per horizon',
  'O((V + E) log V)',
  'O(b^(1+⌊C*/ε⌋))',
  'O(b^(d/2))',
  'O(b^d)',
  'O(b^l)',
  'O(b^m)',
  'O(b^m), best case O(b^(m/2))',
  'O(d^c * (n-c) * d^2)',
  'O(g · a · d · b)',
  'O(g · p · b)',
  'O(k · b · g)',
  'O(k · b)',
  'O(k · d)',
  'O(k)',
  'O(n * d^2)',
  'O(r · k · b)',
  'Problem-dependent',
  'O(1)',
  'O(M)',
  'O(V)',
  'O(b)',
  'O(bd)',
  'O(bl)',
  'O(bm)',
  'O(d)',
  'O(e)',
  'O(m)',
  'O(n + d)',
  'O(n)',
  'O(p)',
  'O(t)',
  'O(|OPEN| + |boundary| + |relay|)',
];

describe('complexityRank', () => {
  it('returns a finite number for every known complexity string in the registry', () => {
    for (const value of KNOWN_COMPLEXITY_STRINGS) {
      expect(Number.isFinite(complexityRank(value))).toBe(true);
    }
  });

  it('returns +Infinity for a missing value', () => {
    expect(complexityRank(undefined)).toBe(Number.POSITIVE_INFINITY);
  });

  it('ranks constant time as the lowest rank', () => {
    expect(complexityRank('O(1)')).toBe(0);
    expect(complexityRank('O(1)')).toBeLessThan(complexityRank('O(k)'));
  });

  it('ranks more multiplied factors as higher (worse) than fewer', () => {
    expect(complexityRank('O(k)')).toBeLessThan(complexityRank('O(k · b)'));
    expect(complexityRank('O(k · b)')).toBeLessThan(complexityRank('O(g · p · b)'));
    expect(complexityRank('O(g · p · b)')).toBeLessThan(complexityRank('O(g · a · d · b)'));
  });

  it('ranks a halved exponent (bidirectional search) below the equivalent full exponential', () => {
    expect(complexityRank('O(b^(d/2))')).toBeLessThan(complexityRank('O(b^d)'));
    expect(complexityRank('O(b^m), best case O(b^(m/2))')).toBeLessThan(complexityRank('O(b^m)'));
  });

  it('ranks log-based complexity well below exponential complexity', () => {
    expect(complexityRank('O((V + E) log V)')).toBeLessThan(complexityRank('O(k · b)'));
    expect(complexityRank('O((V + E) log V)')).toBeLessThan(complexityRank('O(b^d)'));
  });

  it('does not mistake a squared/fixed exponent for a growing one', () => {
    // n * d^2 and d^c * (n-c) * d^2 are polynomial (c and 2 are bounded),
    // not exponential in the search-space depth the way b^d is.
    expect(complexityRank('O(n * d^2)')).toBeLessThan(complexityRank('O(b^d)'));
    expect(complexityRank('O(d^c * (n-c) * d^2)')).toBeLessThan(complexityRank('O(b^d)'));
  });

  it('ranks exponential complexity below the unknown/problem-dependent sentinel', () => {
    expect(complexityRank('O(b^d)')).toBeLessThan(complexityRank('Problem-dependent'));
    expect(complexityRank('NP-complete per horizon')).toBeLessThan(complexityRank('Problem-dependent'));
  });

  it('treats a glued two-letter product like an explicit one-factor product', () => {
    expect(complexityRank('O(bd)')).toBeLessThan(complexityRank('O(g · p · b)'));
  });
});
