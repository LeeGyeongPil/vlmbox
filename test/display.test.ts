import { describe, expect, it } from 'vitest';
import { toDisplay, toXYWH } from '../src/index.js';
import type { Box, Point } from '../src/index.js';

const natural = { width: 1920, height: 1080 };
const cat: Box = { label: 'cat', x1: 480, y1: 270, x2: 960, y2: 810 };
const center: Point = { label: 'cat', x: 720, y: 540 };

function expectBox(got: Box, want: Partial<Box>) {
  for (const [k, v] of Object.entries(want)) {
    if (typeof v === 'number') expect(Math.abs((got as unknown as Record<string, number>)[k]! - v)).toBeLessThanOrEqual(0.01);
  }
}

describe('toDisplay object-fit (AC-5)', () => {
  const square = { width: 960, height: 960 };

  it('contain adds a letterbox: scale 0.5, top offset 210', () => {
    expectBox(toDisplay(cat, natural, square, 'contain'), { x1: 240, y1: 345, x2: 480, y2: 615 });
  });

  it('contain is the default', () => {
    expect(toDisplay(cat, natural, square)).toEqual(toDisplay(cat, natural, square, 'contain'));
  });

  it('cover crops the sides', () => {
    const s = 960 / 1080;
    const offsetX = (960 - 1920 * s) / 2;
    expectBox(toDisplay(cat, natural, square, 'cover'), { x1: 480 * s + offsetX, y1: 270 * s, x2: 960 * s + offsetX, y2: 810 * s });
  });

  it('fill stretches each axis on its own', () => {
    expectBox(toDisplay(cat, natural, square, 'fill'), { x1: 240, y1: 240, x2: 480, y2: 720 });
  });

  it('none keeps the natural size and centres it', () => {
    expectBox(toDisplay(cat, natural, square, 'none'), { x1: 0, y1: 210, x2: 480, y2: 750 });
  });

  it('scale-down behaves like contain when the image is larger than the box', () => {
    expect(toDisplay(cat, natural, square, 'scale-down')).toEqual(toDisplay(cat, natural, square, 'contain'));
  });

  it('scale-down never enlarges: in a bigger box it behaves like none', () => {
    const big = { width: 3000, height: 2000 };
    expect(toDisplay(cat, natural, big, 'scale-down')).toEqual(toDisplay(cat, natural, big, 'none'));
    expectBox(toDisplay(cat, natural, big, 'scale-down'), { x1: 1020, y1: 730 });
  });

  it('contain enlarges small images to fit', () => {
    expectBox(toDisplay(cat, natural, { width: 3840, height: 2160 }, 'contain'), { x1: 960, y1: 540, x2: 1920, y2: 1620 });
  });

  it('maps points and keeps extra fields', () => {
    const p = toDisplay(center, natural, { width: 960, height: 960 }, 'contain');
    expect(p).toEqual({ label: 'cat', x: 360, y: 480 });
  });

  it('does not change its input', () => {
    const copy = { ...cat };
    toDisplay(cat, natural, { width: 100, height: 100 }, 'cover');
    expect(cat).toEqual(copy);
  });
});

describe('toXYWH', () => {
  it('converts corners to size', () => {
    expect(toXYWH(cat)).toEqual({ label: 'cat', x: 480, y: 270, width: 480, height: 540 });
  });
});
