import type { GroundingWarning } from '../types.js';

/** One box (4 numbers) or point (2 numbers) as written by the model, before any conversion. */
export type RawItem = { kind: 'box' | 'point'; label: string; values: number[] };

export type ParsedItems = {
  items: RawItem[];
  /** False when the response had none of the structure this format uses. */
  found: boolean;
  warnings: GroundingWarning[];
};

export function isNumbers(value: unknown, count: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === count &&
    value.every((v) => typeof v === 'number' && Number.isFinite(v))
  );
}

export function skipped(index: number, reason: string): GroundingWarning {
  return {
    code: 'skipped-item',
    message: `Skipped item ${index}: ${reason}.`,
    detail: { index, reason },
  };
}

export const EMPTY: ParsedItems = { items: [], found: false, warnings: [] };
