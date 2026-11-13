// Run: npm run example   (builds dist/ first, then runs this file)
// Reads the practice examples in fixtures/ (hand-written in each model's documented output
// format, not live model output) and maps each one back to the same original-image pixels.
import { readFileSync } from 'node:fs';
import { parseGrounding } from '../dist/index.js';

const fixtures = new URL('../fixtures/', import.meta.url);
const read = (name) => readFileSync(new URL(name, fixtures), 'utf8');

const truth = JSON.parse(read('truth.json'));
const manifest = JSON.parse(read('manifest.json'));
const models = ['gemini', 'qwen2-vl', 'qwen2.5-vl', 'qwen3-vl', 'paligemma', 'florence-2', 'moondream'];

console.error(
  `Practice examples (not live model output), image ${truth.image.width}x${truth.image.height}:`,
);

for (const model of models) {
  // the first example of each model holds the cat (and, for most models, the cup)
  const entry = manifest.find((m) => m.id === model);
  const result = parseGrounding(read(`responses/${entry.file}`), {
    model,
    image: truth.image,
    label: 'cat', // Moondream answers carry no label
  });
  const cat = result.boxes.find((b) => b.label === 'cat');
  const f = (n) => n.toFixed(1);
  console.log(`${model.padEnd(11)} cat x1=${f(cat.x1)} y1=${f(cat.y1)} x2=${f(cat.x2)} y2=${f(cat.y2)}`);
}
