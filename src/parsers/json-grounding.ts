import { extractJson } from '../extract.js';
import type { GroundingWarning } from '../types.js';
import { EMPTY, isNumbers, skipped, type ParsedItems, type RawItem } from './common.js';

export type JsonKeys = { box: string[]; point: string[] };

/** Properties that commonly wrap the item list, e.g. Gemini's {"boxes": [...]}. */
const WRAPPERS = ['boxes', 'objects', 'detections', 'items', 'results', 'points'];

/** Find the array of items in a parsed value, or null if there is none. */
export function findItemArray(value: unknown, keys: string[]): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'object' || value === null) return null;
  const rec = value as Record<string, unknown>;
  for (const w of WRAPPERS) {
    if (Array.isArray(rec[w])) return rec[w] as unknown[];
  }
  if (keys.some((k) => k in rec)) return [value];
  return null;
}

export function labelOf(item: Record<string, unknown>, fallback = ''): string {
  const raw = item.label ?? item.name ?? item.text;
  return typeof raw === 'string' || typeof raw === 'number' ? String(raw) : fallback;
}

/**
 * Read JSON items such as [{"bbox_2d": [x1,y1,x2,y2], "label": "cat"}].
 * Accepts text (fences, prose, truncation tolerated) or an already parsed value.
 */
export function parseJsonItems(input: string | object, keys: JsonKeys): ParsedItems {
  const warnings: GroundingWarning[] = [];
  let value: unknown = input;
  if (typeof input === 'string') {
    const extracted = extractJson(input);
    if (!extracted) return EMPTY;
    value = extracted.value;
    if (extracted.truncated) {
      warnings.push({
        code: 'truncated-json',
        message: 'The response was cut off; only the complete items were kept.',
      });
    }
  }
  const arr = findItemArray(value, [...keys.box, ...keys.point]);
  if (!arr) return EMPTY;
  const items: RawItem[] = [];
  arr.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      warnings.push(skipped(index, 'not an object'));
      return;
    }
    const rec = entry as Record<string, unknown>;
    const label = labelOf(rec);
    const boxKey = keys.box.find((k) => k in rec);
    const pointKey = keys.point.find((k) => k in rec);
    if (boxKey && isNumbers(rec[boxKey], 4)) {
      items.push({ kind: 'box', label, values: rec[boxKey] as number[] });
    } else if (pointKey && isNumbers(rec[pointKey], 2)) {
      items.push({ kind: 'point', label, values: rec[pointKey] as number[] });
    } else if (boxKey || pointKey) {
      warnings.push(skipped(index, `"${boxKey ?? pointKey}" is not a list of ${boxKey ? 4 : 2} numbers`));
    } else {
      warnings.push(skipped(index, `none of the expected keys (${[...keys.box, ...keys.point].join(', ')}) found`));
    }
  });
  return { items, found: true, warnings };
}
