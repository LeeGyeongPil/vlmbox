import { EMPTY, type ParsedItems, type RawItem } from './common.js';

const BOX =
  /(?:<\|object_ref_start\|>([^<]*)<\|object_ref_end\|>\s*)?<\|box_start\|>\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)\s*,\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)\s*<\|box_end\|>/g;

/** Qwen2-VL: <|object_ref_start|>cat<|object_ref_end|><|box_start|>(x1,y1),(x2,y2)<|box_end|> */
export function parseQwen2Tokens(text: string, fallbackLabel = ''): ParsedItems {
  const items: RawItem[] = [];
  for (const m of text.matchAll(BOX)) {
    const values = [m[2], m[3], m[4], m[5]].map(Number);
    items.push({ kind: 'box', label: (m[1] ?? '').trim() || fallbackLabel, values });
  }
  return items.length ? { items, found: true, warnings: [] } : EMPTY;
}
