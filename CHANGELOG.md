# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-13

### Added

- `parseGrounding` for Gemini, Qwen2-VL, Qwen2.5-VL, Qwen3-VL, PaliGemma, Florence-2 and Moondream
  responses, plus user-defined conventions and `model: 'auto'`.
- `smartResize` with three presets, matching Python's rounding (half to even), checked against a
  70,686-row reference table.
- `guessConvention`, `toDisplay`, `toXYWH` and `VlmboxError`.
- `vlmbox/react` with `GroundingOverlay` (SVG layer that follows object-fit and resizing).
- Practice-example responses, `examples/basic.mjs` and a bilingual (English / Korean) demo page.
