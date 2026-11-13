import type { Convention } from './conventions.js';
import type { RawItem } from './parsers/common.js';
import type { Box, GroundingWarning, Point, Size } from './types.js';

const EPS = 1e-6;

type Out = { boxes: Box[]; points: Point[]; warnings: GroundingWarning[] };

/**
 * Convert raw items to original-image pixels with one formula:
 *   pixel = (value + bin) * image / frame
 * where `frame` is the extent the model's numbers refer to.
 */
export function normalizeItems(
  items: RawItem[],
  conv: Convention,
  frame: Size,
  image: Size,
  clamp: boolean,
  fallbackLabel: string,
): Out {
  const sx = image.width / frame.width;
  const sy = image.height / frame.height;
  const bin = conv.binCenter ? 0.5 : 0;
  const out: Out = { boxes: [], points: [], warnings: [] };

  const fitX = (v: number, where: string, index: number, label: string): number =>
    fit(v, image.width, where, index, label);
  const fitY = (v: number, where: string, index: number, label: string): number =>
    fit(v, image.height, where, index, label);
  let clampedNow: GroundingWarning | null = null;
  const fit = (v: number, max: number, where: string, index: number, label: string): number => {
    if (!clamp || (v >= -EPS && v <= max + EPS)) return v;
    const clamped = Math.min(max, Math.max(0, v));
    if (!clampedNow) {
      clampedNow = {
        code: 'clamped',
        message: `Item "${label}" was outside the image and was clamped to it.`,
        detail: { index, label, from: [] as string[] },
      };
      out.warnings.push(clampedNow);
    }
    (clampedNow.detail?.from as string[]).push(`${where}: ${round2(v)} -> ${clamped}`);
    return clamped;
  };

  for (const item of items) {
    clampedNow = null;
    const [a = 0, b = 0, c = 0, d = 0] = item.values;
    if (item.kind === 'point') {
      const [px, py] = conv.axis === 'xy' ? [a, b] : [b, a];
      const index = out.points.length;
      out.points.push({
        label: item.label || fallbackLabel,
        x: fitX(((px + bin) * image.width) / frame.width, 'x', index, item.label),
        y: fitY(((py + bin) * image.height) / frame.height, 'y', index, item.label),
      });
      continue;
    }
    const [v1, w1, v2, w2] = conv.axis === 'xy' ? [a, b, c, d] : [b, a, d, c];
    let x1 = (v1 + bin) * sx;
    let y1 = (w1 + bin) * sy;
    let x2 = (v2 + bin) * sx;
    let y2 = (w2 + bin) * sy;
    const index = out.boxes.length;
    if (x1 > x2 || y1 > y2) {
      if (x1 > x2) [x1, x2] = [x2, x1];
      if (y1 > y2) [y1, y2] = [y2, y1];
      out.warnings.push({
        code: 'swapped-corners',
        message: `Item "${item.label}" had its corners in reverse order; they were swapped.`,
        detail: { index, label: item.label },
      });
    }
    const label = item.label || fallbackLabel;
    out.boxes.push({
      label,
      x1: fitX(x1, 'x1', index, label),
      y1: fitY(y1, 'y1', index, label),
      x2: fitX(x2, 'x2', index, label),
      y2: fitY(y2, 'y2', index, label),
    });
  }
  return out;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
