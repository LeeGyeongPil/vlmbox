export type VlmboxErrorCode =
  | 'INVALID_IMAGE_SIZE'
  | 'UNKNOWN_MODEL'
  | 'INVALID_CONVENTION'
  | 'ASPECT_RATIO_TOO_LARGE';

/** Error thrown for invalid options. The message says how to fix the call. */
export class VlmboxError extends Error {
  readonly code: VlmboxErrorCode;

  constructor(code: VlmboxErrorCode, message: string) {
    super(message);
    this.name = 'VlmboxError';
    this.code = code;
  }
}
