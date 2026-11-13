import { EMPTY, type ParsedItems, type RawItem } from './common.js';

const BOX = /([^<]*)<loc_(\d+)><loc_(\d+)><loc_(\d+)><loc_(\d+)>/g;

/** Florence-2: label<loc_x1><loc_y1><loc_x2><loc_y2>; a box without a label reuses the previous one. */
export function parseFlorence2(text: string, fallbackLabel = ''): ParsedItems {
  const clean = text.replace(/<\/?s>|<pad>/g, '');
  const items: RawItem[] = [];
  let last = fallbackLabel;
  for (const m of clean.matchAll(BOX)) {
    const label = (m[1] ?? '').trim() || last;
    last = label;
    const values = [m[2], m[3], m[4], m[5]].map(Number);
    items.push({ kind: 'box', label, values });
  }
  return items.length ? { items, found: true, warnings: [] } : EMPTY;
}
