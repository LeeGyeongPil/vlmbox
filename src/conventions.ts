import { VlmboxError } from './errors.js';
import { isSize } from './smart-resize.js';
import type { CustomConvention, ModelId, Size } from './types.js';

export type Format =
  | 'json-gemini'
  | 'json-qwen'
  | 'json-custom'
  | 'qwen2-tokens'
  | 'paligemma'
  | 'florence2'
  | 'moondream';

/** Everything needed to turn raw numbers into original pixels. */
export type Convention = {
  id: ModelId | 'custom';
  format: Format;
  /** Order of the numbers as written. */
  axis: 'xy' | 'yx';
  unit: 'pixel' | 'normalized';
  /** Normalized range (frame is scale x scale). Unused for pixel conventions. */
  scale: number;
  binCenter: boolean;
  /** Only for custom pixel conventions. */
  frame?: Size;
};

/** The convention table. Sources are listed in the README. */
export const CONVENTIONS: Record<ModelId, Convention> = {
  gemini: { id: 'gemini', format: 'json-gemini', axis: 'yx', unit: 'normalized', scale: 1000, binCenter: false },
  'qwen2-vl': { id: 'qwen2-vl', format: 'qwen2-tokens', axis: 'xy', unit: 'normalized', scale: 1000, binCenter: false },
  'qwen2.5-vl': { id: 'qwen2.5-vl', format: 'json-qwen', axis: 'xy', unit: 'pixel', scale: 1, binCenter: false },
  'qwen3-vl': { id: 'qwen3-vl', format: 'json-qwen', axis: 'xy', unit: 'normalized', scale: 1000, binCenter: false },
  paligemma: { id: 'paligemma', format: 'paligemma', axis: 'yx', unit: 'normalized', scale: 1024, binCenter: false },
  'florence-2': { id: 'florence-2', format: 'florence2', axis: 'xy', unit: 'normalized', scale: 1000, binCenter: true },
  moondream: { id: 'moondream', format: 'moondream', axis: 'xy', unit: 'normalized', scale: 1, binCenter: false },
};

export const MODEL_IDS = Object.keys(CONVENTIONS) as ModelId[];

/** Turn a model id or a user-defined convention into a validated Convention. */
export function resolveConvention(model: ModelId | CustomConvention): Convention {
  if (typeof model === 'string') {
    const found = (CONVENTIONS as Record<string, Convention | undefined>)[model];
    if (!found) {
      throw new VlmboxError(
        'UNKNOWN_MODEL',
        `Unknown model "${model}". Use one of: ${MODEL_IDS.join(', ')}, "auto", or a custom convention object.`,
      );
    }
    return found;
  }
  if (typeof model !== 'object' || model === null) {
    throw new VlmboxError('INVALID_CONVENTION', 'model must be a model id, "auto", or a custom convention object.');
  }
  if (model.axis !== 'xy' && model.axis !== 'yx') {
    throw new VlmboxError('INVALID_CONVENTION', 'Custom convention: axis must be "xy" or "yx".');
  }
  if (model.unit !== 'pixel' && model.unit !== 'normalized') {
    throw new VlmboxError('INVALID_CONVENTION', 'Custom convention: unit must be "pixel" or "normalized".');
  }
  if (model.unit === 'normalized' && !(typeof model.scale === 'number' && model.scale > 0 && Number.isFinite(model.scale))) {
    throw new VlmboxError(
      'INVALID_CONVENTION',
      'Custom convention: unit "normalized" needs a positive scale, e.g. { unit: "normalized", scale: 1000 }.',
    );
  }
  if (model.frame !== undefined && !isSize(model.frame)) {
    throw new VlmboxError('INVALID_CONVENTION', 'Custom convention: frame must be { width, height } with positive numbers.');
  }
  const conv: Convention = {
    id: 'custom',
    format: 'json-custom',
    axis: model.axis,
    unit: model.unit,
    scale: model.scale ?? 1,
    binCenter: model.binCenter === true,
  };
  if (model.frame) conv.frame = model.frame;
  return conv;
}
