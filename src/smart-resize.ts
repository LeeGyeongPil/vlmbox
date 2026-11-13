import { VlmboxError } from './errors.js';
import { roundHalfEven } from './round.js';
import type { ResizeOptions, ResizePresetName, Size } from './types.js';

/**
 * Known resize rules. Values come from the public processor code and model configs:
 * - qwen2.5-vl: qwen-vl-utils defaults (also the model repo's preprocessor_config).
 * - qwen2-vl-processor-default: defaults of the transformers Qwen2VLImageProcessor class.
 * - qwen3-vl: Qwen3-VL preprocessor_config (patch 16 x merge 2).
 */
export const RESIZE_PRESETS: Record<ResizePresetName, ResizeOptions> = {
  'qwen2.5-vl': { factor: 28, minPixels: 3136, maxPixels: 12_845_056 },
  'qwen2-vl-processor-default': { factor: 28, minPixels: 3136, maxPixels: 1_003_520 },
  'qwen3-vl': { factor: 32, minPixels: 65_536, maxPixels: 16_777_216 },
};

export function isSize(value: unknown): value is Size {
  const s = value as Size | null;
  return (
    typeof s === 'object' &&
    s !== null &&
    Number.isFinite(s.width) &&
    Number.isFinite(s.height) &&
    s.width > 0 &&
    s.height > 0
  );
}

export function assertSize(value: unknown, name: string): asserts value is Size {
  if (!isSize(value)) {
    throw new VlmboxError(
      'INVALID_IMAGE_SIZE',
      `"${name}" must be { width, height } with positive finite numbers, got ${JSON.stringify(value)}.`,
    );
  }
}

/** Resolve a preset name or options object to complete options. */
export function resolveResize(rule: ResizePresetName | ResizeOptions): ResizeOptions {
  if (typeof rule === 'string') {
    const preset = RESIZE_PRESETS[rule];
    if (!preset) {
      throw new VlmboxError(
        'INVALID_CONVENTION',
        `Unknown resize preset "${rule}". Use one of: ${Object.keys(RESIZE_PRESETS).join(', ')} or pass { factor, minPixels, maxPixels }.`,
      );
    }
    return preset;
  }
  const { factor, minPixels, maxPixels } = rule ?? ({} as ResizeOptions);
  if (![factor, minPixels, maxPixels].every((v) => Number.isFinite(v) && v > 0)) {
    throw new VlmboxError(
      'INVALID_CONVENTION',
      'Resize options need positive finite numbers: { factor, minPixels, maxPixels }.',
    );
  }
  return rule;
}

/**
 * Reproduce the Qwen "smart resize": both sides become multiples of `factor` and the pixel
 * count stays within [minPixels, maxPixels]. Rounding matches Python (half to even) by default.
 */
export function smartResize(size: Size, rule: ResizePresetName | ResizeOptions): Size {
  assertSize(size, 'size');
  const opts = resolveResize(rule);
  const round = opts.rounding === 'half-up' ? Math.round : roundHalfEven;
  const { width: w, height: h } = size;
  const ratio = Math.max(w, h) / Math.min(w, h);
  if (ratio > 200) {
    throw new VlmboxError(
      'ASPECT_RATIO_TOO_LARGE',
      `Aspect ratio must be at most 200, got ${ratio.toFixed(1)} for ${w}x${h}. Crop or pad the image first.`,
    );
  }
  const { factor, minPixels, maxPixels } = opts;
  let hb = Math.max(factor, round(h / factor) * factor);
  let wb = Math.max(factor, round(w / factor) * factor);
  if (hb * wb > maxPixels) {
    const beta = Math.sqrt((h * w) / maxPixels);
    hb = Math.max(factor, Math.floor(h / beta / factor) * factor);
    wb = Math.max(factor, Math.floor(w / beta / factor) * factor);
  } else if (hb * wb < minPixels) {
    const beta = Math.sqrt(minPixels / (h * w));
    hb = Math.ceil((h * beta) / factor) * factor;
    wb = Math.ceil((w * beta) / factor) * factor;
  }
  return { width: wb, height: hb };
}
