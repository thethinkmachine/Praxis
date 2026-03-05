export function formatNumber(n: number, decimals = 2): string {
  if (!isFinite(n)) return '∞';
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(decimals);
}

export function formatMs(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatComplexity(expr: string): string {
  return expr;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function toTitleCase(s: string): string {
  return s
    .split(/[-_\s]/)
    .map(capitalize)
    .join(' ');
}
