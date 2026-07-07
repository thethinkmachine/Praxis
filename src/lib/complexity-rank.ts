/**
 * Assigns a Big-O-ish complexity string a rough ordinal rank for sorting
 * purposes only. This is NOT a rigorous cross-algorithm comparison — different
 * families use incomparable variables (b/d/m branching-factor/depth vs V/E
 * graph size vs k/g/p population/generation counts), so two algorithms with
 * the same rank aren't necessarily equally fast. It only captures the rough
 * shape of the expression — constant < linear < low-degree polynomial <
 * high-degree polynomial < exponential (halved exponent, e.g. bidirectional
 * search, ranks below a full exponential) < unknown — well enough to give a
 * sensible ordering when browsing.
 */
export function complexityRank(value: string | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const v = value.toLowerCase().trim();

  if (v.includes('problem-dependent')) return 900;
  if (v.includes('np-complete')) return 850;
  if (v === 'o(1)') return 0;

  // A caret followed by "(" or one of this codebase's depth/limit variables
  // (d, m, l) reads as a growing exponent (b^d, b^m, b^(d/2)); a caret
  // followed by a small fixed exponent (d^2, d^c for a bounded cutset size)
  // is handled as a polynomial factor below instead.
  const hasGrowingExponent = /\^[dml(]/i.test(v) || v.includes('exponential');
  if (hasGrowingExponent) {
    // Bidirectional search halves the exponent, which shrinks the search
    // space dramatically relative to the equivalent one-directional search.
    return v.includes('/2') ? 600 : 700;
  }

  if (v.includes('log')) return 150;

  const inner = v.match(/^o\(([^)]*)\)$/)?.[1] ?? v;

  // Count multiplicative "factors": explicit ·/*, letters glued together the
  // way AIMA writes O(bd) for a product of two variables, or a squared term.
  const explicitFactors = (v.match(/[·*]/g) || []).length;
  const gluedLetters = /^[a-z]{2,4}$/.test(inner) ? inner.length - 1 : 0;
  const squaredTerms = (v.match(/\^[0-9]/g) || []).length;
  const factors = Math.max(explicitFactors, gluedLetters) + squaredTerms;

  if (factors >= 3) return 500;
  if (factors === 2) return 400;
  if (factors === 1) return 300;

  if (v.includes('+')) return 250;

  if (/^[a-z]$/.test(inner)) return 100;

  return 350;
}
