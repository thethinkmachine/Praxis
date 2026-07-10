import katex from 'katex';
import { cn } from '@/lib/cn';

interface MathTextProps {
  value: string;
  className?: string;
}

function convertBigOExpression(value: string, startIndex: number): { tex: string; endIndex: number } | null {
  if (!value.startsWith('O(', startIndex)) return null;

  let depth = 0;
  for (let index = startIndex + 1; index < value.length; index += 1) {
    const char = value[index];
    if (char === '(') depth += 1;
    if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        const inner = value.slice(startIndex + 2, index);
        return {
          tex: `\\mathcal{O}\\!\\left(${toMathInner(inner)}\\right)`,
          endIndex: index + 1,
        };
      }
    }
  }

  return null;
}

function textToTex(value: string): string {
  return `\\text{${value.replace(/[\\{}]/g, '\\$&')}}`;
}

function toMathInner(value: string): string {
  return value
    .replace(/\b([a-z])([a-z])\b/g, '$1\\,$2')
    .replace(/⌊/g, '\\lfloor ')
    .replace(/⌋/g, ' \\rfloor')
    .replace(/ε/g, '\\varepsilon')
    .replace(/·|\*/g, '\\cdot')
    .replace(/\blog\b/g, '\\log')
    .replace(/\|([^|]+)\|/g, '\\lvert $1 \\rvert')
    .replace(/\^（/g, '^(')
    .replace(/\^\(([^)]+)\)/g, '^{$1}')
    .replace(/\^([A-Za-z0-9]+)/g, '^{$1}')
    .replace(/\s+/g, ' ')
    .trim();
}

function complexityToTex(value: string): string {
  let tex = '';
  let cursor = 0;

  while (cursor < value.length) {
    const expression = convertBigOExpression(value, cursor);
    if (expression) {
      tex += expression.tex;
      cursor = expression.endIndex;
      continue;
    }

    const nextExpression = value.indexOf('O(', cursor);
    const text = value.slice(cursor, nextExpression === -1 ? value.length : nextExpression);
    tex += text.trim()
      ? `\\;${textToTex(text.replace(/,\s*/g, ', '))}\\;`
      : text;
    cursor = nextExpression === -1 ? value.length : nextExpression;
  }

  return tex.trim();
}

export default function MathText({ value, className }: MathTextProps) {
  const html = katex.renderToString(complexityToTex(value), {
    throwOnError: false,
    strict: false,
    displayMode: false,
  });

  return (
    <span
      className={cn('inline-flex items-center leading-none [&_.katex]:text-[1em]', className)}
      aria-label={value}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
