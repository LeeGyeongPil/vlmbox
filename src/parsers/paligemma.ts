import { EMPTY, type ParsedItems, type RawItem } from './common.js';

const BOX = /<loc(\d{4})><loc(\d{4})><loc(\d{4})><loc(\d{4})>\s*([^;<]*)/g;

/** PaliGemma: <locYYYY><locXXXX><locYYYY><locXXXX> label ; ... (values are y1,x1,y2,x2 as written). */
export function parsePaliGemma(text: string, fallbackLabel = ''): ParsedItems {
  const items: RawItem[] = [];
  for (const m of text.matchAll(BOX)) {
    const values = [m[1], m[2], m[3], m[4]].map(Number);
    items.push({ kind: 'box', label: (m[5] ?? '').trim() || fallbackLabel, values });
  }
  return items.length ? { items, found: true, warnings: [] } : EMPTY;
}
