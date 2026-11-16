import { describe, expect, test } from 'vitest';
import { parseGrounding } from '../src/index.js';

const image = { width: 1920, height: 1080 };

describe('gemini point and y/x/y2/x2 formats', () => {
  test('gemini reads {"point": [y, x]}', () => {
    const r = parseGrounding('[{"point": [500, 250], "label": "cat"}]', { model: 'gemini', image });
    expect(r.points).toHaveLength(1);
    expect(r.points[0]!.x).toBeCloseTo(480);
    expect(r.points[0]!.y).toBeCloseTo(540);
    expect(r.warnings.map((w) => w.code)).not.toContain('skipped-item');
  });

  test('gemini reads y/x/y2/x2 boxes', () => {
    const r = parseGrounding('[{"label":"cat","y":250,"x":250,"y2":750,"x2":500}]', { model: 'gemini', image });
    expect(r.boxes).toHaveLength(1);
    expect(r.boxes[0]!.x1).toBeCloseTo(480);
    expect(r.boxes[0]!.y1).toBeCloseTo(270);
    expect(r.boxes[0]!.x2).toBeCloseTo(960);
    expect(r.boxes[0]!.y2).toBeCloseTo(810);
  });

  test('non-numeric y/x/y2/x2 is skipped with a warning', () => {
    const r = parseGrounding('[{"label":"cat","y":"a","x":1,"y2":2,"x2":3}]', { model: 'gemini', image });
    expect(r.boxes).toHaveLength(0);
    expect(r.warnings.map((w) => w.code)).toContain('skipped-item');
  });

  test('auto recognizes y/x/y2/x2 as gemini', () => {
    const r = parseGrounding('[{"label":"cat","y":250,"x":250,"y2":750,"x2":500}]', { model: 'auto', image });
    expect(r.convention.id).toBe('gemini');
    expect(r.boxes).toHaveLength(1);
    expect(r.boxes[0]!.x2).toBeCloseTo(960);
  });

  test('auto recognizes point as gemini', () => {
    const r = parseGrounding('[{"point": [500, 250], "label": "cat"}]', { model: 'auto', image });
    expect(r.convention.id).toBe('gemini');
    expect(r.points[0]!.x).toBeCloseTo(480);
  });

  test('Moondream auto regression: points wrapper and bare x/y', () => {
    const a = parseGrounding('{"points":[{"x":0.25,"y":0.5}]}', { model: 'auto', image });
    expect(a.convention.id).toBe('moondream');
    expect(a.points[0]!.x).toBeCloseTo(480);
    expect(a.points[0]!.y).toBeCloseTo(540);
    const b = parseGrounding('[{"x":0.25,"y":0.5}]', { model: 'auto', image });
    expect(b.convention.id).toBe('moondream');
    const c = parseGrounding('[{"x_min":0.25,"y_min":0.25,"x_max":0.5,"y_max":0.75}]', { model: 'auto', image });
    expect(c.convention.id).toBe('moondream');
  });
});
