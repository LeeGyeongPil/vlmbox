import { describe, expect, it } from 'vitest';
import { example, TRUTH } from '../fixtures/index.js';
import { parseGrounding, VlmboxError } from '../src/index.js';
import type { ParseOptions, WarningCode } from '../src/index.js';

const image = TRUTH.image;
const gemini = (text: string | object, extra: Partial<ParseOptions> = {}) =>
  parseGrounding(text, { model: 'gemini', image, ...extra });
const codes = (r: { warnings: { code: WarningCode }[] }) => r.warnings.map((w) => w.code);

function errorCode(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof VlmboxError) return e.code;
    throw e;
  }
  return 'no error';
}

describe('response clean-up (AC-3)', () => {
  it('strips code fences and surrounding prose', () => {
    const r = gemini(example('gemini-noisy').text);
    expect(r.boxes.map((b) => b.label)).toEqual(['cat', 'cup']);
    expect(r.warnings).toEqual([]);
  });

  it('reads JSON without any fence', () => {
    const r = gemini('[{"box_2d": [250, 250, 750, 500], "label": "cat"}]');
    expect(r.boxes).toHaveLength(1);
  });

  it('unwraps {"boxes": [...]}', () => {
    const r = gemini(example('gemini-wrapped').text);
    expect(r.boxes.map((b) => b.label)).toEqual(['cat', 'cup']);
    expect(r.warnings).toEqual([]);
  });

  it('keeps complete items of a truncated response and warns', () => {
    const r = parseGrounding(example('qwen3-vl-truncated').text, { model: 'qwen3-vl', image });
    expect(r.boxes).toHaveLength(1);
    expect(r.boxes[0]).toMatchObject({ label: 'cat', x1: 480, y2: 810 });
    expect(codes(r)).toEqual(['truncated-json']);
  });

  it('truncation inside a string that contains brackets does not confuse the scanner', () => {
    const text = '[{"box_2d": [250, 250, 750, 500], "label": "a}]b"}, {"box_2d": [1, 2, 3, "label": "cut';
    const r = gemini(text);
    expect(r.boxes.map((b) => b.label)).toEqual(['a}]b']);
    expect(codes(r)).toEqual(['truncated-json']);
  });

  it('truncation inside the first item gives an empty result, not an error', () => {
    const r = gemini('```json\n[{"box_2d": [250, 25');
    expect(r.boxes).toEqual([]);
    expect(codes(r)).toEqual(['no-grounding-found']);
  });

  it('truncated {"boxes": [...]} wrapper is repaired too', () => {
    const r = gemini('{"boxes": [{"box_2d": [250, 250, 750, 500], "label": "cat"}, {"box_2d": [5');
    expect(r.boxes).toHaveLength(1);
    expect(codes(r)).toEqual(['truncated-json']);
  });
});

describe('fixing odd values (AC-3)', () => {
  it('clamps values outside the image and says which', () => {
    const r = gemini('[{"box_2d": [-10, 0, 1010, 1000], "label": "big"}]');
    expect(r.boxes[0]).toEqual({ label: 'big', x1: 0, y1: 0, x2: 1920, y2: 1080 });
    expect(codes(r)).toEqual(['clamped']);
    expect(String(r.warnings[0]?.detail?.from)).toContain('y2: 1090.8 -> 1080');
  });

  it('clamp: false keeps the raw values', () => {
    const r = gemini('[{"box_2d": [-10, 0, 1010, 1000], "label": "big"}]', { clamp: false });
    expect(r.boxes[0]?.y2).toBeCloseTo(1090.8, 6);
    expect(r.warnings).toEqual([]);
  });

  it('values exactly on the edge are not clamped', () => {
    const r = gemini('[{"box_2d": [0, 0, 1000, 1000], "label": "full"}]');
    expect(r.boxes[0]).toEqual({ label: 'full', x1: 0, y1: 0, x2: 1920, y2: 1080 });
    expect(r.warnings).toEqual([]);
  });

  it('swaps reversed corners', () => {
    const r = gemini('[{"box_2d": [750, 500, 250, 250], "label": "cat"}]');
    expect(r.boxes[0]).toEqual({ label: 'cat', x1: 480, y1: 270, x2: 960, y2: 810 });
    expect(codes(r)).toEqual(['swapped-corners']);
  });

  it('skips malformed items and keeps the rest', () => {
    const text = JSON.stringify([
      { box_2d: [1, 2, 3], label: 'short' },
      'junk',
      { label: 'no coordinates' },
      { box_2d: [250, 250, 750, 500], label: 'cat' },
    ]);
    const r = gemini(text);
    expect(r.boxes.map((b) => b.label)).toEqual(['cat']);
    expect(codes(r)).toEqual(['skipped-item', 'skipped-item', 'skipped-item']);
  });

  it('non-finite numbers in JSON never reach the result', () => {
    const r = gemini('[{"box_2d": [250, 250, 750, null], "label": "cat"}]');
    expect(r.boxes).toEqual([]);
    expect(codes(r)).toEqual(['skipped-item']);
  });
});

describe('nothing to read (AC-3)', () => {
  const cases: [string, ParseOptions['model'], string | object][] = [
    ['gemini', 'gemini', 'I could not find any cat in this image.'],
    ['qwen3-vl', 'qwen3-vl', ''],
    ['qwen2-vl', 'qwen2-vl', 'The picture shows a cat.'],
    ['paligemma', 'paligemma', 'cat'],
    ['florence-2', 'florence-2', '</s><s></s>'],
    ['moondream', 'moondream', 'no objects'],
    ['token format given an object', 'paligemma', { objects: [] }],
    ['a number', 'gemini', '42'],
  ];
  for (const [name, model, input] of cases) {
    it(`${name}: empty result with no-grounding-found, no throw`, () => {
      const r = parseGrounding(input, { model, image });
      expect(r.boxes).toEqual([]);
      expect(r.points).toEqual([]);
      expect(codes(r)).toEqual(['no-grounding-found']);
    });
  }

  it('an empty list is a valid answer: no boxes, no warning', () => {
    const r = gemini('[]');
    expect(r.boxes).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});

describe('option errors (AC-3)', () => {
  const text = example('gemini').text;
  it('invalid image sizes', () => {
    for (const bad of [{ width: 0, height: 10 }, { width: -1, height: 10 }, { width: NaN, height: 10 }, { width: Infinity, height: 10 }, null, undefined, { width: '10', height: 10 }]) {
      expect(errorCode(() => parseGrounding(text, { model: 'gemini', image: bad as never }))).toBe('INVALID_IMAGE_SIZE');
    }
  });

  it('invalid sent and frame sizes', () => {
    expect(errorCode(() => gemini(text, { sent: { width: 0, height: 1 } }))).toBe('INVALID_IMAGE_SIZE');
    expect(errorCode(() => gemini(text, { frame: { width: 1, height: -1 } }))).toBe('INVALID_IMAGE_SIZE');
  });

  it('unknown or missing model', () => {
    expect(errorCode(() => parseGrounding(text, { model: 'gpt-9' as never, image }))).toBe('UNKNOWN_MODEL');
    expect(errorCode(() => parseGrounding(text, { image } as never))).toBe('UNKNOWN_MODEL');
  });

  it('the unknown-model message lists the valid choices', () => {
    expect(() => parseGrounding(text, { model: 'gpt-9' as never, image })).toThrowError(/qwen2\.5-vl.*auto/);
  });

  it('invalid custom conventions', () => {
    const bad = [
      { axis: 'zz', unit: 'pixel' },
      { axis: 'xy', unit: 'furlongs' },
      { axis: 'xy', unit: 'normalized' },
      { axis: 'xy', unit: 'normalized', scale: -5 },
      { axis: 'xy', unit: 'pixel', frame: { width: 0, height: 1 } },
    ];
    for (const model of bad) {
      expect(errorCode(() => parseGrounding(text, { model: model as never, image }))).toBe('INVALID_CONVENTION');
    }
    expect(errorCode(() => parseGrounding(text, undefined as never))).toBe('INVALID_CONVENTION');
  });

  it('aspect ratio above 200 for qwen2.5-vl', () => {
    const t = example('qwen2.5-vl').text;
    expect(errorCode(() => parseGrounding(t, { model: 'qwen2.5-vl', image: { width: 20100, height: 100 } }))).toBe('ASPECT_RATIO_TOO_LARGE');
  });

  it('VlmboxError carries its name and code', () => {
    try {
      gemini(text, { image: { width: 0, height: 0 } });
    } catch (e) {
      expect((e as Error).name).toBe('VlmboxError');
      expect(e).toBeInstanceOf(Error);
    }
  });
});

describe('labels', () => {
  it('the label option fills in missing labels', () => {
    const r = parseGrounding('<loc0256><loc0256><loc0768><loc0512>', { model: 'paligemma', image, label: 'thing' });
    expect(r.boxes[0]?.label).toBe('thing');
  });

  it('florence-2 reuses the previous label for unlabeled boxes', () => {
    const r = parseGrounding('cat<loc_250><loc_250><loc_500><loc_750><loc_500><loc_500><loc_750><loc_750>', { model: 'florence-2', image });
    expect(r.boxes.map((b) => b.label)).toEqual(['cat', 'cat']);
  });
});
