import { describe, expect, it } from 'vitest';
import { RESIZE_PRESETS, smartResize, VlmboxError } from '../src/index.js';
import type { ResizePresetName } from '../src/index.js';
import ref from './smart-resize-ref.json';

type Ref = {
  presets: Record<string, { factor: number; minPixels: number; maxPixels: number }>;
  rows: Record<string, [number, number, number, number][]>;
};
const table = ref as unknown as Ref;

describe('smartResize vs the Python reference table (AC-2)', () => {
  it('presets match the generator', () => {
    for (const [name, p] of Object.entries(table.presets)) {
      expect(RESIZE_PRESETS[name as ResizePresetName]).toEqual(p);
    }
  });

  it('has 70,686 reference rows and none differ', () => {
    let total = 0;
    const mismatches: string[] = [];
    for (const [name, rows] of Object.entries(table.rows)) {
      for (const [w, h, rw, rh] of rows) {
        total++;
        const got = smartResize({ width: w, height: h }, name as ResizePresetName);
        if (got.width !== rw || got.height !== rh) mismatches.push(`${name} ${w}x${h}: ${got.width}x${got.height} != ${rw}x${rh}`);
      }
    }
    expect(total).toBe(70686);
    expect(mismatches.slice(0, 5)).toEqual([]);
    expect(mismatches).toHaveLength(0);
  });

  it('Math.round style rounding differs on many sizes (why half-even matters)', () => {
    let differ = 0;
    for (const [w, h] of table.rows['qwen2.5-vl'] ?? []) {
      const a = smartResize({ width: w, height: h }, 'qwen2.5-vl');
      const b = smartResize({ width: w, height: h }, { ...RESIZE_PRESETS['qwen2.5-vl'], rounding: 'half-up' });
      if (a.width !== b.width || a.height !== b.height) differ++;
    }
    expect(differ).toBeGreaterThan(0);
  });
});

describe('named cases', () => {
  it('1920x1080', () => {
    expect(smartResize({ width: 1920, height: 1080 }, 'qwen2.5-vl')).toEqual({ width: 1932, height: 1092 });
    expect(smartResize({ width: 1920, height: 1080 }, 'qwen2-vl-processor-default')).toEqual({ width: 1316, height: 728 });
    expect(smartResize({ width: 1920, height: 1080 }, 'qwen3-vl')).toEqual({ width: 1920, height: 1088 });
  });

  it('1918x1078 lands on a half multiple: half-even and half-up differ', () => {
    const size = { width: 1918, height: 1078 };
    expect(smartResize(size, 'qwen2.5-vl')).toEqual({ width: 1904, height: 1064 });
    expect(smartResize(size, { ...RESIZE_PRESETS['qwen2.5-vl'], rounding: 'half-up' })).toEqual({ width: 1932, height: 1092 });
  });

  it('tiny images are scaled up to the minimum', () => {
    const r = smartResize({ width: 10, height: 10 }, 'qwen2.5-vl');
    expect(r.width * r.height).toBeGreaterThanOrEqual(3136);
    expect(r.width % 28).toBe(0);
  });

  it('accepts custom options', () => {
    expect(smartResize({ width: 100, height: 100 }, { factor: 10, minPixels: 1, maxPixels: 1e9 })).toEqual({ width: 100, height: 100 });
  });
});

describe('errors', () => {
  it('aspect ratio above 200 throws ASPECT_RATIO_TOO_LARGE', () => {
    expect.assertions(2);
    try {
      smartResize({ width: 20100, height: 100 }, 'qwen2.5-vl');
    } catch (e) {
      expect(e).toBeInstanceOf(VlmboxError);
      expect((e as VlmboxError).code).toBe('ASPECT_RATIO_TOO_LARGE');
    }
  });

  it('aspect ratio exactly 200 is accepted', () => {
    expect(() => smartResize({ width: 20000, height: 100 }, 'qwen2.5-vl')).not.toThrow();
  });

  it('bad sizes and rules throw VlmboxError', () => {
    expect(() => smartResize({ width: 0, height: 10 }, 'qwen2.5-vl')).toThrowError(/positive/);
    expect(() => smartResize({ width: NaN, height: 10 }, 'qwen2.5-vl')).toThrow(VlmboxError);
    expect(() => smartResize({ width: 10, height: 10 }, { factor: 0, minPixels: 1, maxPixels: 2 })).toThrow(VlmboxError);
    expect(() => smartResize({ width: 10, height: 10 }, 'nope' as ResizePresetName)).toThrow(/Unknown resize preset/);
  });
});
