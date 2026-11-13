import { extractJson } from './extract.js';
import { findItemArray } from './parsers/json-grounding.js';
import type { CustomConvention, ModelId, Size } from './types.js';

export type ConventionGuess = {
  guess: 'fraction-0-1' | 'normalized-0-1000' | 'absolute-pixels' | 'ambiguous';
  confidence: 'high' | 'low';
  reason: string;
};

/**
 * Guess what range raw coordinate values use. Value ranges alone are not conclusive:
 * absolute pixels of a resized frame (Qwen2.5-VL) can look exactly like 0-1000 values, so
 * the 0-1000 guess always has confidence "low". Prefer passing the model explicitly.
 */
export function guessConvention(values: number[], image: Size): ConventionGuess {
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length === 0) {
    return { guess: 'ambiguous', confidence: 'low', reason: 'no numeric values to inspect' };
  }
  const max = Math.max(...nums);
  if (max <= 1) {
    const fractional = nums.some((v) => !Number.isInteger(v));
    return {
      guess: 'fraction-0-1',
      confidence: fractional ? 'high' : 'low',
      reason: fractional
        ? `all values are within 0-1 (max ${max}) and some are fractional`
        : `all values are 0 or 1 (max ${max}); could also be tiny pixel values`,
    };
  }
  const longest = Math.max(image.width, image.height);
  if (max > 1000) {
    const fits = max <= longest * 1.1;
    return {
      guess: 'absolute-pixels',
      confidence: fits ? 'high' : 'low',
      reason: fits
        ? `max ${max} is above 1000 and fits the ${image.width}x${image.height} image`
        : `max ${max} is above 1000 but larger than the ${image.width}x${image.height} image`,
    };
  }
  if (image.width <= 1000 && image.height <= 1000) {
    return {
      guess: 'ambiguous',
      confidence: 'low',
      reason: `max ${max} fits both 0-1000 and pixels of a ${image.width}x${image.height} image`,
    };
  }
  return {
    guess: 'normalized-0-1000',
    confidence: 'low',
    reason: `max ${max} is at most 1000 while the image is ${image.width}x${image.height}; absolute pixels of a resized frame (Qwen2.5-VL) look the same`,
  };
}

export type Detection = {
  model: ModelId | CustomConvention;
  confidence: 'high' | 'low';
  reason: string;
};

function numbersIn(items: unknown[], keys: string[]): number[] {
  const out: number[] = [];
  for (const it of items) {
    if (typeof it !== 'object' || it === null) continue;
    for (const k of keys) {
      const v = (it as Record<string, unknown>)[k];
      if (Array.isArray(v)) out.push(...v.filter((n): n is number => typeof n === 'number'));
    }
  }
  return out;
}

/** Work out which convention a response uses from its shape (and, for Qwen JSON, its values). */
export function detectConvention(input: string | object, image: Size): Detection | null {
  let value: unknown = input;
  if (typeof input === 'string') {
    if (input.includes('<|box_start|>')) {
      return { model: 'qwen2-vl', confidence: 'high', reason: 'found <|box_start|> tokens (Qwen2-VL format)' };
    }
    if (/<loc\d{4}>/.test(input)) {
      return { model: 'paligemma', confidence: 'high', reason: 'found <locNNNN> tokens (PaliGemma format)' };
    }
    if (/<loc_\d+>/.test(input)) {
      return { model: 'florence-2', confidence: 'high', reason: 'found <loc_N> tokens (Florence-2 format)' };
    }
    const extracted = extractJson(input);
    if (!extracted) return null;
    value = extracted.value;
  }
  const arr = findItemArray(value, ['box_2d', 'bbox_2d', 'point_2d', 'x_min', 'x']);
  if (!arr) return null;
  const has = (key: string) => arr.some((it) => typeof it === 'object' && it !== null && key in it);
  if (has('box_2d')) {
    return { model: 'gemini', confidence: 'high', reason: 'items use the "box_2d" key (Gemini format, y first)' };
  }
  if (has('x_min') || has('x')) {
    return { model: 'moondream', confidence: 'high', reason: 'items use x_min/x_max or x/y fractions (Moondream format)' };
  }
  if (has('bbox_2d') || has('point_2d')) {
    const g = guessConvention(numbersIn(arr, ['bbox_2d', 'point_2d']), image);
    if (g.guess === 'absolute-pixels') {
      return { model: 'qwen2.5-vl', confidence: g.confidence, reason: g.reason };
    }
    if (g.guess === 'fraction-0-1') {
      return {
        model: { axis: 'xy', unit: 'normalized', scale: 1 },
        confidence: g.confidence,
        reason: g.reason,
      };
    }
    return { model: 'qwen3-vl', confidence: 'low', reason: g.reason };
  }
  return null;
}
