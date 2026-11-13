"""Regenerate test/smart-resize-ref.json (the Python reference table for smartResize).

Run: python3 -I scripts/gen-smart-resize-ref.py

Uses only the standard library. The arithmetic is the same as the public Qwen2-VL image
processor (transformers) and qwen-vl-utils: Python's built-in round() (half to even),
math.floor and math.ceil. Output rows are [width, height, resized_width, resized_height].
"""
import json
import math
import os

PRESETS = {
    "qwen2.5-vl": (28, 3136, 12845056),
    "qwen2-vl-processor-default": (28, 3136, 1003520),
    "qwen3-vl": (32, 65536, 16777216),
}


def smart_resize(height, width, factor, min_pixels, max_pixels):
    h_bar = max(factor, round(height / factor) * factor)
    w_bar = max(factor, round(width / factor) * factor)
    if h_bar * w_bar > max_pixels:
        beta = math.sqrt(height * width / max_pixels)
        h_bar = max(factor, math.floor(height / beta / factor) * factor)
        w_bar = max(factor, math.floor(width / beta / factor) * factor)
    elif h_bar * w_bar < min_pixels:
        beta = math.sqrt(min_pixels / (height * width))
        h_bar = math.ceil(height * beta / factor) * factor
        w_bar = math.ceil(width * beta / factor) * factor
    return h_bar, w_bar


# Sizes: a regular sweep plus common and edge sizes (several land exactly on half multiples).
SIZES = list(range(30, 4100, 7)) + [42, 70, 98, 126, 640, 1080, 1920, 3024, 4032, 48, 80, 112]


def main():
    out = {"presets": {}, "rows": {}}
    total = 0
    for name, (factor, lo, hi) in PRESETS.items():
        out["presets"][name] = {"factor": factor, "minPixels": lo, "maxPixels": hi}
        rows = []
        for w in SIZES[::3]:
            for h in SIZES[::5]:
                if max(w, h) / min(w, h) > 200:
                    continue
                rh, rw = smart_resize(h, w, factor, lo, hi)
                rows.append([w, h, rw, rh])
        out["rows"][name] = rows
        total += len(rows)
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "test", "smart-resize-ref.json")
    with open(path, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print("rows", total)


if __name__ == "__main__":
    main()
