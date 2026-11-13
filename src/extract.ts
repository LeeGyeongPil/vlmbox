export type Extracted = { value: unknown; truncated: boolean };

/** Text inside the first code fence (an unclosed fence runs to the end), or the whole text. */
function stripFence(text: string): string {
  const m = /```[a-zA-Z0-9_-]*\s*([\s\S]*?)(?:```|$)/.exec(text);
  return m ? (m[1] ?? '') : text;
}

type Scan = {
  /** Index just after the root value closed, or -1 if it never closed. */
  end: number;
  /** Repaired candidate text when the root never closed (complete array items only). */
  repaired: string | null;
};

/**
 * Walk the text from `start` tracking strings and brackets. If the root value closes, report where.
 * Otherwise (cut off at max tokens) keep the text up to the last item that closed directly inside
 * an array and close the remaining brackets.
 */
function scan(text: string, start: number): Scan {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let lastItem = -1;
  let lastItemStack: string[] = [];
  for (let i = start; i < text.length; i++) {
    const c = text[i] as string;
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '[' || c === '{') stack.push(c);
    else if (c === ']' || c === '}') {
      stack.pop();
      if (stack.length === 0) return { end: i + 1, repaired: null };
      if (stack[stack.length - 1] === '[') {
        lastItem = i + 1;
        lastItemStack = stack.slice();
      }
    }
  }
  if (lastItem < 0) return { end: -1, repaired: null };
  const closers = lastItemStack
    .reverse()
    .map((b) => (b === '[' ? ']' : '}'))
    .join('');
  return { end: -1, repaired: text.slice(start, lastItem) + closers };
}

function tryParse(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * Pull a JSON value out of a model response: strips code fences and surrounding prose and
 * recovers the complete items of a response cut off mid-array. Returns null if nothing usable.
 */
export function extractJson(text: string): Extracted | null {
  const body = stripFence(text);
  const whole = tryParse(body.trim());
  if (whole.ok) return { value: whole.value, truncated: false };
  const start = body.search(/[[{]/);
  if (start < 0) return null;
  const s = scan(body, start);
  if (s.end > 0) {
    const part = tryParse(body.slice(start, s.end));
    return part.ok ? { value: part.value, truncated: false } : null;
  }
  if (s.repaired) {
    const fixed = tryParse(s.repaired);
    return fixed.ok ? { value: fixed.value, truncated: true } : null;
  }
  return null;
}
