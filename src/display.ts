import type { Box, FitMode, Point, Size } from './types.js';

type Mapping = { scaleX: number; scaleY: number; offsetX: number; offsetY: number };

/** Scale and offset that CSS object-fit (position: center) applies to the image inside its box. */
function mapping(natural: Size, rendered: Size, fit: FitMode): Mapping {
  const sx = rendered.width / natural.width;
  const sy = rendered.height / natural.height;
  if (fit === 'fill') return { scaleX: sx, scaleY: sy, offsetX: 0, offsetY: 0 };
  let s: number;
  if (fit === 'contain') s = Math.min(sx, sy);
  else if (fit === 'cover') s = Math.max(sx, sy);
  else if (fit === 'none') s = 1;
  else s = Math.min(1, sx, sy); // scale-down
  return {
    scaleX: s,
    scaleY: s,
    offsetX: (rendered.width - natural.width * s) / 2,
    offsetY: (rendered.height - natural.height * s) / 2,
  };
}

/**
 * Map a box or point from original-image pixels to coordinates inside the element that shows
 * the image (CSS pixels), honouring object-fit letterboxing and cropping.
 */
export function toDisplay<T extends Box | Point>(
  item: T,
  natural: Size,
  rendered: Size,
  fit: FitMode = 'contain',
): T {
  const m = mapping(natural, rendered, fit);
  const mx = (v: number) => v * m.scaleX + m.offsetX;
  const my = (v: number) => v * m.scaleY + m.offsetY;
  if ('x1' in item) {
    return { ...item, x1: mx(item.x1), y1: my(item.y1), x2: mx(item.x2), y2: my(item.y2) };
  }
  return { ...item, x: mx(item.x), y: my(item.y) };
}

/** Box as x, y, width, height (the form most drawing APIs want). */
export function toXYWH(box: Box): { label: string; x: number; y: number; width: number; height: number } {
  return { label: box.label, x: box.x1, y: box.y1, width: box.x2 - box.x1, height: box.y2 - box.y1 };
}
