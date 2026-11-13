import { extractJson } from '../extract.js';
import type { GroundingWarning } from '../types.js';
import { EMPTY, skipped, type ParsedItems, type RawItem } from './common.js';
import { findItemArray, labelOf } from './json-grounding.js';

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Moondream: detect gives {"objects":[{x_min,y_min,x_max,y_max}]}, point gives {"points":[{x,y}]},
 * all as 0-1 fractions. Values are returned in x-first order.
 */
export function parseMoondream(input: string | object, fallbackLabel = ''): ParsedItems {
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
  const arr = findItemArray(value, ['x_min', 'x']);
  if (!arr) return EMPTY;
  const items: RawItem[] = [];
  arr.forEach((entry, index) => {
    const rec = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<string, unknown>;
    const label = labelOf(rec, fallbackLabel);
    if ('x_min' in rec) {
      const values = [rec.x_min, rec.y_min, rec.x_max, rec.y_max];
      if (values.every(num)) items.push({ kind: 'box', label, values });
      else warnings.push(skipped(index, 'x_min, y_min, x_max, y_max must all be numbers'));
    } else if ('x' in rec) {
      if (num(rec.x) && num(rec.y)) items.push({ kind: 'point', label, values: [rec.x, rec.y] });
      else warnings.push(skipped(index, 'x and y must be numbers'));
    } else {
      warnings.push(skipped(index, 'neither x_min.. nor x, y found'));
    }
  });
  return { items, found: true, warnings };
}
