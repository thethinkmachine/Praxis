// ---------------------------------------------------------------------------
// Pseudocode syntax-colour tokeniser
// Parses a pseudocode line into an array of {cls, text} tokens.
// All regexes are pre-compiled once at module scope.
// ---------------------------------------------------------------------------

export interface Token { cls: string; text: string }

const KW_PATTERN =
  '\\b(?:function|if|else|then|loop|return|for|each|while|do|begin|end|let|var|const|in|not|and|or|of|to|with|true|false|null|nil|prob)\\b';

const FN_PATTERN =
  '\\b(?:BFS|DFS|DLS|IDDFS|UCS|BidirectionalBFS|BiDirection|Search|search|pop|push|POP|PUSH|dequeue|enqueue|insert|contains|isEmpty|size|min|max|get|set|add|remove|expand|EXPAND|path|FAILURE|FOUND|GOAL|SOLUTION|INITIAL|IS[-_]GOAL|Node|RESULT|ACTIONS|backtrack)\\b';

const NUM_PATTERN = '\\b\\d+(?:\\.\\d+)?\\b';

const OP_PATTERN =
  '[←→≠≤≥⊆∪∩∧∨¬∈∉∅∞Δ]+|[=<>!+\\-*/^]=?|\\.\\.';

const PUNC_PATTERN = '[()\\[\\]{},;:]';

const CM_RE = /--.*$/;

const COMBINED_RE = new RegExp(
  `(${KW_PATTERN})|(${FN_PATTERN})|(${NUM_PATTERN})|(${OP_PATTERN})|(${PUNC_PATTERN})`,
  'g',
);

/**
 * Tokenise a single pseudocode line into classified spans.
 * Token classes: ps-kw (keyword), ps-fn (function), ps-num (number),
 * ps-op (operator), ps-punc (punctuation), ps-cm (comment), '' (plain).
 */
export function tokenise(line: string): Token[] {
  // Full-line comment
  const stripped = line.trimStart();
  if (stripped.startsWith('//') || stripped.startsWith('#') || stripped.startsWith('--')) {
    return [{ cls: 'ps-cm', text: line }];
  }

  // Separate trailing comment
  const cmMatch = CM_RE.exec(line);
  const codepart = cmMatch ? line.slice(0, cmMatch.index) : line;
  const comment  = cmMatch ? line.slice(cmMatch.index) : null;

  const tokens: Token[] = [];
  let last = 0;

  for (const m of codepart.matchAll(COMBINED_RE)) {
    if (m.index! > last) tokens.push({ cls: '', text: codepart.slice(last, m.index) });

    if (m[1])       tokens.push({ cls: 'ps-kw',   text: m[0] });
    else if (m[2])  tokens.push({ cls: 'ps-fn',   text: m[0] });
    else if (m[3])  tokens.push({ cls: 'ps-num',  text: m[0] });
    else if (m[4])  tokens.push({ cls: 'ps-op',   text: m[0] });
    else if (m[5])  tokens.push({ cls: 'ps-punc', text: m[0] });

    last = m.index! + m[0].length;
  }

  if (last < codepart.length) tokens.push({ cls: '', text: codepart.slice(last) });
  if (comment) tokens.push({ cls: 'ps-cm', text: comment });

  return tokens;
}
