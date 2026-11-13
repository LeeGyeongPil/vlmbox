# Practice examples

These files are **not live model output.** Each one was written by hand in the output format
that the model's public documentation describes. They all describe the same scene (a 1920x1080
image with a `cat` at x 480-960, y 270-810 and a `cup` at x 960-1440, y 540-810; see `truth.json`)
and were derived backwards from those boxes with each model's convention.

| File | Format source (checked 2026-11-13) |
|---|---|
| `gemini*.txt/json` | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/bounding-box-detection (`box_2d` = [ymin, xmin, ymax, xmax], 0-1000) |
| `qwen2-vl.txt` | Qwen2-VL box tokens `<\|box_start\|>(x1,y1),(x2,y2)<\|box_end\|>`, 0-1000 |
| `qwen2.5-vl*.txt` | https://github.com/QwenLM/Qwen3-VL/blob/main/cookbooks/2d_grounding.ipynb (absolute pixels of the resized input; frame 1932x1092 here) |
| `qwen3-vl*.txt` | same cookbook (0-1000 relative coordinates) |
| `paligemma.txt` | https://github.com/google-research/big_vision/blob/main/big_vision/configs/proj/paligemma/README.md (`<loc0000>`-`<loc1023>`, y first) |
| `florence-2.txt` | https://huggingface.co/microsoft/Florence-2-large/blob/main/processing_florence2.py (1000 bins, bin centre) |
| `moondream*.json` | https://moondream.ai/c/docs/advanced/api/detect and `/point` (0-1 fractions) |

Real outputs vary (extra keys, wording, spacing). If a real response is not read correctly,
please open an issue with the response text and the image size.
