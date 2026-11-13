import { resolveConvention, type Convention } from './conventions.js';
import { VlmboxError } from './errors.js';
import { detectConvention } from './guess.js';
import { normalizeItems } from './normalize.js';
import { EMPTY, type ParsedItems } from './parsers/common.js';
import { parseFlorence2 } from './parsers/florence2.js';
import { parseJsonItems, type JsonKeys } from './parsers/json-grounding.js';
import { parseMoondream } from './parsers/moondream.js';
import { parsePaliGemma } from './parsers/paligemma.js';
import { parseQwen2Tokens } from './parsers/qwen2-tokens.js';
import { assertSize, resolveResize, smartResize } from './smart-resize.js';
import type { GroundingResult, GroundingWarning, ParseOptions, Size } from './types.js';

const JSON_KEYS: Record<'json-gemini' | 'json-qwen' | 'json-custom', JsonKeys> = {
  'json-gemini': { box: ['box_2d'], point: [] },
  'json-qwen': { box: ['bbox_2d'], point: ['point_2d'] },
  'json-custom': { box: ['bbox_2d', 'box_2d', 'bbox', 'box'], point: ['point_2d', 'point'] },
};

function readItems(input: string | object, conv: Convention, label: string): ParsedItems {
  switch (conv.format) {
    case 'json-gemini':
    case 'json-qwen':
    case 'json-custom':
      return parseJsonItems(input, JSON_KEYS[conv.format]);
    case 'moondream':
      return parseMoondream(input, label);
    default: {
      // Token formats are plain text; an object cannot hold them.
      if (typeof input !== 'string') return EMPTY;
      if (conv.format === 'qwen2-tokens') return parseQwen2Tokens(input, label);
      if (conv.format === 'paligemma') return parsePaliGemma(input, label);
      return parseFlorence2(input, label);
    }
  }
}

/** Decide which extent the model's numbers refer to. Order: frame option > Qwen2.5-VL resize > fixed range. */
function frameFor(conv: Convention, opts: ParseOptions, image: Size, warnings: GroundingWarning[]): Size {
  if (opts.frame !== undefined) {
    assertSize(opts.frame, 'frame');
    return opts.frame;
  }
  if (conv.id === 'qwen2.5-vl') {
    const rule = opts.resize ?? 'qwen2.5-vl';
    const base = opts.sent ?? image;
    const frame = smartResize(base, rule);
    warnings.push({
      code: 'frame-from-preset',
      message:
        `Frame ${frame.width}x${frame.height} was computed with the ${typeof rule === 'string' ? `"${rule}"` : 'custom'} resize rule. ` +
        'If your deployment resizes differently, pass `sent`, `resize` or `frame`.',
      detail: { frame, resize: resolveResize(rule), base },
    });
    return frame;
  }
  if (conv.unit === 'pixel') return conv.frame ?? opts.sent ?? image;
  return { width: conv.scale, height: conv.scale };
}

function emptyResult(image: Size, reason: string): GroundingResult {
  return {
    boxes: [],
    points: [],
    warnings: [
      { code: 'no-grounding-found', message: 'No boxes or points were found in the response.' },
    ],
    convention: { id: 'custom', axis: 'xy', unit: 'unknown', frame: image, guessed: true, confidence: 'low', reason },
  };
}

/**
 * Turn a model's raw grounding output into boxes and points in original-image pixels.
 * Throws VlmboxError only for invalid options; odd responses yield warnings instead.
 */
export function parseGrounding(input: string | object, options: ParseOptions): GroundingResult {
  if (typeof options !== 'object' || options === null) {
    throw new VlmboxError('INVALID_CONVENTION', 'parseGrounding needs options: { model, image }.');
  }
  const image = options.image;
  assertSize(image, 'image');
  if (options.sent !== undefined) assertSize(options.sent, 'sent');
  if (options.model === undefined) {
    throw new VlmboxError('UNKNOWN_MODEL', 'Missing `model`. Pass a model id, "auto", or a custom convention.');
  }

  const warnings: GroundingWarning[] = [];
  let guess: { confidence: 'high' | 'low'; reason: string } | null = null;
  let model = options.model;
  if (model === 'auto') {
    const found = detectConvention(input, image);
    if (!found) return emptyResult(image, 'no recognizable grounding structure in the response');
    model = found.model;
    guess = { confidence: found.confidence, reason: found.reason };
  }
  const conv = resolveConvention(model);
  if (guess) {
    warnings.push({
      code: 'guessed-convention',
      message: `Convention guessed as ${conv.id} (confidence ${guess.confidence}): ${guess.reason}. Pass \`model\` explicitly when you know it.`,
      detail: { guess: conv.id, ...guess },
    });
  }

  const frame = frameFor(conv, options, image, warnings);
  const label = options.label ?? '';
  const parsed = readItems(input, conv, label);
  warnings.push(...parsed.warnings);
  if (!parsed.found) {
    warnings.push({ code: 'no-grounding-found', message: 'No boxes or points were found in the response.' });
  }
  const out = normalizeItems(parsed.items, conv, frame, image, options.clamp !== false, label);
  warnings.push(...out.warnings);

  return {
    boxes: out.boxes,
    points: out.points,
    warnings,
    convention: {
      id: conv.id,
      axis: conv.axis,
      unit: conv.unit === 'pixel' ? 'pixel' : `normalized-${conv.scale}`,
      frame,
      guessed: guess !== null,
      ...(guess ? { confidence: guess.confidence, reason: guess.reason } : {}),
    },
  };
}
