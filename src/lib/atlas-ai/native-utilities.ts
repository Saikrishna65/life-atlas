/** Pure local utilities. Never evaluate user text as code or perform an action. */
export type NativeUtilityReply = { kind: 'utility.math' | 'utility.calendar'; text: string };

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function calculate(raw: string): string | null {
  const explicit = /^(?:calculate|compute|what is|what's)\s+/i.test(raw);
  const body = raw.replace(/^(?:calculate|compute|what is|what's)\s+/i, '').replace(/[?.]$/, '').trim();
  // Unprefixed dates, fractions written as dates, and numeric IDs are ambiguous.
  if (!explicit && /^\d{1,4}[-/]\d{1,2}(?:[-/]\d{1,4})?$/.test(body)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(body)) return null;
  const expr = body.toLowerCase()
    .replace(/\bplus\b/g, '+').replace(/\bminus\b/g, '-')
    .replace(/\b(times|multiplied by)\b/g, '*').replace(/\bdivided by\b/g, '/')
    .replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  if (expr.length > 160 || !/^[\d.\s()+*/%\-]+$/.test(expr) || !/[+*/%\-]/.test(expr.slice(1))) return null;
  const tokens = expr.match(/\d+(?:\.\d*)?|\.\d+|[()+*/%\-]/g) ?? [];
  if (tokens.length > 80 || tokens.join('') !== expr.replace(/\s/g, '')) return null;
  let i = 0;
  let approximate = false;
  const bounded = (n: number) => {
    if (!Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER) throw new Error('The number is outside the supported range.');
    return n;
  };
  function atom(depth: number): number {
    if (depth > 16) throw new Error('The expression is too complex.');
    const token = tokens[i++];
    if (token === '+' || token === '-') return bounded((token === '-' ? -1 : 1) * atom(depth + 1));
    if (token === '(') {
      const n = sum(depth + 1);
      if (tokens[i++] !== ')') throw new Error('Check the parentheses.');
      return n;
    }
    if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) throw new Error('Check the numbers and operators.');
    if (token.replace(/\D/g, '').length > 15) throw new Error('The number has too many digits.');
    return bounded(Number(token));
  }
  function product(depth: number): number {
    let n = atom(depth);
    while (['*', '/', '%'].includes(tokens[i])) {
      const op = tokens[i++], b = atom(depth);
      if ((op === '/' || op === '%') && b === 0) throw new Error("You can't divide by zero.");
      n = bounded(op === '*' ? n * b : op === '/' ? n / b : n % b);
    }
    return n;
  }
  function sum(depth: number): number {
    let n = product(depth);
    while (tokens[i] === '+' || tokens[i] === '-') {
      const op = tokens[i++], b = product(depth);
      n = bounded(op === '+' ? n + b : n - b);
    }
    return n;
  }
  try {
    const result = sum(0);
    if (i !== tokens.length) return 'Check the numbers and operators.';
    const rounded = Number.isSafeInteger(result) ? result : Number(result.toPrecision(12));
    approximate = rounded !== result;
    return `${approximate ? "Approximately" : "That's"} ${rounded.toLocaleString('en-US', {maximumSignificantDigits: Number.isSafeInteger(rounded) ? 16 : 12})}.`;
  } catch (e) { return e instanceof Error ? e.message : 'Check the expression.'; }
}

function calendar(raw: string): string | null {
  const m = /^(?:it's |it is )?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) at (\d{1,2})(?::(\d{2}))?\s*(AM|PM)[.,]?\s+what day and time will it be after (\d{1,5}) hours\??$/i.exec(raw);
  if (!m) return null;
  const hour = Number(m[2]), minute = Number(m[3] ?? 0);
  if (hour < 1 || hour > 12 || minute > 59) return 'Check the starting time.';
  const day = weekdays.findIndex(d => d.toLowerCase() === m[1].toLowerCase());
  const total = day * 1440 + ((hour % 12) + (m[4].toLowerCase() === 'pm' ? 12 : 0)) * 60 + minute + Number(m[5]) * 60;
  const h = Math.floor((total % 1440) / 60), min = total % 60;
  return `${weekdays[Math.floor(total / 1440) % 7]} at ${h % 12 || 12}:${String(min).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}.`;
}

export function resolveNativeUtility(input: string): NativeUtilityReply | null {
  const raw = input.trim().replace(/’/g, "'");
  const dateReply = calendar(raw);
  if (dateReply !== null) return {kind: 'utility.calendar', text: dateReply};
  const mathReply = calculate(raw);
  return mathReply === null ? null : {kind: 'utility.math', text: mathReply};
}
