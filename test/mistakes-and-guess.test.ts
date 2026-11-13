import { describe, expect, it } from 'vitest';
import { EXAMPLES, example, truthBoxes, TRUTH } from '../fixtures/index.js';
import { guessConvention, parseGrounding } from '../src/index.js';
import type { Box, ParseOptions } from '../src/index.js';

const image = TRUTH.image;

/** Largest coordinate difference to the ground truth, in original pixels. */
function maxError(got: Box[], want: Box[]): number {
  let max = 0;
  want.forEach((w, i) => {
    const g = got[i];
    if (!g) throw new Error(`missing box ${i}`);
    for (const k of ['x1', 'y1', 'x2', 'y2'] as const) max = Math.max(max, Math.abs(g[k] - w[k]));
  });
  return max;
}

describe('common mistakes, reproduced by the real conversion (AC-4)', () => {
  it('Qwen2.5-VL absolute pixels read as 0-1000 are off by 894.7 px', () => {
    const r = parseGrounding(example('qwen2.5-vl').text, { model: 'qwen3-vl', image });
    expect(Math.abs(maxError(r.boxes, TRUTH.boxes) - 894.72)).toBeLessThan(0.1);
  });

  it('Gemini read as x-first is off by 480 px', () => {
    const xFirst: ParseOptions['model'] = { axis: 'xy', unit: 'normalized', scale: 1000 };
    const r = parseGrounding(example('gemini').text, { model: xFirst, image });
    expect(Math.abs(maxError(r.boxes, TRUTH.boxes) - 480)).toBeLessThan(0.01);
  });

  it('Qwen2.5-VL frame taken as the original image is off by 9 px', () => {
    const r = parseGrounding(example('qwen2.5-vl').text, { model: 'qwen2.5-vl', image, frame: image });
    expect(Math.abs(maxError(r.boxes, TRUTH.boxes) - 9)).toBeLessThan(0.01);
  });

  it('the right reading is exact', () => {
    const r = parseGrounding(example('qwen2.5-vl').text, { model: 'qwen2.5-vl', image });
    expect(maxError(r.boxes, TRUTH.boxes)).toBeLessThan(0.01);
  });
});

describe('model: "auto" (AC-4)', () => {
  const formatBased = EXAMPLES.filter((e) => !['qwen2.5-vl', 'qwen2.5-vl-points', 'qwen3-vl', 'qwen3-vl-points', 'qwen3-vl-truncated'].includes(e.id));
  for (const ex of formatBased) {
    it(`${ex.id}: detected as ${ex.model} with high confidence`, () => {
      const r = parseGrounding(ex.text, { model: 'auto', image, label: 'cat' });
      expect(r.convention.id).toBe(ex.model);
      expect(r.convention.guessed).toBe(true);
      expect(r.convention.confidence).toBe('high');
      expect(r.convention.reason).toBeTruthy();
      expect(r.warnings.map((w) => w.code)).toContain('guessed-convention');
      if (ex.expect !== 'points') expect(maxError(r.boxes, truthBoxes(ex))).toBeLessThan(1);
    });
  }

  it('Qwen2.5-VL pixel values above 1000 are recognised as pixels', () => {
    const r = parseGrounding(example('qwen2.5-vl').text, { model: 'auto', image });
    expect(r.convention.id).toBe('qwen2.5-vl');
    expect(r.convention.confidence).toBe('high');
    expect(maxError(r.boxes, TRUTH.boxes)).toBeLessThan(0.01);
  });

  it('the Qwen2.5-VL box [483,273,966,819] looks like 0-1000, so confidence is low', () => {
    const text = '[{"bbox_2d": [483, 273, 966, 819], "label": "cat"}]';
    const r = parseGrounding(text, { model: 'auto', image });
    expect(r.convention.guessed).toBe(true);
    expect(r.convention.confidence).toBe('low');
    expect(r.convention.reason).toMatch(/Qwen2\.5-VL/);
    const warning = r.warnings.find((w) => w.code === 'guessed-convention');
    expect(warning?.message).toContain('confidence low');
    // the guess is the 0-1000 reading, which is wrong here: the point of the "low" mark
    expect(r.convention.id).toBe('qwen3-vl');
  });

  it('fractions in bbox_2d become a custom 0-1 convention', () => {
    const r = parseGrounding('[{"bbox_2d": [0.25, 0.25, 0.5, 0.75], "label": "cat"}]', { model: 'auto', image });
    expect(r.convention.id).toBe('custom');
    expect(r.boxes[0]).toMatchObject({ x1: 480, y1: 270, x2: 960, y2: 810 });
  });

  it('nothing recognisable gives an empty low-confidence result', () => {
    const r = parseGrounding('hello', { model: 'auto', image });
    expect(r.boxes).toEqual([]);
    expect(r.convention).toMatchObject({ guessed: true, confidence: 'low' });
    expect(r.warnings.map((w) => w.code)).toEqual(['no-grounding-found']);
  });
});

describe('guessConvention', () => {
  it('fractions', () => {
    expect(guessConvention([0.1, 0.5, 0.9], image)).toMatchObject({ guess: 'fraction-0-1', confidence: 'high' });
    expect(guessConvention([0, 1], image)).toMatchObject({ guess: 'fraction-0-1', confidence: 'low' });
  });

  it('values above 1000 are pixels when they fit the image', () => {
    expect(guessConvention([10, 1500], image)).toMatchObject({ guess: 'absolute-pixels', confidence: 'high' });
    expect(guessConvention([10, 5000], image)).toMatchObject({ guess: 'absolute-pixels', confidence: 'low' });
  });

  it('values up to 1000 on a large image: 0-1000 with low confidence', () => {
    const g = guessConvention([100, 900], image);
    expect(g.guess).toBe('normalized-0-1000');
    expect(g.confidence).toBe('low');
    expect(g.reason).toContain('1920x1080');
  });

  it('small images make it ambiguous', () => {
    expect(guessConvention([100, 900], { width: 640, height: 480 })).toMatchObject({ guess: 'ambiguous', confidence: 'low' });
  });

  it('no numbers', () => {
    expect(guessConvention([], image).guess).toBe('ambiguous');
  });
});
