export function evaluationFormula(algo: string): string {
  if (algo === 'greedy-bfs') return 'f(n) = h(n)';
  if (algo === 'weighted-astar') return 'f(n) = g(n) + w * h(n)';
  if (algo === 'bidirectional-astar') return 'f_f(n) = g_f(n) + h_f(n),   f_b(n) = g_b(n) + h_b(n)';
  if (algo === 'rbfs' || algo === 'sma-star') return 'f(n) = g(n) + h(n) with memory-bounded best-first control';
  if (algo === 'smgs') return 'f(n) = g(n) + h(n) with sparse closed-memory pruning of kernel nodes';
  if (algo === 'astar' || algo === 'ida-star') return 'f(n) = g(n) + h(n)';
  return 'Heuristic scoring is not used by this algorithm.';
}
