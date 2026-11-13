import manifest from './manifest.json';
import truthData from './truth.json';
import type { Box, ModelId, Point, Size } from '../src/types.js';

// Vite (and vitest) can import files as raw text; the same list feeds tests and the demo page.
const raw = import.meta.glob('./responses/*', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

export type Example = {
  id: string;
  model: ModelId;
  file: string;
  /** What the response should contain: both boxes, one point, or only the first box (cut-off or single-object responses). */
  expect: 'boxes' | 'points' | 'first-box';
  text: string;
};

export const TRUTH = truthData as { image: Size; boxes: Box[]; points: Point[] };

export const EXAMPLES: Example[] = (manifest as Omit<Example, 'text'>[]).map((m) => ({
  ...m,
  text: raw[`./responses/${m.file}`] ?? '',
}));

export function example(id: string): Example {
  const found = EXAMPLES.find((e) => e.id === id);
  if (!found) throw new Error(`Unknown example "${id}"`);
  return found;
}

/** Ground-truth boxes that an example is expected to reproduce. */
export function truthBoxes(ex: Example): Box[] {
  if (ex.expect === 'points') return [];
  return ex.expect === 'first-box' ? TRUTH.boxes.slice(0, 1) : TRUTH.boxes;
}
