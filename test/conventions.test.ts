import { describe, expect, it } from 'vitest';
import { EXAMPLES, TRUTH, truthBoxes, example } from '../fixtures/index.js';
import { parseGrounding } from '../src/index.js';
import type { Box } from '../src/index.js';

const image = TRUTH.image;

function maxBoxError(got: Box[], want: Box[]): number {
  let max = 0;
  want.forEach((w, i) => {
    const g = got[i];
    if (!g) throw new Error(`missing box ${i}`);
    for (const k of ['x1', 'y1', 'x2', 'y2'] as const) max = Math.max(max, Math.abs(g[k] - w[k]));
  });
  return max;
}

describe('recorded-format examples map back to original pixels (AC-1)', () => {
  const boxExamples = EXAMPLES.filter((e) => e.expect !== 'points');
  for (const ex of boxExamples) {
    it(`${ex.id} -> boxes within tolerance`, () => {
      const r = parseGrounding(ex.text, { model: ex.model, image, label: 'cat' });
      const want = truthBoxes(ex);
      expect(r.boxes.map((b) => b.label)).toEqual(want.map((b) => b.label));
      // Florence-2 bin centres cannot hit the exact pixel: at most one bin (0.96 px here)
      const tolerance = ex.model === 'florence-2' ? 0.96 + 1e-9 : 0.01;
      expect(maxBoxError(r.boxes, want)).toBeLessThanOrEqual(tolerance);
      expect(r.points).toEqual([]);
    });
  }

  it('gemini cat box is exactly (480,270,960,810) and cup (960,540,1440,810)', () => {
    const r = parseGrounding(example('gemini').text, { model: 'gemini', image });
    expect(r.boxes).toEqual([
      { label: 'cat', x1: 480, y1: 270, x2: 960, y2: 810 },
      { label: 'cup', x1: 960, y1: 540, x2: 1440, y2: 810 },
    ]);
    expect(r.convention).toMatchObject({ id: 'gemini', axis: 'yx', unit: 'normalized-1000', guessed: false });
  });

  it('florence-2 reports the bin-centre positions', () => {
    const r = parseGrounding(example('florence-2').text, { model: 'florence-2', image });
    expect(r.boxes[0]?.x1).toBeCloseTo(480.96, 6);
    expect(r.boxes[0]?.y2).toBeCloseTo(810.54, 6);
  });

  it('qwen2.5-vl uses the smart-resized frame and says so', () => {
    const r = parseGrounding(example('qwen2.5-vl').text, { model: 'qwen2.5-vl', image });
    expect(r.convention.frame).toEqual({ width: 1932, height: 1092 });
    expect(r.warnings.map((w) => w.code)).toEqual(['frame-from-preset']);
  });

  it('qwen2.5-vl frame follows the `resize`, `sent` and `frame` options', () => {
    const text = example('qwen2.5-vl').text;
    const hf = parseGrounding(text, { model: 'qwen2.5-vl', image, resize: 'qwen2-vl-processor-default' });
    expect(hf.convention.frame).toEqual({ width: 1316, height: 728 });
    const sent = parseGrounding(text, { model: 'qwen2.5-vl', image, sent: { width: 960, height: 540 } });
    expect(sent.convention.frame).toEqual({ width: 952, height: 532 });
    const explicit = parseGrounding(text, { model: 'qwen2.5-vl', image, frame: { width: 1932, height: 1092 } });
    expect(explicit.warnings).toEqual([]);
    expect(explicit.boxes[0]).toMatchObject({ x1: 480, y1: 270 });
  });
});

describe('points', () => {
  const pointExamples = EXAMPLES.filter((e) => e.expect === 'points');
  expect(pointExamples.length).toBe(3);
  for (const ex of pointExamples) {
    it(`${ex.id} -> point (720,540)`, () => {
      const r = parseGrounding(ex.text, { model: ex.model, image, label: 'cat' });
      expect(r.boxes).toEqual([]);
      expect(r.points).toHaveLength(1);
      const p = r.points[0];
      expect(p?.label).toBe('cat');
      expect(Math.abs((p?.x ?? 0) - 720)).toBeLessThanOrEqual(0.01);
      expect(Math.abs((p?.y ?? 0) - 540)).toBeLessThanOrEqual(0.01);
    });
  }
});

describe('custom conventions', () => {
  it('y-first 0-1000 reads the Gemini example', () => {
    const r = parseGrounding(example('gemini').text, {
      model: { axis: 'yx', unit: 'normalized', scale: 1000 },
      image,
    });
    expect(r.convention.id).toBe('custom');
    expect(maxBoxError(r.boxes, TRUTH.boxes)).toBeLessThanOrEqual(0.01);
  });

  it('pixel convention with an explicit frame reads the Qwen2.5-VL example', () => {
    const r = parseGrounding(example('qwen2.5-vl').text, {
      model: { axis: 'xy', unit: 'pixel', frame: { width: 1932, height: 1092 } },
      image,
    });
    expect(maxBoxError(r.boxes, TRUTH.boxes)).toBeLessThanOrEqual(0.01);
    expect(r.warnings).toEqual([]);
  });

  it('bin centre can be switched on', () => {
    const r = parseGrounding('[{"box": [0, 0, 999, 999], "label": "a"}]', {
      model: { axis: 'xy', unit: 'normalized', scale: 1000, binCenter: true },
      image,
    });
    expect(r.boxes[0]?.x1).toBeCloseTo(0.96, 6);
    expect(r.boxes[0]?.x2).toBeCloseTo(1919.04, 6);
  });
});

describe('inputs that are already objects', () => {
  it('accepts a parsed Moondream response', () => {
    const r = parseGrounding(
      { objects: [{ x_min: 0.25, y_min: 0.25, x_max: 0.5, y_max: 0.75 }] },
      { model: 'moondream', image, label: 'cat' },
    );
    expect(r.boxes).toEqual([{ label: 'cat', x1: 480, y1: 270, x2: 960, y2: 810 }]);
  });
});
