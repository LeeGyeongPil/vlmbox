/** Width and height in pixels. */
export type Size = { width: number; height: number };

/** A box in original-image pixels (x1,y1 = top-left, x2,y2 = bottom-right). */
export type Box = { label: string; x1: number; y1: number; x2: number; y2: number };

/** A point in original-image pixels. */
export type Point = { label: string; x: number; y: number };

export type ModelId =
  | 'gemini'
  | 'qwen2-vl'
  | 'qwen2.5-vl'
  | 'qwen3-vl'
  | 'paligemma'
  | 'florence-2'
  | 'moondream';

/** A user-defined coordinate convention for JSON responses (box_2d, bbox_2d, bbox, box, point_2d, point). */
export type CustomConvention = {
  /** Order of the numbers as written by the model. */
  axis: 'xy' | 'yx';
  /** "normalized" divides by `scale`; "pixel" uses `frame` (or the sent/original image) as the reference. */
  unit: 'pixel' | 'normalized';
  /** Range of normalized values (1000, 1, 1024, ...). Required when `unit` is "normalized". */
  scale?: number;
  /** Add 0.5 to every value before scaling (Florence-2 style bin centre). */
  binCenter?: boolean;
  /** Reference frame when `unit` is "pixel". */
  frame?: Size;
};

export type WarningCode =
  | 'truncated-json'
  | 'clamped'
  | 'swapped-corners'
  | 'guessed-convention'
  | 'frame-from-preset'
  | 'no-grounding-found'
  | 'skipped-item';

export type GroundingWarning = {
  code: WarningCode;
  message: string;
  detail?: Record<string, unknown>;
};

export type ResizePresetName = 'qwen2.5-vl' | 'qwen2-vl-processor-default' | 'qwen3-vl';

export type ResizeOptions = {
  factor: number;
  minPixels: number;
  maxPixels: number;
  /** "half-even" matches Python's round; "half-up" matches Math.round and is for comparison only. */
  rounding?: 'half-even' | 'half-up';
};

export type ParseOptions = {
  model: ModelId | 'auto' | CustomConvention;
  /** Original image size. Result coordinates are in this image's pixels. */
  image: Size;
  /** Size actually sent to the model if you shrank the image first. */
  sent?: Size;
  /** Rule used to compute the Qwen2.5-VL frame (default "qwen2.5-vl"). */
  resize?: ResizePresetName | ResizeOptions;
  /** Frame the model saw, set explicitly. Highest priority. */
  frame?: Size;
  /** Label for responses that carry none (Moondream). */
  label?: string;
  /** Clamp results to the image (default true). */
  clamp?: boolean;
};

export type GroundingResult = {
  boxes: Box[];
  points: Point[];
  warnings: GroundingWarning[];
  convention: {
    id: ModelId | 'custom';
    axis: 'xy' | 'yx';
    unit: string;
    frame: Size;
    guessed: boolean;
    confidence?: 'high' | 'low';
    reason?: string;
  };
};

export type FitMode = 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
